<script setup lang="ts">
// Таблица сравнения тиров (roles.html/titles.html в исходном макете). Description товара
// (T-09) — мелким текстом в шапке колонки, под названием тира, как на референсе (Hypixel
// Store): не отдельная строка таблицы, а часть карточки тира. `rows` — необязательные
// строки сравнения сверх этого (например для roles.vue) — владелец задаёт их на фронте,
// PublicProductDto булевых фич по тиру не несёт.
import type { PublicProduct } from '~/composables/useCatalogApi'
import { useCart } from '~/composables/useCart'
import { formatPrice } from '~/utils/formatPrice'
import { iconForProduct } from '~/utils/productIcon'

export interface ComparisonRow {
  label: string
  /** 'check' — галочка/прочерк по truthy; 'tag' — цветной тег вида чат-префикса; иначе — текст. */
  kind?: 'check' | 'tag'
  values: (product: PublicProduct) => string
}

const props = withDefaults(
  defineProps<{ products: PublicProduct[]; rows?: ComparisonRow[] }>(),
  { rows: () => [] },
)

const { add } = useCart()
const addedSlug = ref<string | null>(null)
let resetTimer: ReturnType<typeof setTimeout> | undefined

function addToCart(product: PublicProduct) {
  add({ slug: product.slug, name: product.name, price: product.price, icon: iconForProduct(product) })
  addedSlug.value = product.slug
  clearTimeout(resetTimer)
  resetTimer = setTimeout(() => {
    addedSlug.value = null
  }, 900)
}

onBeforeUnmount(() => clearTimeout(resetTimer))
</script>

<template>
  <div class="cmp-wrap">
  <div class="cmp-scroll">
    <table class="cmp">
      <thead>
        <tr>
          <th class="cmp-label" />
          <th v-for="product in products" :key="product.slug">
            <span class="tier-name">{{ product.name }}</span>
            <p v-if="product.description" class="tier-desc">{{ product.description }}</p>
            <span class="tier-price">{{ formatPrice(product.price) }} ₸</span>
            <button class="add" @click="addToCart(product)">
              <svg><use href="#ic-cart" /></svg>{{ addedSlug === product.slug ? 'Добавлено' : 'Купить' }}
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.label">
          <td class="cmp-label">{{ row.label }}</td>
          <td v-for="product in products" :key="product.slug">
            <span v-if="row.kind === 'tag'" class="chat-tag">{{ row.values(product) }}</span>
            <svg v-else-if="row.kind === 'check' && row.values(product)" class="check"><use href="#ic-check" /></svg>
            <span v-else-if="row.kind === 'check'" class="dash">—</span>
            <span v-else-if="row.values(product)">{{ row.values(product) }}</span>
            <span v-else class="dash">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Закреплена снизу окна, пока пользователь листает сравнение, и "садится" на своё
       место в потоке, как только .cmp-buy-bar достигает низа .cmp-wrap (см. cmp-wrap в
       store.css: sticky не может выйти за пределы containing block). Вне таблицы (не
       tfoot) — иначе overflow-x на .cmp-scroll ловит sticky в себя и он никуда не едет. -->
  <div class="cmp-buy-bar">
    <div class="cmp-buy-bar-label" />
    <div v-for="product in products" :key="product.slug" class="cmp-buy-bar-item">
      <button class="add" @click="addToCart(product)">
        <svg><use href="#ic-cart" /></svg>{{ addedSlug === product.slug ? 'Добавлено' : 'Купить' }}
      </button>
    </div>
  </div>
  </div>
</template>
