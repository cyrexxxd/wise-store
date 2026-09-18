<script setup lang="ts">
// Хаб каталога (design-mockup.html → T-15). Счётчики на плитках — из реального
// списка активных товаров (GET /api/catalog/products), а не хардкод "3 товара" и т.п.
import { countByType, PRODUCT_TYPE, useCatalogProducts } from '~/composables/useCatalogApi'

useSeoMeta({
  title: 'Каталог',
  description: 'Официальный магазин сервера wise: роли, титулы, косметика, кристаллы и кейсы. Выдача на ник, указанный при оплате.',
})

const { products, pending, error } = useCatalogProducts()

const counts = computed(() => countByType(products.value))

const sections = computed(() => [
  { to: '/roles', icon: 'shield', title: 'Роли', count: counts.value[PRODUCT_TYPE.Rank] ?? 0 },
  { to: '/titles', icon: 'title', title: 'Титулы', count: counts.value[PRODUCT_TYPE.Title] ?? 0 },
  { to: '/cosmetics', icon: 'hat', title: 'Косметика', count: counts.value[PRODUCT_TYPE.Cosmetic] ?? 0 },
  { to: '/currency', icon: 'gem', title: 'Кристаллы', count: counts.value[PRODUCT_TYPE.Currency] ?? 0 },
  { to: '/crates', icon: 'crate', title: 'Кейсы', count: counts.value[PRODUCT_TYPE.CrateKey] ?? 0 },
])
</script>

<template>
  <section id="shop">
    <div class="sec-head">
      <h1>Каталог</h1>
      <p>
        Всё выдаётся на ник, указанный при оплате. Если вы не в сети — покупка придёт при
        следующем заходе. Шансы в кейсах — <NuxtLink class="text-link" to="/crates#odds">на странице кейсов</NuxtLink>.
      </p>
    </div>

    <p v-if="error" class="grid-empty">Не получилось загрузить каталог. Попробуйте обновить страницу.</p>
    <div v-else class="hub-grid">
      <HubTile v-for="s in sections" :key="s.to" :to="s.to" :icon="s.icon" :title="s.title" :count="pending ? 0 : s.count" />
    </div>
  </section>
</template>
