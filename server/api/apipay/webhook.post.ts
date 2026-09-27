/// Вебхук ApiPay (URL в кабинете ApiPay: https://wisepvp.net/api/apipay/webhook). Подпись X-Webhook-Signature =
/// HMAC-SHA256 сырого тела секретом вебхука — проверяется ДО разбора JSON. Отвечаем 200 быстро; повторы
/// одного и того же статуса безопасны (applyApipayInvoice идемпотентен).
import { verifyWebhook, type ApipayInvoice } from '../../utils/apipay'
import { applyApipayInvoice } from '../../utils/apipaySync'

export default defineEventHandler(async (event) => {
  const apipay = useApipay()
  if (!apipay) throw createError({ statusCode: 503, statusMessage: 'ApiPay не настроен' })
  const raw = (await readRawBody(event, 'utf8')) ?? ''
  if (!verifyWebhook(raw, getHeader(event, 'x-webhook-signature'), apipay.webhookSecret)) {
    console.warn('[apipay] вебхук с неверной подписью')
    throw createError({ statusCode: 401, statusMessage: 'bad signature' })
  }
  let payload: { event?: string; invoice?: ApipayInvoice }
  try {
    payload = JSON.parse(raw)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'bad json' })
  }
  // смена статуса и возврат (invoice.refunded несёт is_fully_refunded); прочие события (qr_scanned, чеки) — принять и забыть
  if ((payload.event !== 'invoice.status_changed' && payload.event !== 'invoice.refunded') || !payload.invoice || typeof payload.invoice.id !== 'number') {
    return { ok: true }
  }
  const allowTestDelivery = String(useRuntimeConfig().deliveryAllowTest) === '1'
  const result = await applyApipayInvoice(await useDb(), payload.invoice, { sandbox: apipay.sandbox, allowTestDelivery })
  if (result === 'amount_mismatch' || result === 'unknown_invoice') {
    console.error(`[apipay] счёт ${payload.invoice.id}: ${result}, amount=${payload.invoice.amount} — сверить вручную`)
  } else {
    console.info(`[apipay] счёт ${payload.invoice.id} → ${payload.invoice.status}: ${result}`)
  }
  // 200 и при «не наш счёт»: повтор ничего не изменит, а circuit breaker ApiPay не должен выключать вебхук
  return { ok: true }
})
