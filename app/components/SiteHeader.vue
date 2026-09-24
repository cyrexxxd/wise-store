<script setup lang="ts">
// Шапка сайта — общая для всех страниц. "Магазин" подсвечен везде, кроме /crates.
// Входа по нику нет: покупка оформляется на ник, введённый в корзине, а оплата и история
// платежей — на стороне EasyDonate.
import { useCart } from '~/composables/useCart'

const route = useRoute()
const isCratesPage = computed(() => route.path === '/crates')

const { count, open } = useCart()
</script>

<template>
  <header class="top">
    <div class="top-in">
      <NuxtLink class="brand" to="/"><span class="cube" />WISE</NuxtLink>
      <nav class="main">
        <NuxtLink to="/" :class="{ on: !isCratesPage }">Магазин</NuxtLink>
        <NuxtLink to="/crates" :class="{ on: isCratesPage }">Кейсы</NuxtLink>
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
