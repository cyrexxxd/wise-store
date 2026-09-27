/// POST /api/checkout { nick, items: [{ slug, qty }] } → { url } — ссылка на оплату Robokassa.
/// Цены и состав — из каталога в репозитории, браузер присылает только slug и количество.
import { validateCheckout } from '../utils/catalog'
import { createOrder } from '../utils/orders'
import { allowRequest } from '../utils/rateLimit'
import { paymentUrl } from '../utils/robokassa'

export default defineEventHandler(async (event) => {
  const robokassa = useRobokassa()
  if (!robokassa) {
    throw createError({ statusCode: 503, data: { message: 'Оплата скоро откроется — подключаем платёжную систему.' } })
  }
  // каждый запрос — строка в базе: не больше 10 заказов в минуту с одного адреса
  if (!allowRequest(getRequestIP(event, { xForwardedFor: true }) ?? 'unknown', 10, 60_000)) {
    throw createError({ statusCode: 429, data: { message: 'Слишком много попыток. Подождите минуту.' } })
  }
  const body = await readBody<{ nick?: unknown; items?: unknown }>(event)
  const checked = validateCheckout(body?.nick, body?.items)
  if (!checked.ok) {
    throw createError({ statusCode: 400, data: { message: checked.message } })
  }
  try {
    const db = await useDb()
    const invId = await createOrder(db, checked.nick, checked.lines, checked.total, robokassa.isTest)
    const what = checked.lines.map((l) => (l.qty > 1 ? `${l.name} ×${l.qty}` : l.name)).join(', ')
    return { url: paymentUrl(robokassa, { invId, kzt: checked.total, description: `wisepvp.net #${invId}: ${what} → ${checked.nick}` }) }
  } catch (error) {
    console.error('[checkout] заказ не создан', error)
    throw createError({ statusCode: 502, data: { message: 'Не получилось создать заказ. Попробуйте через минуту.' } })
  }
})
