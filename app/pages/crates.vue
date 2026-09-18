<script setup lang="ts">
// Кейсы (crates.html → T-15). Верхняя сетка — товары типа crate_key (ключи кейсов,
// покупаются как обычный товар). Нижняя секция "Шансы" — отдельный публичный эндпоинт
// GET /api/catalog/crates: шансы публикуются открыто (раздел 6 плана), а не берутся из
// текста товара.
import { PRODUCT_TYPE, useCatalogCrates, useCatalogProductsByType } from '~/composables/useCatalogApi'

useSeoMeta({
  title: 'Кейсы',
  description: 'Кейсы сервера wise: один случайный предмет из набора за открытие. Шансы публикуются честно, без раскрасок задним числом.',
})

const { products, pending: productsPending, error: productsError } = useCatalogProductsByType(PRODUCT_TYPE.CrateKey)
const { data: crates, pending: cratesPending, error: cratesError } = useCatalogCrates()

function barColorFor(index: number, total: number): string {
  // Тот же визуальный приём, что в crate.html: чем реже предмет, тем насыщеннее полоса.
  const ratio = total > 1 ? index / (total - 1) : 0
  if (ratio < 0.34) return 'rgba(140,109,255,.28)'
  if (ratio < 0.67) return 'rgba(140,109,255,.5)'
  return 'var(--accent-hi)'
}
</script>

<template>
  <div>
    <section>
      <BackLink />
      <div class="sec-head">
        <h1>Кейсы</h1>
        <p>Открытие выдаёт один случайный предмет из набора. Шансы — ниже, честно и без раскрасок задним числом.</p>
      </div>

      <p v-if="productsError" class="grid-empty">Не получилось загрузить кейсы. Попробуйте обновить страницу.</p>
      <div v-else class="grid">
        <p v-if="!productsPending && !products.length" class="grid-empty">Пока нет кейсов в продаже.</p>
        <ProductCard v-for="product in products" :key="product.slug" :product="product" />
      </div>
    </section>

    <section id="odds">
      <div class="sec-head">
        <h2>Шансы в кейсах</h2>
        <p>Публикуем как есть — те же числа, что стоят в конфиге сервера. Сумма всегда равна 100%.</p>
      </div>

      <p v-if="cratesError" class="grid-empty">Не получилось загрузить шансы.</p>
      <div v-else class="crate-wrap">
        <div v-for="crate in crates" :key="crate.key" class="crate">
          <h3>{{ crate.name }}</h3>
          <p>{{ crate.items.length }} {{ crate.items.length === 1 ? 'предмет' : 'предметов' }}, один выпадает за открытие.</p>
          <div class="odds">
            <div v-for="(item, idx) in crate.items" :key="item.itemKey" class="odd">
              <span class="nm">{{ item.displayName }}</span>
              <span class="pc">{{ item.chance.toFixed(1) }}%</span>
              <span class="bar"><i :style="{ width: `${item.chance}%`, background: barColorFor(idx, crate.items.length) }" /></span>
            </div>
          </div>
        </div>
        <p v-if="!cratesPending && !crates?.length" class="grid-empty">Пока нет опубликованных кейсов.</p>
      </div>
    </section>
  </div>
</template>
