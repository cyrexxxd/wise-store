<script setup lang="ts">
// Кристаллы (currency.html → T-15) — товары типа currency из живого каталога. Тип не входит
// в перечень PRODUCT_TYPES админки (crate_key/title/cosmetic/rank), но поле type у товара —
// свободная строка (см. комментарий в useCatalogApi.ts), так что раздел просто показывает
// пустое состояние, пока владельцы не заведут такие товары через админку.
import { PRODUCT_TYPE, useCatalogProductsByType } from '~/composables/useCatalogApi'

useSeoMeta({
  title: 'Кристаллы',
  description: 'Кристаллы сервера wise — внутриигровая валюта для покупок в /shop. Крупные наборы выгоднее поштучных.',
})

const { products, pending, error } = useCatalogProductsByType(PRODUCT_TYPE.Currency)
</script>

<template>
  <section>
    <BackLink />
    <div class="sec-head">
      <h1>Кристаллы</h1>
      <p>Внутриигровая валюта для покупок в /shop. Крупные наборы выгоднее поштучных.</p>
    </div>

    <p v-if="error" class="grid-empty">Не получилось загрузить каталог. Попробуйте обновить страницу.</p>
    <div v-else class="grid">
      <p v-if="!pending && !products.length" class="grid-empty">Пока нет кристаллов в продаже.</p>
      <ProductCard v-for="product in products" :key="product.slug" :product="product" />
    </div>
  </section>
</template>
