import { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { validateCheckout } from './catalog'
import { claimPending, confirmDelivery, createOrder, ensureSchema, kaspiInvoicesToday, kaspiOrdersToSync, markPaid, openKaspiInvoicesForPhone, orderByToken, payPageState, setProviderRef, type Db } from './orders'

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
      'claws deliver {nick} 100 wise-{delivery}',
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
      'claws deliver {nick} 100 wise-{delivery}',
      expect.stringMatching(/^tellraw /),
    ])
    const [typo] = await db.query<{ status: string; attempts: number }>("SELECT status, attempts FROM deliveries WHERE nick = 'Typo_nick'")
    expect(typo).toEqual({ status: 'pending', attempts: 0 })                // не тронута, очередь не забивает
  })
})

describe('Kaspi (kaspipos) orders', () => {
  async function kaspiOrder(ref: string | null = '555', hash = 'hash-1') {
    const v = validateCheckout('Notch', [{ slug: 'role-cat', qty: 1 }])
    if (!v.ok) throw new Error(v.message)
    const { invId, token } = await createOrder(db, v.nick, v.lines, v.total, false, 'kaspipos', hash)
    if (ref) await setProviderRef(db, invId, ref, 'pending')
    return { invId, token }
  }

  it('a Robokassa notification cannot pay a Kaspi order', async () => {
    const { invId } = await kaspiOrder()
    expect(await markPaid(db, invId, '1599.00', {}, { provider: 'robokassa' })).toBe('unknown_order')
    expect((await db.query('SELECT 1 FROM deliveries')).length).toBe(0)
  })

  it('counts open Kaspi invoices per phone hash and per day', async () => {
    await kaspiOrder('1')
    await kaspiOrder('2')
    expect(await openKaspiInvoicesForPhone(db, 'hash-1')).toBe(2)
    expect(await openKaspiInvoicesForPhone(db, 'other')).toBe(0)
    await db.query("UPDATE orders SET provider_status = 'expired' WHERE provider_ref = '1'")
    expect(await openKaspiInvoicesForPhone(db, 'hash-1')).toBe(1)
    expect(await kaspiInvoicesToday(db)).toBe(2)
    // карта (Robokassa) в лимиты Kaspi не входит
    await order([{ slug: 'role-cat', qty: 1 }])
    expect(await kaspiInvoicesToday(db)).toBe(2)
  })
})

describe('pending order of a disabled provider (old rows in the DB)', () => {
  // провайдер, которого больше нет в коде: такие строки остались в orders с прежних времён
  async function legacyOrder(status = 'pending', providerStatus: string | null = 'pending') {
    const v = validateCheckout('Notch', [{ slug: 'role-cat', qty: 1 }])
    if (!v.ok) throw new Error(v.message)
    const { invId, token } = await createOrder(db, v.nick, v.lines, v.total, false, 'kaspipos', 'hash-1')
    await db.query('UPDATE orders SET provider = $2, provider_ref = $3, provider_status = $4, status = $5 WHERE inv_id = $1',
      [invId, 'apipay', String(900 + invId), providerStatus, status])
    return { invId, token }
  }

  it('is shown as finished (failed/expired), not as waiting forever', async () => {
    const { invId, token } = await legacyOrder()
    const view = (await orderByToken(db, invId, token))!
    expect(view).toMatchObject({ status: 'pending', provider: 'apipay' })
    expect(await orderByToken(db, invId, '00000000-0000-0000-0000-000000000000')).toBeNull()
    expect(payPageState(view)).toEqual({ state: 'failed', providerStatus: 'expired', legacy: true })
    // без статуса у провайдера — тоже завершён
    expect(payPageState({ ...view, providerStatus: null })).toEqual({ state: 'failed', providerStatus: 'expired', legacy: true })
  })

  it('a paid or refunded old order keeps its real state', async () => {
    const paid = await legacyOrder('paid', 'paid')
    expect(payPageState((await orderByToken(db, paid.invId, paid.token))!)).toMatchObject({ state: 'paid', legacy: true })
    const refunded = await legacyOrder('refunded', 'paid')
    expect(payPageState((await orderByToken(db, refunded.invId, refunded.token))!)).toMatchObject({ state: 'refunded', legacy: true })
  })

  it('is not reconciled and does not count against Kaspi limits', async () => {
    await legacyOrder()
    expect(await kaspiOrdersToSync(db)).toEqual([])
    expect(await openKaspiInvoicesForPhone(db, 'hash-1')).toBe(0)
    expect(await kaspiInvoicesToday(db)).toBe(0)
  })

  it('kaspipos orders: waiting and failed states are unchanged', () => {
    const k = { status: 'pending', provider: 'kaspipos' }
    expect(payPageState({ ...k, providerStatus: 'pending' })).toEqual({ state: 'pending', providerStatus: 'pending', legacy: false })
    expect(payPageState({ ...k, providerStatus: null })).toEqual({ state: 'pending', providerStatus: null, legacy: false })
    expect(payPageState({ ...k, providerStatus: 'unknown' })).toMatchObject({ state: 'pending' })
    for (const st of ['cancelled', 'expired', 'error', 'lost']) {
      expect(payPageState({ ...k, providerStatus: st })).toEqual({ state: 'failed', providerStatus: st, legacy: false })
    }
  })
})
