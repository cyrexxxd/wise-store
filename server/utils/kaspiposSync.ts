/// Применение статуса счёта Kaspi (кассир, kaspipos) к заказу — общий путь для страницы ожидания и фоновой
/// сверки. Вебхуков у Kaspi нет: оплату узнаём только опросом. Идемпотентно: повтор paid → already_paid.
/// Песочницы нет — любая оплата настоящая и получает выдачу.
import { commentPrefix, findInvoiceByComment, getRemoteInvoice, type FetchFn, type KaspiInvoice, type KaspiPosConfig } from './kaspipos'
import { notifyAlert, notifyOrderPaid } from './discord'
import { linkProviderRef, markPaid, orderByProviderRef, refundOrder, setProviderStatus, type Db, type PaidResult } from './orders'

export type KaspiPosApplyResult = PaidResult | 'status_saved' | 'unknown_invoice' | 'refunded' | 'not_found'

/// Сколько ждать счёт, ответ на создание которого потерялся: дольше — заказ помечается lost (страница скажет
/// «Kaspi не смог выставить счёт», корзина цела), но поиск по комментарию продолжается до 25 ч (раз в 5 мин):
/// найдётся — привяжется и оплатится как обычно.
const LOST_INVOICE_SECONDS = 600

export async function applyKaspiPosInvoice(db: Db, inv: KaspiInvoice, opts: { allowTestDelivery: boolean }): Promise<KaspiPosApplyResult> {
  const order = await orderByProviderRef(db, 'kaspipos', String(inv.id))
  if (!order) {
    if (inv.status === 'paid') {
      console.error(`[kaspipos] счёт ${inv.id} оплачен, но заказ с ним не найден — сверить вручную`)
      notifyAlert(`Счёт Kaspi ${inv.id} оплачен, но заказ с ним не найден — сверить вручную`)
    }
    return 'unknown_invoice'
  }
  if (inv.status === 'unknown') console.warn(`[kaspipos] заказ ${order.invId}: незнакомый статус Kaspi «${inv.rawStatus}» — заказ ждёт`)

  // возврат делают в приложении Kaspi Pay: статус счёта остаётся Processed, растёт сумма возвратов
  const full = inv.returnedKzt > 0 && inv.amountKzt !== null && inv.returnedKzt >= inv.amountKzt
  const status = inv.returnedKzt > 0 && !full ? 'partially_refunded' : inv.status
  if (order.providerStatus !== status) {
    await setProviderStatus(db, order.invId, status)
    if (status === 'partially_refunded') {
      console.error(`[kaspipos] заказ ${order.invId}: частичный возврат ${inv.returnedKzt} ₸ из ${inv.amountKzt} — проверить вручную`)
      notifyAlert(`Заказ #${order.invId}: частичный возврат ${inv.returnedKzt} ₸ из ${inv.amountKzt} — проверить вручную`)
    }
  }
  if (full) {
    if (order.status === 'refunded') return 'refunded'
    const r = await refundOrder(db, order.invId)
    if (r.delivered > 0) {
      console.error(`[kaspipos] заказ ${order.invId} возвращён, но ${r.delivered} строк уже выдано — снять вручную`)
      notifyAlert(`↩️ Заказ #${order.invId} возвращён, но ${r.delivered} строк уже выдано — снять в игре вручную`)
    } else {
      console.info(`[kaspipos] заказ ${order.invId} возвращён`)
      notifyAlert(`↩️ Заказ #${order.invId} возвращён до выдачи — выдача отменена`)
    }
    return 'refunded'
  }
  if (inv.status !== 'paid') return 'status_saved'
  if (inv.amountKzt === null) {
    console.error(`[kaspipos] заказ ${order.invId}: оплачен, но Kaspi не отдал сумму — сверить вручную`)
    notifyAlert(`Заказ #${order.invId}: оплачен, но Kaspi не отдал сумму — сверить вручную`)
    return 'status_saved'
  }
  const result = await markPaid(db, order.invId, String(inv.amountKzt), { kaspipos: { id: inv.id, status: inv.rawStatus, amount: inv.amountKzt } }, {
    provider: 'kaspipos',
    isTest: false,
    allowTestDelivery: opts.allowTestDelivery,
  })
  if (result === 'paid' || result === 'paid_test') void notifyOrderPaid(db, order.invId)
  if (result === 'amount_mismatch' || result === 'unknown_order') {
    console.error(`[kaspipos] заказ ${order.invId}: оплата ${inv.amountKzt} ₸ не зачтена (${result}) — сверить вручную`)
    notifyAlert(`Заказ #${order.invId}: оплата ${inv.amountKzt} ₸ не зачтена (${result}) — сверить вручную`)
  }
  return result
}

/// Сверить один неоплаченный заказ: по номеру счёта, а если связь не записалась — найти счёт по комментарию.
export async function syncKaspiPosOrder(db: Db, cfg: KaspiPosConfig, fetchFn: FetchFn,
  o: { invId: number; providerRef: string | null; ageSeconds: number }, opts: { allowTestDelivery: boolean }): Promise<KaspiPosApplyResult> {
  let ref = o.providerRef
  if (!ref) {
    const found = await findInvoiceByComment(cfg, fetchFn, commentPrefix(o.invId))
    if (found === null) {
      if (o.ageSeconds > LOST_INVOICE_SECONDS) await setProviderStatus(db, o.invId, 'lost')
      return 'not_found'
    }
    if (!(await linkProviderRef(db, o.invId, String(found), 'kaspipos'))) return 'unknown_invoice'
    console.info(`[kaspipos] заказ ${o.invId}: счёт ${found} найден по комментарию и привязан`)
    ref = String(found)
  }
  return applyKaspiPosInvoice(db, await getRemoteInvoice(cfg, fetchFn, Number(ref)), opts)
}
