<script setup lang="ts">
import { pluralizeProducts } from '~/utils/pluralize'

defineProps<{
  to: string
  icon: string
  title: string
  count: number
}>()
</script>

<template>
  <NuxtLink class="hub-tile" :to="to">
    <svg class="ico"><use :href="`#ic-${icon}`" /></svg>
    <div>
      <h3>{{ title }}</h3>
      <span class="cnt">{{ count }} {{ pluralizeProducts(count) }}</span>
    </div>
  </NuxtLink>
</template>
