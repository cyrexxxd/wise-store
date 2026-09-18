<script setup lang="ts">
// История покупок игрока (T-18) — видит только СВОИ заказы, найденные бэкендом по нику из
// httpOnly cookie сессии (PlayerOrdersController.Mine, GET /api/orders/mine). Гость видит
// приглашение войти вместо ошибки, тот же приём входа, что уже открывает LoginModal из
// SiteHeader (useLoginModal).
import { useAuthSession, useLoginModal } from '~/composables/useAuthApi'
import { extractOrderError, fetchMyOrders, type Order } from '~/composables/useOrdersApi'
import { orderStatusView } from '~/utils/orderStatus'
import { formatPrice } from '~/utils/formatPrice'

useSeoMeta({
  title: 'Покупки',
  description: 'История ваших покупок на сервере wise — статус, сумма и состав каждого заказа.',
})

const { session, nick, refresh } = useAuthSession()
const { open: openLogin } = useLoginModal()

// SSR не знает про сессию (httpOnly cookie другого origin, см. auth-session.client.ts) —
// пока сессия не проверена хотя бы раз, страница показывает нейтральное "проверяем", а не
// сразу приглашение войти: иначе уже вошедший игрок на миг увидел бы "гостевой" экран.
const checkingSession = ref(true)

const orders = ref<Order[]>([])
const pending = ref(false)
const error = ref<string | null>(null)

async function loadOrders() {
  pending.value = true
  error.value = null
  try {
    orders.value = await fetchMyOrders()
  } catch (caught) {
    error.value = extractOrderError(caught)?.message ?? 'Не получилось загрузить историю покупок. Попробуйте обновить страницу.'
  } finally {
    pending.value = false
  }
}

onMounted(async () => {
  if (!session.value) await refresh()
  checkingSession.value = false
  if (nick.value) await loadOrders()
})

// Вход/выход прямо на этой странице (модалка логина открывается тут же) — подгружаем или
// очищаем список без перезагрузки страницы.
watch(nick, async (value, previous) => {
  if (checkingSession.value) return
  if (value && value !== previous) {
    await loadOrders()
  } else if (!value) {
    orders.value = []
  }
})

function formatDate(value: string): string {
  return new Date(value).toLocaleString('ru-RU')
}
</script>

<template>
  <section>
    <BackLink />
    <div class="sec-head">
      <h1>Покупки</h1>
      <p>История ваших заказов на сервере — статус, сумма и состав каждой покупки.</p>
    </div>

    <p v-if="checkingSession" class="grid-empty purchases-note">Проверяем сессию…</p>

    <div v-else-if="!nick" class="purchases-guest">
      <p>Чтобы увидеть историю покупок, войдите по нику.</p>
      <button class="pay purchases-login-btn" type="button" @click="openLogin">Войти по нику</button>
    </div>

    <template v-else>
      <p v-if="error" class="grid-empty purchases-note">{{ error }}</p>
      <p v-else-if="pending" class="grid-empty purchases-note">Загружаем историю покупок…</p>
      <p v-else-if="!orders.length" class="grid-empty purchases-note">У вас пока нет покупок.</p>

      <ul v-else class="purchases-list">
        <li v-for="order in orders" :key="order.id" class="purchase-card">
          <div class="purchase-head">
            <span class="purchase-number">{{ order.publicNumber }}</span>
            <span class="purchase-date">{{ formatDate(order.createdAt) }}</span>
            <span class="purchase-status" :class="`tone-${orderStatusView(order.status).tone}`">
              {{ orderStatusView(order.status).label }}
            </span>
          </div>

          <ul class="purchase-items">
            <li v-for="item in order.items" :key="item.id">
              <span>{{ item.nameAtPurchase }} × {{ item.qty }}</span>
              <span>{{ formatPrice(item.priceAtPurchase * item.qty) }} ₸</span>
            </li>
          </ul>

          <div class="purchase-total">
            <span>Итого</span>
            <span>{{ formatPrice(order.total) }} ₸</span>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.purchases-note {
  padding: 40px 20px;
  text-align: center;
  color: var(--muted);
  font-family: var(--f-mono);
  font-size: 0.85rem;
}

.purchases-guest {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  padding: 32px 0;
}

.purchases-guest p {
  margin: 0;
  color: var(--muted);
  font-size: 0.92rem;
}

.purchases-login-btn {
  width: auto;
  padding-left: 28px;
  padding-right: 28px;
}

.purchases-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.purchase-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 18px 20px;
}

.purchase-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--line);
}

.purchase-number {
  font-family: var(--f-mono);
  font-weight: 700;
  color: var(--ink);
}

.purchase-date {
  font-family: var(--f-mono);
  font-size: 0.78rem;
  color: var(--muted);
}

.purchase-status {
  margin-left: auto;
  font-family: var(--f-mono);
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid var(--line-hi);
  color: var(--ink-2);
}

.purchase-status.tone-success { color: #6FE08C; border-color: #2E5F3C; }
.purchase-status.tone-danger { color: #F08A8A; border-color: #6B3232; }
.purchase-status.tone-warning { color: #F0C875; border-color: #6B5628; }

.purchase-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
}

.purchase-items li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.86rem;
  color: var(--ink-2);
}

.purchase-total {
  display: flex;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid var(--line);
  font-family: var(--f-display);
  font-weight: 700;
  color: var(--ink);
}
</style>
