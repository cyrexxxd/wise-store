// Общий формат цены для всей витрины: "1 990" — с пробелом-разделителем разрядов,
// как в исходном store.js (`new Intl.NumberFormat('ru-RU')`), чтобы 1990 не выглядело
// иначе после переноса на Vue.
const formatter = new Intl.NumberFormat('ru-RU')

export function formatPrice(amount: number): string {
  return formatter.format(amount)
}

const CURRENCY_SYMBOL: Record<string, string> = { KZT: '₸', RUB: '₽' }

export function formatPriceWithCurrency(amount: number, currency: string): string {
  return `${formatPrice(amount)} ${CURRENCY_SYMBOL[currency] ?? currency}`
}

/// Ориентир в тенге для цены в рублях (платёж EasyDonate идёт в рублях, игроки считают
/// в тенге). Округляем до десятков — это подсказка, а не сумма к оплате.
export function approxKzt(rub: number, kztPerRub: number): string {
  return `≈ ${formatPrice(Math.round((rub * kztPerRub) / 10) * 10)} ₸`
}
