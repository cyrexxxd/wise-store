/// Заказы и очередь выдачи в Postgres. Чистая логика поверх интерфейса Db — в проде это postgres.js
/// (server/utils/db.ts), в тестах PGlite (настоящий Postgres в WASM), поэтому транзакции и FOR UPDATE
/// проверяются по-настоящему.
///
/// Жизнь заказа: pending (ссылка выдана) → paid (ResultURL прошёл проверку, строки выдачи созданы).
/// Жизнь строки выдачи: pending → claimed (плагин забрал) → done | failed (плагин подтвердил).
/// Игрок не в сети — плагин не подтверждает, строка через CLAIM_TIMEOUT возвращается в pending.
/// Тестовый заказ (Robokassa IsTest) выдачу НЕ получает — иначе тестовая «оплата» раздавала бы товар даром;
/// исключение — явный allowTestDelivery (только локальный стенд).
import { deliveryCommands, type CheckoutLine } from './catalog'
import { sameAmount } from './robokassa'

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>
  tx<T>(fn: (q: Db) => Promise<T>): Promise<T>
}

/// Через сколько незаподтверждённая строка снова отдаётся плагину. Плагин не начинает новые строки
/// партии позже 60 с после её получения — запас вдвое.
export const CLAIM_TIMEOUT_SECONDS = 120

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS orders (
  inv_id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nick        TEXT NOT NULL,
  items       JSONB NOT NULL,
  amount_kzt  NUMERIC(12,2) NOT NULL CHECK (amount_kzt > 0),
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded')),
  is_test     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at     TIMESTAMPTZ,
  result_raw  JSONB
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'robokassa';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_ref TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS provider_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS public_token UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone_hash TEXT;
CREATE INDEX IF NOT EXISTS orders_phone_hash ON orders (phone_hash) WHERE phone_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_ref ON orders (provider, provider_ref) WHERE provider_ref IS NOT NULL;
CREATE TABLE IF NOT EXISTS deliveries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inv_id       INTEGER NOT NULL REFERENCES orders(inv_id),
  line_no      INTEGER NOT NULL,
  nick         TEXT NOT NULL,
  command      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimed','done','failed')),
  attempts     INTEGER NOT NULL DEFAULT 0,
  claimed_at   TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  error        TEXT,
  UNIQUE (inv_id, line_no)
);
CREATE INDEX IF NOT EXISTS deliveries_queue ON deliveries (status, lower(nick), inv_id, line_no);
`

export async function ensureSchema(db: Db): Promise<void> {
  for (const stmt of SCHEMA.split(';').map((s) => s.trim()).filter(Boolean)) await db.query(stmt)
}

/// Провайдер новых заказов: robokassa (карта) или kaspipos (счёт Kaspi по номеру, напрямую от кассира).
/// В старых строках БД бывают и другие значения provider — такие заказы только показываются, не сверяются.
export type Provider = 'robokassa' | 'kaspipos'

/// Новый заказ. token — секрет страницы ожидания оплаты (номер заказа последовательный, по нему одному статус не отдаём).
export async function createOrder(db: Db, nick: string, lines: readonly CheckoutLine[], totalKzt: number, isTest: boolean,
  provider: Provider = 'robokassa', phoneHash: string | null = null): Promise<{ invId: number; token: string }> {
  const rows = await db.query<{ inv_id: number; public_token: string }>(
    'INSERT INTO orders (nick, items, amount_kzt, is_test, provider, phone_hash) VALUES ($1, $2::jsonb, $3, $4, $5, $6) RETURNING inv_id, public_token::text AS public_token',
    [nick, JSON.stringify(lines), totalKzt, isTest, provider, phoneHash],
  )
  return { invId: Number(rows[0]!.inv_id), token: rows[0]!.public_token }
}

/// Счёт у платёжного сервиса выставлен — запомнить его id (для вебхука и сверки статуса).
export async function setProviderRef(db: Db, invId: number, ref: string, status: string | null): Promise<void> {
  await db.query('UPDATE orders SET provider_ref = $2, provider_status = $3 WHERE inv_id = $1', [invId, ref, status])
}

/// Неоплаченные счета Kaspi на этот номер за сутки (кроме отменённых/истёкших) — защита от спама счетами чужим людям.
export async function openKaspiInvoicesForPhone(db: Db, phoneHash: string): Promise<number> {
  const rows = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM orders WHERE provider = 'kaspipos' AND phone_hash = $1 AND status = 'pending'
       AND created_at > now() - interval '24 hours' AND coalesce(provider_status, '') NOT IN ('cancelled', 'expired', 'error')`,
    [phoneHash],
  )
  return Number(rows[0]!.n)
}

