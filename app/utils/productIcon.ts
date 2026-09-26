/// Иконка товара — рендер настоящей модели из игры (public/icons/*.png, 512×512, прозрачный фон).
/// Модели — Blockbench-исходники CATCosmetics: ключи кейсов, «Коготь кота», тюбетейка, кейс;
/// короны ролей сделаны только для сайта. Перерендер: _tools/bb/icons.mjs в репозитории сервера.
import type { PublicProduct } from '~/composables/useCatalogApi'

export const ITEM_ICONS = [
  'crown_wise',
  'crown_cat',
  'crown_premium',
  'claw',
  'key_title',
  'key_cosmetic',
  'tubeteika',
  'crate',
] as const
export type ItemIconName = (typeof ITEM_ICONS)[number]

// роль → своя корона; порядок важен: «Premium» проверяем раньше короткого «CAT»
const RANK_ICON: Array<[RegExp, ItemIconName]> = [
  [/premium|премиум/i, 'crown_premium'],
  [/\bcat\b|кэт/i, 'crown_cat'],
  [/wise|вайз/i, 'crown_wise'],
]

export function iconForProduct(product: Pick<PublicProduct, 'type' | 'slug' | 'name'>): ItemIconName {
  const haystack = `${product.slug} ${product.name}`
  switch (product.type) {
    case 'rank':
      return RANK_ICON.find(([re]) => re.test(haystack))?.[1] ?? 'crown_cat'
    case 'currency':
      return 'claw'
    case 'crate_key':
      return /косметик|cosmetic/i.test(haystack) ? 'key_cosmetic' : 'key_title'
    case 'title':
      return 'key_title'
    case 'cosmetic':
      return /sword|меч|клинок|коготь/i.test(haystack) ? 'claw' : 'tubeteika'
    default:
      return 'crate'
  }
}

// корзины, сохранённые до перехода на рендеры, хранят имена SVG-символов
const LEGACY_ICON: Record<string, ItemIconName> = {
  shield: 'crown_cat',
  gem: 'claw',
  crate: 'key_title',
  title: 'key_title',
  hat: 'tubeteika',
  wings: 'tubeteika',
  pet: 'tubeteika',
  sword: 'claw',
}

export function iconUrl(icon: string): string {
  const known = (ITEM_ICONS as readonly string[]).includes(icon) ? (icon as ItemIconName) : LEGACY_ICON[icon] ?? 'crate'
  return `/icons/${known}.png`
}
