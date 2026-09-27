/// Доступ плагина WiseDelivery: заголовок X-Server-Token = NUXT_DELIVERY_SERVER_TOKEN (сравнение за
/// постоянное время). Токен не задан — API выдачи закрыт целиком.
import { timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

export function requireServerToken(event: H3Event): void {
  const expected = useRuntimeConfig().deliveryServerToken
  const got = getHeader(event, 'x-server-token') ?? ''
  const a = Buffer.from(String(expected ?? ''))
  const b = Buffer.from(got)
  if (a.length < 32 || a.length !== b.length || !timingSafeEqual(a, b)) {
    throw createError({ statusCode: 401, statusMessage: 'unauthorized' })
  }
}
