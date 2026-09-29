/// Номер Kaspi покупателя: нормализация ввода и необратимый хэш для лимита «счетов на номер».
/// В базе магазина хранится только хэш, сам номер уходит в Kaspi Pay и нигде не сохраняется.
import { createHmac } from 'node:crypto'

/// Номер Kaspi → формат 8XXXXXXXXXX. Принимает +7 7xx…, 8 7xx…, 7 7xx… с пробелами/скобками/дефисами.
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

/// HMAC-SHA256 номера (секрет NUXT_PHONE_HASH_SECRET). Формат сообщения менять нельзя: хэши уже лежат
/// в orders.phone_hash, и лимит «счетов на номер» сравнивает новые с ними.
export function phoneHash(phone: string, secret: string): string {
  return createHmac('sha256', secret).update(`phone:${phone}`).digest('hex')
}
