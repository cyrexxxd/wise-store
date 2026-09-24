<script setup lang="ts">
// Роли — товары-привилегии (тип group в EasyDonate). Состав привилегий каждой роли пишется
// в описании товара в панели EasyDonate и выводится в шапке колонки — строк сравнения на
// фронте нет, чтобы сайт не обещал того, чего не даёт группа в LuckPerms.
import { PRODUCT_TYPE, useCatalogProductsByType } from '~/composables/useCatalogApi'

useSeoMeta({
  title: 'Роли',
  description: 'Роли сервера wise на 30 дней. Повторная покупка продлевает срок.',
})

const { products, pending, error } = useCatalogProductsByType(PRODUCT_TYPE.Rank)
</script>

<template>
  <section>
    <BackLink />
    <div class="sec-head">
      <h1>Роли</h1>
      <p>Роль действует 30 дней с момента выдачи. Повторная покупка той же роли продлевает срок.</p>
    </div>

    <p v-if="error" class="grid-empty">Не получилось загрузить роли. Попробуйте обновить страницу.</p>
    <p v-else-if="!pending && !products.length" class="grid-empty">Пока нет ролей в продаже.</p>
    <TierComparisonTable v-else :products="products" />
  </section>
</template>
