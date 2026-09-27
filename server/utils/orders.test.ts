import { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { validateCheckout } from './catalog'
import type { ApipayInvoice } from './apipay'
import { applyApipayInvoice } from './apipaySync'
import { claimPending, confirmDelivery, createOrder, ensureSchema, markPaid, orderByToken, setProviderRef, type Db } from './orders'

function pgliteDb(pg: PGlite): Db {
  const wrap = (run: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>): Db => ({
    query: async <T>(text: string, params?: unknown[]) => (await run(text, params)).rows as T[],
    tx: <T>(fn: (q: Db) => Promise<T>) => pg.transaction((t) => fn(wrap((x, p) => t.query(x, p)))) as Promise<T>,
  })
  return wrap((x, p) => pg.query(x, p))
}

let db: Db
beforeEach(async () => {
  db = pgliteDb(new PGlite())
  await ensureSchema(db)
})

async function order(items: Array<{ slug: string; qty: number }>, nick = 'Notch', isTest = false) {
  const v = validateCheckout(nick, items)
  if (!v.ok) throw new Error(v.message)
  return { invId: (await createOrder(db, v.nick, v.lines, v.total, isTest)).invId, total: v.total }
}

describe('markPaid', () => {
  it('pays once and creates one delivery line per command', async () => {
    const { invId, total } = await order([{ slug: 'role-cat', qty: 1 }, { slug: 'claws-250', qty: 2 }])
    expect(total).toBe(1599 + 2 * 1250)
    expect(await markPaid(db, invId, `${total}.000000`, { a: 1 })).toBe('paid')
    const rows = await db.query<{ command: string }>('SELECT command FROM deliveries WHERE inv_id = $1 ORDER BY line_no', [invId])
    expect(rows.map((r) => r.command)).toEqual([
      'lp user {nick} parent addtemp cat 30d accumulate',
      expect.stringMatching(/^tellraw \{nick\} /),
      'claws deliver {nick} 250 wise-{delivery}',
      'claws deliver {nick} 250 wise-{delivery}',
    ])
  })

  it('a repeated notification does not create new deliveries', async () => {
    const { invId, total } = await order([{ slug: 'claws-100', qty: 1 }])
    await markPaid(db, invId, `${total}.00`, {})
    expect(await markPaid(db, invId, `${total}.00`, {})).toBe('already_paid')
    expect((await db.query('SELECT 1 FROM deliveries')).length).toBe(1)
  })

  it('rejects a wrong amount and unknown orders', async () => {
    const { invId } = await order([{ slug: 'role-premium', qty: 1 }])
    expect(await markPaid(db, invId, '1.00', {})).toBe('amount_mismatch')
    expect(await markPaid(db, 99999, '3799.00', {})).toBe('unknown_order')
    expect((await db.query("SELECT 1 FROM orders WHERE status = 'paid'")).length).toBe(0)
  })
})

describe('delivery queue', () => {
  it('claims pending lines once, confirms them, and requeues stuck claims', async () => {
    const { invId, total } = await order([{ slug: 'claws-500', qty: 1 }])
    await markPaid(db, invId, `${total}.00`, {})
    const first = await claimPending(db, 20, ['Notch'])
    expect(first).toHaveLength(1)
    expect(first[0]!.command).toBe('claws deliver {nick} 500 wise-{delivery}')
    expect(await claimPending(db, 20, ['Notch'])).toHaveLength(0)                  // уже захвачено

    // игрок не в сети: плагин не подтвердил — после таймаута строка снова в очереди
    await db.query("UPDATE deliveries SET claimed_at = now() - interval '5 minutes'")
    const again = await claimPending(db, 20, ['Notch'])
    expect(again.map((d) => d.id)).toEqual([first[0]!.id])

    expect(await confirmDelivery(db, again[0]!.id, true, null)).toBe(true)
    expect(await confirmDelivery(db, again[0]!.id, false, 'late failure')).toBe(true)   // done не откатывается
    const [row] = await db.query<{ status: string }>('SELECT status FROM deliveries')
    expect(row!.status).toBe('done')
    expect(await claimPending(db, 20, ['Notch'])).toHaveLength(0)
  })

  it('records a failure', async () => {
    const { invId, total } = await order([{ slug: 'claws-100', qty: 1 }])
    await markPaid(db, invId, `${total}.00`, {})
    const [d] = await claimPending(db, 20, ['Notch'])
    await confirmDelivery(db, d!.id, false, 'command not allowed: op')
    const [row] = await db.query<{ status: string; error: string }>('SELECT status, error FROM deliveries')
    expect(row).toEqual({ status: 'failed', error: 'command not allowed: op' })
  })

  it('unknown delivery id is reported', async () => {
    expect(await confirmDelivery(db, '00000000-0000-0000-0000-000000000000', true, null)).toBe(false)
  })
})

describe('test mode and online filter', () => {
  it('a test (IsTest) order is paid but never delivered', async () => {
    const { invId, total } = await order([{ slug: 'role-premium', qty: 20 }], 'Notch', true)
    expect(await markPaid(db, invId, `${total}.00`, {})).toBe('paid_test')
    expect((await db.query('SELECT 1 FROM deliveries')).length).toBe(0)
    expect(await markPaid(db, invId, `${total}.00`, {})).toBe('already_paid')
  })

  it('a test order is delivered only with allowTestDelivery (local bench)', async () => {
    const { invId, total } = await order([{ slug: 'claws-100', qty: 1 }], 'Notch', true)
    expect(await markPaid(db, invId, `${total}.00`, {}, { allowTestDelivery: true })).toBe('paid')
    expect((await db.query('SELECT 1 FROM deliveries')).length).toBe(1)
  })

  it('hands out only deliveries of online players, in line order', async () => {
    const a = await order([{ slug: 'role-cat', qty: 1 }], 'Online_1')
    const b = await order([{ slug: 'claws-100', qty: 1 }], 'Typo_nick')
    await markPaid(db, a.invId, `${a.total}.00`, {})
    await markPaid(db, b.invId, `${b.total}.00`, {})
    expect(await claimPending(db, 20, [])).toEqual([])
    const got = await claimPending(db, 20, ['online_1', 'SomeoneElse'])       // регистр ника не важен
    expect(got.map((d) => d.command)).toEqual([
      'lp user {nick} parent addtemp cat 30d accumulate',
      expect.stringMatching(/^tellraw /),
    ])
    const [typo] = await db.query<{ status: string; attempts: number }>("SELECT status, attempts FROM deliveries WHERE nick = 'Typo_nick'")
    expect(typo).toEqual({ status: 'pending', attempts: 0 })                // не тронута, очередь не забивает
  })
})

describe('ApiPay (Kaspi) orders', () => {
  async function kaspiOrder(isTest = false) {
    const v = validateCheckout('Notch', [{ slug: 'role-cat', qty: 1 }])
    if (!v.ok) throw new Error(v.message)
    const { invId, token } = await createOrder(db, v.nick, v.lines, v.total, isTest, 'apipay')
    await setProviderRef(db, invId, '555', 'processing')
    return { invId, token }
  }
  const paidInv = (over: Partial<ApipayInvoice> = {}): ApipayInvoice => ({ id: 555, amount: '1599.00', status: 'paid', external_order_id: undefined, is_sandbox: false, ...over })

  it('a paid Kaspi invoice pays the order once and queues delivery', async () => {
    const { invId } = await kaspiOrder()
    expect(await applyApipayInvoice(db, paidInv({ external_order_id: String(invId) }), { sandbox: false, allowTestDelivery: false })).toBe('paid')
    expect(await applyApipayInvoice(db, paidInv(), { sandbox: false, allowTestDelivery: false })).toBe('already_paid')
    expect((await db.query('SELECT 1 FROM deliveries')).length).toBe(2)          // lp + tellraw
  })

  it('a sandbox invoice never delivers, even for a live-mode order', async () => {
    await kaspiOrder()
    expect(await applyApipayInvoice(db, paidInv({ is_sandbox: true }), { sandbox: false, allowTestDelivery: false })).toBe('paid_test')
    expect((await db.query('SELECT 1 FROM deliveries')).length).toBe(0)
  })

  it('rejects wrong amount, unknown invoice and a mismatched order id; stores intermediate statuses', async () => {
    const { invId, token } = await kaspiOrder()
    expect(await applyApipayInvoice(db, paidInv({ amount: '1.00' }), { sandbox: false, allowTestDelivery: false })).toBe('amount_mismatch')
    expect(await applyApipayInvoice(db, paidInv({ id: 999 }), { sandbox: false, allowTestDelivery: false })).toBe('unknown_invoice')
    expect(await applyApipayInvoice(db, paidInv({ external_order_id: '12345' }), { sandbox: false, allowTestDelivery: false })).toBe('unknown_invoice')
    expect(await applyApipayInvoice(db, paidInv({ status: 'expired' }), { sandbox: false, allowTestDelivery: false })).toBe('status_saved')
    const view = await orderByToken(db, invId, token)
    expect(view).toMatchObject({ status: 'pending', provider: 'apipay', providerStatus: 'expired' })
    expect(await orderByToken(db, invId, '00000000-0000-0000-0000-000000000000')).toBeNull()
  })

  it('a Robokassa notification cannot pay a Kaspi order', async () => {
    const { invId } = await kaspiOrder()
    expect(await markPaid(db, invId, '1599.00', {}, { provider: 'robokassa' })).toBe('unknown_order')
  })
})
