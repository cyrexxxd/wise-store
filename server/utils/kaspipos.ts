/// Kaspi Pay напрямую, от имени кассира — порт нужной части tapter-dev/kaspi-pos-automation (MIT,
/// https://github.com/tapter-dev/kaspi-pos-automation): подпись запросов (src/crypto.js, src/helpers.js),
/// счёт по номеру и его статус (src/routes/invoice.js, src/routes/history.js). Возвраты, QR и вход сюда
/// не перенесены: возврат делает владелец в приложении Kaspi Pay, вход — scripts/kaspipos-login.mjs.
///
/// Официального API у Kaspi нет: сервер представляется приложением Kaspi Pay (iOS). Устройство (ключ ECDSA,
/// deviceId, installId) и сессия кассира (tokenSN + секрет vtoken) — из env Render, на диск ничего не пишется.
/// Kaspi поднимает минимальную версию приложения — тогда вход и запросы отвечают OldVersionToUpdate:
/// NUXT_KASPIPOS_APP_VERSION/BUILD меняются без правки кода (актуальные — в issues tapter).
///
/// Чистые функции + клиент с подменяемым fetch — тестируется vitest (kaspipos.test.ts).
import { createHash, createHmac, createPrivateKey, createPublicKey, createSign, randomUUID, type KeyObject } from 'node:crypto'

export const KASPI_QRPAY_URL = 'https://qrpay.kaspi.kz'

export interface KaspiPosConfig {
  deviceId: string
  installId: string
  /** ECDSA P-256, pkcs8 DER в base64 — тот же ключ, с которым устройство зарегистрировано при входе. */
  privateKey: string
  tokenSn: string
  /** Секрет vtoken (результат ECDH при входе), hex. */
  secretHex: string
  profileId: string
  appVersion: string
  appBuild: string
  /** Адрес API; по умолчанию боевой (другой — только для локальных тестов). */
  baseUrl?: string
}

/// Константы «устройства» — как в tapter (config.js), кроме версии: её Kaspi проверяет, она в env.
const DEVICE = { platform: 'iOS', platformVer: '18.4', locale: 'ru-RU', cfNetwork: 'CFNetwork/3826.400.120', darwin: 'Darwin/24.4.0' }

// ─── подпись (порт tapter src/crypto.js) ───

const keyCache = new Map<string, KeyObject>()
function privateKeyObject(pkcs8B64: string): KeyObject {
  let key = keyCache.get(pkcs8B64)
  if (!key) {
    key = createPrivateKey({ key: Buffer.from(pkcs8B64, 'base64'), format: 'der', type: 'pkcs8' })
    keyCache.set(pkcs8B64, key)
  }
  return key
}

/// Несжатая точка открытого ключа (base64) и её md5 — cookie pk/pkTag и заголовок X-PkTag при входе.
export function publicKeyInfo(pkcs8B64: string): { pk: string; pkTag: string; x509: string } {
  const der = createPublicKey(privateKeyObject(pkcs8B64)).export({ type: 'spki', format: 'der' })
  const pk = der.subarray(der.length - 65).toString('base64')
  return { pk, pkTag: createHash('md5').update(pk).digest('hex'), x509: der.toString('base64') }
}

/// OCRA-1:HOTP-SHA256-6:QH64-T1M — одноразовый код сессии X-Kb-TokenSnMac (шаг 30 с).
export function computeTokenSnMac(tokenSn: string, secret: Buffer | null, nowMs = Date.now()): string {
  if (!secret) return '000000'
  const timeHex = (BigInt(nowMs) / BigInt(30000)).toString(16)
  const qHex = Buffer.from(tokenSn || '00000000').toString('hex').substring(0, 64)
  const data = Buffer.concat([
    Buffer.from('OCRA-1:HOTP-SHA256-6:QH64-T1M'),
    Buffer.from([0]),
    Buffer.from(qHex.padEnd(256, '0'), 'hex'),
    Buffer.from(timeHex.padStart(16, '0'), 'hex'),
  ])
  const hash = createHmac('sha256', secret).update(data).digest()
  const offset = hash[hash.length - 1]! & 0x0f
  const bin = ((hash[offset]! & 0x7f) << 24) | ((hash[offset + 1]! & 0xff) << 16) | ((hash[offset + 2]! & 0xff) << 8) | (hash[offset + 3]! & 0xff)
  return String(bin % 1_000_000).padStart(6, '0')
}

