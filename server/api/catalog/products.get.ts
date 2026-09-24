/// GET /api/catalog/products?type= — активные товары магазина EasyDonate в формате витрины.
/// Форма ответа (PagedResult) сохранена от прежнего бэкенда, чтобы не трогать композаблы.
import { getProducts } from '../../utils/easydonate'
import { visibleStoreProducts } from '../../utils/catalog'

export default defineEventHandler(async (event) => {
  const { type } = getQuery(event)
  const items = visibleStoreProducts(await getProducts(), typeof type === 'string' && type ? type : undefined)
  return { items, total: items.length, page: 1, pageSize: items.length }
})
