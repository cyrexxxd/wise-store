/// Уведомления владельцу в Discord через вебхук канала (NUXT_DISCORD_WEBHOOK_URL). Только оповещение:
/// никогда не бросает и не задерживает оплату/выдачу — вызывать через `void`. Пустой URL — уведомления выключены.
import type { CheckoutLine } from './catalog'
import type { Db } from './orders'

const WEBHOOK_RE = /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/

type PostFn = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ status: number }>

function webhookUrl(): string {
  // вне Nitro (vitest) useRuntimeConfig не определён — уведомления просто выключены
  try { return String(useRuntimeConfig().discordWebhookUrl || '') } catch { return '' }
}

export async function notifyDiscord(text: string, deps: { url?: string; post?: PostFn } = {}): Promise<boolean> {
  const url = deps.url ?? webhookUrl()
  if (!url) return false
  if (!WEBHOOK_RE.test(url)) {
    console.warn('[discord] NUXT_DISCORD_WEBHOOK_URL не похож на вебхук Discord — уведомление не отправлено')
    return false
  }
  const post: PostFn = deps.post ?? ((u, init) => fetch(u, { ...init, signal: AbortSignal.timeout(5_000) }))
  try {
    const res = await post(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // allowed_mentions: ни ник, ни название товара не пингуют @everyone/@here/роли
      body: JSON.stringify({ content: text.slice(0, 1900), allowed_mentions: { parse: [] } }),
    })
    if (res.status >= 300) console.warn(`[discord] вебхук ответил ${res.status}`)
    return res.status < 300
  } catch (e) {
    console.warn(`[discord] не отправлено: ${e instanceof Error ? e.message : String(e)}`)
    return false
  }
}

const kzt = (n: number) => `${new Intl.NumberFormat('ru-RU').format(n).replace(/ /g, ' ')} ₸`

export function formatPaid(o: { invId: number; nick: string; items: CheckoutLine[]; amountKzt: number; provider: string; isTest: boolean }): string {
  const what = o.items.map((l) => (l.qty > 1 ? `${l.name} ×${l.qty}` : l.name)).join(', ')
  const via = o.provider === 'kaspipos' ? 'Kaspi' : o.provider === 'robokassa' ? 'Robokassa' : o.provider
  return `💰 **#${o.invId}** · \`${o.nick}\` · ${what} · **${kzt(o.amountKzt)}** · ${via}${o.isTest ? ' · ТЕСТ' : ''}`
}

/// Уведомление об оплаченном заказе: ник, товары и сумма берутся из БД.
export async function notifyOrderPaid(db: Db, invId: number): Promise<void> {
  if (!webhookUrl()) return
  try {
    const rows = await db.query<{ nick: string; items: unknown; amount_kzt: string; provider: string; is_test: boolean }>(
      'SELECT nick, items, amount_kzt, provider, is_test FROM orders WHERE inv_id = $1', [invId])
    const r = rows[0]
    if (!r) return
    const items = (typeof r.items === 'string' ? JSON.parse(r.items) : r.items) as CheckoutLine[]
    await notifyDiscord(formatPaid({ invId, nick: r.nick, items, amountKzt: Number(r.amount_kzt), provider: r.provider, isTest: r.is_test }))
  } catch (e) {
    console.warn(`[discord] заказ ${invId}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/// Тревога, требующая действий владельца (сессия кассира, возврат, неверная сумма).
export function notifyAlert(text: string): void {
  void notifyDiscord(`⚠️ ${text}`)
}
