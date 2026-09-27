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

export type Provider = 'robokassa' | 'apipay'

/// Новый заказ. token — секрет страницы ожидания оплаты (номер заказа последовательный, по нему одному статус не отдаём).
export async function createOrder(db: Db, nick: string, lines: readonly CheckoutLine[], totalKzt: number, isTest: boolean,
  provider: Provider = 'robokassa'): Promise<{ invId: number; token: string }> {
  const rows = await db.query<{ inv_id: number; public_token: string }>(
    'INSERT INTO orders (nick, items, amount_kzt, is_test, provider) VALUES ($1, $2::jsonb, $3, $4, $5) RETURNING inv_id, public_token::text AS public_token',
    [nick, JSON.stringify(lines), totalKzt, isTest, provider],
  )
  return { invId: Number(rows[0]!.inv_id), token: rows[0]!.public_token }
}

/// Счёт у платёжного сервиса выставлен — запомнить его id (для вебхука и сверки статуса).
export async function setProviderRef(db: Db, invId: number, ref: string, status: string | null): Promise<void> {
  await db.query('UPDATE orders SET provider_ref = $2, provider_status = $3 WHERE inv_id = $1', [invId, ref, status])
}

export async function setProviderStatus(db: Db, invId: number, status: string): Promise<void> {
  await db.query('UPDATE orders SET provider_status = $2 WHERE inv_id = $1', [invId, status])
}

export interface OrderView {
  invId: number
  status: string
  provider: Provider
  providerRef: string | null
  providerStatus: string | null
  amountKzt: number
  isTest: boolean
  createdAt: string
}

const ORDER_VIEW = `inv_id, status, provider, provider_ref, provider_status, amount_kzt, is_test, created_at::text AS created_at`
const toView = (r: Record<string, unknown>): OrderView => ({
  invId: Number(r.inv_id), status: String(r.status), provider: r.provider as Provider, providerRef: (r.provider_ref as string) ?? null,
  providerStatus: (r.provider_status as string) ?? null, amountKzt: Number(r.amount_kzt), isTest: Boolean(r.is_test), createdAt: String(r.created_at),
})

/// Заказ для страницы ожидания оплаты — только по паре (номер, секретный токен).
export async function orderByToken(db: Db, invId: number, token: string): Promise<OrderView | null> {
  const rows = await db.query(`SELECT ${ORDER_VIEW} FROM orders WHERE inv_id = $1 AND public_token = $2::uuid`, [invId, token])
  return rows[0] ? toView(rows[0]) : null
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
  opts: { allowTestDelivery?: boolean; provider?: Provider; forceTest?: boolean } = {}): Promise<PaidResult> {
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
    if ((order.is_test || opts.forceTest) && !opts.allowTestDelivery) return 'paid_test'
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
  const rows = await db.query<{ id: string }>(
    `UPDATE deliveries SET status = CASE WHEN status = 'done' THEN 'done' WHEN $2 THEN 'done' ELSE 'failed' END,
            confirmed_at = COALESCE(confirmed_at, now()), error = CASE WHEN $2 THEN error ELSE $3 END
      WHERE id = $1::uuid RETURNING id::text AS id`,
    [id, success, error?.slice(0, 500) ?? null],
  )
  return rows.length > 0
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const NICK_LIST_RE = /^[A-Za-z0-9_]{3,16}$/
