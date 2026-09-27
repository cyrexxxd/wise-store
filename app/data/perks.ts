/// Таблица привилегий ролей (страница /roles, как у Hypixel). Значение по роли: true — есть,
/// false — нет, строка — текст в ячейке. Строки должны совпадать с правами групп LuckPerms на сервере:
/// cat / wise / premium (наследование wise → cat, premium → wise).
/// Решения владельца 2026-09-28: киты 9 бесплатно / CAT 13 / Wise 15 / Premium 18 (PerPlayerKit kit-tiers);
/// тримы — все платные роли; легендарная косметика, /prefix, /suffix и цвет ника — с Wise (CATCosmetics:
/// cosmetics.legendary, cosmetics.prefix|suffix|namecolor); права ивентов — Premium; Когти 100/250/500 (catalog.ts).
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
      { label: 'Косметика сервера', hint: 'Шляпы, скины мечей, эффекты, звуки и сообщения убийств — пока действует роль', values: { cat: 'Кроме легендарной', wise: 'Вся', premium: 'Вся' } },
      { label: 'Тримы на броню', hint: '/trim — узор и материал, алмаз и незерит', values: { cat: true, wise: true, premium: true } },
      { label: 'Свой префикс и суффикс', hint: '/prefix и /suffix с цветами и HEX', values: { cat: false, wise: true, premium: true } },
      { label: 'Цвет и градиент ника', hint: 'Готовые цвета и свой HEX-градиент', values: { cat: false, wise: true, premium: true } },
    ],
  },
  {
    title: 'Бонусы',
    rows: [
      { label: 'Когти к каждой покупке роли', hint: 'Зачисляются вместе с ролью — на ключи кейсов и косметику навсегда', values: { cat: '+100', wise: '+250', premium: '+500' } },
    ],
  },
  {
    title: 'Игра',
    rows: [
      { label: 'Создание клана', values: { cat: true, wise: true, premium: true } },
      { label: 'Наборы китов', hint: 'Сохранённые наборы в редакторе китов (без роли — 9)', values: { cat: '13', wise: '15', premium: '18' } },
      { label: 'Права ивентов', hint: 'Запуск ивентов на сервере', values: { cat: false, wise: false, premium: true } },
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
