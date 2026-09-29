/// Фоновая сверка заказов Kaspi-кассира (kaspipos). Вебхуков у Kaspi нет, поэтому опрос: заказы моложе часа —
/// каждые 30 с, старше — раз в 5 минут (счёт живёт 24 ч). Раз в 5 минут — оплаченные с невыданными строками:
/// если владелец вернул деньги в Kaspi Pay, заказ помечается refunded и невыданное не выдаётся.
/// Раз в 10 минут, даже без ждущих заказов, проверяется, что сессия кассира жива: умерла — оплата Kaspi скрывается и в лог пишется ошибка (её ловит монитор).
/// Работает, если заданы NUXT_KASPIPOS_* — независимо от NUXT_KASPI_PROVIDER (досверить старые заказы после отката).
import { checkSession, getRemoteInvoice, KaspiPosError } from '../utils/kaspipos'
import { applyKaspiPosInvoice, syncKaspiPosOrder } from '../utils/kaspiposSync'
import { kaspiOrdersToSync, kaspiposPaidUndelivered } from '../utils/orders'

const TICK_MS = 30_000
const OLD_EVERY_TICKS = 10
const SESSION_CHECK_TICKS = 20

export default defineNitroPlugin(() => {
  let running = false
  let tickNo = 0
  const tick = async () => {
    const cfg = useKaspiPos()
    if (!cfg || !useRuntimeConfig().databaseUrl || running) return
    running = true
    tickNo++
    let talked = false
    try {
      const db = await useDb()
      const allowTestDelivery = String(useRuntimeConfig().deliveryAllowTest) === '1'
      for (const o of await kaspiOrdersToSync(db, 'kaspipos')) {
        // старше часа (и потерянные, lost) — раз в 5 минут
        if (o.ageSeconds > 3600 && tickNo % OLD_EVERY_TICKS !== 0) continue
        try {
          await syncKaspiPosOrder(db, cfg, kaspiposFetch, o, { allowTestDelivery })
          talked = true
          markKaspiPosAlive()
        } catch (error) {
          if (error instanceof KaspiPosError && error.sessionDead) {
            markKaspiPosDead(error.message)
            break
          }
          console.warn(`[kaspipos-sync] заказ ${o.invId}: сверка не удалась`, error instanceof Error ? error.message : error)
        }
      }
      if (!kaspiPosDead() && tickNo % OLD_EVERY_TICKS === 0) {
        for (const o of await kaspiposPaidUndelivered(db)) {
          try {
            await applyKaspiPosInvoice(db, await getRemoteInvoice(cfg, kaspiposFetch, Number(o.providerRef)), { allowTestDelivery })
            talked = true
          } catch (error) {
            if (error instanceof KaspiPosError && error.sessionDead) {
              markKaspiPosDead(error.message)
              break
            }
            console.warn(`[kaspipos-sync] заказ ${o.invId}: проверка возврата не удалась`, error instanceof Error ? error.message : error)
          }
        }
      }
      if (!talked && tickNo % SESSION_CHECK_TICKS === 1) {
        try {
          await checkSession(cfg, kaspiposFetch)
          markKaspiPosAlive()
        } catch (error) {
          if (error instanceof KaspiPosError && error.sessionDead) markKaspiPosDead(error.message)
          else console.warn('[kaspipos-sync] проверка сессии не удалась', error instanceof Error ? error.message : error)
        }
      }
    } catch (error) {
      console.warn('[kaspipos-sync] сверка пропущена', error instanceof Error ? error.message : error)
    } finally {
      running = false
    }
  }
  const timer = setInterval(tick, TICK_MS)
  timer.unref?.()
})
