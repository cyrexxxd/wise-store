<script setup lang="ts">
// "← Все разделы" — общая ссылка назад на хаб, была продублирована в разметке каждой
// страницы раздела (crates/cosmetics/currency/roles/titles).
</script>

<template>
  <NuxtLink class="back-link" to="/">
    <svg class="pico"><use href="#ic-back" /></svg>Все разделы
  </NuxtLink>
</template>
