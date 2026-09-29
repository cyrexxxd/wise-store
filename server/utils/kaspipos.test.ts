import { createHash, createVerify, generateKeyPairSync } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { beforeEach, describe, expect, it } from 'vitest'
import { validateCheckout } from './catalog'
import {
  almatyIso, checkSession, commentPrefix, computeTokenSnMac, computeXSign, createRemoteInvoice, findInvoiceByComment, getRemoteInvoice,
  invoiceDescription, KaspiPosError, kaspiPhone, mapStatus, parseKzt, publicKeyInfo, signedHeaders, type FetchFn, type KaspiPosConfig,
} from './kaspipos'
import { applyKaspiPosInvoice, syncKaspiPosOrder } from './kaspiposSync'
import { claimPending, confirmDelivery, createOrder, ensureSchema, kaspiInvoicesToday, kaspiOrdersToSync, kaspiposPaidUndelivered, openKaspiInvoicesForPhone, setProviderRef, setProviderStatus, type Db } from './orders'

const key = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const cfg: KaspiPosConfig = {
  deviceId: 'DEV', installId: 'INST', privateKey: key.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  tokenSn: 'TSN12345', secretHex: '0123456789abcdef0123456789abcdef', profileId: '1000001', appVersion: '26.0921', appBuild: '1115',
  baseUrl: 'https://kaspi.test',
}

/// Мок Kaspi: отвечает по пути, записывает запросы.
function mockKaspi(routes: Record<string, (body: unknown) => { status?: number; json: unknown }>) {
  const calls: Array<{ url: string; method: string; headers: Record<string, string>; body?: string }> = []
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({ url, ...init })
    const path = new URL(url).pathname
    const route = routes[path]
    if (!route) return { status: 404, json: async () => ({}) }
    const r = route(init.body ? JSON.parse(init.body) : undefined)
    return { status: r.status ?? 200, json: async () => r.json }
  }
  return { fetchFn, calls }
}
const ok = (Data: unknown) => ({ json: { StatusCode: 0, Message: 'OK', Data } })