/// Счета Kaspi, выставленные с начала суток по Алматы: защита от спама счетами (у кассира лимита тарифа
/// нет, но частые счета заметны антифроду Kaspi).
export async function kaspiInvoicesToday(db: Db): Promise<number> {
  const rows = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM orders WHERE provider = 'kaspipos'
       AND created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Almaty') AT TIME ZONE 'Asia/Almaty')`,
  )
  return Number(rows[0]!.n)
}

/// Привязать счёт к заказу, если связь не записалась при выставлении (только если ещё не привязан).
export async function linkProviderRef(db: Db, invId: number, ref: string, provider: Provider): Promise<boolean> {
  const rows = await db.query(
    `UPDATE orders SET provider_ref = $2 WHERE inv_id = $1 AND provider = $3 AND provider_ref IS NULL RETURNING inv_id`,
    [invId, ref, provider],
  )
  return rows.length > 0
}

/// Полный возврат: заказ refunded, невыданные строки выдачи снимаются (уже выданное снимает администратор вручную).
export async function refundOrder(db: Db, invId: number): Promise<{ undelivered: number; delivered: number }> {
  return db.tx(async (q) => {
    await q.query(`UPDATE orders SET status = 'refunded' WHERE inv_id = $1`, [invId])
    const cancelled = await q.query(
      `UPDATE deliveries SET status = 'failed', error = 'refunded' WHERE inv_id = $1 AND status IN ('pending', 'claimed') RETURNING id`,
      [invId],
    )
    const done = await q.query(`SELECT 1 FROM deliveries WHERE inv_id = $1 AND status = 'done'`, [invId])
    return { undelivered: cancelled.length, delivered: done.length }
  })
}

export interface KaspiOrderToSync { invId: number; providerRef: string | null; ageSeconds: number }

/// Неоплаченные заказы кассира Kaspi (kaspipos) моложе 25 ч (счёт живёт 24 ч) — для фоновой сверки со статусом в Kaspi.
/// Без заказов, у которых счёта точно нет (не привязан и помечен error), и без окончательных статусов
/// (отклонён/истёк — у Kaspi в оплату не переходят). Заказы других провайдеров сюда не попадают.
export async function kaspiOrdersToSync(db: Db, limit = 100): Promise<KaspiOrderToSync[]> {
  const rows = await db.query<{ inv_id: number; provider_ref: string | null; age: string }>(
    `SELECT inv_id, provider_ref, extract(epoch FROM now() - created_at)::int::text AS age FROM orders
      WHERE provider = 'kaspipos' AND status = 'pending' AND created_at > now() - interval '25 hours'
        AND NOT (provider_ref IS NULL AND coalesce(provider_status, '') = 'error')
        AND coalesce(provider_status, '') NOT IN ('cancelled', 'expired')
      ORDER BY created_at DESC LIMIT $1`,
    [limit],
  )
  return rows.map((r) => ({ invId: Number(r.inv_id), providerRef: r.provider_ref, ageSeconds: Number(r.age) }))
}

/// Оплаченные заказы кассира Kaspi (kaspipos) с ещё не выданными строками — проверить, не вернули ли деньги:
/// вебхука о возврате у Kaspi нет, а невыданное после возврата выдавать нельзя (игрок не в сети, владелец вернул).
export async function kaspiposPaidUndelivered(db: Db, limit = 20): Promise<Array<{ invId: number; providerRef: string }>> {
  const rows = await db.query<{ inv_id: number; provider_ref: string }>(
    `SELECT o.inv_id, o.provider_ref FROM orders o WHERE o.provider = 'kaspipos' AND o.status = 'paid' AND o.provider_ref IS NOT NULL
        AND o.paid_at > now() - interval '25 hours'
        AND EXISTS (SELECT 1 FROM deliveries d WHERE d.inv_id = o.inv_id AND d.status IN ('pending', 'claimed'))
      ORDER BY o.paid_at DESC LIMIT $1`,
    [limit],
  )
  return rows.map((r) => ({ invId: Number(r.inv_id), providerRef: r.provider_ref }))
}