export function ecSign(pkcs8B64: string, data: Buffer | string): string {
  const s = createSign('SHA256')
  s.update(data)
  s.end()
  return s.sign(privateKeyObject(pkcs8B64)).toString('base64')
}

/// X-Sign: подпись sha256 от «имя:значение» заголовков из списка X-SH (url — в нижнем регистре) + тела.
export function computeXSign(pkcs8B64: string, url: string, headers: Record<string, string>, xsh: string, body?: string): string {
  const lines = xsh.split(',').map((name) => (name === 'url' ? `url:${url.toLowerCase()}` : `${name.toLowerCase()}:${headers[name] ?? ''}`))
  let text = lines.join('\n')
  if (body) text += `\n${body}`
  return ecSign(pkcs8B64, createHash('sha256').update(text, 'utf8').digest())
}

/// Время как у телефона в Казахстане: 2026-09-28T23:34:10.123+0500 (сервер Render живёт в UTC).
export function almatyIso(date = new Date()): string {
  return `${new Date(date.getTime() + 5 * 3600_000).toISOString().slice(0, 23)}+0500`
}

const XSH = 'url,X-Install-ID,X-PI,X-App-Bld,X-Platform-Ver,X-Locale,X-App-Ver,X-Device-ID,X-SV,X-Time,X-Platform-Type,X-Call,X-Kb-TokenSnMac,X-Kb-TokenSn'

export function signedHeaders(cfg: KaspiPosConfig, url: string, body?: string, now = new Date()): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Kb-TokenSn': cfg.tokenSn,
    'X-Kb-TokenSnMac': computeTokenSnMac(cfg.tokenSn, Buffer.from(cfg.secretHex, 'hex'), now.getTime()),
    'X-PI': cfg.profileId,
    'X-Install-ID': cfg.installId,
    'X-Device-ID': cfg.deviceId,
    'X-App-Ver': cfg.appVersion,
    'X-App-Bld': cfg.appBuild,
    'X-Platform-Type': DEVICE.platform,
    'X-Platform-Ver': DEVICE.platformVer,
    'X-Locale': DEVICE.locale,
    'X-Time': almatyIso(now),
    'X-Request-ID': randomUUID().toUpperCase(),
    'X-Call': 'notConnected',
    'X-SV': '2',
    'X-SH': XSH,
    'User-Agent': `Kaspi%20Pay/${cfg.appBuild} ${DEVICE.cfNetwork} ${DEVICE.darwin}`,
    Accept: '*/*',
    'Accept-Language': 'ru',
  }
  headers['X-Sign'] = computeXSign(cfg.privateKey, url, headers, XSH, body)
  if (body) headers['Content-Type'] = 'application/json'
  return headers
}

// ─── API счетов ───

/// Коды Kaspi (проверено 29.09.2026 на карточке счёта): -101001 — токен сессии не действует (вход с другого
/// устройства, кассир удалён); -10001 — не сошёлся одноразовый код (неверный секрет); -99000001 — счёта нет.
const SESSION_DEAD_CODES = new Set([-101001, -10001])
const NOT_FOUND_CODE = -99000001

export class KaspiPosError extends Error {
  /** Kaspi не принимает запросы кассира: сессия не действует (нужен вход по SMS — scripts/kaspipos-login.mjs)
   *  или Kaspi поднял минимальную версию приложения (OldVersionToUpdate — поднять NUXT_KASPIPOS_APP_VERSION/BUILD).
   *  В обоих случаях оплата Kaspi скрывается до вмешательства владельца. */
  readonly sessionDead: boolean
  constructor(message: string, readonly httpStatus: number, readonly statusCode: number | null, oldVersion = false) {
    super(message)
    this.sessionDead = oldVersion || httpStatus === 401 || (statusCode !== null && SESSION_DEAD_CODES.has(statusCode))
  }

