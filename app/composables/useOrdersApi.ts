/// Клиент оформления заказа (T-16/T-17 частично: сама оплата ещё не подключена — нет
/// выбранного провайдера, см. блокер №1 плана. Пока что "Перейти к оплате" создаёт заказ
/// (POST /api/orders, PublicOrdersController) и показывает номер заказа — оплата и выдача
/// пока обрабатываются вручную администрацией (раздел 6 плана: "между фазами... заказы
/// выдаются руками"). Контракт сверен с CreateOrderRequestDto/OrderDto на бэкенде.

export interface CreateOrderItemInput {
  productSlug: string
  qty: number
}

export interface OrderItem {
  id: string
  productId: string
  qty: number
  priceAtPurchase: number
  nameAtPurchase: string
}

export interface Order {
  id: string
  publicNumber: string
  minecraftNick: string
  minecraftUuid: string | null
  email: string | null
  total: number
  currency: string
  status: string
  deliveredManually: boolean
  createdAt: string
  paidAt: string | null
  items: OrderItem[]
}

export interface OrderApiError {
  code: string
  message: string
}

function useOrdersBase(): string {
  const config = useRuntimeConfig()
  return config.public.ordersApiBase
}

/// $fetch, не useFetch — это клиентское действие по клику (оплата), а не данные для
/// первого рендера (см. правило выбора useFetch/$fetch в nuxt-patterns).
export async function createOrder(minecraftNick: string, items: CreateOrderItemInput[]): Promise<Order> {
  const base = useOrdersBase()
  return await $fetch<Order>(base, {
    method: 'POST',
    body: { minecraftNick, items },
  })
}

/// GET /api/orders/mine (T-18) — история покупок ТЕКУЩЕЙ сессии. Контракт сверен с
/// PlayerOrdersController.cs на бэкенде: ник для поиска берётся там из httpOnly cookie сессии
/// (PlayerSessionAuthenticationHandler), этот вызов никогда не передаёт ник сам — только
/// credentials:'include', тот же принцип, что во всех вызовах useAuthApi.ts к сессии игрока.
/// $fetch, не useFetch: страница покупок сама решает, когда дёргать этот запрос (после того,
/// как известно, что сессия есть, см. purchases.vue), а не на каждый первый рендер.
export async function fetchMyOrders(): Promise<Order[]> {
  const base = useOrdersBase()
  return await $fetch<Order[]>(`${base}/mine`, { credentials: 'include' })
}

/// Тело ошибки бэкенда — { code, message } (ApiErrorResponse, см. ApiErrors.cs) — достаём
/// его из $fetch-исключения, чтобы показать причину отказа, а не голое "что-то пошло не так".
export function extractOrderError(error: unknown): OrderApiError | null {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: unknown }).data
    if (data && typeof data === 'object' && 'code' in data && 'message' in data) {
      return data as OrderApiError
    }
  }
  return null
}
