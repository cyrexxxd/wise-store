<script setup lang="ts">
// Заголовок по умолчанию — конкретные страницы переопределяют через useSeoMeta.
useSeoMeta({
  titleTemplate: (title) => (title ? `${title} · Wise Store` : 'Wise Store'),
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
