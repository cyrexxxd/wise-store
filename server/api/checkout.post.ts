/// POST /api/checkout { nick, items: [{ slug, qty }], method: 'kaspi' | 'card', phone? }
///  card  → { url } — ссылка на оплату Robokassa;
///  kaspi → { pay: '/pay/<InvId>?t=<token>' } — счёт выставлен в Kaspi на номер покупателя, страница ждёт оплату.
/// Цены и состав — из каталога в репозитории, браузер присылает только slug и количество.
import { apipayUserMessage, createInvoice, invoiceDescription, normalizeKzPhone } from '../utils/apipay'
import { validateCheckout } from '../utils/catalog'
import { createOrder, setProviderRef } from '../utils/orders'
import { allowRequest } from '../utils/rateLimit'
import { paymentUrl } from '../utils/robokassa'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ nick?: unknown; items?: unknown; method?: unknown; phone?: unknown }>(event)
  const method = body?.method === 'kaspi' ? 'kaspi' : 'card'
  const robokassa = method === 'card' ? useRobokassa() : null
  const apipay = method === 'kaspi' ? useApipay() : null
  if ((method === 'card' && !robokassa) || (method === 'kaspi' && !apipay)) {
    throw createError({ statusCode: 503, data: { message: 'Этот способ оплаты скоро откроется.' } })
  }
  // каждый запрос — строка в базе (и счёт в Kaspi): не больше 10 заказов в минуту с одного адреса
  if (!allowRequest(getRequestIP(event, { xForwardedFor: true }) ?? 'unknown', 10, 60_000)) {
    throw createError({ statusCode: 429, data: { message: 'Слишком много попыток. Подождите минуту.' } })
  }
  const checked = validateCheckout(body?.nick, body?.items)
  if (!checked.ok) throw createError({ statusCode: 400, data: { message: checked.message } })
  const phone = method === 'kaspi' ? normalizeKzPhone(body?.phone) : null
  if (method === 'kaspi' && !phone) {
    throw createError({ statusCode: 400, data: { message: 'Укажите номер Kaspi в формате 8 7XX XXX XX XX.' } })
  }
  const what = checked.lines.map((l) => (l.qty > 1 ? `${l.name} ×${l.qty}` : l.name)).join(', ')

  let db
  let order
  try {
    db = await useDb()
    order = await createOrder(db, checked.nick, checked.lines, checked.total,
      method === 'card' ? robokassa!.isTest : apipay!.sandbox, method === 'card' ? 'robokassa' : 'apipay')
  } catch (error) {
    console.error('[checkout] заказ не создан', error)
    throw createError({ statusCode: 502, data: { message: 'Не получилось создать заказ. Попробуйте через минуту.' } })
  }

  if (method === 'card') {
    return { url: paymentUrl(robokassa!, { invId: order.invId, kzt: checked.total, description: `wisepvp.net #${order.invId}: ${what} → ${checked.nick}` }) }
  }
  try {
    // номер телефона не сохраняем — он нужен только ApiPay, чтобы выставить счёт
    const inv = await createInvoice(apipay!, apipayFetch, { invId: order.invId, kzt: checked.total, phone: phone!, description: invoiceDescription(order.invId, what) })
    await setProviderRef(db, order.invId, String(inv.id), inv.status)
    return { pay: `/pay/${order.invId}?t=${order.token}` }
  } catch (error) {
    console.error(`[checkout] счёт Kaspi для заказа ${order.invId} не выставлен`, error)
    throw createError({ statusCode: 502, data: { message: apipayUserMessage(error) } })
  }
})
