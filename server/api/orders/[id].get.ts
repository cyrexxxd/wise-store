/// GET /api/orders/<InvId>?t=<token> — статус заказа для страницы ожидания оплаты Kaspi.
/// Если заказ kaspipos ещё не оплачен, не чаще раза в 10 с сам сверяется с Kaspi (фоновая сверка медленнее).
/// Неоплаченный заказ другого провайдера больше никто не сверяет — отдаётся завершённым (payPageState).
import { KaspiPosError } from '../../utils/kaspipos'
import { syncKaspiPosOrder } from '../../utils/kaspiposSync'
import { orderByToken, payPageState, UUID_RE } from '../../utils/orders'

const lastCheck = new Map<number, number>()

export default defineEventHandler(async (event) => {
  const invId = Number(getRouterParam(event, 'id'))
  const token = String(getQuery(event).t ?? '')
  if (!Number.isSafeInteger(invId) || invId < 1 || !UUID_RE.test(token)) throw createError({ statusCode: 404, statusMessage: 'not found' })
  const db = await useDb()
  let order = await orderByToken(db, invId, token)
  if (!order) throw createError({ statusCode: 404, statusMessage: 'not found' })

  const now = Date.now()
  const kaspipos = order.provider === 'kaspipos' ? useKaspiPos() : null
  if (order.status === 'pending' && kaspipos && !kaspiPosDead() && now - (lastCheck.get(invId) ?? 0) > 10_000
    && !(order.providerRef === null && order.providerStatus === 'error')) {
    lastCheck.set(invId, now)
    if (lastCheck.size > 5000) lastCheck.clear()
    try {
      // created_at приходит текстом Postgres; не разобрался — считаем заказ свежим (error пометит фоновая сверка)
      const created = Date.parse(order.createdAt)
      const ageSeconds = Number.isFinite(created) ? Math.max(0, (now - created) / 1000) : 0
      await syncKaspiPosOrder(db, kaspipos, kaspiposFetch, { invId, providerRef: order.providerRef, ageSeconds },
        { allowTestDelivery: String(useRuntimeConfig().deliveryAllowTest) === '1' })
      markKaspiPosAlive()
      order = (await orderByToken(db, invId, token)) ?? order
    } catch (error) {
      if (error instanceof KaspiPosError && error.sessionDead) markKaspiPosDead(error.message)
      console.warn(`[orders] сверка счёта Kaspi для заказа ${invId} не удалась`, error instanceof Error ? error.message : error)
    }
  }

  const { state, providerStatus, legacy } = payPageState(order)
  return { invId: order.invId, state, providerStatus, amount: order.amountKzt, test: order.isTest, legacy }
})
