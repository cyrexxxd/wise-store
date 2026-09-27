/// ResultURL Robokassa (метод POST или GET — как выбрано в кабинете). Проверяет подпись Паролем #2,
/// сверяет сумму с заказом и один раз ставит выдачу в очередь. Ответ OK{InvId} — Robokassa перестаёт
/// повторять уведомление; при ошибке — 400 без OK, в лог (повтор не поможет, нужна ручная сверка).
import { markPaid } from '../../utils/orders'
import { parseResult, verifyResult } from '../../utils/robokassa'

export default defineEventHandler(async (event) => {
  const robokassa = useRobokassa()
  if (!robokassa) throw createError({ statusCode: 503, statusMessage: 'Robokassa не настроена' })

  const method = event.method.toUpperCase()
  const fields: Record<string, unknown> = method === 'POST'
    ? Object.fromEntries(new URLSearchParams((await readRawBody(event, 'utf8')) ?? ''))
    : getQuery(event)
  const n = parseResult(fields)
  if (!n || !verifyResult(robokassa, n)) {
    console.warn('[robokassa] неверное уведомление', { invId: fields.InvId, outSum: fields.OutSum })
    throw createError({ statusCode: 400, statusMessage: 'bad signature' })
  }

  const db = await useDb()
  // в журнал заказа — всё, кроме подписи
  const { SignatureValue: _s, ...raw } = fields
  // тестовый заказ выдачу не получает; на локальном стенде это включается NUXT_DELIVERY_ALLOW_TEST=1
  const allowTestDelivery = String(useRuntimeConfig().deliveryAllowTest) === '1'
  const result = await markPaid(db, n.invId, n.outSum, raw, { allowTestDelivery })
  if (result === 'unknown_order' || result === 'amount_mismatch') {
    console.error(`[robokassa] заказ ${n.invId}: ${result}, OutSum=${n.outSum} — сверить вручную`)
    throw createError({ statusCode: 400, statusMessage: result })
  }
  if (result === 'refunded') console.warn(`[robokassa] уведомление по возвращённому заказу ${n.invId}`)
  else console.info(`[robokassa] заказ ${n.invId}: ${result}`)

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  return `OK${n.invId}`
})
