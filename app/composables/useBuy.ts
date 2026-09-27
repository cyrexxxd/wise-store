/// Кнопка «Купить»: кладёт товар в корзину и на миг показывает «Добавлено».
import type { PublicProduct } from './useCatalogApi'
import { useCart } from './useCart'

export function useBuy() {
  const { add, open } = useCart()
  const added = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  function buy(p: PublicProduct, openCart = false) {
    add({ slug: p.slug, name: p.name, price: p.price, icon: p.icon ?? 'crate' })
    added.value = p.slug
    clearTimeout(timer)
    timer = setTimeout(() => { added.value = null }, 900)
    if (openCart) open()
  }

  onBeforeUnmount(() => clearTimeout(timer))
  return { buy, added }
}
