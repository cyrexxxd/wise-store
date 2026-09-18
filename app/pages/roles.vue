<script setup lang="ts">
// Роли (roles.html → T-15) — товары типа rank из живого каталога.
import type { ComparisonRow } from '~/components/TierComparisonTable.vue'
import { PRODUCT_TYPE, useCatalogProductsByType } from '~/composables/useCatalogApi'

useSeoMeta({
  title: 'Роли',
  description: 'Роли сервера wise — постоянные привилегии, покупаются один раз и остаются навсегда.',
})

const { products, pending, error } = useCatalogProductsByType(PRODUCT_TYPE.Rank)

// Иллюстративные строки сравнения — до согласования точного списка привилегий с владельцем.
// Единственный подтверждённый факт (CLAUDE.md): /prefix и /suffix через CustomPrefixes даёт
// именно группа premium, не vip. Остальные строки — примерные, для наглядности таблицы.
const CHAT_TAGS: Record<string, string> = { vip: '[VIP]', premium: '[PREMIUM]' }

const comparisonRows: ComparisonRow[] = [
  { label: 'Тег в чате', kind: 'tag', values: p => CHAT_TAGS[p.slug] ?? `[${p.name.toUpperCase()}]` },
  { label: 'Custom /prefix и /suffix', kind: 'check', values: p => (p.slug === 'premium' ? '✓' : '') },
  { label: 'Приоритет в очереди сервера', kind: 'check', values: () => '✓' },
  { label: 'Значок роли в TAB и чате', kind: 'check', values: () => '✓' },
  { label: 'Цветной ник в чате', kind: 'check', values: p => (p.slug === 'premium' ? '✓' : '') },
  { label: 'Эксклюзивный кит на арене', kind: 'check', values: p => (p.slug === 'premium' ? '✓' : '') },
  { label: 'Скидка на кейсы в магазине', values: p => (p.slug === 'premium' ? '10%' : '5%') },
]
</script>

<template>
  <section>
    <BackLink />
    <div class="sec-head">
      <h1>Роли</h1>
      <p>Постоянные привилегии на сервере — покупаются один раз и остаются навсегда.</p>
    </div>

    <p v-if="error" class="grid-empty">Не получилось загрузить роли. Попробуйте обновить страницу.</p>
    <p v-else-if="!pending && !products.length" class="grid-empty">Пока нет ролей в продаже.</p>
    <TierComparisonTable v-else :products="products" :rows="comparisonRows" />
  </section>
</template>
