/// Robokassa.kz: ссылка на оплату и проверка уведомления ResultURL (https://docs.robokassa.kz/pay-interface,
/// /notifications-and-redirects). Чистые функции без Nuxt — тестируются vitest (robokassa.test.ts).
///
/// Подпись ссылки:     MerchantLogin:OutSum:InvId:Пароль#1
/// Подпись ResultURL:  OutSum:InvId:Пароль#2   (OutSum — строка ровно как пришла, например "1599.000000")
/// Алгоритм — тот, что выбран в технических настройках магазина (MD5 по умолчанию, можно SHA-256).
/// Shp_-параметры не используем: ник и состав заказа лежат в БД по InvId — подписывать и подменять нечего.
import { createHash, timingSafeEqual } from 'node:crypto'

export type HashAlgo = 'md5' | 'sha256'

export const PAYMENT_URL = 'https://auth.robokassa.kz/Merchant/Index.aspx'

export interface RobokassaConfig {
  login: string
  password1: string
  password2: string
  hash: HashAlgo
  isTest: boolean
}

/// Алгоритм из настроек магазина: md5 или sha256 (регистр и дефис не важны). Иное — null: оплата закрыта,
/// чтобы не молчать с неверными подписями (sha384/sha512 кабинет тоже предлагает — их не поддерживаем).
export function parseHashAlgo(value: unknown): HashAlgo | null {
  const v = String(value ?? '').toLowerCase().replace('-', '')
  return v === 'sha256' ? 'sha256' : v === 'md5' ? 'md5' : null
}

function hash(algo: HashAlgo, text: string): string {
  return createHash(algo).update(text, 'utf8').digest('hex')
}

/// Сумма в тенге → формат Robokassa «число через точку»: 1599 → "1599.00".
export function formatOutSum(kzt: number): string {
  if (!Number.isFinite(kzt) || kzt <= 0) throw new Error(`неверная сумма ${kzt}`)
  return kzt.toFixed(2)
}

export function paymentSignature(cfg: RobokassaConfig, outSum: string, invId: number): string {
  return hash(cfg.hash, `${cfg.login}:${outSum}:${invId}:${cfg.password1}`)
}

export function paymentUrl(cfg: RobokassaConfig, order: { invId: number; kzt: number; description: string; email?: string }): string {
  const outSum = formatOutSum(order.kzt)
  const params = new URLSearchParams({
    MerchantLogin: cfg.login,
    OutSum: outSum,
    InvId: String(order.invId),
    // Description — до 100 символов, показывается покупателю на странице оплаты
    Description: order.description.slice(0, 100),
    SignatureValue: paymentSignature(cfg, outSum, order.invId),
    Culture: 'ru',
    Encoding: 'utf-8',
  })
  if (order.email) params.set('Email', order.email)
  if (cfg.isTest) params.set('IsTest', '1')
  return `${PAYMENT_URL}?${params}`
}

export interface ResultNotification {
  outSum: string
  invId: number
  signature: string
}

/// Поля уведомления ResultURL (POST form или GET query). null — чего-то не хватает или InvId не число.
export function parseResult(fields: Record<string, unknown>): ResultNotification | null {
  const get = (k: string) => {
    const v = fields[k] ?? fields[k.toLowerCase()]
    return typeof v === 'string' ? v.trim() : Array.isArray(v) && typeof v[0] === 'string' ? v[0].trim() : ''
  }
  const outSum = get('OutSum')
  const invRaw = get('InvId')
  const signature = get('SignatureValue')
  if (!outSum || !signature || !/^\d{1,10}$/.test(invRaw)) return null
  const invId = Number(invRaw)
  if (!Number.isSafeInteger(invId) || invId < 1) return null
  return { outSum, invId, signature }
}

/// Подпись уведомления верна? Сравнение без учёта регистра (Robokassa шлёт верхний регистр) и за постоянное время.
export function verifyResult(cfg: RobokassaConfig, n: ResultNotification): boolean {
  const expected = Buffer.from(hash(cfg.hash, `${n.outSum}:${n.invId}:${cfg.password2}`).toLowerCase())
  const got = Buffer.from(n.signature.toLowerCase())
  return expected.length === got.length && timingSafeEqual(expected, got)
}

/// Сумма из уведомления совпадает с суммой заказа (в тийынах, чтобы не сравнивать дробные числа).
export function sameAmount(outSum: string, kzt: number): boolean {
  if (!/^\d+(\.\d+)?$/.test(outSum)) return false
  return Math.round(Number(outSum) * 100) === Math.round(kzt * 100)
}
