/// Настройки ApiPay из env Render (NUXT_APIPAY_*). null — Kaspi не подключён, способ оплаты скрыт.
import type { ApipayConfig } from './apipay'

export function useApipay(): ApipayConfig | null {
  const c = useRuntimeConfig().apipay
  if (!c.apiKey || !c.webhookSecret) return null
  // песочница — всё, кроме явного "0" (безопасно по умолчанию: песочные оплаты выдачу не получают)
  return { apiKey: c.apiKey, webhookSecret: c.webhookSecret, sandbox: String(c.sandbox) !== '0', baseUrl: c.baseUrl || undefined }
}

export const apipayFetch = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(15_000) })
