<script setup lang="ts">
// Копирование IP сервера по клику — перенос store.js 1:1, только вместо innerText-трюка
// используется реактивное состояние copied.
const props = withDefaults(defineProps<{ ip?: string }>(), { ip: 'catiers.xyz' })

const copied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | undefined

async function copyIp() {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(props.ip)
      showCopied()
      return
    }
    fallbackCopy()
  } catch {
    fallbackCopy()
  }
}

function fallbackCopy() {
  // Старые браузеры / небезопасный контекст без Clipboard API — тот же трюк с textarea,
  // что был в оригинальном store.js.
  const ta = document.createElement('textarea')
  ta.value = props.ip
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  document.body.removeChild(ta)
  if (ok) showCopied()
}

function showCopied() {
  copied.value = true
  clearTimeout(resetTimer)
  resetTimer = setTimeout(() => {
    copied.value = false
  }, 1400)
}

onBeforeUnmount(() => clearTimeout(resetTimer))
</script>

<template>
  <button class="ip-chip" title="Скопировать IP сервера" @click="copyIp">
    <svg><use href="#ic-copy" /></svg>
    <span class="lb">IP</span>
    <span class="val">{{ copied ? 'Скопировано' : ip }}</span>
  </button>
</template>
