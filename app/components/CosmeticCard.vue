<script setup lang="ts">
// Карточка предмета каталога: иконка, редкость, превью (титул/сообщение/цвет ника как в игре), где взять.
import { howToGet, nameGradient, RARITY_INFO, type CosmeticItem } from '~/utils/cosmetics'
import { itemIcon } from '~/utils/productIcon'

const props = defineProps<{ type: string; item: CosmeticItem }>()
const color = computed(() => RARITY_INFO[props.item.rarity].color)
const ways = computed(() => howToGet(props.type, props.item))
</script>

<template>
  <article class="cos-card" :style="{ '--r': color }">
    <ItemIcon class="cos-ico" :icon="itemIcon(type, item.id)" :size="84" />
    <h3>{{ item.name }}</h3>
    <RarityTag :rarity="item.rarity" />
    <p v-if="type === 'title' && item.preview" class="cos-preview"><span class="nick">Cyrexxxx</span> <RunsText :runs="item.preview" /></p>
    <p v-else-if="type === 'killmessage' && item.preview" class="cos-preview small"><RunsText :runs="item.preview" /></p>
    <p v-else-if="type === 'namecolor'" class="cos-preview">
      <span class="grad-nick" :style="{ backgroundImage: nameGradient(item.colors), fontWeight: item.bold ? 800 : 600 }">Cyrexxxx</span>
    </p>
    <p v-else-if="item.description" class="cos-desc">{{ item.description }}</p>
    <ul class="ways">
      <li v-for="w in ways" :key="w">{{ w }}</li>
    </ul>
  </article>
</template>
