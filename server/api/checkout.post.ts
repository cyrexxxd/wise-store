/// POST /api/checkout { nick, items: [{ slug, qty }] } → { url } — ссылка на оплату EasyDonate.
/// Выдачу после оплаты делает сам EasyDonate через плагин EasyPayments на сервере.
import { createPayment, EasyDonateError, getProducts } from '../utils/easydonate'
import { validateCheckout } from '../utils/catalog'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ nick?: unknown; items?: unknown }>(event)
  const checked = validateCheckout(body?.nick, body?.items, await getProducts())
  if (!checked.ok) {
    throw createError({ statusCode: 400, data: { message: checked.message } })
  }

  try {
    return { url: await createPayment(checked.nick, checked.products) }
  } catch (error) {
    if (error instanceof EasyDonateError) {
      throw createError({ statusCode: 422, data: { message: error.message } })
    }
    console.error('[checkout] EasyDonate недоступен', error)
    throw createError({ statusCode: 502, data: { message: 'Платёжный сервис не ответил. Попробуйте через минуту.' } })
  }
})
