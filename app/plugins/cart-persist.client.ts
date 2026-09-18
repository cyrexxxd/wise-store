/// Персистентность корзины и ника в localStorage — перенос store.js на клиентский плагин.
/// .client.ts-суффикс гарантирует, что файл вообще не попадёт в серверный бандл: обращения
/// к localStorage здесь безопасны без дополнительных import.meta.client-проверок.
import { CART_STORAGE_KEY, NICK_STORAGE_KEY, parseCartItems, useCart } from '~/composables/useCart'

export default defineNuxtPlugin(() => {
  const { items, nick } = useCart()

  try {
    items.value = parseCartItems(localStorage.getItem(CART_STORAGE_KEY))
    nick.value = localStorage.getItem(NICK_STORAGE_KEY) ?? ''
  } catch {
    // localStorage недоступен (приватный режим, ограничения браузера) — корзина остаётся
    // пустой на эту сессию, как и в оригинальном store.js.
  }

  watch(
    items,
    (value) => {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(value))
      } catch {
        // тихо игнорируем — квота/приватный режим не должны ронять страницу
      }
    },
    { deep: true },
  )

  watch(nick, (value) => {
    try {
      localStorage.setItem(NICK_STORAGE_KEY, value)
    } catch {
      // см. выше
    }
  })
})
