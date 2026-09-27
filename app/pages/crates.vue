<script setup lang="ts">
// Кейсы: шанс на каждый предмет. Правило то же, что в плагине (CrateRoller): сначала редкость по весам,
// потом равномерно среди предметов этой редкости. Данные — выгрузка из плагина (app/data/cosmetics.json).
import { crates, formatChance, RARITIES, RARITY_INFO, sectionTitle, type Crate, type Rarity } from '~/utils/cosmetics'
import { itemIcon } from '~/utils/productIcon'

useSeoMeta({
  title: 'Кейсы',
  description: 'Кейс косметики и кейс титулов сервера CATIERS: шанс выпадения каждого предмета, как в игре.',
})

const CRATE_ICON: Record<string, string> = { cosmetic: 'crate', title: 'crate_title' }
const KEY_ICON: Record<string, string> = { cosmetic: 'key_cosmetic', title: 'key_title' }
const byRarity = (c: Crate) => [...RARITIES].reverse()
  .map((r) => ({ rarity: r as Rarity, items: c.items.filter((i) => i.rarity === r) }))
  .filter((g) => g.items.length)
const active = ref(crates[0]?.key ?? 'cosmetic')
</script>

<template>
  <div>
    <section>
      <BackLink />
      <div class="sec-head tone-crates">
        <h1>Кейсы</h1>
        <p>Ключи покупаются в игре за Когти (<code>/cos</code>), кейсы стоят на спавне. Повторная награда возвращает часть Когтей.</p>
      </div>
      <div class="crate-tabs">
        <button v-for="c in crates" :key="c.key" class="crate-tab" :class="{ on: active === c.key, [`tone-${c.key === 'title' ? 'titles' : 'crates'}`]: true }" @click="active = c.key">
          <ItemIcon :icon="CRATE_ICON[c.key] ?? 'crate'" :size="56" />
          <span><b>{{ c.name }}</b><i>{{ c.items.length }} наград · ключ {{ c.keyPrice }} Когтей</i></span>
        </button>
      </div>
    </section>

    <section v-for="c in crates" v-show="active === c.key" :id="c.key" :key="c.key" class="crate-block" :class="`tone-${c.key === 'title' ? 'titles' : 'crates'}`">
      <div class="crate-head">
        <ItemIcon class="crate-art" :icon="CRATE_ICON[c.key] ?? 'crate'" :size="150" />
        <div>
          <h2>{{ c.name }}</h2>
          <p class="crate-key"><ItemIcon :icon="KEY_ICON[c.key] ?? 'key_title'" :size="34" /> Ключ — {{ c.keyPrice }} Когтей</p>
          <div class="rar-chips">
            <span v-for="r in [...RARITIES].reverse().filter((x) => c.rarities[x])" :key="r" class="rar-chip" :style="{ '--r': RARITY_INFO[r].color }">
              {{ RARITY_INFO[r].title }} <b>{{ c.rarities[r]!.chance }}%</b> <i>{{ c.rarities[r]!.count }} шт.</i>
            </span>
          </div>
        </div>
      </div>

      <div v-for="g in byRarity(c)" :key="g.rarity" class="odds-group" :style="{ '--r': RARITY_INFO[g.rarity].color }">
        <h3>{{ RARITY_INFO[g.rarity].title }} <span>{{ c.rarities[g.rarity]!.chance }}% на редкость · {{ formatChance(g.items[0]!.chance) }} на предмет</span></h3>
        <div class="odds-grid">
          <div v-for="i in g.items" :key="i.type + i.id" class="odd-item">
            <ItemIcon :icon="itemIcon(i.type, i.id)" :size="60" />
            <span class="odd-name">{{ i.name }}<small v-if="c.key !== 'title'">{{ sectionTitle(i.type) }}</small></span>
            <b class="odd-chance">{{ formatChance(i.chance) }}</b>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
