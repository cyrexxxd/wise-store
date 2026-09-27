import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ApipayError, createInvoice, getInvoice, invoiceDescription, maskPhone, normalizeKzPhone, verifyWebhook, type ApipayConfig } from './apipay'

const cfg: ApipayConfig = { apiKey: 'key-123', webhookSecret: 'whsec', sandbox: true }

describe('normalizeKzPhone', () => {
  it.each([
    ['87071234567', '87071234567'],
    ['+7 (707) 123-45-67', '87071234567'],
    ['77071234567', '87071234567'],
    ['7071234567', '87071234567'],
    ['8 707 123 45 67', '87071234567'],
  ])('%s → %s', (input, out) => {
    expect(normalizeKzPhone(input)).toBe(out)
  })

  it.each(['', '123', '+1 555 123 4567', '84951234567', 'abc', 42, null])('rejects %s', (input) => {
    expect(normalizeKzPhone(input)).toBeNull()
  })

  it('masks the phone for display', () => {
    expect(maskPhone('87071234567')).toBe('8 707 *** ** 67')
  })
})

describe('verifyWebhook', () => {
  const body = '{"event":"invoice.status_changed","invoice":{"id":5,"status":"paid","amount":"1599.00"}}'
  const sig = 'sha256=' + createHmac('sha256', 'whsec').update(body).digest('hex')

  it('accepts HMAC-SHA256 of the raw body', () => {
    expect(verifyWebhook(body, sig, 'whsec')).toBe(true)
    expect(verifyWebhook(body, sig.toUpperCase().replace('SHA256=', 'sha256='), 'whsec')).toBe(true)
  })

  it('rejects a changed body, a wrong secret or a missing header', () => {
    expect(verifyWebhook(body.replace('1599', '1'), sig, 'whsec')).toBe(false)
    expect(verifyWebhook(body, sig, 'other')).toBe(false)
    expect(verifyWebhook(body, undefined, 'whsec')).toBe(false)
    expect(verifyWebhook(body, sig, '')).toBe(false)
  })
})

describe('API client', () => {
  it('creates an invoice by phone with idempotency by order', async () => {
    let seen: { url: string; init: { method: string; headers: Record<string, string>; body?: string } } | null = null
    const inv = await createInvoice(cfg, async (url, init) => {
      seen = { url, init }
      return { status: 201, json: async () => ({ id: 42, amount: '1599.00', status: 'processing' }) }
    }, { invId: 7, kzt: 1599, phone: '87071234567', description: invoiceDescription(7, 'Роль CAT') })
    expect(inv.id).toBe(42)
    expect(seen!.url).toBe('https://api.apipay.kz/api/v1/invoices')
    expect(seen!.init.headers['X-API-Key']).toBe('key-123')
    expect(JSON.parse(seen!.init.body!)).toEqual({
      phone_number: '87071234567', amount: 1599, description: 'Wise Store #7: Роль CAT',
      external_order_id: '7', external_order_id_idempotency: 'wise-7',
    })
  })

  it('refuses fractional tenge and maps API errors', async () => {
    expect(() => createInvoice(cfg, async () => ({ status: 201, json: async () => ({}) }), { invId: 1, kzt: 10.5, phone: '87071234567', description: 'x' })).toThrow()
    await expect(getInvoice(cfg, async () => ({ status: 422, json: async () => ({ error_code: 'invalid_phone', message: 'bad' }) }), 1))
      .rejects.toMatchObject({ status: 422, code: 'invalid_phone' })
    await expect(getInvoice(cfg, async () => ({ status: 500, json: async () => { throw new Error('html') } }), 1)).rejects.toBeInstanceOf(ApipayError)
  })

  it('keeps the description within the 60 characters Kaspi shows', () => {
    expect(invoiceDescription(123, 'Роль Premium ×3, 1100 Когтей ×2, 500 Когтей').length).toBeLessThanOrEqual(60)
  })
})
