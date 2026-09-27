<script setup lang="ts">
// FailURL Robokassa: оплата отменена или не прошла. Заказ остаётся неоплаченным, выдачи нет.
useSeoMeta({ title: 'Оплата не прошла', robots: 'noindex' })
</script>

<template>
  <section>
    <div class="sec-head">
      <h1>Оплата не прошла</h1>
      <p>Платёж отменён или отклонён банком — деньги не списаны, покупка не выдана. Корзина сохранилась, можно попробовать ещё раз.</p>
      <p>
        Если деньги всё-таки списались — напишите в
        <a class="text-link" href="https://discord.gg/GvwpxwJCY" target="_blank" rel="noopener">Discord</a>
        и укажите ник и время оплаты.
      </p>
    </div>
    <NuxtLink class="btn btn-gold" to="/">Вернуться в магазин</NuxtLink>
  </section>
</template>
