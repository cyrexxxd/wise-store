/// Иконки витрины — нарисованные SVG (public/icons, исходники: _tools/icons в репозитории сервера).
/// Имя иконки: «crown_cat» (иконки витрины) или «hat/farmer» (предмет: раздел/id).
const LEGACY_ICON: Record<string, string> = {
  // корзины, сохранённые до перехода на новые иконки, хранят старые имена
  shield: 'crown_cat',
  gem: 'claws_1',
  claw: 'claws_1',
  title: 'key_title',
  hat: 'hat/tubeteika',
  tubeteika: 'hat/tubeteika',
  wings: 'crate',
  pet: 'crate',
  sword: 'swordskin/catiers',
}

const SAFE = /^[a-z0-9_]+(\/[a-z0-9_]+)?$/

export function iconUrl(icon: string): string {
  const name = LEGACY_ICON[icon] ?? icon
  return SAFE.test(name) ? `/icons/${name}.svg` : '/icons/crate.svg'
}

/// Иконка предмета косметики по разделу и id.
export function itemIcon(type: string, id: string): string {
  return `${type}/${id}`
}
