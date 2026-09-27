// Общий формат цены для всей витрины: "1 990" — с пробелом-разделителем разрядов (ru-RU).
const formatter = new Intl.NumberFormat('ru-RU')

export function formatPrice(amount: number): string {
  return formatter.format(amount)
}

/// Основная валюта магазина — тенге (оплата через Robokassa.kz в тенге).
export function formatKzt(kzt: number): string {
  return `${formatPrice(kzt)} ₸`
}

/// Подсказка для игроков из России: «≈ 720 ₽» по курсу из конфига, до десятков. Только ориентир —
/// списывается сумма в тенге, в рублях её пересчитывает банк.
export function approxRub(kzt: number, kztPerRub: number): string {
  if (!(kztPerRub > 0)) return ''
  return `≈ ${formatPrice(Math.round(kzt / kztPerRub / 10) * 10)} ₽`
}
