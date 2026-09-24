<script setup lang="ts">
// Хаб каталога. Счётчики на плитках — из живого каталога EasyDonate; разделы без товаров
// не показываются, чтобы не водить покупателя на пустые страницы.
import { countByType, PRODUCT_TYPE, useCatalogProducts } from '~/composables/useCatalogApi'

useSeoMeta({
  title: 'Каталог',
  description: 'Официальный магазин сервера wise: роли и кейсы. Выдача на ник, указанный при оплате.',
})

const { products, pending, error } = useCatalogProducts()

const counts = computed(() => countByType(products.value))

const allSections = computed(() => [
  { to: '/roles', icon: 'shield', title: 'Роли', count: counts.value[PRODUCT_TYPE.Rank] ?? 0 },
  { to: '/titles', icon: 'title', title: 'Титулы', count: counts.value[PRODUCT_TYPE.Title] ?? 0 },
  { to: '/cosmetics', icon: 'hat', title: 'Косметика', count: counts.value[PRODUCT_TYPE.Cosmetic] ?? 0 },
  { to: '/currency', icon: 'gem', title: 'Кристаллы', count: counts.value[PRODUCT_TYPE.Currency] ?? 0 },
  { to: '/crates', icon: 'crate', title: 'Кейсы', count: counts.value[PRODUCT_TYPE.CrateKey] ?? 0 },
])

const sections = computed(() => allSections.value.filter((s) => s.count > 0))
</script>

<template>
  <section id="shop">
    <div class="sec-head">
      <h1>Каталог</h1>
      <p>
        Всё выдаётся на ник, указанный при оплате, в течение пары минут после оплаты. Роли можно
        купить и вне игры, а для кейса нужно быть на сервере в момент оплаты. Шансы в кейсах — <NuxtLink class="text-link" to="/crates#odds">на странице кейсов</NuxtLink>.
      </p>
    </div>

    <p v-if="error" class="grid-empty">Не получилось загрузить каталог. Попробуйте обновить страницу.</p>
    <div v-else class="hub-grid">
      <p v-if="!pending && !sections.length" class="grid-empty">Скоро здесь появятся товары.</p>
      <HubTile v-for="s in sections" :key="s.to" :to="s.to" :icon="s.icon" :title="s.title" :count="s.count" />
    </div>
  </section>
</template>
