<script setup lang="ts">
// Сюда EasyDonate возвращает покупателя после оплаты (success_url в server/utils/easydonate.ts).
// Страница только сообщает о выдаче — сам факт оплаты подтверждает и выдачу делает EasyDonate.
import { useCart } from '~/composables/useCart'

useSeoMeta({ title: 'Спасибо за покупку', robots: 'noindex' })

// Оплата прошла — корзина больше не нужна.
const { items } = useCart()
onMounted(() => {
  items.value = []
})
</script>

<template>
  <section>
    <div class="sec-head">
      <h1>Спасибо за покупку!</h1>
      <p>
        Оплата принята. Покупка придёт на указанный ник в течение пары минут. Если вы были не в сети,
        роль появится при следующем входе на сервер.
      </p>
      <p>
        Если за 10 минут ничего не пришло — напишите в
        <a class="text-link" href="https://discord.gg/GvwpxwJCY" target="_blank" rel="noopener">Discord</a>
        и укажите ник и время оплаты.
      </p>
    </div>
    <NuxtLink class="pay" to="/" style="display: inline-block; width: auto; padding: 15px 28px; text-decoration: none">Вернуться в магазин</NuxtLink>
  </section>
</template>
