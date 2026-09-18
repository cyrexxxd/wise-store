/// PublicProductDto не несёт иконку — витрина выбирает символ спрайта (IconSprite.vue)
/// по типу товара и, для косметики, по ключевым словам в slug/названии (шляпа/крылья/меч/
/// питомец продолжают старый дизайн-макет, где иконка была на усмотрение вёрстки).
/// Список известных типов — PRODUCT_TYPE в useCatalogApi.ts; сюда же попадает 'currency',
/// который не в перечне админки, но допустим как строка (см. комментарий там).
import type { PublicProduct } from '~/composables/useCatalogApi'

const COSMETIC_KEYWORD_ICON: Array<[RegExp, string]> = [
  [/hat|шляп/i, 'hat'],
  [/wing|крыль/i, 'wings'],
  [/sword|меч|клинок/i, 'sword'],
  [/pet|питомец|дракон/i, 'pet'],
]

export function iconForProduct(product: Pick<PublicProduct, 'type' | 'slug' | 'name'>): string {
  switch (product.type) {
    case 'crate_key':
      return 'crate'
    case 'title':
      return 'title'
    case 'rank':
      return 'shield'
    case 'currency':
      return 'gem'
    case 'cosmetic': {
      const haystack = `${product.slug} ${product.name}`
      const match = COSMETIC_KEYWORD_ICON.find(([re]) => re.test(haystack))
      return match ? match[1] : 'hat'
    }
    default:
      return 'gem'
  }
}
