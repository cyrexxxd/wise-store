/// Настройки Robokassa из env Render (NUXT_ROBOKASSA_*). null — магазин не настроен, оплата закрыта.
import { parseHashAlgo, type RobokassaConfig } from './robokassa'

export function useRobokassa(): RobokassaConfig | null {
  const c = useRuntimeConfig().robokassa
  if (!c.login || !c.password1 || !c.password2) return null
  const hash = parseHashAlgo(c.hash)
  if (!hash) {
    console.error(`[robokassa] NUXT_ROBOKASSA_HASH=${c.hash}: нужен md5 или sha256 — оплата закрыта`)
    return null
  }
  // тестовый режим — всё, кроме явного "0" (безопасное значение по умолчанию: тестовые заказы выдачу не получают)
  return { login: c.login, password1: c.password1, password2: c.password2, hash, isTest: String(c.test) !== '0' }
}
