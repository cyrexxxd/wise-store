/// Таблица привилегий ролей (страница /roles, как у Hypixel). Значение по роли: true — есть,
/// false — нет, строка — текст в ячейке. Строки должны совпадать с правами групп LuckPerms на сервере:
/// cat / wise / premium (наследование wise → cat, premium → wise).
/// Проверено на проде 2026-09-27: слоты наборов PerPlayerKit cat 1, wise 2, premium 3; тримы — у premium (wise — с 28.09).
/// Распределение 2026-09-27 — черновик Claude по просьбе владельца («пока придумай сам»), владелец поменяет.
/// Косметика, префикс/суффикс, кланы и скрытие ActionBar — роль CAT в CATCosmetics (MC-004/005/007).
export type RoleKey = 'cat' | 'wise' | 'premium'

export interface PerkRow {
  label: string
  hint?: string
  values: Record<RoleKey, boolean | string>
}

export interface PerkGroup {
  title: string
  rows: PerkRow[]
}

export const PERKS: PerkGroup[] = [
  {
    title: 'Косметика',
    rows: [
      { label: 'Вся косметика сервера', hint: 'Шляпы, скины мечей, эффекты, звуки и сообщения убийств, цвета ника — пока действует роль', values: { cat: true, wise: true, premium: true } },
      { label: 'Свой префикс и суффикс', hint: '/prefix и /suffix с цветами и HEX', values: { cat: true, wise: true, premium: true } },
      { label: 'Тримы на броню', hint: '/trim — узор и материал, алмаз и незерит', values: { cat: false, wise: true, premium: true } },
    ],
  },
  {
    title: 'Бонусы',
    rows: [
      { label: 'Когти к каждой покупке роли', hint: 'Зачисляются вместе с ролью — на ключи кейсов и косметику навсегда', values: { cat: false, wise: '+150', premium: '+400' } },
    ],
  },
  {
    title: 'Игра',
    rows: [
      { label: 'Создание клана', values: { cat: true, wise: true, premium: true } },
      { label: 'Дополнительные наборы китов', hint: 'Сохранённые наборы в редакторе китов', values: { cat: '+1', wise: '+2', premium: '+3' } },
      { label: 'Скрыть ActionBar и Scoreboard', values: { cat: true, wise: true, premium: true } },
    ],
  },
  {
    title: 'Статус',
    rows: [
      { label: 'Тег роли в чате и табе', values: { cat: 'CAT', wise: 'Wise', premium: 'Premium' } },
    ],
  },
]
