/// Применение статуса счёта ApiPay к заказу — общий путь для вебхука, страницы ожидания и фоновой сверки.
/// Идемпотентно: повтор paid → already_paid.
///
/// Песочница определяется по самому счёту (is_sandbox от ApiPay), а не по настройке сайта: ключ ApiPay общий для
/// песочницы и боевого режима, режим переключается в кабинете — настоящая оплата всегда получает выдачу.
import { invoiceForLog, type ApipayInvoice } from './apipay'
import { linkProviderRef, markPaid, orderByProviderRef, refundOrder, setProviderStatus, type Db, type PaidResult } from './orders'

export type ApplyResult = PaidResult | 'status_saved' | 'unknown_invoice' | 'refunded'

export async function applyApipayInvoice(db: Db, inv: ApipayInvoice, opts: { sandbox: boolean; allowTestDelivery: boolean }): Promise<ApplyResult> {
  let order = await orderByProviderRef(db, 'apipay', String(inv.id))
  // связь «заказ ↔ счёт» не записалась при выставлении (таймаут, сбой БД) — ищем по нашему номеру заказа
  // и привязываем, только если заказ ещё ни к какому счёту не привязан
  if (!order && inv.external_order_id && /^\d+$/.test(inv.external_order_id)) {
    if (await linkProviderRef(db, Number(inv.external_order_id), String(inv.id))) order = await orderByProviderRef(db, 'apipay', String(inv.id))
  }
  if (!order || (inv.external_order_id && inv.external_order_id !== String(order.invId))) return 'unknown_invoice'
  await setProviderStatus(db, order.invId, inv.status)

  if (inv.is_fully_refunded === true) {
    const r = await refundOrder(db, order.invId)
    if (r.delivered > 0) console.error(`[apipay] заказ ${order.invId} возвращён, но ${r.delivered} строк уже выдано — снять вручную`)
    return 'refunded'
  }
  if (inv.status === 'partially_refunded' && order.status !== 'paid') {
    console.error(`[apipay] заказ ${order.invId}: частичный возврат по неоплаченному у нас заказу — проверить вручную`)
    return 'status_saved'
  }
  if (inv.status !== 'paid') return 'status_saved'

  const isTest = inv.is_sandbox !== false
  if (!isTest && opts.sandbox) {
    console.error(`[apipay] заказ ${order.invId}: БОЕВАЯ оплата, а сайт в режиме песочницы (NUXT_APIPAY_SANDBOX) — выдаём, поправьте настройку`)
  }
  return markPaid(db, order.invId, String(inv.amount), { apipay: invoiceForLog(inv) }, {
    provider: 'apipay',
    isTest,
    allowTestDelivery: opts.allowTestDelivery,
  })
}
