<script setup lang="ts">
// Модалка корзины. "Перейти к оплате" отправляет ник и состав корзины на /api/checkout —
// сервер Nuxt сверяет товары с каталогом EasyDonate, создаёт платёж и возвращает ссылку
// на страницу оплаты EasyDonate, куда и уходит покупатель. Выдачу после оплаты делает
// EasyDonate через плагин на сервере.
import { useCart } from '~/composables/useCart'
import { approxKzt, formatPrice } from '~/utils/formatPrice'

const { items, nick, isOpen, count, total, changeQty, remove, close } = useCart()
const { kztPerRub } = useRuntimeConfig().public

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)

const canSubmit = computed(() => items.value.length > 0 && nick.value.trim().length > 0 && !isSubmitting.value)

function errorMessage(error: unknown): string {
  const data = (error as { data?: { data?: { message?: unknown } } })?.data?.data
  return typeof data?.message === 'string' ? data.message : 'Не получилось перейти к оплате. Попробуйте ещё раз.'
}

async function submitOrder() {
  if (!canSubmit.value) return
  isSubmitting.value = true
  submitError.value = null
  try {
    const { url } = await $fetch<{ url: string }>('/api/checkout', {
      method: 'POST',
      body: { nick: nick.value.trim(), items: items.value.map((i) => ({ slug: i.slug, qty: i.qty })) },
    })
    window.location.href = url
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
          <span class="thumb"><svg><use :href="`#ic-${item.icon}`" /></svg></span>
          <span class="info">
            <b>{{ item.name }}</b>
            <span>{{ formatPrice(item.price) }} ₽ за штуку</span>
          </span>
          <span class="right">
            <span class="qty">
              <button aria-label="Меньше" @click="changeQty(item.slug, -1)">−</button>
              <span>{{ item.qty }}</span>
              <button aria-label="Больше" @click="changeQty(item.slug, 1)">+</button>
            </span>
            <span class="sum">{{ formatPrice(item.price * item.qty) }} ₽</span>
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
        <div class="totals">
          <div><span class="k">Позиций</span><span class="v">{{ count }}</span></div>
          <div><span class="k">В тенге</span><span class="v">{{ approxKzt(total, kztPerRub) }}</span></div>
          <div class="grand"><span class="k">К оплате</span><span class="v">{{ formatPrice(total) }} ₽</span></div>
        </div>
        <p v-if="submitError" class="cart-error">{{ submitError }}</p>
        <button class="pay" :disabled="!canSubmit" @click="submitOrder">
          {{ isSubmitting ? 'Переходим к оплате…' : 'Перейти к оплате' }}
        </button>
        <p class="note">Оплата в рублях через сервис EasyDonate, способ оплаты выбирается на его странице.<br>Нажимая кнопку, вы соглашаетесь с <NuxtLink to="/offer" @click="close">офертой</NuxtLink>.</p>
      </div>
    </div>
  </div>
</template>
