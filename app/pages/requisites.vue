<script setup lang="ts">
useSeoMeta({
  title: 'Реквизиты',
  description: 'Реквизиты продавца — магазин сервера wise.',
})
</script>

<template>
  <LegalDoc title="Реквизиты" updated="заполняется">
    <LegalNotice>
      Данные продавца — заглушка. Владелец добавит реальные реквизиты ИП перед запуском
      приёма платежей; до этого момента страница не публикует настоящих данных.
    </LegalNotice>

    <h2>Продавец</h2>
    <dl>
      <dt>Наименование</dt>
      <dd>ИП «———»</dd>
      <dt>БИН/ИИН</dt>
      <dd>—————————— (12 цифр)</dd>
      <dt>Юридический адрес</dt>
      <dd>Республика Казахстан, —————————</dd>
      <dt>Контактный email</dt>
      <dd>—————@wisepvp.net</dd>
      <dt>Discord</dt>
      <dd><a href="https://discord.gg/GvwpxwJCY" target="_blank" rel="noopener">discord.gg/GvwpxwJCY</a></dd>
    </dl>

    <h2>Приём оплаты</h2>
    <p>
      Платежи принимает сервис EasyDonate (easydonate.ru) — оплата проходит на его странице,
      после чего покупка автоматически выдаётся на сервере.
    </p>
  </LegalDoc>
</template>
