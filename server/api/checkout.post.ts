/// POST /api/checkout { nick, items: [{ slug, qty }], method: 'kaspi' | 'card', phone? }
///  card  → { url } — ссылка на оплату Robokassa;
///  kaspi → { pay: '/pay/<InvId>?t=<token>' } — счёт выставлен в Kaspi на номер покупателя, страница ждёт оплату.
/// Цены и состав — из каталога в репозитории, браузер присылает только slug и количество.
import { apipayUserMessage, ApipayError, createInvoiceSafely, invoiceDescription, normalizeKzPhone, phoneHash } from '../utils/apipay'
import { validateCheckout } from '../utils/catalog'
import { createOrder, kaspiInvoicesToday, openKaspiInvoicesForPhone, setProviderRef } from '../utils/orders'
import { allowRequest } from '../utils/rateLimit'
import { paymentUrl } from '../utils/robokassa'

/// Не больше стольких неоплаченных счетов Kaspi на один номер: чужому человеку не завалить push-ами.
const MAX_OPEN_PER_PHONE = 2

export default defineEventHandler(async (event) => {
  const body = await readBody<{ nick?: unknown; items?: unknown; method?: unknown; phone?: unknown }>(event)
  const method = body?.method === 'kaspi' ? 'kaspi' : 'card'
  const robokassa = method === 'card' ? useRobokassa() : null
  const apipay = method === 'kaspi' ? useApipay() : null
  if ((method === 'card' && !robokassa) || (method === 'kaspi' && !apipay)) {
    throw createError({ statusCode: 503, data: { message: 'Этот способ оплаты скоро откроется.' } })
  }
  // каждый запрос — строка в базе (и счёт в Kaspi): не больше 10 заказов в минуту с одного адреса
  if (!allowRequest(clientIp(event), 10, 60_000)) {
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
  try {
    db = await useDb()
  } catch (error) {
    console.error('[checkout] база недоступна', error)
    throw createError({ statusCode: 502, data: { message: 'Не получилось создать заказ. Попробуйте через минуту.' } })
  }

  if (method === 'card') {
    let order
    try {
      order = await createOrder(db, checked.nick, checked.lines, checked.total, robokassa!.isTest, 'robokassa')
    } catch (error) {
      console.error('[checkout] заказ не создан', error)
      throw createError({ statusCode: 502, data: { message: 'Не получилось создать заказ. Попробуйте через минуту.' } })
    }
    return { url: paymentUrl(robokassa!, { invId: order.invId, kzt: checked.total, description: `wisepvp.net #${order.invId}: ${what} → ${checked.nick}` }) }
  }

  // Kaspi: лимиты до выставления счёта (номер в базе — только хэш)
  const hash = phoneHash(phone!, apipay!.webhookSecret)
  if (await openKaspiInvoicesForPhone(db, hash) >= MAX_OPEN_PER_PHONE) {
    throw createError({ statusCode: 429, data: { message: 'На этот номер уже выставлены неоплаченные счета — оплатите их в Kaspi или подождите сутки.' } })
  }
  const dailyLimit = Number(useRuntimeConfig().apipay.dailyLimit) || 40
  if (await kaspiInvoicesToday(db) >= dailyLimit) {
    console.error(`[checkout] дневной бюджет счетов Kaspi (${dailyLimit}) исчерпан`)
    throw createError({ statusCode: 429, data: { message: 'Оплата через Kaspi на сегодня недоступна — оплатите картой или попробуйте завтра.' } })
  }
  const order = await createOrder(db, checked.nick, checked.lines, checked.total, apipay!.sandbox, 'apipay', hash)
  const pay = `/pay/${order.invId}?t=${order.token}`
  try {
    const inv = await createInvoiceSafely(apipay!, apipayFetch, { invId: order.invId, kzt: checked.total, phone: phone!, description: invoiceDescription(order.invId, what) })
    try {
      await setProviderRef(db, order.invId, String(inv.id), inv.status)
    } catch (error) {
      // счёт в Kaspi уже есть: связь восстановит вебхук или сверка по номеру заказа — покупателя ведём на ожидание
      console.error(`[checkout] счёт ApiPay ${inv.id} не привязан к заказу ${order.invId}`, error)
    }
    return { pay }
  } catch (error) {
    console.error(`[checkout] счёт Kaspi для заказа ${order.invId} не выставлен`, error)
    // ответ ApiPay — счёт точно не создан; сеть/таймаут дважды — счёт мог создаться, отправляем ждать, а не платить картой
    if (!(error instanceof ApipayError)) return { pay }
    throw createError({ statusCode: 502, data: { message: apipayUserMessage(error) } })
  }
})
