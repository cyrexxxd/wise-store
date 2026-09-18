/// Клиент входа по нику без пароля (T-17). Контракт сверен с бэкендом:
/// CatStore.Api/Controllers/PlayerAuthController.cs + CatStore.Contracts/Auth/PlayerAuthDtos.cs.
/// Сессия — httpOnly cookie (не токен в теле ответа), поэтому credentials:'include' обязателен
/// на КАЖДОМ вызове ниже — без него браузер не приложит cookie к кросс-доменному запросу
/// к бэкенду (другой origin: store на :3000, бэкенд на :5169) и не примет Set-Cookie в ответ.

export interface PlayerSession {
  minecraftNick: string
}

export interface AuthApiError {
  code: string
  message: string
}

function useAuthBase(): string {
  const config = useRuntimeConfig()
  return config.public.authApiBase
}

/// Тело ошибки бэкенда — { code, message } (ApiErrorResponse) — тот же приём, что
/// extractOrderError в useOrdersApi.ts.
export function extractAuthError(error: unknown): AuthApiError | null {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: unknown }).data
    if (data && typeof data === 'object' && 'code' in data && 'message' in data) {
      return data as AuthApiError
    }
  }
  return null
}

/// POST /request-code — код никогда не возвращается в ответе, только 202. Сам код игрок
/// увидит в игровом чате (см. site/plugin LoginCodePoller).
export async function requestLoginCode(minecraftNick: string): Promise<void> {
  const base = useAuthBase()
  await $fetch(`${base}/request-code`, {
    method: 'POST',
    credentials: 'include',
    body: { minecraftNick },
  })
}

/// POST /verify-code — успех выставляет httpOnly cookie сессии на СТОРОНЕ бэкенда (Set-Cookie
/// в ответе); здесь только читаем тело с ником для мгновенного обновления UI.
export async function verifyLoginCode(minecraftNick: string, code: string): Promise<PlayerSession> {
  const base = useAuthBase()
  return await $fetch<PlayerSession>(`${base}/verify-code`, {
    method: 'POST',
    credentials: 'include',
    body: { minecraftNick, code },
  })
}

/// GET /me — 401 означает "сессии нет", это ожидаемое состояние (гость), не ошибка для UI.
export async function fetchCurrentSession(): Promise<PlayerSession | null> {
  const base = useAuthBase()
  try {
    return await $fetch<PlayerSession>(`${base}/me`, { credentials: 'include' })
  } catch {
    return null
  }
}

export async function logoutSession(): Promise<void> {
  const base = useAuthBase()
  await $fetch(`${base}/logout`, { method: 'POST', credentials: 'include' })
}

/// Сессия игрока на всё приложение — тот же приём, что useCart: useState, SSR-safe. SSR сам
/// сессию не знает (httpOnly cookie бэкенда на другом origin серверу Nuxt не форвардится) —
/// её подтягивает клиентский плагин app/plugins/auth-session.client.ts через refresh().
export function useAuthSession() {
  const session = useState<PlayerSession | null>('player-session', () => null)
  const nick = computed(() => session.value?.minecraftNick ?? null)

  async function refresh() {
    session.value = await fetchCurrentSession()
  }

  async function login(minecraftNick: string, code: string) {
    session.value = await verifyLoginCode(minecraftNick, code)
  }

  async function logout() {
    await logoutSession()
    session.value = null
  }

  return { session, nick, refresh, login, logout }
}

/// Открытие/закрытие модалки входа — из SiteHeader (клик по "Гость") и изнутри самой модалки.
export function useLoginModal() {
  const isOpen = useState<boolean>('login-modal-open', () => false)
  function open() {
    isOpen.value = true
  }
  function close() {
    isOpen.value = false
  }
  return { isOpen, open, close }
}
