<script setup lang="ts">
// Модалка корзины. "Перейти к оплате" отправляет ник, состав корзины и способ оплаты на /api/checkout.
// Kaspi (ApiPay): сервер выставляет счёт на номер покупателя → страница /pay/<заказ> ждёт оплату.
// Карта (Robokassa): сервер возвращает ссылку на страницу оплаты Robokassa. Выдачу делает плагин WiseDelivery.
import { useCart } from '~/composables/useCart'
import { approxRub, formatKzt } from '~/utils/formatPrice'

const { items, nick, isOpen, count, total, changeQty, remove, close } = useCart()
const { kztPerRub } = useRuntimeConfig().public

// способы оплаты, подключённые на сервере; Kaspi — по умолчанию (большинство покупателей из Казахстана)
const { data: methods } = useFetch<{ kaspi: boolean; card: boolean }>('/api/checkout/methods', { key: 'checkout-methods', server: false })
const method = ref<'kaspi' | 'card'>('kaspi')
const phone = ref('')
watch(methods, (m) => { if (m && !m.kaspi && m.card) method.value = 'card' })
const methodReady = computed(() => (method.value === 'kaspi' ? methods.value?.kaspi : methods.value?.card) ?? false)
// быстрая проверка в браузере (10–11 цифр); точную делает сервер (normalizeKzPhone)
const phoneOk = computed(() => method.value !== 'kaspi' || [10, 11].includes(phone.value.replace(/\D/g, '').length))

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)

const canSubmit = computed(() => items.value.length > 0 && nick.value.trim().length > 0 && methodReady.value && phoneOk.value && !isSubmitting.value)

function errorMessage(error: unknown): string {
  const data = (error as { data?: { data?: { message?: unknown } } })?.data?.data
  return typeof data?.message === 'string' ? data.message : 'Не получилось перейти к оплате. Попробуйте ещё раз.'
}

async function submitOrder() {
  if (!canSubmit.value) return
  isSubmitting.value = true
  submitError.value = null
  try {
    const res = await $fetch<{ url?: string; pay?: string }>('/api/checkout', {
      method: 'POST',
      body: { nick: nick.value.trim(), items: items.value.map((i) => ({ slug: i.slug, qty: i.qty })), method: method.value, phone: phone.value },
    })
    if (res.pay) {
      close()
      await navigateTo(res.pay)
      isSubmitting.value = false
    } else if (res.url) {
      window.location.href = res.url
    }
  } catch (error) {
    submitError.value = errorMessage(error)
    isSubmitting.value = false
  }
}

let lastFocus: HTMLElement | null = null
const closeBtnRef = ref<HTMLButtonElement | null>(null)

watch(isOpen, async (open) => {
  if (open) {
    submitError.value = null
    lastFocus = document.activeElement as HTMLElement | null
    document.body.classList.add('locked')
    await nextTick()
    closeBtnRef.value?.focus()
  } else {
    document.body.classList.remove('locked')
    lastFocus?.focus()
  }
})

function onOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) close()
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.classList.remove('locked')
})
</script>

<template>
  <div
    id="cart"
    class="overlay"
    :class="{ open: isOpen }"
    :hidden="!isOpen"
    role="dialog"
    aria-modal="true"
    aria-labelledby="cart-title"
    @click="onOverlayClick"
  >
    <div class="modal">
      <div class="modal-head">
        <h2 id="cart-title">Корзина</h2>
        <span class="n">{{ items.length ? `${count} шт.` : 'пусто' }}</span>
        <button ref="closeBtnRef" class="x" aria-label="Закрыть корзину" @click="close">✕</button>
      </div>

      <div class="modal-body">
        <p v-if="!items.length" class="cart-empty">Корзина пуста</p>
        <div v-for="item in items" :key="item.slug" class="line">
          <span class="thumb"><ItemIcon :icon="item.icon" :size="40" /></span>
          <span class="info">
            <b>{{ item.name }}</b>
            <span>{{ formatKzt(item.price) }} за штуку</span>
          </span>
          <span class="right">
            <span class="qty">
              <button aria-label="Меньше" @click="changeQty(item.slug, -1)">−</button>
              <span>{{ item.qty }}</span>
              <button aria-label="Больше" @click="changeQty(item.slug, 1)">+</button>
            </span>
            <span class="sum">{{ formatKzt(item.price * item.qty) }}</span>
            <button class="rm" aria-label="Убрать" @click="remove(item.slug)">✕</button>
          </span>
        </div>
      </div>

      <div class="modal-foot">
        <div class="nick-field">
          <label for="nick">Ник в игре</label>
          <input
            id="nick"
            v-model="nick"
            type="text"
            autocomplete="off"
            spellcheck="false"
            placeholder="Например, Notch"
          >
          <small>Покупка придёт на этот ник. Проверьте регистр — изменить после оплаты нельзя.</small>
        </div>
        <div class="pay-methods" role="radiogroup" aria-label="Способ оплаты">
          <button type="button" class="pm kaspi" :class="{ on: method === 'kaspi' }" role="radio" :aria-checked="method === 'kaspi'" @click="method = 'kaspi'">
            <b>Kaspi</b><span>{{ methods?.kaspi ? 'счёт в приложении Kaspi' : 'скоро' }}</span>
          </button>
          <button type="button" class="pm card" :class="{ on: method === 'card' }" role="radio" :aria-checked="method === 'card'" @click="method = 'card'">
            <b>Карта</b><span>{{ methods?.card ? 'Visa / Mastercard, Robokassa' : 'скоро' }}</span>
          </button>
        </div>
        <div v-if="method === 'kaspi'" class="nick-field">
          <label for="kaspi-phone">Номер Kaspi</label>
          <input id="kaspi-phone" v-model="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="8 7XX XXX XX XX">
          <small>На этот номер придёт счёт в приложении Kaspi. Сам номер мы не сохраняем.</small>
        </div>
        <div class="totals">
          <div><span class="k">Позиций</span><span class="v">{{ count }}</span></div>
          <div class="grand"><span class="k">К оплате</span><span class="v">{{ formatKzt(total) }}</span></div>
          <div><span class="k">В рублях</span><span class="v">{{ approxRub(total, kztPerRub) }}</span></div>
        </div>
        <p v-if="submitError" class="cart-error">{{ submitError }}</p>
        <button class="pay" :disabled="!canSubmit" @click="submitOrder">
          {{ isSubmitting ? 'Оформляем…' : !methodReady ? 'Этот способ оплаты скоро откроется' : method === 'kaspi' ? 'Выставить счёт в Kaspi' : 'Перейти к оплате картой' }}
        </button>
        <p class="note">Kaspi — счёт по номеру через ApiPay, оплата в приложении Kaspi. Карта — через Robokassa, в тенге; сумму в другой валюте пересчитывает ваш банк.<br>Нажимая кнопку, вы соглашаетесь с <NuxtLink to="/offer" @click="close">офертой</NuxtLink>.</p>
      </div>
    </div>
  </div>
</template>
