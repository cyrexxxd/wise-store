<script setup lang="ts">
// Модалка корзины — перенос store.js 1:1 на реактивность. "Перейти к оплате" создаёт
// заказ (POST /api/orders) и показывает номер — сама оплата ждёт выбора провайдера
// (блокер №1 плана), до этого заказы обрабатываются вручную администрацией (раздел 6).
import { useCart } from '~/composables/useCart'
import { formatPrice } from '~/utils/formatPrice'
import { createOrder, extractOrderError } from '~/composables/useOrdersApi'
import { useAuthSession } from '~/composables/useAuthApi'

const { items, nick, isOpen, count, total, changeQty, remove, close } = useCart()
const { nick: sessionNick } = useAuthSession()

// T-17 (необязательное улучшение): у вошедшего игрока ник в корзине подставляется из сессии
// и блокируется от ручного редактирования — свободный ввод остаётся только для гостя, не
// имеющего сессии (никакого требования входа для покупки — это по-прежнему опционально).
watch(sessionNick, (value) => {
  if (value) nick.value = value
}, { immediate: true })

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const createdOrder = ref<{ publicNumber: string } | null>(null)

const canSubmit = computed(() => items.value.length > 0 && nick.value.trim().length > 0 && !isSubmitting.value)

async function submitOrder() {
  if (!canSubmit.value) return
  isSubmitting.value = true
  submitError.value = null
  try {
    const order = await createOrder(
      nick.value.trim(),
      items.value.map((i) => ({ productSlug: i.slug, qty: i.qty })),
    )
    createdOrder.value = { publicNumber: order.publicNumber }
  } catch (error) {
    const apiError = extractOrderError(error)
    submitError.value = apiError?.message ?? 'Не получилось оформить заказ. Попробуйте ещё раз.'
  } finally {
    isSubmitting.value = false
  }
}

let lastFocus: HTMLElement | null = null
const closeBtnRef = ref<HTMLButtonElement | null>(null)

watch(isOpen, async (open) => {
  if (open) {
    // Новое открытие после успешного заказа — снова чистая форма, не "застрявшее"
    // сообщение об уже оформленном заказе поверх новой покупки.
    createdOrder.value = null
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

      <template v-if="createdOrder">
        <div class="modal-body">
          <p class="cart-empty">
            Заказ <b>{{ createdOrder.publicNumber }}</b> оформлен.<br>
            Оплата и выдача пока обрабатываются вручную администрацией — напишите номер заказа
            в Discord, чтобы ускорить обработку.
          </p>
        </div>
        <div class="modal-foot">
          <button class="pay" @click="close">Понятно</button>
        </div>
      </template>
      <template v-else>
        <div class="modal-body">
          <p v-if="!items.length" class="cart-empty">Корзина пуста</p>
          <div v-for="item in items" :key="item.slug" class="line">
            <span class="thumb"><svg><use :href="`#ic-${item.icon}`" /></svg></span>
            <span class="info">
              <b>{{ item.name }}</b>
              <span>{{ formatPrice(item.price) }} ₸ за штуку</span>
            </span>
            <span class="right">
              <span class="qty">
                <button aria-label="Меньше" @click="changeQty(item.slug, -1)">−</button>
                <span>{{ item.qty }}</span>
                <button aria-label="Больше" @click="changeQty(item.slug, 1)">+</button>
              </span>
              <span class="sum">{{ formatPrice(item.price * item.qty) }} ₸</span>
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
              :readonly="!!sessionNick"
            >
            <small v-if="sessionNick">Ник подставлен из вашей сессии входа.</small>
            <small v-else>Покупка придёт на этот ник. Проверьте регистр — изменить после оплаты нельзя.</small>
          </div>
          <div class="totals">
            <div><span class="k">Позиций</span><span class="v">{{ count }}</span></div>
            <div class="grand"><span class="k">К оплате</span><span class="v">{{ formatPrice(total) }} ₸</span></div>
          </div>
          <p v-if="submitError" class="cart-error">{{ submitError }}</p>
          <button class="pay" :disabled="!canSubmit" @click="submitOrder">
            {{ isSubmitting ? 'Оформляем…' : 'Перейти к оплате' }}
          </button>
          <p class="note">Оплата картой через платёжный сервис.<br>Нажимая кнопку, вы соглашаетесь с офертой.</p>
        </div>
      </template>
    </div>
  </div>
</template>
