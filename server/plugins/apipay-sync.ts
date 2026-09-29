/// Фоновая сверка Kaspi-заказов с ApiPay раз в 2 минуты: если вебхук не дошёл (деплой, холодный старт, пауза
/// circuit breaker у ApiPay), оплата всё равно применится, даже когда покупатель закрыл страницу ожидания.
/// Заказ без привязанного счёта (связь не записалась при выставлении) ищется по номеру заказа.
import { findInvoiceByOrder, getInvoice } from '../utils/apipay'
import { applyApipayInvoice } from '../utils/apipaySync'
import { kaspiOrdersToSync } from '../utils/orders'

const INTERVAL_MS = 120_000

export default defineNitroPlugin(() => {
  let running = false
  const tick = async () => {
    const apipay = useApipay()
    if (!apipay || !useRuntimeConfig().databaseUrl || running) return
    running = true
    try {
      const db = await useDb()
      const allowTestDelivery = String(useRuntimeConfig().deliveryAllowTest) === '1'
      for (const o of await kaspiOrdersToSync(db, 'apipay')) {
        try {
          const inv = o.providerRef ? await getInvoice(apipay, apipayFetch, Number(o.providerRef)) : await findInvoiceByOrder(apipay, apipayFetch, o.invId)
          if (inv) await applyApipayInvoice(db, inv, { sandbox: apipay.sandbox, allowTestDelivery })
        } catch (error) {
          console.warn(`[apipay-sync] заказ ${o.invId}: сверка не удалась`, error)
        }
      }
    } catch (error) {
      console.warn('[apipay-sync] сверка пропущена', error)
    } finally {
      running = false
    }
  }
  const timer = setInterval(tick, INTERVAL_MS)
  timer.unref?.()
})
