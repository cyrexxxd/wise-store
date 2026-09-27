/// Применение статуса счёта ApiPay к заказу — общий путь для вебхука и для сверки со страницы ожидания оплаты
/// (если вебхук потерялся, страница спрашивает ApiPay сама). Идемпотентно: повтор paid → already_paid.
import type { ApipayInvoice } from './apipay'
import { markPaid, orderByProviderRef, setProviderStatus, type Db, type PaidResult } from './orders'

export type ApplyResult = PaidResult | 'status_saved' | 'unknown_invoice'

export async function applyApipayInvoice(db: Db, inv: ApipayInvoice, opts: { sandbox: boolean; allowTestDelivery: boolean }): Promise<ApplyResult> {
  const order = await orderByProviderRef(db, 'apipay', String(inv.id))
  // счёт ищем по нашему id счёта ApiPay; external_order_id — только перекрёстная проверка
  if (!order || (inv.external_order_id && inv.external_order_id !== String(order.invId))) return 'unknown_invoice'
  await setProviderStatus(db, order.invId, inv.status)
  if (inv.status !== 'paid') return 'status_saved'
  return markPaid(db, order.invId, String(inv.amount), { apipay: inv }, {
    provider: 'apipay',
    // счёт песочницы — не настоящие деньги, даже если заказ создан в боевом режиме
    forceTest: opts.sandbox || inv.is_sandbox === true,
    allowTestDelivery: opts.allowTestDelivery,
  })
}