export async function setProviderStatus(db: Db, invId: number, status: string): Promise<void> {
  await db.query('UPDATE orders SET provider_status = $2 WHERE inv_id = $1', [invId, status])
}

export interface OrderView {
  invId: number
  status: string
  /// строка из БД: у старых заказов бывают провайдеры, которых в Provider больше нет
  provider: string
  providerRef: string | null
  providerStatus: string | null
  amountKzt: number
  isTest: boolean
  createdAt: string
}

const ORDER_VIEW = `inv_id, status, provider, provider_ref, provider_status, amount_kzt, is_test, created_at::text AS created_at`
const toView = (r: Record<string, unknown>): OrderView => ({
  invId: Number(r.inv_id), status: String(r.status), provider: String(r.provider), providerRef: (r.provider_ref as string) ?? null,
  providerStatus: (r.provider_status as string) ?? null, amountKzt: Number(r.amount_kzt), isTest: Boolean(r.is_test), createdAt: String(r.created_at),
})

/// Заказ для страницы ожидания оплаты — только по паре (номер, секретный токен).
export async function orderByToken(db: Db, invId: number, token: string): Promise<OrderView | null> {
  const rows = await db.query(`SELECT ${ORDER_VIEW} FROM orders WHERE inv_id = $1 AND public_token = $2::uuid`, [invId, token])
  return rows[0] ? toView(rows[0]) : null
}

const TERMINAL_FAIL = new Set(['cancelled', 'expired', 'error', 'lost'])

export interface PayPageState {
  state: 'pending' | 'paid' | 'failed' | 'refunded'
  providerStatus: string | null
  /// заказ не kaspipos (старый провайдер, отключён): сайт его больше не проверяет — только поддержка
  legacy: boolean
}

/// Состояние заказа для страницы ожидания оплаты /pay. Неоплаченный заказ не kaspipos никто больше не сверяет —
/// отдаём его завершённым (failed/expired, legacy), чтобы страница не ждала вечно, а отправила в поддержку.
/// У kaspipos cancelled/expired/error/lost показываются как failed, но страница ещё проверяет (оплата в последний момент).
export function payPageState(order: Pick<OrderView, 'status' | 'provider' | 'providerStatus'>): PayPageState {
  const legacy = order.provider !== 'kaspipos'
  if (order.status === 'paid') return { state: 'paid', providerStatus: order.providerStatus, legacy }
  if (order.status === 'refunded') return { state: 'refunded', providerStatus: order.providerStatus, legacy }
  if (legacy) return { state: 'failed', providerStatus: 'expired', legacy }
  const failed = order.providerStatus !== null && TERMINAL_FAIL.has(order.providerStatus)
  return { state: failed ? 'failed' : 'pending', providerStatus: order.providerStatus, legacy }
}

export async function orderByProviderRef(db: Db, provider: Provider, ref: string): Promise<OrderView | null> {
  const rows = await db.query(`SELECT ${ORDER_VIEW} FROM orders WHERE provider = $1 AND provider_ref = $2`, [provider, ref])
  return rows[0] ? toView(rows[0]) : null
}

export type PaidResult = 'paid' | 'paid_test' | 'already_paid' | 'unknown_order' | 'amount_mismatch' | 'refunded'

/// Обработка проверенного (по подписи) уведомления: один раз переводит заказ в paid и создаёт строки
/// выдачи. Повтор уведомления — already_paid без новых строк (блокировка строки + UNIQUE(inv_id, line_no)).
/// Тестовый заказ — paid_test: оплачен, но строк выдачи нет (если не allowTestDelivery).
export async function markPaid(db: Db, invId: number, outSum: string, raw: Record<string, unknown>,
  opts: { allowTestDelivery?: boolean; provider?: Provider; forceTest?: boolean; isTest?: boolean } = {}): Promise<PaidResult> {
  return db.tx(async (q) => {
    const rows = await q.query<{ nick: string; items: unknown; amount_kzt: string; status: string; is_test: boolean; provider: string }>(
      'SELECT nick, items, amount_kzt, status, is_test, provider FROM orders WHERE inv_id = $1 FOR UPDATE',
      [invId],
    )
    const order = rows[0]
    if (!order) return 'unknown_order'
    // уведомление одного платёжного сервиса не может оплатить заказ, выставленный через другой
    if (opts.provider && order.provider !== opts.provider) return 'unknown_order'
    if (!sameAmount(outSum, Number(order.amount_kzt))) return 'amount_mismatch'
    if (order.status === 'paid') return 'already_paid'
    if (order.status === 'refunded') return 'refunded'
    await q.query("UPDATE orders SET status = 'paid', paid_at = now(), result_raw = $2::jsonb WHERE inv_id = $1", [invId, JSON.stringify(raw)])
    // тестовый заказ или тестовая (песочная) оплата — без выдачи
    // isTest (если передан) — решение платёжного сервиса об этой оплате; иначе — флаг заказа
    const test = opts.isTest ?? (order.is_test || Boolean(opts.forceTest))
    if (test && !opts.allowTestDelivery) return 'paid_test'
    const lines = (typeof order.items === 'string' ? JSON.parse(order.items) : order.items) as CheckoutLine[]
    for (const cmd of deliveryCommands(lines)) {
      await q.query(
        'INSERT INTO deliveries (inv_id, line_no, nick, command) VALUES ($1, $2, $3, $4) ON CONFLICT (inv_id, line_no) DO NOTHING',
        [invId, cmd.lineNo, order.nick, cmd.template],
      )
    }
    return 'paid'
  })
}

