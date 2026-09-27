/// POST /api/mc/deliveries/{id}/confirm { success, error } → 204. Повтор того же подтверждения безопасен.
import { confirmDelivery, UUID_RE } from '../../../../utils/orders'

export default defineEventHandler(async (event) => {
  requireServerToken(event)
  const id = getRouterParam(event, 'id') ?? ''
  if (!UUID_RE.test(id)) throw createError({ statusCode: 400, statusMessage: 'bad id' })
  const body = await readBody<{ success?: unknown; error?: unknown }>(event)
  if (typeof body?.success !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'success required' })
  const error = typeof body.error === 'string' ? body.error : null
  const found = await confirmDelivery(await useDb(), id, body.success, error)
  if (!found) throw createError({ statusCode: 404, statusMessage: 'unknown delivery' })
  if (!body.success) console.error(`[delivery] ${id} не выдана: ${error}`)
  setResponseStatus(event, 204)
  return null
})
