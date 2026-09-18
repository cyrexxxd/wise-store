/// Корзина витрины — перенос store.js (раздел "корзина") с localStorage на Vue-реактивность.
/// Логика намеренно вынесена в чистые функции (add/change/remove/count/total, parse) —
/// они тестируются без Nuxt-окружения, как useProductsAdminApi.ts в админке.
/// Персистентность в localStorage подключается отдельным клиентским плагином
/// (app/plugins/cart-persist.client.ts), не здесь — сам композабл не трогает localStorage
/// напрямую, чтобы не падать при SSR.

export interface CartItem {
  slug: string
  name: string
  price: number
  icon: string
  qty: number
}

export const CART_STORAGE_KEY = 'wise.cart.v1'
export const NICK_STORAGE_KEY = 'wise.nick.v1'

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.slug === 'string' &&
    typeof v.name === 'string' &&
    typeof v.price === 'number' &&
    typeof v.icon === 'string' &&
    typeof v.qty === 'number' &&
    v.qty > 0
  )
}

/// Разбор значения из localStorage. Испорченный/чужой JSON не должен ронять страницу —
/// корзина просто оказывается пустой, как и было в оригинальном store.js (try/catch → []).
export function parseCartItems(raw: string | null): CartItem[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isCartItem) : []
  } catch {
    return []
  }
}

/// Добавление товара: если slug уже в корзине — увеличиваем qty, иначе добавляем новую строку.
/// Возвращает новый массив (иммутабельно), не трогает items.
export function addCartItem(items: readonly CartItem[], item: Omit<CartItem, 'qty'>): CartItem[] {
  const existing = items.find((i) => i.slug === item.slug)
  if (existing) {
    return items.map((i) => (i.slug === item.slug ? { ...i, qty: i.qty + 1 } : i))
  }
  return [...items, { ...item, qty: 1 }]
}

/// +/- в модалке корзины. qty <= 0 после изменения — строка убирается целиком, как в
/// оригинальном store.js (`if (items[i].qty < 1) items.splice(i, 1)`).
export function changeCartItemQty(items: readonly CartItem[], slug: string, delta: number): CartItem[] {
  return items.map((i) => (i.slug === slug ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0)
}

export function removeCartItem(items: readonly CartItem[], slug: string): CartItem[] {
  return items.filter((i) => i.slug !== slug)
}

export function cartItemCount(items: readonly CartItem[]): number {
  return items.reduce((sum, i) => sum + i.qty, 0)
}

export function cartTotal(items: readonly CartItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0)
}

/// Общее состояние корзины на всё приложение (useState — SSR-safe, per-request на сервере,
/// разделяемое между компонентами на клиенте). Ключи 'cart-*' устойчивы к HMR/повторным
/// вызовам композабла из разных компонентов — Nuxt переиспользует один и тот же стейт.
export function useCart() {
  const items = useState<CartItem[]>('cart-items', () => [])
  const nick = useState<string>('cart-nick', () => '')
  const isOpen = useState<boolean>('cart-open', () => false)

  const count = computed(() => cartItemCount(items.value))
  const total = computed(() => cartTotal(items.value))

  function add(item: Omit<CartItem, 'qty'>) {
    items.value = addCartItem(items.value, item)
  }
  function changeQty(slug: string, delta: number) {
    items.value = changeCartItemQty(items.value, slug, delta)
  }
  function remove(slug: string) {
    items.value = removeCartItem(items.value, slug)
  }
  function open() {
    isOpen.value = true
  }
  function close() {
    isOpen.value = false
  }

  return { items, nick, isOpen, count, total, add, changeQty, remove, open, close }
}
