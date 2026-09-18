<script setup lang="ts">
// Шапка сайта — общая для всех страниц (была продублирована в каждом HTML-мокапе).
// "Магазин" подсвечен активным везде, кроме /crates и /purchases — так же вело себя все
// мокапы для /crates: на design-mockup/cosmetics/currency/roles/titles активен пункт
// "Магазин", на crates.html — "Кейсы". /purchases (T-18) добавлена в то же исключение,
// иначе на странице покупок подсвечивались бы сразу два пункта меню. "Тирлист" — заглушка
// вне области T-14/T-15.
//
// T-17: ник в шапке — это сессия входа (useAuthSession), а не ник, вручную набранный в
// корзине (тот остаётся отдельным полем в CartModal — при активной сессии он лишь подставляется
// из неё, см. комментарий там). "Гость" кликабелен и открывает модалку входа; вошедший игрок
// видит свой ник и кнопку выхода рядом.
import { useCart } from '~/composables/useCart'
import { useAuthSession, useLoginModal } from '~/composables/useAuthApi'

const route = useRoute()
const isCratesPage = computed(() => route.path === '/crates')
const isPurchasesPage = computed(() => route.path === '/purchases')

const { count, open } = useCart()
const { nick: sessionNick, logout } = useAuthSession()
const { open: openLogin } = useLoginModal()

const isLoggingOut = ref(false)

async function onLogout() {
  if (isLoggingOut.value) return
  isLoggingOut.value = true
  try {
    await logout()
  } finally {
    isLoggingOut.value = false
  }
}
</script>

<template>
  <header class="top">
    <div class="top-in">
      <NuxtLink class="brand" to="/"><span class="cube" />WISE</NuxtLink>
      <nav class="main">
        <NuxtLink to="/" :class="{ on: !isCratesPage && !isPurchasesPage }">Магазин</NuxtLink>
        <NuxtLink to="/crates" :class="{ on: isCratesPage }">Кейсы</NuxtLink>
        <a href="#" aria-disabled="true" @click.prevent>Тирлист</a>
        <NuxtLink to="/purchases" :class="{ on: isPurchasesPage }">Покупки</NuxtLink>
      </nav>
      <div class="top-right">
        <IpChip />
        <button v-if="!sessionNick" class="nick nick-guest" type="button" @click="openLogin">
          <span class="av" /><span>Гость</span>
        </button>
        <div v-else class="nick nick-session">
          <span class="av" /><span>{{ sessionNick }}</span>
          <button class="logout-btn" type="button" title="Выйти" :disabled="isLoggingOut" @click="onLogout">✕</button>
        </div>
        <button class="cart-btn" @click="open">
          <svg class="pico" style="width: 15px; height: 15px"><use href="#ic-cart" /></svg>Корзина
          <span class="cnt">{{ count }}</span>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.nick-guest {
  background: none;
  border: 0;
  cursor: pointer;
  font: inherit;
  color: inherit;
}

.nick-session {
  display: flex;
  align-items: center;
}

.logout-btn {
  margin-left: 8px;
  background: none;
  border: 0;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.72rem;
  line-height: 1;
  padding: 2px;
}

.logout-btn:hover:not(:disabled) {
  color: var(--accent-hi);
}

.logout-btn:disabled {
  cursor: default;
  opacity: 0.6;
}
</style>
