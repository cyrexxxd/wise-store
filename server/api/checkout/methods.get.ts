/// GET /api/checkout/methods — какие способы оплаты сейчас подключены (корзина показывает только их).
export default defineEventHandler(() => ({
  kaspi: useApipay() !== null,
  card: useRobokassa() !== null,
}))
