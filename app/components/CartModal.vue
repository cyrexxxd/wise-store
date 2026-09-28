<script setup lang="ts">
// Модалка корзины. "Перейти к оплате" отправляет ник, состав корзины и способ оплаты на /api/checkout.
// Kaspi (ApiPay): сервер выставляет счёт на номер покупателя → страница /pay/<заказ> ждёт оплату.
// Выдачу делает плагин WiseDelivery. Оплата картой (Robokassa) на сервере осталась, но в корзине скрыта — магазин не активирован.
import { useCart } from '~/composables/useCart'
import { approxRub, formatKzt } from '~/utils/formatPrice'

const { items, nick, isOpen, count, total, changeQty, remove, close } = useCart()
const { kztPerRub } = useRuntimeConfig().public

// способы оплаты, подключённые на сервере; в корзине сейчас только Kaspi
const { data: methods } = useFetch<{ kaspi: boolean; card: boolean }>('/api/checkout/methods', { key: 'checkout-methods', server: false })
const method = 'kaspi' as const
// номер Kaspi: 10 цифр после «+7» (747 131 14 61); точную проверку делает сервер (normalizeKzPhone)
const phone = ref('')
const methodReady = computed(() => methods.value?.kaspi ?? false)

function phoneDigits(raw: string, prev: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.length > 10) {
    // номер уже полный, дописали лишнюю цифру — оставляем как был
    if (prev.length === 10 && d.startsWith(prev)) return prev
    // вставили полный номер: +7 747…, 8 747…, 7 747…
    if (d.startsWith('7') || d.startsWith('8')) d = d.slice(1)
  }
  return d.slice(0, 10)
}
// (747) 131-14-61 — по мере ввода
function formatPhone(d: string): string {
  if (!d) return ''
  let out = `(${d.slice(0, 3)}`
  if (d.length > 3) out += `) ${d.slice(3, 6)}`
  if (d.length > 6) out += `-${d.slice(6, 8)}`
  if (d.length > 8) out += `-${d.slice(8, 10)}`
  return out
}
const phoneShown = computed(() => formatPhone(phone.value))
// вставили 12+ цифр — это номер карты, а не телефон
const cardLike = ref(false)
function onPhoneInput(event: Event) {
  const input = event.target as HTMLInputElement
  const raw = input.value.replace(/\D/g, '')
  cardLike.value = raw.length >= 12 && !(phone.value.length === 10 && raw.startsWith(phone.value))
  phone.value = cardLike.value ? '' : phoneDigits(input.value, phone.value)
  input.value = phoneShown.value
}
const phoneOk = computed(() => phone.value.length === 10 && phone.value.startsWith('7'))
const phoneHint = computed(() => {
  if (cardLike.value) return 'Это номер карты. Нужен номер телефона, к которому привязан Kaspi'
  if (!phone.value || phoneOk.value) return null
  return phone.value.startsWith('7') ? `Ещё ${10 - phone.value.length} цифр` : 'Номер казахстанский: после +7 идёт (7__)'
})

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)

const nickOk = computed(() => nick.value.trim().length > 0)
const canSubmit = computed(() => items.value.length > 0 && nickOk.value && methodReady.value && phoneOk.value && !isSubmitting.value)
const payLabel = computed(() => {
  if (isSubmitting.value) return 'Оформляем…'
  if (!methodReady.value) return 'Оплата временно недоступна'
  if (!nickOk.value) return 'Укажите ник в игре'
  if (!phoneOk.value) return 'Укажите номер Kaspi'
  return 'Выставить счёт в Kaspi'
})

function errorMessage(error: unknown): string {
  const data = (error as { data?: { data?: { message?: unknown } } })?.data?.data
  return typeof data?.message === 'string' ? data.message : 'Не получилось перейти к оплате. Попробуйте ещё раз.'
}

async function submitOrder() {
  if (!canSubmit.value) return
  isSubmitting.value = true
  submitError.value = null
  try {
    const res = await $fetch<{ pay?: string }>('/api/checkout', {
      method: 'POST',
      body: { nick: nick.value.trim(), items: items.value.map((i) => ({ slug: i.slug, qty: i.qty })), method, phone: `+7${phone.value}` },
    })
    if (res.pay) {
      close()
      await navigateTo(res.pay)
      isSubmitting.value = false
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
        <div class="pay-methods">
          <div class="pm kaspi on">
            <b><img class="pm-logo" src="/icons/kaspi.svg" alt="" width="20" height="20">Kaspi</b><span>счёт в приложении Kaspi</span>
          </div>
        </div>
        <div class="nick-field">
          <label for="kaspi-phone">Номер Kaspi</label>
          <div class="phone-input" :class="{ bad: phoneHint }">
            <span class="cc">+7</span>
            <input
              id="kaspi-phone"
              :value="phoneShown"
              type="tel"
              inputmode="numeric"
              autocomplete="tel-national"
              placeholder="(___) ___-__-__"
              @input="onPhoneInput"
              @change="onPhoneInput"
            >
          </div>
          <small v-if="phoneHint" class="phone-hint">{{ phoneHint }}</small>
          <small>Номер телефона, к которому привязан Kaspi (не номер карты). Счёт придёт в приложение Kaspi. Сам номер мы не сохраняем.</small>
        </div>
        <div class="totals">
          <div><span class="k">Позиций</span><span class="v">{{ count }}</span></div>
          <div class="grand"><span class="k">К оплате</span><span class="v">{{ formatKzt(total) }}</span></div>
          <div><span class="k">В рублях</span><span class="v">{{ approxRub(total, kztPerRub) }}</span></div>
        </div>
        <p v-if="submitError" class="cart-error">{{ submitError }}</p>
        <button class="pay" :disabled="!canSubmit" @click="submitOrder">
          {{ payLabel }}
        </button>
        <p class="note">Нажимая кнопку, вы соглашаетесь с <NuxtLink to="/offer" @click="close">офертой</NuxtLink>.</p>
      </div>
    </div>
  </div>
</template>
