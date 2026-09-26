<script setup lang="ts">
// Когти — внутриигровая валюта CATCosmetics (товары типа currency в EasyDonate). За Когти в игре
// покупаются ключи кейсов и косметика навсегда (/cos). Пока пакетов в EasyDonate нет — раздел
// скрыт на главной (index.vue не показывает пустые разделы), а здесь пустое состояние.
import { PRODUCT_TYPE, useCatalogProductsByType } from '~/composables/useCatalogApi'

useSeoMeta({
  title: 'Когти',
  description: 'Когти — валюта сервера CAT: ключи кейсов косметики и титулов, косметика навсегда. Крупные пакеты — с бонусом.',
})

const { products, pending, error } = useCatalogProductsByType(PRODUCT_TYPE.Currency)
</script>

<template>
  <section>
    <BackLink />
    <div class="sec-head">
      <h1>Когти</h1>
      <p>
        Валюта сервера: в игре за Когти покупаются ключи кейса косметики и кейса титулов, а также
        косметика навсегда — через <code>/cos</code>. Крупные пакеты идут с бонусными Когтями.
      </p>
    </div>

    <p v-if="error" class="grid-empty">Не получилось загрузить каталог. Попробуйте обновить страницу.</p>
    <div v-else class="grid">
      <p v-if="!pending && !products.length" class="grid-empty">Пакеты Когтей скоро появятся в продаже.</p>
      <ProductCard v-for="product in products" :key="product.slug" :product="product" />
    </div>
  </section>
</template>
