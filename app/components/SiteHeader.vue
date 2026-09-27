<script setup lang="ts">
// Шапка сайта — общая для всех страниц; у каждого раздела свой цвет подчёркивания.
// Входа по нику нет: покупка оформляется на ник, введённый в корзине, оплата — на стороне Robokassa.
import { useCart } from '~/composables/useCart'

const route = useRoute()
const links = [
  { to: '/roles', title: 'Роли', tone: 'roles' },
  { to: '/currency', title: 'Когти', tone: 'claws' },
  { to: '/crates', title: 'Кейсы', tone: 'crates' },
  { to: '/cosmetics', title: 'Косметика', tone: 'cosmetics' },
]
const { count, open } = useCart()
</script>

<template>
  <header class="top">
    <div class="top-in">
      <NuxtLink class="brand" to="/"><span class="cube" />WISE</NuxtLink>
      <nav class="main">
        <NuxtLink v-for="l in links" :key="l.to" :to="l.to" :class="[`tone-${l.tone}`, { on: route.path === l.to }]">{{ l.title }}</NuxtLink>
        <a href="https://catiers.xyz" target="_blank" rel="noopener">Тирлист</a>
      </nav>
      <div class="top-right">
        <IpChip />
        <button class="cart-btn" @click="open">
          <svg class="pico" style="width: 15px; height: 15px"><use href="#ic-cart" /></svg>Корзина
          <span class="cnt">{{ count }}</span>
        </button>
      </div>
    </div>
  </header>
</template>
