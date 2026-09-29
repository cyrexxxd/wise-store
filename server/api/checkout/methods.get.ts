/// GET /api/checkout/methods — какие способы оплаты сейчас подключены (корзина показывает только их).
/// kaspi:false, если сессия кассира умерла — на это смотрит внешний монитор (ждёт строку "kaspi":true).
export default defineEventHandler(() => ({
  // без секрета хэша номера (NUXT_PHONE_HASH_SECRET) checkout отвечает 503 — Kaspi не показываем
  kaspi: Boolean(useRuntimeConfig().phoneHashSecret) && useKaspiPos() !== null && !kaspiPosDead(),
  card: useRobokassa() !== null,
}))