  /** Kaspi внятно отказал (ответ с кодом, не 5xx, не отказ сессии) — счёта точно нет. Всё прочее (5xx, пустое/чужое
   *  тело) — как сбой сети: счёт мог создаться, его найдёт сверка. */
  get definitiveRejection(): boolean {
    return !this.sessionDead && this.httpStatus < 500 && this.statusCode !== null && this.statusCode !== 0
  }
}

export type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) =>
  Promise<{ status: number; json: () => Promise<unknown> }>

interface KaspiEnvelope<T> { StatusCode?: number; Message?: string; Data?: T }

async function call<T>(cfg: KaspiPosConfig, fetchFn: FetchFn, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const url = `${cfg.baseUrl || KASPI_QRPAY_URL}${path}`
  const payload = body === undefined ? undefined : JSON.stringify(body)
  const res = await fetchFn(url, { method, headers: signedHeaders(cfg, url, payload), body: payload })
  const data = (await res.json().catch(() => ({}))) as KaspiEnvelope<T>
  const code = typeof data.StatusCode === 'number' ? data.StatusCode : null
  if (res.status >= 400 || code !== 0 || data.Data === undefined) {
    const oldVersion = /OldVersionToUpdate|обновите приложение/i.test(JSON.stringify(data))
    // Message — текст Kaspi для кассира; телефон и токены в сообщение не попадают
    throw new KaspiPosError(`Kaspi ${res.status}/${code}${oldVersion ? ' OldVersionToUpdate' : ''}: ${String(data.Message ?? '').slice(0, 200)}`,
      res.status, code, oldVersion)
  }
  return data.Data
}

/// Номер для Kaspi: 7XXXXXXXXXX (11 цифр). Принимает формат normalizeKzPhone — 8XXXXXXXXXX.
export function kaspiPhone(phone8: string): string {
  if (!/^8\d{10}$/.test(phone8)) throw new Error('номер не в формате 8XXXXXXXXXX')
  return `7${phone8.slice(1)}`
}

/// Счёт по номеру. Ключа идемпотентности у Kaspi нет — одна попытка; при сбое сети счёт ищут по комментарию.
export async function createRemoteInvoice(cfg: KaspiPosConfig, fetchFn: FetchFn,
  order: { phone8: string; kzt: number; comment: string }): Promise<number> {
  if (!Number.isInteger(order.kzt) || order.kzt <= 0) throw new Error(`сумма Kaspi только целыми тенге: ${order.kzt}`)
  const data = await call<{ QrOperationId?: number }>(cfg, fetchFn, 'POST', '/v01/remote/create',
    { PhoneNumber: kaspiPhone(order.phone8), Amount: order.kzt, Comment: order.comment })
  // успех без номера счёта — непонятный ответ: как сбой (код null), сверка поищет счёт по комментарию
  if (typeof data.QrOperationId !== 'number') throw new KaspiPosError('Kaspi не вернул номер счёта', 200, null)
  return data.QrOperationId
}

/// Статус счёта в нашем словаре (тот же, что у ApiPay: страница ожидания и лимиты понимают его одинаково).
export type KaspiStatus = 'pending' | 'paid' | 'cancelled' | 'expired' | 'unknown'

export function mapStatus(raw: unknown): KaspiStatus {
  switch (raw) {
    case 'RemotePaymentCreated': return 'pending'
    case 'Processed': return 'paid'
    case 'RemotePaymentRejected':
    case 'RemotePaymentCanceled': return 'cancelled'
    case 'Expired':
    case 'RemotePaymentExpired': return 'expired'
    // незнакомый статус — не отказ: заказ остаётся ждать, статус пишется в лог
    default: return 'unknown'
  }
}

/// « 3 799 ₸», «- 100 ₸», «500,00 ₸» → 3799, 100, 500 (Kaspi отдаёт суммы строкой для показа; тийыны отбрасываем).
export function parseKzt(text: unknown): number | null {
  if (typeof text === 'number') return text
  if (typeof text !== 'string') return null
  const digits = text.replace(/[.,]\d{1,2}(?=\D*$)/, '').replace(/[^\d]/g, '')
  return digits ? Number(digits) : null
}

