import { describe, expect, it } from 'vitest'
import { pluralizeProducts } from './pluralize'

describe('pluralizeProducts', () => {
  it('uses the singular form for 1, 21, 31...', () => {
    expect(pluralizeProducts(1)).toBe('товар')
    expect(pluralizeProducts(21)).toBe('товар')
  })

  it('uses the few form for 2-4, 22-24...', () => {
    expect(pluralizeProducts(2)).toBe('товара')
    expect(pluralizeProducts(3)).toBe('товара')
    expect(pluralizeProducts(4)).toBe('товара')
    expect(pluralizeProducts(22)).toBe('товара')
  })

  it('uses the many form for 0, 5-20, 25...', () => {
    expect(pluralizeProducts(0)).toBe('товаров')
    expect(pluralizeProducts(5)).toBe('товаров')
    expect(pluralizeProducts(11)).toBe('товаров')
    expect(pluralizeProducts(14)).toBe('товаров')
    expect(pluralizeProducts(25)).toBe('товаров')
  })
})
