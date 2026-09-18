// Общий формат цены для всей витрины: "1 990" — с пробелом-разделителем разрядов,
// как в исходном store.js (`new Intl.NumberFormat('ru-RU')`), чтобы 1990 не выглядело
// иначе после переноса на Vue.
const formatter = new Intl.NumberFormat('ru-RU')

export function formatPrice(amount: number): string {
  return formatter.format(amount)
}

export function formatPriceWithCurrency(amount: number, currency: string): string {
  const symbol = currency === 'KZT' ? '₸' : currency
  return `${formatPrice(amount)} ${symbol}`
}
