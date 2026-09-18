<script setup lang="ts">
// Вход по нику без пароля (T-17) — тот же диалоговый/focus-trap паттерн, что CartModal.vue.
// Два шага: ник → код (выдаётся в игре, см. site/plugin LoginCodePoller). Открывается кликом
// по "Гость" в SiteHeader.vue.
import { useAuthSession, useLoginModal, extractAuthError, requestLoginCode } from '~/composables/useAuthApi'

const { isOpen, close } = useLoginModal()
const { login } = useAuthSession()

type Step = 'nick' | 'code'

const step = ref<Step>('nick')
const nick = ref('')
const code = ref('')

const isSubmittingNick = ref(false)
const isSubmittingCode = ref(false)
const nickError = ref<string | null>(null)
const codeError = ref<string | null>(null)
const resendNotice = ref<string | null>(null)

const canSubmitNick = computed(() => nick.value.trim().length > 0 && !isSubmittingNick.value)
const canSubmitCode = computed(() => code.value.trim().length === 6 && !isSubmittingCode.value)

async function submitNick() {
  if (!canSubmitNick.value) return
  isSubmittingNick.value = true
  nickError.value = null
  try {
    await requestLoginCode(nick.value.trim())
    step.value = 'code'
  } catch (error) {
    nickError.value = extractAuthError(error)?.message ?? 'Не получилось отправить код. Попробуйте ещё раз.'
  } finally {
    isSubmittingNick.value = false
  }
}

async function submitCode() {
  if (!canSubmitCode.value) return
  isSubmittingCode.value = true
  codeError.value = null
  try {
    await login(nick.value.trim(), code.value.trim())
    close()
  } catch (error) {
    codeError.value = extractAuthError(error)?.message ?? 'Код неверный или истёк. Попробуйте ещё раз.'
  } finally {
    isSubmittingCode.value = false
  }
}

async function resendCode() {
  if (isSubmittingNick.value) return
  isSubmittingNick.value = true
  codeError.value = null
  resendNotice.value = null
  try {
    await requestLoginCode(nick.value.trim())
    resendNotice.value = 'Новый код отправлен в игру.'
  } catch (error) {
    codeError.value = extractAuthError(error)?.message ?? 'Не получилось отправить код. Попробуйте ещё раз.'
  } finally {
    isSubmittingNick.value = false
  }
}

function backToNick() {
  step.value = 'nick'
  code.value = ''
  codeError.value = null
  resendNotice.value = null
}

let lastFocus: HTMLElement | null = null
const closeBtnRef = ref<HTMLButtonElement | null>(null)

watch(isOpen, async (open) => {
  if (open) {
    // Каждое новое открытие — чистая форма, тот же приём, что CartModal сбрасывает createdOrder.
    step.value = 'nick'
    code.value = ''
    nickError.value = null
    codeError.value = null
    resendNotice.value = null
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
    id="login"
    class="overlay"
    :class="{ open: isOpen }"
    :hidden="!isOpen"
    role="dialog"
    aria-modal="true"
    aria-labelledby="login-title"
    @click="onOverlayClick"
  >
    <div class="modal">
      <div class="modal-head">
        <h2 id="login-title">Вход по нику</h2>
        <button ref="closeBtnRef" class="x" aria-label="Закрыть окно входа" @click="close">✕</button>
      </div>

      <template v-if="step === 'nick'">
        <div class="modal-body">
          <p class="cart-empty">Код подтверждения придёт вам в игровой чат — пароль не нужен.</p>
        </div>
        <div class="modal-foot">
          <div class="nick-field">
            <label for="login-nick">Ник в игре</label>
            <input
              id="login-nick"
              v-model="nick"
              type="text"
              autocomplete="off"
              spellcheck="false"
              placeholder="Например, Notch"
              @keyup.enter="submitNick"
            >
            <small>Зайдите на сервер под этим ником, чтобы увидеть код в чате.</small>
          </div>
          <p v-if="nickError" class="cart-error">{{ nickError }}</p>
          <button class="pay" :disabled="!canSubmitNick" @click="submitNick">
            {{ isSubmittingNick ? 'Отправляем…' : 'Получить код' }}
          </button>
        </div>
      </template>

      <template v-else>
        <div class="modal-body">
          <p class="cart-empty">
            Код отправлен игроку <b>{{ nick }}</b> в чат сервера.<br>
            Действует 5 минут — введите его ниже.
          </p>
        </div>
        <div class="modal-foot">
          <div class="nick-field">
            <label for="login-code">Код из игры</label>
            <input
              id="login-code"
              v-model="code"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="6"
              autocomplete="one-time-code"
              placeholder="000000"
              @keyup.enter="submitCode"
            >
          </div>
          <p v-if="codeError" class="cart-error">{{ codeError }}</p>
          <p v-else-if="resendNotice" class="login-notice">{{ resendNotice }}</p>
          <button class="pay" :disabled="!canSubmitCode" @click="submitCode">
            {{ isSubmittingCode ? 'Проверяем…' : 'Войти' }}
          </button>
          <p class="note">
            <button type="button" class="link-btn" @click="backToNick">Изменить ник</button>
            ·
            <button type="button" class="link-btn" :disabled="isSubmittingNick" @click="resendCode">
              Отправить код ещё раз
            </button>
          </p>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.login-notice {
  margin: 0 0 10px;
  font-size: 0.82rem;
  color: var(--muted);
  text-align: center;
}

.link-btn {
  background: none;
  border: 0;
  padding: 0;
  color: var(--muted);
  font-family: var(--f-mono);
  font-size: 0.68rem;
  cursor: pointer;
  text-decoration: underline;
}

.link-btn:hover:not(:disabled) {
  color: var(--accent-hi);
}

.link-btn:disabled {
  cursor: default;
  opacity: 0.6;
}
</style>
