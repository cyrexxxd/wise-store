/// Клиент EasyDonate API v3 (https://docs.easydonate.ru). Живёт только на сервере Nuxt:
/// Shop-Key даёт полный доступ к магазину, поэтому в браузер он не уходит никогда —
/// витрина ходит в наши /api/* маршруты, а они уже сюда.

const API_BASE = 'https://easydonate.ru/api/v3'

interface EasyDonateResponse<T> {
  success: boolean
  response: T
  error_code?: number
}

export interface EasyDonateProduct {
  id: number
  name: string
  price: number
  old_price: number | null
  type: string
  number: number
  is_hidden: number
  commands: string[] | null
  description: string | null
  image: string | null
  sort_index: number | null
  servers?: Array<{ id: number }>
}

/// Ошибка, текст которой можно показать покупателю: EasyDonate возвращает понятные
/// русские сообщения ("Игрок не в сети", "Покупки недоступны" и т.п.).
export class EasyDonateError extends Error {}

function shopKey(): string {
  const key = useRuntimeConfig().easydonateShopKey
  if (!key) throw createError({ statusCode: 500, statusMessage: 'NUXT_EASYDONATE_SHOP_KEY не задан' })
  return key
}

async function request<T>(path: string, query?: Record<string, string | number>): Promise<T> {
  const body = await $fetch<EasyDonateResponse<T | string>>(`${API_BASE}${path}`, {
    query,
    headers: { 'Shop-Key': shopKey() },
    // EasyDonate отвечает 200 с success:false на бизнес-ошибки, но на некоторые — 4xx
    // с тем же телом; разбираем тело в обоих случаях.
    ignoreResponseError: true,
    timeout: 15000,
  })
  if (!body?.success) {
    throw new EasyDonateError(typeof body?.response === 'string' ? body.response : 'EasyDonate вернул ошибку')
  }
  return body.response as T
}

// Каталог меняется редко, а витрина запрашивает его на каждой странице — кешируем в памяти,
// чтобы не упираться в лимиты EasyDonate. Изменения в панели появятся на сайте за минуту.
const PRODUCTS_TTL_MS = 60_000
let productsCache: { at: number; data: EasyDonateProduct[] } | null = null

export async function getProducts(): Promise<EasyDonateProduct[]> {
  if (productsCache && Date.now() - productsCache.at < PRODUCTS_TTL_MS) return productsCache.data
  const data = await request<EasyDonateProduct[]>('/shop/products')
  productsCache = { at: Date.now(), data }
  return data
}

/// Создаёт платёж и возвращает ссылку на страницу оплаты EasyDonate. Сервер выдачи —
/// из конфига: в магазине он один (CAT), товары привязаны к нему в панели.
export async function createPayment(customer: string, products: Record<string, number>): Promise<string> {
  const config = useRuntimeConfig()
  const result = await request<{ url: string }>('/shop/payment/create', {
    customer,
    server_id: config.easydonateServerId,
    products: JSON.stringify(products),
    success_url: `${config.public.siteUrl}/success`,
  })
  return result.url
}
