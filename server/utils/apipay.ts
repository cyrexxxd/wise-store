/// ApiPay.kz — оплата через Kaspi Pay (https://apipay.kz/docs). Счёт по номеру телефона: покупатель получает push
/// в приложении Kaspi и оплачивает (счёт живёт 24 часа). QR-счёт не используем: у кассира может быть только
/// один активный QR, второй покупатель отменил бы счёт первого.
///
/// API: https://api.apipay.kz/api/v1, заголовок X-API-Key (серверный секрет).
/// Вебхук invoice.status_changed: X-Webhook-Signature: sha256=<hex> = HMAC-SHA256(сырое тело, webhook secret).
/// Чистые функции + клиент с подменяемым fetch — тестируется vitest (apipay.test.ts).
import { createHmac, timingSafeEqual } from 'node:crypto'

export const APIPAY_BASE = 'https://api.apipay.kz/api/v1'

export interface ApipayConfig {
  apiKey: string
  webhookSecret: string
  /** Песочница: счета не настоящие, заказы помечаются тестовыми и выдачу не получают. */
  sandbox: boolean
  /** Адрес API; по умолчанию боевой https://api.apipay.kz/api/v1 (другой — только для локальных тестов). */
  baseUrl?: string
}

/// Номер Kaspi → формат ApiPay 8XXXXXXXXXX. Принимает +7 7xx…, 8 7xx…, 7 7xx… с пробелами/скобками/дефисами.
/// Только казахстанские мобильные (7xx после кода страны). null — не номер.
export function normalizeKzPhone(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const digits = input.replace(/[\s()+-]/g, '')
  if (!/^\d+$/.test(digits)) return null
  let local: string
  if (digits.length === 11 && (digits.startsWith('8') || digits.startsWith('7'))) local = digits.slice(1)
  else if (digits.length === 10) local = digits
  else return null
  return local.startsWith('7') ? `8${local}` : null
}

/// «8 707 *** ** 67» — для показа на странице оплаты (полный номер не светим).
export function maskPhone(phone: string): string {
  return `${phone.slice(0, 1)} ${phone.slice(1, 4)} *** ** ${phone.slice(-2)}`
}

/// Подпись вебхука верна? Сравнение за постоянное время; заголовок вида «sha256=<hex>».
export function verifyWebhook(rawBody: string, header: string | undefined, secret: string): boolean {
  if (!secret || !header) return false
  const got = header.trim().replace(/^sha256=/i, '').toLowerCase()
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export type ApipayStatus = 'processing' | 'pending' | 'cancelling' | 'paid' | 'cancelled' | 'expired' | 'error' | 'partially_refunded'

export interface ApipayInvoice {
  id: number
  amount: string
  status: ApipayStatus
  external_order_id?: string | null
  is_sandbox?: boolean
  error_message?: string | null
}

export class ApipayError extends Error {
  constructor(message: string, readonly status: number, readonly code: string | null) {
    super(message)
  }
}

type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) =>
  Promise<{ status: number; json: () => Promise<unknown> }>

async function call<T>(cfg: ApipayConfig, fetchFn: FetchFn, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetchFn(`${cfg.baseUrl || APIPAY_BASE}${path}`, {
    method,
    headers: { 'X-API-Key': cfg.apiKey, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (res.status >= 400) {
    const code = typeof data.error_code === 'string' ? data.error_code : typeof data.error === 'string' ? data.error : null
    const message = typeof data.message === 'string' ? data.message : `ApiPay HTTP ${res.status}`
    throw new ApipayError(message, res.status, code)
  }
  return data as T
}

/// Описание счёта: Kaspi показывает покупателю только первые 60 символов.
export function invoiceDescription(invId: number, what: string): string {
  return `Wise Store #${invId}: ${what}`.slice(0, 60)
}

/// Счёт по номеру: 201 со status=processing (асинхронно) — это не ошибка. Идемпотентность по номеру заказа:
/// повтор с тем же ключом → 409, вторым счётом покупатель не получит.
export function createInvoice(cfg: ApipayConfig, fetchFn: FetchFn,
  order: { invId: number; kzt: number; phone: string; description: string }): Promise<ApipayInvoice> {
  if (!Number.isInteger(order.kzt) || order.kzt <= 0) throw new Error(`сумма ApiPay только целыми тенге: ${order.kzt}`)
  return call<ApipayInvoice>(cfg, fetchFn, 'POST', '/invoices', {
    phone_number: order.phone,
    amount: order.kzt,
    description: order.description,
    external_order_id: String(order.invId),
    external_order_id_idempotency: `wise-${order.invId}`,
  })
}

export function getInvoice(cfg: ApipayConfig, fetchFn: FetchFn, id: number): Promise<ApipayInvoice> {
  return call<ApipayInvoice>(cfg, fetchFn, 'GET', `/invoices/${id}`)
}

/// Только песочница: перевести счёт в статус (paid/cancelled/expired/error) — для тестов.
export function simulateStatus(cfg: ApipayConfig, fetchFn: FetchFn, id: number, status: 'paid' | 'cancelled' | 'expired' | 'error'): Promise<unknown> {
  return call(cfg, fetchFn, 'POST', `/invoices/${id}/simulate-status`, { status })
}

/// Понятный покупателю текст по коду ошибки ApiPay при выставлении счёта.
export function apipayUserMessage(e: unknown): string {
  if (e instanceof ApipayError) {
    if (e.status === 422) return 'Проверьте номер: на него должен быть зарегистрирован Kaspi.'
    if (e.status === 429) return 'Сейчас много оплат — попробуйте через минуту.'
    if (e.status === 409) return 'Счёт по этому заказу уже выставлен — откройте приложение Kaspi.'
  }
  return 'Kaspi сейчас не отвечает. Попробуйте ещё раз или оплатите картой.'
}
