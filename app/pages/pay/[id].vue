<script setup lang="ts">
// Ожидание оплаты Kaspi: счёт уже выставлен на номер покупателя через ApiPay. Страница раз в 5 с спрашивает
// статус заказа (/api/orders/<id>?t=<token>); сервер при этом сам сверяется с ApiPay, если вебхук задержался.
import { useCart } from '~/composables/useCart'
import { formatKzt } from '~/utils/formatPrice'

useSeoMeta({ title: 'Оплата в Kaspi', robots: 'noindex' })

const route = useRoute()
const id = String(route.params.id)
const token = String(route.query.t ?? '')
// qrLink/qrSvg — ссылка Kaspi на этот же счёт и QR из неё (сервер отдаёт их, пока заказ ждёт оплаты)
interface OrderState { invId: number; state: 'pending' | 'paid' | 'failed' | 'refunded'; providerStatus: string | null; amount: number; test: boolean; qrLink?: string | null; qrSvg?: string | null }
const order = ref<OrderState | null>(null)
const notFound = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
// после отмены/ошибки ещё 15 минут проверяем реже: Kaspi может провести оплату в последний момент
const startedFailedAt = ref<number | null>(null)

async function poll() {
  try {
    order.value = await $fetch<OrderState>(`/api/orders/${id}`, { query: { t: token } })
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 404) { notFound.value = true; return }
  }
  if (order.value?.state === 'paid') useCart().items.value = []
  if (order.value?.state === 'pending') timer = setTimeout(poll, 5000)
  if (order.value?.state === 'failed') {
    startedFailedAt.value ??= Date.now()
    if (Date.now() - startedFailedAt.value < 15 * 60_000) timer = setTimeout(poll, 30_000)
  }
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
      <div class="kaspi-qr">
        <h3>Или оплатите по QR</h3>
        <template v-if="order?.qrLink">
          <!-- SVG собирает сервер (uqr) из проверенной ссылки https://kaspi.kz/… -->
          <div class="qr-box" role="img" aria-label="QR-код для оплаты в Kaspi" v-html="order.qrSvg" />
          <p>Отсканируйте камерой телефона или в приложении Kaspi.kz → «Kaspi QR». Это тот же счёт — второй раз платить не нужно.</p>
          <a class="btn btn-pink" :href="order.qrLink" target="_blank" rel="noopener noreferrer">Открыть в Kaspi</a>
        </template>
        <p v-else class="qr-wait">QR появится здесь через несколько секунд, как только Kaspi примет счёт.</p>
      </div>
      <p class="hint">Счёт не пришёл? Проверьте номер в Kaspi → «Мои платежи» → «Счета» или оплатите по QR выше. Страницу можно
        закрыть: сайт сам проверяет оплату, и покупка будет выдана автоматически.</p>
    </div>

    <div v-else-if="order.state === 'paid'" class="kaspi-done">
      <h2>Оплачено!</h2>
      <p>Покупка придёт на ваш ник в течение нескольких минут. Не в сети — при следующем входе на сервер.</p>
      <NuxtLink class="btn btn-gold" to="/">Вернуться в магазин</NuxtLink>
    </div>

    <div v-else-if="order.state === 'refunded'" class="kaspi-fail">
      <h2>Оплата возвращена</h2>
      <p>По этому заказу оформлен возврат денег в Kaspi. Вопросы — в поддержку.</p>
      <NuxtLink class="btn btn-pink" to="/contacts">Контакты</NuxtLink>
    </div>

    <div v-else class="kaspi-fail">
      <h2>{{ order.providerStatus === 'error' ? 'Kaspi не смог выставить счёт' : 'Счёт пока не оплачен' }}</h2>
      <p v-if="order.providerStatus === 'error'">Проверьте номер Kaspi и оформите заказ ещё раз или оплатите картой.</p>
      <p v-else>Счёт {{ order.providerStatus === 'expired' ? 'истёк' : 'отменён' }}. Если вы всё же успели оплатить — покупка придёт
        автоматически, страница продолжает проверять. Если нет — корзина сохранилась, оформите заново.</p>
      <NuxtLink class="btn btn-pink" to="/">В магазин</NuxtLink>
    </div>
  </section>
</template>
