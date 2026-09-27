<script setup lang="ts">
import { PENDING, SELLER, sellerTitle } from '~/data/seller'

useSeoMeta({
  title: 'Контакты',
  description: 'Как связаться с магазином wisepvp.net: email, телефон, Discord.',
})
</script>

<template>
  <section>
    <BackLink />
    <div class="sec-head tone-crates">
      <h1>Контакты</h1>
      <p>Вопросы по покупке, выдаче и возврату. Укажите ник и номер заказа — так ответим быстрее.</p>
    </div>
    <div class="contact-grid">
      <a class="contact tone-claws" :href="SELLER.email ? `mailto:${SELLER.email}` : undefined">
        <b>Email</b><span>{{ SELLER.email ?? PENDING }}</span>
      </a>
      <a v-if="SELLER.phone" class="contact tone-roles" :href="`tel:${SELLER.phone.replace(/[^+\d]/g, '')}`">
        <b>Телефон</b><span>{{ SELLER.phone }}</span>
      </a>
      <a class="contact tone-titles" :href="SELLER.discord" target="_blank" rel="noopener">
        <b>Discord</b><span>{{ SELLER.discord.replace('https://', '') }}</span>
      </a>
      <a v-if="SELLER.telegram" class="contact tone-wise" :href="`https://t.me/${SELLER.telegram.replace('@', '')}`" target="_blank" rel="noopener">
        <b>Telegram</b><span>{{ SELLER.telegram }}</span>
      </a>
    </div>
    <p class="contact-note">Поддержка: {{ SELLER.supportHours }}. {{ sellerTitle() }}, {{ SELLER.address ?? PENDING }}. <NuxtLink to="/requisites">Все реквизиты</NuxtLink></p>
  </section>
</template>
