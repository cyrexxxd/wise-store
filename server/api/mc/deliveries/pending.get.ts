/// GET /api/mc/deliveries/pending?limit=N&online=Nick1,Nick2 — партия выдачи для плагина WiseDelivery: только
/// строки игроков в сети (строки становятся claimed). Пустой online — пустой ответ без обращения к базе.
/// Формат — контракт плагина (DeliveryDto): { id, nick, uuid, actionKind: "command", payload: "{\"template\":...}" }.
import { claimPending, NICK_LIST_RE } from '../../../utils/orders'

export default defineEventHandler(async (event) => {
  requireServerToken(event)
  const query = getQuery(event)
  const limit = Number(query.limit) || 20
  const online = String(query.online ?? '').split(',').map((n) => n.trim()).filter((n) => NICK_LIST_RE.test(n)).slice(0, 500)
  if (!online.length) return []
  const rows = await claimPending(await useDb(), limit, online)
  return rows.map((r) => ({ id: r.id, nick: r.nick, uuid: null, actionKind: 'command', payload: JSON.stringify({ template: r.command }) }))
})
