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
  /** Полный возврат: статус остаётся paid (статуса refunded у ApiPay нет). */
  is_fully_refunded?: boolean
  total_refunded?: string
  /** Ссылка на оплату этого счёта по QR (https://kaspi.kz/qr/pay?tranId=…); null в processing и в песочнице. */
  kaspi_qr_link?: string | null
}

/// Ссылка Kaspi для QR на странице оплаты — только https://kaspi.kz/…, иначе null (не рисуем покупателю чужой адрес).
export function kaspiQrLink(inv: Pick<ApipayInvoice, 'kaspi_qr_link'>): string | null {
  const link = inv.kaspi_qr_link
  if (typeof link !== 'string' || link.length > 300) return null
  try {
    const u = new URL(link)
    return u.protocol === 'https:' && u.hostname === 'kaspi.kz' ? u.toString() : null
  } catch {
    return null
  }
}

/// Что из счёта сохраняем в заказ: без номера телефона и имени покупателя (client_phone, client_name, phone_number).
export function invoiceForLog(inv: ApipayInvoice): Record<string, unknown> {
  const { id, amount, status, is_sandbox, is_fully_refunded, total_refunded } = inv
  const extra = inv as unknown as Record<string, unknown>
  return { id, amount, status, is_sandbox, is_fully_refunded, total_refunded, kaspi_invoice_id: extra.kaspi_invoice_id ?? null, paid_at: extra.paid_at ?? null }
}

/// Номер телефона в базе не храним — только HMAC (для лимита «не больше N неоплаченных счетов на номер»).
export function phoneHash(phone: string, secret: string): string {
  return createHmac('sha256', secret).update(`phone:${phone}`).digest('hex')
}

export class ApipayError extends Error {
  constructor(message: string, readonly status: number, readonly code: string | null, readonly body: Record<string, unknown> = {}) {
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
    throw new ApipayError(message, res.status, code, data)
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

/// Выставить счёт и не потерять его: при таймауте/сбое сети повторяем тем же ключом идемпотентности — ApiPay
/// отвечает 409 duplicate_idempotency_key с invoice_id уже созданного счёта. null — счёт точно не создан.
export async function createInvoiceSafely(cfg: ApipayConfig, fetchFn: FetchFn,
  order: { invId: number; kzt: number; phone: string; description: string }): Promise<{ id: number; status: string }> {
  for (let attempt = 1; ; attempt++) {
    try {
      const inv = await createInvoice(cfg, fetchFn, order)
      return { id: inv.id, status: inv.status }
    } catch (e) {
      if (e instanceof ApipayError && e.code === 'duplicate_idempotency_key' && typeof e.body.invoice_id === 'number') {
        return { id: e.body.invoice_id, status: String(e.body.status ?? 'processing') }
      }
      // ответ ApiPay (4xx/5xx) — решение принято, повтор не поможет; сеть/таймаут — счёт мог создаться, повторяем
      if (e instanceof ApipayError || attempt >= 2) throw e
    }
  }
}

/// Счёт ApiPay по нашему номеру заказа (external_order_id) — если связь «заказ ↔ счёт» не записалась.
export async function findInvoiceByOrder(cfg: ApipayConfig, fetchFn: FetchFn, invId: number): Promise<ApipayInvoice | null> {
  const page = await call<{ data?: ApipayInvoice[] }>(cfg, fetchFn, 'GET', `/invoices?search=${invId}&per_page=20`)
  return (page.data ?? []).find((i) => i.external_order_id === String(invId)) ?? null
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
    if (e.code === 'duplicate_idempotency_key') return 'Счёт по этому заказу уже выставлен — откройте приложение Kaspi.'
    if (e.status === 409) return 'Kaspi временно недоступен. Попробуйте позже или оплатите картой.'
  }
  return 'Kaspi сейчас не отвечает. Попробуйте ещё раз или оплатите картой.'
}
