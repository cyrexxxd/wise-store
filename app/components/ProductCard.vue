<script setup lang="ts">
import type { PublicProduct } from '~/composables/useCatalogApi'
import { useCart } from '~/composables/useCart'
import { approxKzt, formatPrice } from '~/utils/formatPrice'
import { iconForProduct } from '~/utils/productIcon'

const props = defineProps<{ product: PublicProduct }>()

const { add } = useCart()
const { kztPerRub } = useRuntimeConfig().public
const icon = computed(() => iconForProduct(props.product))
const justAdded = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | undefined

function addToCart() {
  add({
    slug: props.product.slug,
    name: props.product.name,
    price: props.product.price,
    icon: icon.value,
  })
  justAdded.value = true
  clearTimeout(resetTimer)
  resetTimer = setTimeout(() => {
    justAdded.value = false
  }, 900)
}

onBeforeUnmount(() => clearTimeout(resetTimer))
</script>

<template>
  <article class="card">
    <svg class="ico"><use :href="`#ic-${icon}`" /></svg>
    <h3>{{ product.name }}</h3>
    <p v-if="product.description" class="desc">{{ product.description }}</p>
    <span class="price">{{ formatPrice(product.price) }} ₽ <i>{{ approxKzt(product.price, kztPerRub) }}</i></span>
    <button class="add" @click="addToCart">
      <svg><use href="#ic-cart" /></svg>{{ justAdded ? 'Добавлено' : 'Купить' }}
    </button>
  </article>
</template>
