/// GET /api/orders/<InvId>?t=<token> — статус заказа для страницы ожидания оплаты Kaspi.
/// Если заказ ещё не оплачен, не чаще раза в 10 с спрашивает ApiPay сам — на случай потерянного вебхука.
import { findInvoiceByOrder, getInvoice } from '../../utils/apipay'
import { applyApipayInvoice } from '../../utils/apipaySync'
import { orderByToken, UUID_RE } from '../../utils/orders'

const lastCheck = new Map<number, number>()
const TERMINAL_FAIL = new Set(['cancelled', 'expired', 'error'])

export default defineEventHandler(async (event) => {
  const invId = Number(getRouterParam(event, 'id'))
  const token = String(getQuery(event).t ?? '')
  if (!Number.isSafeInteger(invId) || invId < 1 || !UUID_RE.test(token)) throw createError({ statusCode: 404, statusMessage: 'not found' })
  const db = await useDb()
  let order = await orderByToken(db, invId, token)
  if (!order) throw createError({ statusCode: 404, statusMessage: 'not found' })

  const apipay = useApipay()
  const now = Date.now()
  if (order.status === 'pending' && order.provider === 'apipay' && apipay && now - (lastCheck.get(invId) ?? 0) > 10_000) {
    lastCheck.set(invId, now)
    if (lastCheck.size > 5000) lastCheck.clear()
    try {
      // счёт не привязан (связь не записалась при выставлении) — ищем его по номеру заказа
      const inv = order.providerRef ? await getInvoice(apipay, apipayFetch, Number(order.providerRef)) : await findInvoiceByOrder(apipay, apipayFetch, invId)
      const allowTestDelivery = String(useRuntimeConfig().deliveryAllowTest) === '1'
      if (inv) await applyApipayInvoice(db, inv, { sandbox: apipay.sandbox, allowTestDelivery })
      order = (await orderByToken(db, invId, token)) ?? order
    } catch (error) {
      console.warn(`[orders] сверка счёта ApiPay для заказа ${invId} не удалась`, error)
    }
  }
  // cancelled/expired/error — не окончательно для страницы (у ApiPay законны переходы cancelled→paid, error→pending)
  const state = order.status === 'paid' ? 'paid' : order.status === 'refunded' ? 'refunded'
    : order.providerStatus && TERMINAL_FAIL.has(order.providerStatus) ? 'failed' : 'pending'
  return { invId: order.invId, state, providerStatus: order.providerStatus, amount: order.amountKzt, test: order.isTest }
})
