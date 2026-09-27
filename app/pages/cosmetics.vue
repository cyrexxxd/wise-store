<script setup lang="ts">
// Каталог косметики по разделам: титулы, эффекты/звуки/сообщения убийств, шляпы, скины мечей, цвета ника.
// Всё это получается в игре (кейсы, Когти, роль CAT), на сайте — витрина с редкостью и способом получения.
import { RARITIES, SECTIONS, sections, type Rarity } from '~/utils/cosmetics'

useSeoMeta({
  title: 'Косметика',
  description: 'Каталог косметики CATIERS: титулы, эффекты и звуки убийств, шляпы, скины мечей, цвета ника.',
})

const route = useRoute()
const router = useRouter()
const tab = computed({
  get: () => (SECTIONS.some((s) => s.key === route.query.tab) ? String(route.query.tab) : SECTIONS[0]!.key),
  set: (key: string) => router.replace({ query: { ...route.query, tab: key } }),
})
const rarity = ref<Rarity | 'ALL'>('ALL')
const current = computed(() => SECTIONS.find((s) => s.key === tab.value)!)
const items = computed(() => {
  const order = (r: Rarity) => RARITIES.indexOf(r)
  return [...(sections[tab.value] ?? [])]
    .filter((i) => rarity.value === 'ALL' || i.rarity === rarity.value)
    .sort((a, b) => order(b.rarity) - order(a.rarity))
})
</script>

<template>
  <section>
    <BackLink />
    <div class="sec-head tone-cosmetics">
      <h1>Косметика</h1>
      <p>Внешний вид без игрового преимущества. С ролью CAT открыта вся, пока роль действует; из кейса или за Когти — навсегда.</p>
    </div>

    <div class="cat-tabs" role="tablist">
      <button v-for="s in SECTIONS" :key="s.key" role="tab" class="cat-tab" :class="[`tone-${s.tone}`, { on: tab === s.key }]" :aria-selected="tab === s.key" @click="tab = s.key">
        {{ s.title }} <i>{{ sections[s.key]?.length ?? 0 }}</i>
      </button>
    </div>

    <div class="cat-bar" :class="`tone-${current.tone}`">
      <p>{{ current.hint }}</p>
      <div class="rar-filter">
        <button :class="{ on: rarity === 'ALL' }" @click="rarity = 'ALL'">Все</button>
        <button v-for="r in RARITIES" :key="r" :class="['r-' + r.toLowerCase(), { on: rarity === r }]" @click="rarity = r">{{ { COMMON: 'Обычные', RARE: 'Редкие', EPIC: 'Эпические', LEGENDARY: 'Легендарные' }[r] }}</button>
      </div>
    </div>

    <div class="cos-grid">
      <CosmeticCard v-for="i in items" :key="i.id" :type="tab" :item="i" />
      <p v-if="!items.length" class="grid-empty">Нет предметов этой редкости.</p>
    </div>
  </section>
</template>
