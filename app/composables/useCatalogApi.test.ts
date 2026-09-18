import { describe, expect, it } from 'vitest'
import { countByType, sortByOrder, type PublicProduct } from './useCatalogApi'

function makeProduct(overrides: Partial<PublicProduct> = {}): PublicProduct {
  return {
    slug: 'title-recruit',
    name: 'Титул Recruit',
    description: null,
    type: 'title',
    price: 490,
    currency: 'KZT',
    imageKey: null,
    sortOrder: 0,
    ...overrides,
  }
}

describe('sortByOrder', () => {
  it('orders items ascending by sortOrder', () => {
    const input = [makeProduct({ slug: 'c', sortOrder: 2 }), makeProduct({ slug: 'a', sortOrder: 0 }), makeProduct({ slug: 'b', sortOrder: 1 })]
    expect(sortByOrder(input).map((p) => p.slug)).toEqual(['a', 'b', 'c'])
  })

  it('does not mutate the input array', () => {
    const input = [makeProduct({ slug: 'b', sortOrder: 1 }), makeProduct({ slug: 'a', sortOrder: 0 })]
    const copy = [...input]
    sortByOrder(input)
    expect(input).toEqual(copy)
  })

  it('returns an empty array for empty input', () => {
    expect(sortByOrder([])).toEqual([])
  })
})

describe('countByType', () => {
  it('counts products grouped by their type field', () => {
    const products = [
      makeProduct({ type: 'title' }),
      makeProduct({ type: 'title' }),
      makeProduct({ type: 'cosmetic' }),
    ]
    expect(countByType(products)).toEqual({ title: 2, cosmetic: 1 })
  })

  it('returns an empty object when there are no products', () => {
    expect(countByType([])).toEqual({})
  })

  it('does not blow up on a single product', () => {
    expect(countByType([makeProduct({ type: 'rank' })])).toEqual({ rank: 1 })
  })
})
