/// Клиент публичного каталога (T-15). Контракт сверен с реальным бэкендом:
/// CatStore.Api/Controllers/PublicCatalogController.cs + CatStore.Contracts/Catalog/PublicCatalogDtos.cs.
/// Три маршрута: GET /products (?type=, всегда только активные), GET /products/{slug},
/// GET /crates. Ни Id, ни Actions, ни IsActive наружу не отдаются — сознательно, см.
/// комментарий у PublicProductDto на бэкенде.

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface PublicProduct {
  slug: string
  name: string
  description: string | null
  type: string
  price: number
  currency: string
  imageKey: string | null
  sortOrder: number
}

export interface PublicCrateItem {
  itemKey: string
  displayName: string
  chance: number
}

export interface PublicCrate {
  key: string
  name: string
  items: PublicCrateItem[]
}

/// Известные типы товаров (см. раздел 4 плана и PRODUCT_TYPES в админке). Список не enum:
/// новый тип заводится через админку без пересборки фронта, поэтому это только для
/// удобных констант в вызовах ниже, а не для валидации ответа бэкенда.
export const PRODUCT_TYPE = {
  CrateKey: 'crate_key',
  Title: 'title',
  Cosmetic: 'cosmetic',
  Rank: 'rank',
  Currency: 'currency',
} as const

/// Сортировка по sort_order — поле есть у каждого PublicProductDto, ей же управляет
/// владелец через админку (T-09), порядок карточек не хардкодим на фронте.
export function sortByOrder<T extends { sortOrder: number }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder)
}

/// Число товаров каждого типа — для плиток хаба (design-mockup.html: "N товаров").
/// Считается от реального списка, а не хардкодится в разметке хаба.
export function countByType(products: readonly PublicProduct[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const product of products) {
    counts[product.type] = (counts[product.type] ?? 0) + 1
  }
  return counts
}

function useCatalogBase(): string {
  const config = useRuntimeConfig()
  return config.public.catalogApiBase
}

/// Полный активный каталог одним запросом — используется на хабе (index.vue) для счётчиков
/// по разделам. pageSize с запасом: настоящих SKU на сервере считаные десятки (раздел 8
/// плана — стартовый каталог узкий), реальная пагинация каталогу пока не нужна.
///
/// Сортировка вынесена в отдельный computed, а не в transform у useFetch: generic-вывод
/// useFetch не разрешает transform, меняющий форму данных (PagedResult<T> → T[]), без
/// explicit generics на каждом вызове — так проще и читаемее.
export function useCatalogProducts() {
  const base = useCatalogBase()
  const { data, pending, error, refresh } = useFetch<PagedResult<PublicProduct>>(`${base}/products`, {
    key: 'catalog-products-all',
    query: { pageSize: 200 },
  })
  const products = computed(() => sortByOrder(data.value?.items ?? []))
  return { products, pending, error, refresh }
}

/// Товары одного раздела витрины (кейсы/косметика/титулы/роли/кристаллы) — фильтр type
/// применяется на бэкенде (ProductListQuery.Type), не на клиенте.
export function useCatalogProductsByType(type: string) {
  const base = useCatalogBase()
  const { data, pending, error, refresh } = useFetch<PagedResult<PublicProduct>>(`${base}/products`, {
    key: `catalog-products-${type}`,
    query: { type, pageSize: 100 },
  })
  const products = computed(() => sortByOrder(data.value?.items ?? []))
  return { products, pending, error, refresh }
}

/// Кейсы вместе с шансами (раздел 6 плана — шансы публикуются открыто).
export function useCatalogCrates() {
  const base = useCatalogBase()
  return useFetch<PublicCrate[]>(`${base}/crates`, {
    key: 'catalog-crates',
  })
}
