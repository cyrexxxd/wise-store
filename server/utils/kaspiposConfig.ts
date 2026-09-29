/// Настройки Kaspi-кассира из env Render (NUXT_KASPIPOS_*). null — сессия не задана, оплата Kaspi скрыта.
import { notifyAlert } from './discord'
import type { KaspiPosConfig } from './kaspipos'

export function useKaspiPos(): KaspiPosConfig | null {
  const c = useRuntimeConfig().kaspipos
  if (!c.deviceId || !c.installId || !c.privateKey || !c.tokenSn || !c.secret || !c.profileId) return null
  return {
    deviceId: c.deviceId,
    installId: c.installId,
    privateKey: c.privateKey,
    tokenSn: c.tokenSn,
    secretHex: c.secret,
    profileId: String(c.profileId),
    appVersion: c.appVersion || '26.0921',
    appBuild: c.appBuild || '1115',
    baseUrl: c.baseUrl || undefined,
  }
}

export const kaspiposFetch = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(15_000) })

/// Сессия кассира умерла (вход с другого устройства, кассир удалён) — оплата Kaspi скрывается, пока
/// владелец не войдёт заново (scripts/kaspipos-login.mjs → env → перезапуск). Флаг живёт в памяти процесса:
/// после перезапуска с новыми env он сброшен, а фоновая проверка снова выставит его, если вход не помог.
let deadSince: number | null = null

export function markKaspiPosDead(reason: string): void {
  if (deadSince === null) {
    console.error(`[kaspipos] СЕССИЯ КАССИРА НЕ ДЕЙСТВУЕТ (${reason}) — оплата Kaspi скрыта; нужен вход: node scripts/kaspipos-login.mjs`)
    notifyAlert(`🔴 Оплата Kaspi ОТКЛЮЧЕНА: сессия кассира не действует (${reason}). Нужен вход по SMS: node scripts/kaspipos-login.mjs → env в Render`)
  }
  deadSince ??= Date.now()
}

export function markKaspiPosAlive(): void {
  if (deadSince !== null) {
    console.info('[kaspipos] сессия кассира снова работает')
    notifyAlert('🟢 Сессия кассира снова работает — оплата Kaspi включена')
  }
  deadSince = null
}

export const kaspiPosDead = (): boolean => deadSince !== null
