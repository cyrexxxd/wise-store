<script setup lang="ts">
// Иконка товара — рендер игровой модели (см. utils/productIcon.ts). Декоративная: название
// товара всегда рядом текстом, поэтому alt пустой.
import { iconUrl } from '~/utils/productIcon'

const props = defineProps<{ icon: string; size?: number }>()
const src = computed(() => iconUrl(props.icon))
</script>

<template>
  <img class="item-ico" :src="src" alt="" :width="size ?? 96" :height="size ?? 96" loading="lazy" decoding="async">
</template>
