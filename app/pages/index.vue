<script setup lang="ts">
// Главная: баннер и разделы магазина, каждый в своём цвете.
import { crates, sections } from '~/utils/cosmetics'

useSeoMeta({
  title: 'Магазин',
  description: 'Официальный магазин сервера CATIERS: роли, Когти, кейсы и косметика. Оплата в тенге, выдача на ник.',
})

const cosmeticsCount = Object.values(sections).reduce((n, list) => n + list.length, 0)
const tiles = [
  { to: '/roles', icon: 'crown_premium', title: 'Роли', text: 'CAT, Wise и Premium — привилегии на 30 дней', tone: 'roles' },
  { to: '/currency', icon: 'claws_4', title: 'Когти', text: 'Валюта сервера: ключи кейсов и косметика навсегда', tone: 'claws' },
  { to: '/crates', icon: 'crate', title: 'Кейсы', text: `Шансы на каждый предмет — ${crates.reduce((n, c) => n + c.items.length, 0)} наград`, tone: 'crates' },
  { to: '/cosmetics', icon: 'hat/wizard', title: 'Косметика', text: `Каталог: ${cosmeticsCount} предметов — титулы, шляпы, мечи, эффекты`, tone: 'cosmetics' },
]
</script>

<template>
  <div>
    <section class="hero">
      <div class="hero-text">
        <span class="hero-kicker">CATIERS · Центральная Азия</span>
        <h1>Магазин <span class="grad">CATIERS</span></h1>
        <p>Роли, Когти и косметика для PvP-сервера. Оплата в тенге через Kaspi или картой, покупка приходит на ник, указанный в корзине — даже если ты не в сети.</p>
        <div class="hero-cta">
          <NuxtLink class="btn btn-gold" to="/roles">Выбрать роль</NuxtLink>
          <NuxtLink class="btn btn-pink" to="/currency">Купить Когти</NuxtLink>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <ItemIcon class="art a1" icon="crown_premium" :size="190" />
        <ItemIcon class="art a2" icon="claws_4" :size="150" />
        <ItemIcon class="art a3" icon="crate_title" :size="130" />
        <ItemIcon class="art a4" icon="swordskin/nz_aether" :size="120" />
      </div>
    </section>

    <section id="shop">
      <div class="hub-grid hub-4">
        <NuxtLink v-for="t in tiles" :key="t.to" :to="t.to" class="hub-tile" :class="`tone-${t.tone}`">
          <ItemIcon class="ico" :icon="t.icon" :size="112" />
          <div>
            <h3>{{ t.title }}</h3>
            <span class="cnt">{{ t.text }}</span>
          </div>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
