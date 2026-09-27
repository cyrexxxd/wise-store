<script setup lang="ts">
import { RARITY_INFO, type Rarity } from '~/utils/cosmetics'

const props = defineProps<{ rarity: Rarity }>()
const info = computed(() => RARITY_INFO[props.rarity])
</script>

<template>
  <span class="rarity" :style="{ '--r': info.color }">{{ info.title }}</span>
</template>