export interface KaspiInvoice {
  id: number
  rawStatus: string
  status: KaspiStatus
  amountKzt: number | null
  /** Сколько уже возвращено (возврат делают в приложении Kaspi Pay; статус при этом остаётся Processed). */
  returnedKzt: number
}

export async function getRemoteInvoice(cfg: KaspiPosConfig, fetchFn: FetchFn, id: number): Promise<KaspiInvoice> {
  const d = await call<{ Id?: number; Status?: string; Amount?: string; TotalReturnsAmount?: string }>(
    cfg, fetchFn, 'GET', `/v02/remote/details?operationId=${id}`)
  return {
    // id — запрошенный: по нему заказ привязан (provider_ref), даже если Kaspi вернёт в Id другое
    id,
    rawStatus: String(d.Status ?? ''),
    status: mapStatus(d.Status),
    amountKzt: parseKzt(d.Amount),
    returnedKzt: parseKzt(d.TotalReturnsAmount) ?? 0,
  }
}

/// Номер счёта по комментарию «Wise Store #<заказ>: …» — если ответ на создание потерялся (таймаут, сбой БД).
/// Неоплаченные и отклонённые — в remote/history, оплаченные — только в истории продаж. Период истории задаёт
/// StatementPeriodCode (EndDate Kaspi не смотрит; проверено 29.09): 0 — сегодня, 1 — вчера, 2 — вчера и сегодня,
/// 3 — месяц. Берём 2: оплата около полуночи уходит во вчерашний день.
export async function findInvoiceByComment(cfg: KaspiPosConfig, fetchFn: FetchFn, commentPrefix: string, now = new Date()): Promise<number | null> {
  const match = (c: unknown) => typeof c === 'string' && c.startsWith(commentPrefix)
  const remote = await call<{ Operations?: Array<{ Id?: number; Comment?: string }> }>(cfg, fetchFn, 'POST', '/v01/remote/history', { MaxResult: 50 })
  const open = remote.Operations?.find((o) => match(o.Comment))
  if (typeof open?.Id === 'number') return open.Id
  const sales = await call<{ DailySets?: Array<{ Operations?: Array<{ Id?: number; Comment?: string }> }> }>(
    cfg, fetchFn, 'POST', '/v02/history/operations', { EndDate: almatyIso(now), LastTransactionDate: '', StatementPeriodCode: 2 })
  for (const day of sales.DailySets ?? []) {
    const paid = day.Operations?.find((o) => match(o.Comment))
    if (typeof paid?.Id === 'number') return paid.Id
  }
  return null
}

/// «Жива ли сессия» (фоновая проверка, когда ждущих заказов нет): карточка заведомо несуществующего счёта.
/// История счетов для этого не годится — она проверяет только профиль, а не токен (отвечает OK с чужим токеном);
/// карточка проверяет токен и одноразовый код: жива — «покупка не найдена», нет — -101001/-10001.
export async function checkSession(cfg: KaspiPosConfig, fetchFn: FetchFn): Promise<void> {
  try {
    await call(cfg, fetchFn, 'GET', '/v02/remote/details?operationId=1')
  } catch (e) {
    if (e instanceof KaspiPosError && e.statusCode === NOT_FOUND_CODE) return
    throw e
  }
}

/// Префикс комментария заказа — по нему счёт находится в истории Kaspi. «#12:» не совпадёт с «#123:».
export function commentPrefix(invId: number): string {
  return `Wise Store #${invId}:`
}

/// Понятный покупателю текст по ошибке Kaspi при выставлении счёта.
export function kaspiUserMessage(e: unknown): string {
  if (e instanceof KaspiPosError && e.sessionDead) return 'Оплата через Kaspi временно недоступна. Попробуйте позже.'
  if (e instanceof KaspiPosError && e.definitiveRejection) return 'Проверьте номер: на него должен быть зарегистрирован Kaspi.'
  return 'Kaspi сейчас не отвечает. Попробуйте ещё раз через минуту.'
}
