/// Косметика сервера для каталога и кейсов — данные выгружаются из плагина CATCosmetics
/// (gradlew exportSite → app/data/cosmetics.json), поэтому шансы и составы совпадают с игрой.
import data from '~/data/cosmetics.json'

export type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'
export interface TextRun { text: string; color?: string | null; bold?: boolean }
export interface CosmeticItem {
  id: string
  name: string
  rarity: Rarity
  description?: string
  preview?: TextRun[]
  colors?: string[]
  bold?: boolean
  crate?: boolean
}
export interface CrateItem { type: string; id: string; name: string; rarity: Rarity; chance: number }
export interface Crate {
  key: string
  name: string
  keyPrice: number
  rarities: Partial<Record<Rarity, { chance: number; count: number }>>
  items: CrateItem[]
}

export const RARITIES: Rarity[] = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY']
export const RARITY_INFO: Record<Rarity, { title: string; color: string }> = {
  COMMON: { title: 'Обычный', color: '#9AA6B6' },
  RARE: { title: 'Редкий', color: '#4FA8FF' },
  EPIC: { title: 'Эпический', color: '#B45CFF' },
  LEGENDARY: { title: 'Легендарный', color: '#FFB02E' },
}

/// Разделы каталога в порядке показа.
export const SECTIONS: Array<{ key: string; title: string; tone: string; hint: string }> = [
  { key: 'title', title: 'Титулы', tone: 'titles', hint: 'Рядом с ником в чате и табе. Из кейса титулов.' },
  { key: 'killeffect', title: 'Эффекты убийств', tone: 'effects', hint: 'Анимация на месте убийства.' },
  { key: 'killsound', title: 'Звуки убийств', tone: 'sounds', hint: 'Звук, который слышишь при убийстве.' },
  { key: 'killmessage', title: 'Сообщения убийств', tone: 'messages', hint: 'Как чат сообщает о твоём убийстве.' },
  { key: 'hat', title: 'Шляпы', tone: 'hats', hint: 'Модели на голове — видят все игроки.' },
  { key: 'swordskin', title: 'Скины мечей', tone: 'swords', hint: 'Внешний вид меча в руке.' },
  { key: 'namecolor', title: 'Цвета ника', tone: 'colors', hint: 'Градиент ника в чате и табе.' },
]

export const sections = data.sections as unknown as Record<string, CosmeticItem[]>
export const crates = data.crates as unknown as Crate[]
export const shopPrices = data.prices as Record<Rarity, number>

export function sectionTitle(key: string): string {
  return SECTIONS.find((s) => s.key === key)?.title ?? key
}

/// Как получить предмет: кейс, покупка за Когти в /cos, роль CAT.
export function howToGet(type: string, item: CosmeticItem): string[] {
  if (type === 'title') return item.crate ? ['Кейс титулов'] : ['Архивный: только у получивших раньше']
  const role = item.rarity === 'LEGENDARY' ? 'Роль Wise или Premium — пока действует' : 'Роль CAT и выше — пока действует'
  const ways = [`${shopPrices[item.rarity]} Когтей навсегда`, role]
  return cosmeticCrateTypes.has(type) ? ['Кейс косметики', ...ways] : ways
}

// разделы, которые выпадают из кейса косметики (сейчас шляпы и скины меча) — по выгрузке из плагина
const cosmeticCrateTypes = new Set((crates.find((c) => c.key === 'cosmetic')?.items ?? []).map((i) => i.type))

/// Шанс в процентах для показа: 0.0625 → «0.06%», 3.75 → «3.75%».
export function formatChance(chance: number): string {
  return `${chance < 0.1 ? chance.toFixed(3) : chance < 1 ? chance.toFixed(2) : chance.toFixed(2).replace(/\.?0+$/, '')}%`
}

/// Градиент ника для превью (CSS). Всегда linear-gradient: значение идёт в background-image, а голый цвет
/// там недопустим — браузер его отбрасывает, и ник с одним цветом (обычная редкость) становится невидимым.
export function nameGradient(colors: readonly string[] | undefined): string {
  const c = colors?.length ? colors : ['#FFFFFF']
  return `linear-gradient(90deg, ${(c.length === 1 ? [c[0], c[0]] : c).join(', ')})`
}