export interface PendingDelivery {
  id: string
  nick: string
  command: string
}

/// Отдать плагину партию выдачи для игроков В СЕТИ (online — их ники от плагина): сначала вернуть в очередь
/// зависшие claimed, затем захватить до limit строк этих игроков по порядку заказа и строк (SKIP LOCKED —
/// два одновременных опроса не получат одну строку). Строки игроков не в сети не трогаются вовсе:
/// опечатка в нике не забивает очередь, пустой онлайн не ходит в базу (см. pending.get.ts).
export async function claimPending(db: Db, limit: number, online: readonly string[]): Promise<PendingDelivery[]> {
  const nicks = [...new Set(online.map((n) => n.toLowerCase()))]
  if (!nicks.length) return []
  return db.tx(async (q) => {
    await q.query(
      `UPDATE deliveries SET status = 'pending', claimed_at = NULL
        WHERE status = 'claimed' AND claimed_at < now() - make_interval(secs => $1)`,
      [CLAIM_TIMEOUT_SECONDS],
    )
    return q.query<PendingDelivery>(
      `WITH picked AS (
         SELECT id FROM deliveries
          WHERE status = 'pending' AND lower(nick) = ANY($2::text[])
          ORDER BY inv_id, line_no LIMIT $1 FOR UPDATE SKIP LOCKED
       ), claimed AS (
         UPDATE deliveries d SET status = 'claimed', claimed_at = now(), attempts = d.attempts + 1
           FROM picked WHERE d.id = picked.id
         RETURNING d.id, d.nick, d.command, d.inv_id, d.line_no
       )
       SELECT id::text AS id, nick, command FROM claimed ORDER BY inv_id, line_no`,
      [Math.max(1, Math.min(limit, 50)), nicks],
    )
  })
}

/// Подтверждение плагина. Повторное подтверждение того же исхода безопасно; уже done не меняется.
/// false — строки нет (неверный id).
export async function confirmDelivery(db: Db, id: string, success: boolean, error: string | null): Promise<boolean> {
  // строку отменили возвратом, пока плагин её выдавал: товар в игре уже есть — фиксируем это, а не прячем
  const rows = await db.query<{ id: string; inv_id: number; after_refund: boolean }>(
    `WITH prev AS (SELECT id, (status = 'failed' AND error = 'refunded') AS after_refund FROM deliveries WHERE id = $1::uuid)
     UPDATE deliveries d SET status = CASE WHEN d.status = 'done' THEN 'done' WHEN $2 THEN 'done' ELSE 'failed' END,
            confirmed_at = COALESCE(d.confirmed_at, now()),
            error = CASE WHEN $2 AND prev.after_refund THEN 'delivered after refund' WHEN $2 THEN d.error ELSE $3 END
       FROM prev WHERE d.id = prev.id RETURNING d.id::text AS id, d.inv_id, prev.after_refund`,
    [id, success, error?.slice(0, 500) ?? null],
  )
  if (success && rows[0]?.after_refund) console.error(`[delivery] заказ ${rows[0].inv_id}: строка выдана ПОСЛЕ возврата денег — снять вручную`)
  return rows.length > 0
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const NICK_LIST_RE = /^[A-Za-z0-9_]{3,16}$/
