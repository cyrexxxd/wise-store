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

/// Основная валюта витрины — тенге. EasyDonate принимает оплату только в рублях, поэтому цена
/// товара хранится в рублях, а в тенге пересчитывается по курсу из конфига (NUXT_PUBLIC_KZT_PER_RUB)
/// до целого тенге. Сумма к оплате в рублях всегда показывается рядом — списывается именно она.
export function rubToKzt(rub: number, kztPerRub: number): number {
  // toFixed: 245 × 5.3 в двоичной арифметике = 1298.4999…, без него половина округлялась бы вниз
  return Math.round(Number((rub * kztPerRub).toFixed(6)))
}

export function formatKzt(kzt: number): string {
  return `${formatPrice(kzt)} ₸`
}