describe('signing', () => {
  it('tokenSnMac is 6 digits, stable within 30 s and changes with the time step', () => {
    const secret = Buffer.from(cfg.secretHex, 'hex')
    const t = 1_790_000_010_000
    const a = computeTokenSnMac('TSN12345', secret, t)
    expect(a).toMatch(/^\d{6}$/)
    expect(computeTokenSnMac('TSN12345', secret, t + 5_000)).toBe(a)
    expect(computeTokenSnMac('TSN12345', secret, t + 30_000)).not.toBe(a)
    expect(computeTokenSnMac('TSN12345', null, t)).toBe('000000')
  })

  it('X-Sign verifies with the device public key over the listed headers and body', () => {
    const h = { 'X-A': '1', 'X-B': 'two' }
    const sig = computeXSign(cfg.privateKey, 'https://Kaspi.test/Path', h, 'url,X-A,X-B', '{"x":1}')
    const digest = createHash('sha256').update('url:https://kaspi.test/path\nx-a:1\nx-b:two\n{"x":1}', 'utf8').digest()
    const v = createVerify('SHA256')
    v.update(digest)
    expect(v.verify(key.publicKey, Buffer.from(sig, 'base64'))).toBe(true)
  })

  it('signed headers carry the session and a valid signature; time is Almaty +0500', () => {
    const h = signedHeaders(cfg, 'https://kaspi.test/v01/remote/create', '{}', new Date('2026-09-28T18:34:10.123Z'))
    expect(h['X-Kb-TokenSn']).toBe('TSN12345')
    expect(h['X-PI']).toBe('1000001')
    expect(h['X-Time']).toBe('2026-09-28T23:34:10.123+0500')
    expect(h['Content-Type']).toBe('application/json')
    expect(h['X-Sign']).toBeTruthy()
    expect(almatyIso(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01T05:00:00.000+0500')
  })

  it('public key info: 65-byte point and md5 tag', () => {
    const info = publicKeyInfo(cfg.privateKey)
    expect(Buffer.from(info.pk, 'base64').length).toBe(65)
    expect(info.pkTag).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('parsing', () => {
  it('maps Kaspi statuses; unknown stays unknown, not failed', () => {
    expect(mapStatus('RemotePaymentCreated')).toBe('pending')
    expect(mapStatus('Processed')).toBe('paid')
    expect(mapStatus('RemotePaymentRejected')).toBe('cancelled')
    expect(mapStatus('RemotePaymentCanceled')).toBe('cancelled')
    expect(mapStatus('Expired')).toBe('expired')
    expect(mapStatus('SomethingNew')).toBe('unknown')
  })

  it('parses display amounts', () => {
    expect(parseKzt(' 3 799 ₸')).toBe(3799)
    expect(parseKzt('- 100 ₸')).toBe(100)
    expect(parseKzt('0 ₸')).toBe(0)
    expect(parseKzt('500,00 ₸')).toBe(500)
    expect(parseKzt('1 250.5 ₸')).toBe(1250)
    expect(parseKzt(undefined)).toBeNull()
  })

  it('phone 8XXXXXXXXXX → 7XXXXXXXXXX', () => {
    expect(kaspiPhone('87001234567')).toBe('77001234567')
    expect(() => kaspiPhone('7001234567')).toThrow()
  })
})

describe('API client', () => {
  it('creates an invoice with phone, amount and comment', async () => {
    const m = mockKaspi({ '/v01/remote/create': () => ok({ QrOperationId: 17827683513 }) })
    const id = await createRemoteInvoice(cfg, m.fetchFn, { phone8: '87001234567', kzt: 500, comment: 'Wise Store #7: 100 Когтей' })
    expect(id).toBe(17827683513)
    expect(JSON.parse(m.calls[0]!.body!)).toEqual({ PhoneNumber: '77001234567', Amount: 500, Comment: 'Wise Store #7: 100 Когтей' })
    expect(m.calls[0]!.headers['X-Sign']).toBeTruthy()
  })

  it('session eviction (-101001, HTTP 200 without Data) is sessionDead', async () => {
    const m = mockKaspi({ '/v01/remote/create': () => ({ json: { StatusCode: -101001, Message: 'Был выполнен вход с другого устройства' } }) })
    const err = await createRemoteInvoice(cfg, m.fetchFn, { phone8: '87001234567', kzt: 500, comment: 'x' }).catch((e) => e)
    expect(err).toBeInstanceOf(KaspiPosError)
    expect(err.sessionDead).toBe(true)
  })

  it('a wrong one-time code (-10001) is sessionDead too', async () => {
    const m = mockKaspi({ '/v02/remote/details': () => ({ json: { StatusCode: -10001, Message: 'Ошибка' } }) })
    const err = await getRemoteInvoice(cfg, m.fetchFn, 5).catch((e) => e)
    expect(err.sessionDead).toBe(true)
  })

  it('checkSession: "purchase not found" means the session is alive; -101001 means dead', async () => {
    const alive = mockKaspi({ '/v02/remote/details': () => ({ json: { StatusCode: -99000001, Message: 'Покупка не найдена', Data: {} } }) })
    await expect(checkSession(cfg, alive.fetchFn)).resolves.toBeUndefined()
    const dead = mockKaspi({ '/v02/remote/details': () => ({ json: { StatusCode: -101001, Message: 'Был выполнен вход с другого устройства' } }) })
    expect((await checkSession(cfg, dead.fetchFn).catch((e) => e)).sessionDead).toBe(true)
  })

  it('a business error is a definitive rejection, not sessionDead', async () => {
    const m = mockKaspi({ '/v01/remote/create': () => ({ json: { StatusCode: -1, Message: 'Клиент не найден' } }) })
    const err = await createRemoteInvoice(cfg, m.fetchFn, { phone8: '87001234567', kzt: 500, comment: 'x' }).catch((e) => e)
    expect(err.sessionDead).toBe(false)
    expect(err.definitiveRejection).toBe(true)
  })

  it('5xx, an unparsable body and success without an invoice number are NOT definitive (the invoice may exist)', async () => {
    for (const r of [{ status: 502, json: {} }, { json: 'oops' }, { json: { StatusCode: 0, Data: {} } }]) {
      const m = mockKaspi({ '/v01/remote/create': () => r as { status?: number; json: unknown } })
      const err = await createRemoteInvoice(cfg, m.fetchFn, { phone8: '87001234567', kzt: 500, comment: 'x' }).catch((e) => e)
      expect(err).toBeInstanceOf(KaspiPosError)
      expect(err.definitiveRejection).toBe(false)
      expect(err.sessionDead).toBe(false)
    }
  })

  it('OldVersionToUpdate hides Kaspi like a dead session', async () => {
    const m = mockKaspi({ '/v01/remote/create': () => ({ json: { StatusCode: -1, view: { onOpenAlarm: { error: { code: 'OldVersionToUpdate', label: 'Обновите приложение, чтобы войти' } } } } }) })
    const err = await createRemoteInvoice(cfg, m.fetchFn, { phone8: '87001234567', kzt: 500, comment: 'x' }).catch((e) => e)
    expect(err.sessionDead).toBe(true)
    expect(err.definitiveRejection).toBe(false)
  })

  it('reads invoice details with returns', async () => {
    const m = mockKaspi({ '/v02/remote/details': () => ok({ Id: 5, Status: 'Processed', Amount: '100 ₸', TotalReturnsAmount: '100 ₸' }) })
    expect(await getRemoteInvoice(cfg, m.fetchFn, 5)).toEqual({ id: 5, rawStatus: 'Processed', status: 'paid', amountKzt: 100, returnedKzt: 100 })
  })

  it('finds an invoice by comment prefix: open ones first, then today\'s sales; #12 does not match #123', async () => {
    const m = mockKaspi({
      '/v01/remote/history': () => ok({ Operations: [{ Id: 1, Comment: 'Wise Store #123: A' }] }),
      '/v02/history/operations': () => ok({ DailySets: [{ Operations: [{ Id: 2, Comment: 'Wise Store #12: B' }] }] }),
    })
    expect(await findInvoiceByComment(cfg, m.fetchFn, commentPrefix(123))).toBe(1)
    expect(await findInvoiceByComment(cfg, m.fetchFn, commentPrefix(12))).toBe(2)
    expect(await findInvoiceByComment(cfg, m.fetchFn, commentPrefix(1))).toBeNull()
  })

  it('invoice description starts with the comment prefix the lost-invoice search looks for (reference values)', () => {
    expect(invoiceDescription(42, '100 Когтей')).toBe('Wise Store #42: 100 Когтей')
    // обрезка до 60 символов — как было
    expect(invoiceDescription(123456, 'Роль Premium x1, Кейс косметики x3, Ключ x10, ещё кое-что'))
      .toBe('Wise Store #123456: Роль Premium x1, Кейс косметики x3, Ключ')
    for (const id of [1, 12, 123, 99999999]) expect(invoiceDescription(id, 'x'.repeat(200)).startsWith(commentPrefix(id))).toBe(true)
    expect(invoiceDescription(7, 'Роль CAT')).toBe('Wise Store #7: Роль CAT')
  })
})

// ─── применение статусов к заказам (PGlite — настоящий Postgres) ───

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

async function kaspiOrder(slug = 'claws-100', ref: string | null = '777', hash = 'h1') {
  const v = validateCheckout('Notch', [{ slug, qty: 1 }])
  if (!v.ok) throw new Error(v.message)
  const o = await createOrder(db, v.nick, v.lines, v.total, false, 'kaspipos', hash)
  if (ref) await setProviderRef(db, o.invId, ref, 'pending')
  return { ...o, total: v.total }
}
const inv = (over: Partial<{ id: number; rawStatus: string; status: 'pending' | 'paid' | 'cancelled' | 'expired' | 'unknown'; amountKzt: number | null; returnedKzt: number }> = {}) =>
  ({ id: 777, rawStatus: 'Processed', status: 'paid' as const, amountKzt: 500, returnedKzt: 0, ...over })
const opts = { allowTestDelivery: false }

describe('applyKaspiPosInvoice', () => {
  it('a paid invoice pays the order once and queues delivery', async () => {
    const o = await kaspiOrder()
    expect(await applyKaspiPosInvoice(db, inv({ amountKzt: o.total }), opts)).toBe('paid')
    expect(await applyKaspiPosInvoice(db, inv({ amountKzt: o.total }), opts)).toBe('already_paid')
    expect((await db.query('SELECT 1 FROM deliveries WHERE inv_id = $1', [o.invId])).length).toBe(1)
  })

  it('a wrong amount does not pay', async () => {
    await kaspiOrder()
    expect(await applyKaspiPosInvoice(db, inv({ amountKzt: 1 }), opts)).toBe('amount_mismatch')
  })

  it('a full return refunds the order and cancels undelivered lines', async () => {
    const o = await kaspiOrder()
    await applyKaspiPosInvoice(db, inv({ amountKzt: o.total }), opts)
    expect(await applyKaspiPosInvoice(db, inv({ amountKzt: o.total, returnedKzt: o.total }), opts)).toBe('refunded')
    expect((await db.query<{ status: string }>('SELECT status FROM orders WHERE inv_id = $1', [o.invId]))[0]!.status).toBe('refunded')
    expect((await db.query<{ status: string }>('SELECT status FROM deliveries WHERE inv_id = $1', [o.invId]))[0]!.status).toBe('failed')
  })

  it('a paid order with undelivered lines is re-checked for a refund until it is refunded', async () => {
    const o = await kaspiOrder()
    await applyKaspiPosInvoice(db, inv({ amountKzt: o.total }), opts)
    expect(await kaspiposPaidUndelivered(db)).toEqual([{ invId: o.invId, providerRef: '777' }])
    await applyKaspiPosInvoice(db, inv({ amountKzt: o.total, returnedKzt: o.total }), opts)
    expect(await kaspiposPaidUndelivered(db)).toEqual([])
  })

  it('a rejected kaspipos order leaves the sync list (final at Kaspi)', async () => {
    const o = await kaspiOrder()
    await applyKaspiPosInvoice(db, inv({ status: 'cancelled', rawStatus: 'RemotePaymentRejected' }), opts)
    expect((await kaspiOrdersToSync(db)).map((x) => x.invId)).not.toContain(o.invId)
  })

  it('a partial return is saved once as partially_refunded and the order stays paid', async () => {
    const o = await kaspiOrder()
    await applyKaspiPosInvoice(db, inv({ amountKzt: o.total }), opts)
    expect(await applyKaspiPosInvoice(db, inv({ amountKzt: o.total, returnedKzt: 100 }), opts)).toBe('already_paid')
    const row = (await db.query<{ status: string; provider_status: string }>('SELECT status, provider_status FROM orders WHERE inv_id = $1', [o.invId]))[0]!
    expect(row).toEqual({ status: 'paid', provider_status: 'partially_refunded' })
  })

  it('a line delivered after the refund cancelled it is recorded, not hidden', async () => {
    const o = await kaspiOrder()
    await applyKaspiPosInvoice(db, inv({ amountKzt: o.total }), opts)
    const [line] = await claimPending(db, 10, ['Notch'])
    await applyKaspiPosInvoice(db, inv({ amountKzt: o.total, returnedKzt: o.total }), opts)
    expect(await confirmDelivery(db, line!.id, true, null)).toBe(true)
    const d = (await db.query<{ status: string; error: string }>('SELECT status, error FROM deliveries WHERE id = $1', [line!.id]))[0]!
    expect(d).toEqual({ status: 'done', error: 'delivered after refund' })
  })

  it('rejection saves cancelled; unknown status keeps the order pending', async () => {
    const o = await kaspiOrder()
    expect(await applyKaspiPosInvoice(db, inv({ status: 'unknown', rawStatus: 'X' }), opts)).toBe('status_saved')
    expect(await applyKaspiPosInvoice(db, inv({ status: 'cancelled', rawStatus: 'RemotePaymentRejected' }), opts)).toBe('status_saved')
    const row = (await db.query<{ status: string; provider_status: string }>('SELECT status, provider_status FROM orders WHERE inv_id = $1', [o.invId]))[0]!
    expect(row).toEqual({ status: 'pending', provider_status: 'cancelled' })
  })

  it('an order of another provider is not touched by a kaspipos invoice with the same number', async () => {
    const v = validateCheckout('Notch', [{ slug: 'claws-100', qty: 1 }])
    if (!v.ok) throw new Error(v.message)
    const a = await createOrder(db, v.nick, v.lines, v.total, false, 'robokassa')
    await setProviderRef(db, a.invId, '777', 'pending')
    expect(await applyKaspiPosInvoice(db, inv({ amountKzt: v.total }), opts)).toBe('unknown_invoice')
  })
})

describe('syncKaspiPosOrder', () => {
  it('a lost invoice is found by comment, linked and paid', async () => {
    const o = await kaspiOrder('claws-100', null)
    const m = mockKaspi({
      '/v01/remote/history': () => ok({ Operations: [] }),
      '/v02/history/operations': () => ok({ DailySets: [{ Operations: [{ Id: 999, Comment: `Wise Store #${o.invId}: 100 Когтей` }] }] }),
      '/v02/remote/details': () => ok({ Id: 999, Status: 'Processed', Amount: `${o.total} ₸`, TotalReturnsAmount: '0 ₸' }),
    })
    expect(await syncKaspiPosOrder(db, cfg, m.fetchFn, { invId: o.invId, providerRef: null, ageSeconds: 30 }, opts)).toBe('paid')
    expect((await db.query<{ provider_ref: string }>('SELECT provider_ref FROM orders WHERE inv_id = $1', [o.invId]))[0]!.provider_ref).toBe('999')
  })

  it('not found for 10 minutes → lost, but the order stays in the sync list and is found later', async () => {
    const o = await kaspiOrder('claws-100', null)
    let paidOps: Array<{ Id: number; Comment: string }> = []
    const m = mockKaspi({
      '/v01/remote/history': () => ok({ Operations: [] }),
      '/v02/history/operations': () => ok({ DailySets: [{ Operations: paidOps }] }),
      '/v02/remote/details': () => ok({ Id: 42, Status: 'Processed', Amount: `${o.total} ₸`, TotalReturnsAmount: '0 ₸' }),
    })
    expect(await syncKaspiPosOrder(db, cfg, m.fetchFn, { invId: o.invId, providerRef: null, ageSeconds: 700 }, opts)).toBe('not_found')
    const row = (await db.query<{ provider_status: string }>('SELECT provider_status FROM orders WHERE inv_id = $1', [o.invId]))[0]!
    expect(row.provider_status).toBe('lost')
    expect((await kaspiOrdersToSync(db)).map((x) => x.invId)).toContain(o.invId)
    paidOps = [{ Id: 42, Comment: `Wise Store #${o.invId}: 100 Когтей` }]
    expect(await syncKaspiPosOrder(db, cfg, m.fetchFn, { invId: o.invId, providerRef: null, ageSeconds: 3000 }, opts)).toBe('paid')
  })

  it('asks sales history for yesterday and today (period code 2) — payment around midnight is found', async () => {
    const bodies: unknown[] = []
    const m = mockKaspi({
      '/v01/remote/history': () => ok({ Operations: [] }),
      '/v02/history/operations': (b) => {
        bodies.push(b)
        return ok({ DailySets: [{ Operations: [] }, { Operations: [{ Id: 7, Comment: 'Wise Store #5: X' }] }] })
      },
    })
    expect(await findInvoiceByComment(cfg, m.fetchFn, commentPrefix(5), new Date('2026-09-29T19:00:30Z'))).toBe(7)
    expect(bodies).toEqual([{ EndDate: '2026-09-30T00:00:30.000+0500', LastTransactionDate: '', StatementPeriodCode: 2 }])
  })
})

describe('Kaspi limits', () => {
  it('open invoices per phone and daily count: kaspipos orders only, cancelled ones free the phone', async () => {
    const k1 = await kaspiOrder('claws-100', '1', 'same')
    await kaspiOrder('claws-100', '2', 'same')
    // старая строка другого провайдера с тем же хэшем — в лимиты не входит
    const old = await kaspiOrder('claws-100', '3', 'same')
    await db.query('UPDATE orders SET provider = $2 WHERE inv_id = $1', [old.invId, 'apipay'])
    expect(await openKaspiInvoicesForPhone(db, 'same')).toBe(2)
    expect(await kaspiInvoicesToday(db)).toBe(2)
    await setProviderStatus(db, k1.invId, 'cancelled')
    expect(await openKaspiInvoicesForPhone(db, 'same')).toBe(1)
    expect(await kaspiInvoicesToday(db)).toBe(2)               // бюджет суток считает и отменённые счета
  })
})
