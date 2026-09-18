/// Подписи статуса заказа для витрины (T-18, история покупок) — слова зеркалят
/// site/admin/app/utils/status.ts (ORDER_STATUSES), чтобы игрок и администратор видели один
/// и тот же термин для одного и того же статуса. Не импортируем сам файл админки: это два
/// независимых Nuxt-приложения без общего пакета, копия нескольких строк проще, чем тянуть
/// shared-модуль ради этого.
export type OrderStatusTone = 'neutral' | 'success' | 'danger' | 'warning'

export interface OrderStatusView {
  label: string
  tone: OrderStatusTone
}

const ORDER_STATUSES: Record<string, OrderStatusView> = {
  created: { label: 'Создан', tone: 'neutral' },
  paid: { label: 'Оплачен', tone: 'success' },
  failed: { label: 'Не оплачен', tone: 'danger' },
  refunded: { label: 'Возврат', tone: 'warning' },
}

/// Неизвестный статус показываем как есть, а не прячем — тот же приём, что у admin/utils/status.ts:
/// бэкенд может завести новый статус раньше витрины, и пустая ячейка хуже незнакомого слова.
export function orderStatusView(status: string): OrderStatusView {
  return ORDER_STATUSES[status] ?? { label: status, tone: 'neutral' }
}
