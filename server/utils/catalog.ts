/// Чистые функции преобразования товаров EasyDonate в формат витрины и проверки корзины.
/// Без Nuxt auto-imports — тестируются обычным vitest (catalog.test.ts).
import type { EasyDonateProduct } from './easydonate'

/// Тот же контракт, что PublicProduct в app/composables/useCatalogApi.ts.
export interface StoreProduct {
  slug: string
  name: string
  description: string | null
  type: string
  price: number
  currency: string
  imageKey: string | null
  sortOrder: number
}

/// Раздел витрины по товару EasyDonate. В EasyDonate тип "case" — это их собственная
/// рулетка, не наш CratesPlugin, поэтому ключи кейсов узнаём по команде выдачи givekey.
export function storeTypeOf(product: Pick<EasyDonateProduct, 'type' | 'commands'>): string {
  if (product.type === 'group') return 'rank'
  if (product.type === 'currency') return 'currency'
  if ((product.commands ?? []).some((c) => /^\/?givekey\s/i.test(c.trim()))) return 'crate_key'
  return 'other'
}

/// Команды выдачи наружу не отдаём — покупателю они не нужны.
export function toStoreProduct(product: EasyDonateProduct): StoreProduct {
  return {
    slug: String(product.id),
    name: product.name,
    description: product.description || null,
    type: storeTypeOf(product),
    price: product.price,
    currency: 'RUB',
    imageKey: null,
    sortOrder: product.sort_index ?? product.id,
  }
}

export function visibleStoreProducts(products: readonly EasyDonateProduct[], type?: string): StoreProduct[] {
  return products
    .filter((p) => !p.is_hidden)
    .map(toStoreProduct)
    .filter((p) => !type || p.type === type)
}

// Ник Java Edition: 3–16 символов, латиница, цифры и подчёркивание.
const NICK_RE = /^[A-Za-z0-9_]{3,16}$/
const MAX_QTY = 99

export interface CheckoutItemInput {
  slug: unknown
  qty: unknown
}

export type CheckoutValidation =
  | { ok: true; nick: string; products: Record<string, number> }
  | { ok: false; message: string }

/// Проверка корзины против живого каталога: цены и существование товаров берутся из
/// EasyDonate, а не из браузера, — клиент передаёт только id и количество.
export function validateCheckout(
  nick: unknown,
  items: unknown,
  catalog: readonly EasyDonateProduct[],
): CheckoutValidation {
  const cleanNick = typeof nick === 'string' ? nick.trim() : ''
  if (!NICK_RE.test(cleanNick)) {
    return { ok: false, message: 'Ник должен быть от 3 до 16 символов: латиница, цифры и _.' }
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, message: 'Корзина пуста.' }
  }

  const available = new Set(catalog.filter((p) => !p.is_hidden).map((p) => String(p.id)))
  const products: Record<string, number> = {}
  for (const item of items as CheckoutItemInput[]) {
    const slug = typeof item?.slug === 'string' ? item.slug : ''
    const qty = item?.qty
    if (!available.has(slug)) {
      return { ok: false, message: 'Один из товаров больше не продаётся. Обновите страницу и соберите корзину заново.' }
    }
    if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      return { ok: false, message: 'Неверное количество товара.' }
    }
    products[slug] = (products[slug] ?? 0) + qty
    if (products[slug] > MAX_QTY) return { ok: false, message: 'Неверное количество товара.' }
  }
  return { ok: true, nick: cleanNick, products }
}
