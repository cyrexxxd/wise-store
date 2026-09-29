/// GET /api/checkout/methods — какие способы оплаты сейчас подключены (корзина показывает только их).
/// kaspi:false, если сессия кассира умерла — на это смотрит внешний монитор (ждёт строку "kaspi":true).
export default defineEventHandler(() => {
  // без секрета хэша номера checkout отвечает 503 — не показываем Kaspi
  const hashSecret = Boolean(useRuntimeConfig().phoneHashSecret || useRuntimeConfig().apipay.webhookSecret)
  return {
    kaspi: hashSecret && (useKaspiProvider() === 'kaspipos' ? useKaspiPos() !== null && !kaspiPosDead() : useApipay() !== null),
    card: useRobokassa() !== null,
  }
})
