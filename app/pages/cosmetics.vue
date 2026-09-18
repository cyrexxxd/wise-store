<script setup lang="ts">
// Косметика (cosmetics.html → T-15) — товары типа cosmetic из живого каталога.
import { PRODUCT_TYPE, useCatalogProductsByType } from '~/composables/useCatalogApi'

useSeoMeta({
  title: 'Косметика',
  description: 'Косметика сервера wise: внешний вид без игрового преимущества — шляпы, крылья, эффекты и питомцы.',
})

const { products, pending, error } = useCatalogProductsByType(PRODUCT_TYPE.Cosmetic)
</script>

<template>
  <section>
    <BackLink />
    <div class="sec-head">
      <h1>Косметика</h1>
      <p>Внешний вид без игрового преимущества — только для красоты и статуса.</p>
    </div>

    <p v-if="error" class="grid-empty">Не получилось загрузить косметику. Попробуйте обновить страницу.</p>
    <div v-else class="grid">
      <p v-if="!pending && !products.length" class="grid-empty">Пока нет косметики в продаже.</p>
      <ProductCard v-for="product in products" :key="product.slug" :product="product" />
    </div>
  </section>
</template>
