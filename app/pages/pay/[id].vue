<script setup lang="ts">
// Ожидание оплаты Kaspi: счёт уже выставлен на номер покупателя через ApiPay. Страница раз в 5 с спрашивает
// статус заказа (/api/orders/<id>?t=<token>); сервер при этом сам сверяется с ApiPay, если вебхук задержался.
import { useCart } from '~/composables/useCart'
import { formatKzt } from '~/utils/formatPrice'

useSeoMeta({ title: 'Оплата в Kaspi', robots: 'noindex' })

const route = useRoute()
const id = String(route.params.id)
const token = String(route.query.t ?? '')
interface OrderState { invId: number; state: 'pending' | 'paid' | 'failed'; providerStatus: string | null; amount: number; test: boolean }
const order = ref<OrderState | null>(null)
const notFound = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function poll() {
  try {
    order.value = await $fetch<OrderState>(`/api/orders/${id}`, { query: { t: token } })
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 404) { notFound.value = true; return }
  }
  if (order.value?.state === 'paid') useCart().items.value = []
  if (order.value?.state === 'pending') timer = setTimeout(poll, 5000)
}

onMounted(poll)
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <section>
    <div class="sec-head tone-claws">
      <h1>Оплата в Kaspi</h1>
      <p v-if="order">Заказ №{{ order.invId }} · {{ formatKzt(order.amount) }}<template v-if="order.test"> · тестовый режим (без выдачи)</template></p>
    </div>

    <p v-if="notFound" class="grid-empty">Заказ не найден. Проверьте ссылку или напишите в поддержку.</p>

    <div v-else-if="!order || order.state === 'pending'" class="kaspi-wait">
      <div class="spinner" aria-hidden="true" />
      <ol>
        <li>Откройте приложение <b>Kaspi.kz</b> — туда пришёл счёт от <b>Wise Store</b>.</li>
        <li>Проверьте сумму и оплатите. Счёт действует 24 часа.</li>
        <li>Эта страница обновится сама — покупка придёт в игру за несколько минут.</li>
      </ol>
      <p class="hint">Счёт не пришёл? Проверьте номер в Kaspi → «Мои платежи» → «Счета». Можно закрыть страницу —
        оплата всё равно дойдёт, и выдача произойдёт автоматически.</p>
    </div>

    <div v-else-if="order.state === 'paid'" class="kaspi-done">
      <h2>Оплачено!</h2>
      <p>Покупка придёт на ваш ник в течение нескольких минут. Не в сети — при следующем входе на сервер.</p>
      <NuxtLink class="btn btn-gold" to="/">Вернуться в магазин</NuxtLink>
    </div>

    <div v-else class="kaspi-fail">
      <h2>Счёт не оплачен</h2>
      <p>Счёт {{ order.providerStatus === 'expired' ? 'истёк' : 'отменён' }} — деньги не списаны. Корзина сохранилась, можно оформить заново.</p>
      <NuxtLink class="btn btn-pink" to="/">В магазин</NuxtLink>
    </div>
  </section>
</template>
