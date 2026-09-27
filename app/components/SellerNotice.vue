<script setup lang="ts">
// Предупреждение на документах, пока владелец не заполнил данные продавца (app/data/seller.ts).
import { SELLER_COMPLETE } from '~/data/seller'
</script>

<template>
  <LegalNotice v-if="!SELLER_COMPLETE">
    Данные продавца ещё не заполнены — документ начнёт действовать после их публикации на
    <NuxtLink to="/requisites">странице реквизитов</NuxtLink>. Приём платежей до этого момента закрыт.
  </LegalNotice>
</template>
