<script setup lang="ts">
// Цветной текст из игры (титулы, сообщения убийств): куски с цветом — так же, как их рисует MiniMessage.
import type { TextRun } from '~/utils/cosmetics'

defineProps<{ runs: TextRun[] }>()
</script>

<template>
  <span class="runs"><span v-for="(r, i) in runs" :key="i" :style="{ color: r.color ?? undefined, fontWeight: r.bold ? 700 : undefined }">{{ r.text }}</span></span>
</template>
