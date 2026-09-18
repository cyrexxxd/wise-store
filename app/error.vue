<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

useSeoMeta({ title: 'Страница не найдена' })

function goHome() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div class="wrap" style="padding: 90px 0; text-align: center;">
    <p style="font-family: var(--f-mono); color: var(--muted); font-size: 0.85rem; margin-bottom: 10px;">
      Ошибка {{ props.error.statusCode }}
    </p>
    <h1 style="font-family: var(--f-display); font-weight: 700; font-size: 1.6rem; margin: 0 0 14px;">
      {{ props.error.statusCode === 404 ? 'Страница не найдена' : 'Что-то пошло не так' }}
    </h1>
    <p style="color: var(--ink-2); margin: 0 0 24px;">
      {{ props.error.statusCode === 404
        ? 'Такого раздела магазина не существует или он был перемещён.'
        : 'Попробуйте обновить страницу чуть позже.' }}
    </p>
    <button class="add" style="margin: 0 auto;" @click="goHome">На главную</button>
  </div>
</template>
