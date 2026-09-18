<script setup lang="ts">
// Титулы (titles.html → T-15) — товары типа title из живого каталога.
import { PRODUCT_TYPE, useCatalogProductsByType } from '~/composables/useCatalogApi'

useSeoMeta({
  title: 'Титулы',
  description: 'Титулы сервера wise — виден в TAB и чате рядом с ником. Можно купить напрямую или получить из кейса.',
})

const { products, pending, error } = useCatalogProductsByType(PRODUCT_TYPE.Title)
</script>

<template>
  <section>
    <BackLink />
    <div class="sec-head">
      <h1>Титулы</h1>
      <p>Титул виден в TAB и чате рядом с ником. Можно купить напрямую или получить из кейса.</p>
    </div>

    <p v-if="error" class="grid-empty">Не получилось загрузить титулы. Попробуйте обновить страницу.</p>
    <p v-else-if="!pending && !products.length" class="grid-empty">Пока нет титулов в продаже.</p>
    <TierComparisonTable v-else :products="products" />
  </section>
</template>
