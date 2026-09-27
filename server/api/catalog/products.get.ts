/// GET /api/catalog/products?type= — товары каталога (цены в тенге). Форма ответа (PagedResult)
/// сохранена от прежнего бэкенда, чтобы не трогать композаблы.
import { publicProducts } from '../../utils/catalog'

export default defineEventHandler((event) => {
  const { type } = getQuery(event)
  const items = publicProducts(typeof type === 'string' && type ? type : undefined)
  return { items, total: items.length, page: 1, pageSize: items.length }
})
