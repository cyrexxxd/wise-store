/// IP покупателя для лимитов. Render стоит за Cloudflare: CF-Connecting-IP выставляет сам Cloudflare (клиент его не
/// подменит). Иначе — ПОСЛЕДНЕЕ значение X-Forwarded-For (первое задаёт клиент), иначе — адрес соединения.
import type { H3Event } from 'h3'

export function clientIp(event: H3Event): string {
  const cf = getHeader(event, 'cf-connecting-ip')?.trim()
  if (cf) return cf
  const xff = getHeader(event, 'x-forwarded-for')
  const last = xff?.split(',').map((s) => s.trim()).filter(Boolean).pop()
  return last || event.node.req.socket?.remoteAddress || 'unknown'
}
