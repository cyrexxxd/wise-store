<script setup lang="ts">
import { PENDING, SELLER } from '~/data/seller'

useSeoMeta({
  title: 'Реквизиты',
  description: 'Реквизиты продавца и контакты магазина wisepvp.net.',
})
</script>

<template>
  <LegalDoc title="Реквизиты и контакты" updated="27.09.2026">
    <SellerNotice />

    <h2>Продавец</h2>
    <dl>
      <dt>Организационная форма</dt>
      <dd>{{ SELLER.legalForm ?? PENDING }}</dd>
      <dt>Наименование / ФИО</dt>
      <dd>{{ SELLER.name ?? PENDING }}</dd>
      <template v-if="SELLER.iin"><dt>ИИН / БИН</dt><dd>{{ SELLER.iin }}</dd></template>
      <dt>Адрес регистрации</dt>
      <dd>{{ SELLER.address ?? PENDING }}</dd>
    </dl>

    <h2>Контакты</h2>
    <dl>
      <dt>Email</dt>
      <dd><a v-if="SELLER.email" :href="`mailto:${SELLER.email}`">{{ SELLER.email }}</a><template v-else>{{ PENDING }}</template></dd>
      <template v-if="SELLER.phone">
        <dt>Телефон</dt>
        <dd><a :href="`tel:${SELLER.phone.replace(/[^+\d]/g, '')}`">{{ SELLER.phone }}</a></dd>
      </template>
      <template v-if="SELLER.telegram">
        <dt>Telegram</dt>
        <dd><a :href="`https://t.me/${SELLER.telegram.replace('@', '')}`" target="_blank" rel="noopener">{{ SELLER.telegram }}</a></dd>
      </template>
      <dt>Discord</dt>
      <dd><a :href="SELLER.discord" target="_blank" rel="noopener">{{ SELLER.discord.replace('https://', '') }}</a></dd>
      <dt>Поддержка</dt>
      <dd>{{ SELLER.supportHours }}; ответ на обращение — в течение 24 часов.</dd>
    </dl>

    <h2>Приём оплаты</h2>
    <p>
      Платежи в тенге принимает сервис Robokassa (robokassa.kz): оплата проходит на его защищённой странице,
      данные карты магазин не получает. После оплаты покупка автоматически выдаётся на игровом сервере.
    </p>
    <p>
      Условия покупки — в <NuxtLink to="/offer">публичной оферте</NuxtLink>, возврат — в
      <NuxtLink to="/returns">политике возврата</NuxtLink>.
    </p>
  </LegalDoc>
</template>
