/// Гидратация сессии игрока (T-17). .client.ts — тот же приём, что cart-persist.client.ts:
/// SSR не может узнать про httpOnly cookie бэкенда (другой origin, куки серверу Nuxt не
/// форвардятся), поэтому сессия подтягивается отдельным запросом сразу после старта на клиенте.
/// Пока refresh() не отработал, SiteHeader на SSR-пейнте покажет "Гость" — короткое мигание
/// для уже вошедшего игрока, приемлемый компромисс ради простоты (в отличие от форвардинга
/// cookie в SSR-запрос, который тянет за собой чтение заголовков входящего запроса).
import { useAuthSession } from '~/composables/useAuthApi'

export default defineNuxtPlugin(() => {
  const { refresh } = useAuthSession()
  refresh()
})
