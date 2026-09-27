/// Клиент каталога витрины: товары из server/api/catalog/products (каталог в репозитории, цены в тенге).

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/// Тот же контракт, что StoreProduct в server/utils/catalog.ts.
export interface PublicProduct {
  slug: string
  name: string
  description: string | null
  type: string
  /** Цена в тенге. */
  price: number
  currency: string
  sortOrder: number
  icon?: string
  tone?: string
  badge?: string
  amount?: number
  bonus?: number
}

export const PRODUCT_TYPE = {
  Rank: 'rank',
  Currency: 'currency',
} as const

export function sortByOrder<T extends { sortOrder: number }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder)
}

export function countByType(products: readonly Pick<PublicProduct, 'type'>[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const product of products) counts[product.type] = (counts[product.type] ?? 0) + 1
  return counts
}

export function useCatalogProducts() {
  const { data, pending, error, refresh } = useFetch<PagedResult<PublicProduct>>('/api/catalog/products', {
    key: 'catalog-products-all',
  })
  const products = computed(() => sortByOrder(data.value?.items ?? []))
  return { products, pending, error, refresh }
}

export function useCatalogProductsByType(type: string) {
  const { data, pending, error, refresh } = useFetch<PagedResult<PublicProduct>>('/api/catalog/products', {
    key: `catalog-products-${type}`,
    query: { type },
  })
  const products = computed(() => sortByOrder(data.value?.items ?? []))
  return { products, pending, error, refresh }
}
