<script setup lang="ts">
// Роли — как у Hypixel Store: карточки ролей по возрастанию (CAT → Wise → Premium) и под ними
// таблица привилегий. Строки таблицы — app/data/perks.ts (сверены с правами групп LuckPerms).
import { PRODUCT_TYPE, useCatalogProductsByType } from '~/composables/useCatalogApi'
import { PERKS, type RoleKey } from '~/data/perks'
import { approxRub, formatKzt } from '~/utils/formatPrice'

useSeoMeta({
  title: 'Роли',
  description: 'Роли CAT, Wise и Premium на 30 дней: вся косметика, префикс, кланы и больше. Цены в тенге.',
})

const { products, pending, error } = useCatalogProductsByType(PRODUCT_TYPE.Rank)
const { kztPerRub } = useRuntimeConfig().public
const { buy, added } = useBuy()
const roleOf = (slug: string) => slug.replace('role-', '') as RoleKey
</script>

<template>
  <section>
    <BackLink />
    <div class="sec-head tone-roles">
      <h1>Роли</h1>
      <p>Роль действует 30 дней с момента выдачи. Повторная покупка продлевает срок. Каждая следующая роль включает всё из предыдущей.</p>
    </div>

    <p v-if="error" class="grid-empty">Не получилось загрузить роли. Попробуйте обновить страницу.</p>
    <template v-else-if="!pending">
      <div class="rank-grid">
        <article v-for="(p, i) in products" :key="p.slug" class="rank-card" :class="[`tone-${p.tone}`, { top: i === products.length - 1 }]">
          <span v-if="i === products.length - 1" class="rank-ribbon">Лучший выбор</span>
          <ItemIcon class="rank-ico" :icon="p.icon ?? 'crown_cat'" :size="150" />
          <h2>{{ p.name.replace('Роль ', '') }}</h2>
          <p class="rank-desc">{{ p.description }}</p>
          <div class="rank-price">
            <b>{{ formatKzt(p.price) }}</b>
            <i>{{ approxRub(p.price, kztPerRub) }} · 30 дней</i>
          </div>
          <button class="btn btn-tone" @click="buy(p, true)">
            <svg><use href="#ic-cart" /></svg>{{ added === p.slug ? 'Добавлено' : 'Купить' }}
          </button>
        </article>
      </div>

      <div class="perks">
        <div class="perks-head">
          <span />
          <span v-for="p in products" :key="p.slug" :class="`tone-${p.tone}`">{{ p.name.replace('Роль ', '') }}</span>
        </div>
        <template v-for="g in PERKS" :key="g.title">
          <div class="perks-group">{{ g.title }}</div>
          <div v-for="row in g.rows" :key="row.label" class="perks-row">
            <span class="perk-label">{{ row.label }}<small v-if="row.hint">{{ row.hint }}</small></span>
            <span v-for="p in products" :key="p.slug" class="perk-val" :class="`tone-${p.tone}`">
              <svg v-if="row.values[roleOf(p.slug)] === true" class="check"><use href="#ic-check" /></svg>
              <span v-else-if="row.values[roleOf(p.slug)] === false" class="dash">—</span>
              <b v-else>{{ row.values[roleOf(p.slug)] }}</b>
            </span>
          </div>
        </template>
      </div>
    </template>
  </section>
</template>
