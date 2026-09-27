/// Каталог магазина — единственный источник цен и того, что выдаётся за покупку. Живёт в репозитории:
/// цену и состав заказа сервер берёт отсюда, браузер присылает только slug и количество.
/// Без Nuxt auto-imports — тестируется обычным vitest (catalog.test.ts).
///
/// Выдача — шаблоны консольных команд для плагина WiseDelivery на сервере CAT. {nick} подставляет плагин
/// (точный ник игрока в сети), {delivery} — тоже плагин: UUID строки выдачи. «wise-{delivery}» — ref для
/// CATCosmetics: уникален навсегда (не зависит от счётчика заказов), повтор «claws deliver» отбрасывается.
/// Роли — LuckPerms addtemp с накоплением срока.

/// Контракт витрины — тот же, что PublicProduct в app/composables/useCatalogApi.ts.
export interface StoreProduct {
  slug: string
  name: string
  description: string
  type: 'rank' | 'currency'
  /** Цена в тенге (целое). */
  price: number
  currency: 'KZT'
  sortOrder: number
  /** Имя иконки в public/icons (см. app/utils/productIcon.ts). */
  icon: string
  /** Цветовая тема карточки (см. store.css: .tone-*). */
  tone: string
  /** Бейдж на карточке, например «Выгоднее всего». */
  badge?: string
  /** Когти: сколько всего и сколько из них бонус. */
  amount?: number
  bonus?: number
}

export interface CatalogEntry extends StoreProduct {
  /** Шаблоны команд выдачи; {nick} и {delivery} подставляет плагин. */
  deliver: string[]
}

const ROLE_DAYS = 30

function role(slug: string, name: string, group: string, price: number, sortOrder: number, tone: string, description: string): CatalogEntry {
  return {
    slug,
    name,
    description,
    type: 'rank',
    price,
    currency: 'KZT',
    sortOrder,
    icon: `crown_${group}`,
    tone,
    deliver: [
      `lp user {nick} parent addtemp ${group} ${ROLE_DAYS}d accumulate`,
      `tellraw {nick} ${JSON.stringify([{ text: 'Магазин » ', color: 'gold' }, { text: `${name} выдана на ${ROLE_DAYS} дней. Спасибо за поддержку!`, color: 'white' }])}`,
    ],
  }
}

function claws(slug: string, amount: number, bonus: number, price: number, sortOrder: number, icon: string, badge?: string): CatalogEntry {
  return {
    slug,
    name: `${amount} Когтей`,
    description: bonus > 0
      ? `${amount - bonus} Когтей + ${bonus} бонусом. Ключи кейсов и косметика навсегда — в /cos.`
      : 'Ключи кейсов и косметика навсегда — в /cos.',
    type: 'currency',
    price,
    currency: 'KZT',
    sortOrder,
    icon,
    tone: 'claws',
    badge,
    amount,
    bonus,
    // игроку не в сети CATCosmetics ставит зачисление в очередь; повтор с тем же ref не начисляется
    deliver: [`claws deliver {nick} ${amount} wise-{delivery}`],
  }
}

export const CATALOG: readonly CatalogEntry[] = [
  role('role-cat', 'Роль CAT', 'cat', 1599, 1, 'cat', 'Вся косметика сервера, свой префикс и суффикс, создание клана. 30 дней, повторная покупка продлевает срок.'),
  role('role-wise', 'Роль Wise', 'wise', 2599, 2, 'wise', 'Всё, что даёт CAT, и больше. 30 дней, повторная покупка продлевает срок.'),
  role('role-premium', 'Роль Premium', 'premium', 3799, 3, 'premium', 'Высшая роль сервера: всё, что даёт Wise, и больше. 30 дней, повторная покупка продлевает срок.'),
  claws('claws-100', 100, 0, 500, 10, 'claws_1'),
  claws('claws-250', 250, 0, 1250, 11, 'claws_2'),
  claws('claws-500', 500, 0, 2500, 12, 'claws_3'),
  claws('claws-1100', 1100, 100, 5000, 13, 'claws_4', 'Выгоднее всего'),
]

/// Наружу — без шаблонов выдачи: покупателю они не нужны.
export function publicProducts(type?: string): StoreProduct[] {
  return CATALOG.filter((p) => !type || p.type === type).map(({ deliver: _deliver, ...pub }) => pub)
}

export function findProduct(slug: string): CatalogEntry | undefined {
  return CATALOG.find((p) => p.slug === slug)
}

// Ник Java Edition: 3–16 символов, латиница, цифры и подчёркивание.
export const NICK_RE = /^[A-Za-z0-9_]{3,16}$/
const MAX_QTY = 20

export interface CheckoutLine {
  slug: string
  qty: number
  name: string
  price: number
  /** Шаблоны выдачи на момент заказа: товар могут убрать из каталога до оплаты. */
  deliver: string[]
}

export type CheckoutValidation =
  | { ok: true; nick: string; lines: CheckoutLine[]; total: number }
  | { ok: false; message: string }

/// Проверка корзины против каталога: цены и существование товаров — отсюда, не из браузера.
export function validateCheckout(nick: unknown, items: unknown): CheckoutValidation {
  const cleanNick = typeof nick === 'string' ? nick.trim() : ''
  if (!NICK_RE.test(cleanNick)) {
    return { ok: false, message: 'Ник должен быть от 3 до 16 символов: латиница, цифры и _.' }
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, message: 'Корзина пуста.' }
  }
  const qtyBySlug = new Map<string, number>()
  for (const item of items as Array<{ slug?: unknown; qty?: unknown }>) {
    const slug = typeof item?.slug === 'string' ? item.slug : ''
    const qty = item?.qty
    if (!findProduct(slug)) {
      return { ok: false, message: 'Один из товаров больше не продаётся. Обновите страницу и соберите корзину заново.' }
    }
    if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      return { ok: false, message: 'Неверное количество товара.' }
    }
    const merged = (qtyBySlug.get(slug) ?? 0) + qty
    if (merged > MAX_QTY) return { ok: false, message: 'Неверное количество товара.' }
    qtyBySlug.set(slug, merged)
  }
  const lines = [...qtyBySlug].map(([slug, qty]) => {
    const p = findProduct(slug)!
    return { slug, qty, name: p.name, price: p.price, deliver: [...p.deliver] }
  })
  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0)
  return { ok: true, nick: cleanNick, lines, total }
}

/// Команды выдачи оплаченного заказа: по строке на каждую единицу товара (две роли — два срока,
/// два пакета Когтей — два зачисления, у каждой строки свой UUID → свой ref). lineNo уникален в заказе.
/// Шаблоны — из самого заказа (снимок при оформлении); у старых заказов без снимка — из каталога.
export function deliveryCommands(lines: readonly Pick<CheckoutLine, 'slug' | 'qty' | 'deliver'>[]): Array<{ lineNo: number; template: string }> {
  const out: Array<{ lineNo: number; template: string }> = []
  let lineNo = 0
  for (const line of lines) {
    const templates = line.deliver ?? findProduct(line.slug)?.deliver
    if (!templates?.length) throw new Error(`товар ${line.slug} без команд выдачи`)
    for (let unit = 0; unit < line.qty; unit++) {
      for (const template of templates) {
        lineNo++
        out.push({ lineNo, template })
      }
    }
  }
  return out
}
