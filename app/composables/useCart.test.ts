import { describe, expect, it } from 'vitest'
import {
  addCartItem,
  cartItemCount,
  cartTotal,
  changeCartItemQty,
  parseCartItems,
  removeCartItem,
  type CartItem,
} from './useCart'

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return { slug: 'title-recruit', name: 'Титул Recruit', price: 490, icon: 'title', qty: 1, ...overrides }
}

describe('parseCartItems', () => {
  it('returns an empty array for null (nothing stored yet)', () => {
    expect(parseCartItems(null)).toEqual([])
  })

  it('returns an empty array for malformed JSON instead of throwing', () => {
    expect(parseCartItems('{not json')).toEqual([])
  })

  it('returns an empty array when the stored value is not an array', () => {
    expect(parseCartItems('{"slug":"x"}')).toEqual([])
  })

  it('drops entries that do not look like a cart item', () => {
    const raw = JSON.stringify([makeItem(), { slug: 'bad' }, 'not-an-item'])
    expect(parseCartItems(raw)).toEqual([makeItem()])
  })

  it('drops items with a non-positive quantity', () => {
    const raw = JSON.stringify([makeItem({ qty: 0 })])
    expect(parseCartItems(raw)).toEqual([])
  })

  it('parses a valid saved cart back into items', () => {
    const items = [makeItem(), makeItem({ slug: 'cosmetic-hat', name: 'Шляпа фермера', price: 690, icon: 'hat' })]
    expect(parseCartItems(JSON.stringify(items))).toEqual(items)
  })
})

describe('addCartItem', () => {
  it('adds a new item with qty 1', () => {
    expect(addCartItem([], { slug: 'a', name: 'A', price: 100, icon: 'gem' })).toEqual([
      { slug: 'a', name: 'A', price: 100, icon: 'gem', qty: 1 },
    ])
  })

  it('increments qty instead of duplicating an existing slug', () => {
    const items = [makeItem({ qty: 2 })]
    const result = addCartItem(items, { slug: 'title-recruit', name: 'Титул Recruit', price: 490, icon: 'title' })
    expect(result).toEqual([makeItem({ qty: 3 })])
  })

  it('does not mutate the input array', () => {
    const items = [makeItem()]
    const snapshot = [...items]
    addCartItem(items, { slug: 'other', name: 'Other', price: 1, icon: 'gem' })
    expect(items).toEqual(snapshot)
  })
})

describe('changeCartItemQty', () => {
  it('increases quantity by delta', () => {
    expect(changeCartItemQty([makeItem({ qty: 1 })], 'title-recruit', 1)).toEqual([makeItem({ qty: 2 })])
  })

  it('decreases quantity by delta', () => {
    expect(changeCartItemQty([makeItem({ qty: 2 })], 'title-recruit', -1)).toEqual([makeItem({ qty: 1 })])
  })

  it('removes the line entirely once qty drops to zero or below', () => {
    expect(changeCartItemQty([makeItem({ qty: 1 })], 'title-recruit', -1)).toEqual([])
  })

  it('leaves other lines untouched', () => {
    const items = [makeItem(), makeItem({ slug: 'other', qty: 5 })]
    const result = changeCartItemQty(items, 'title-recruit', 1)
    expect(result.find((i) => i.slug === 'other')).toEqual({ ...makeItem({ slug: 'other', qty: 5 }) })
  })
})

describe('removeCartItem', () => {
  it('removes the matching line', () => {
    expect(removeCartItem([makeItem()], 'title-recruit')).toEqual([])
  })

  it('leaves the array unchanged when the slug is not present', () => {
    const items = [makeItem()]
    expect(removeCartItem(items, 'nope')).toEqual(items)
  })
})

describe('cartItemCount', () => {
  it('sums quantities across all lines', () => {
    expect(cartItemCount([makeItem({ qty: 2 }), makeItem({ slug: 'b', qty: 3 })])).toBe(5)
  })

  it('is zero for an empty cart', () => {
    expect(cartItemCount([])).toBe(0)
  })
})

describe('cartTotal', () => {
  it('sums price * qty across all lines', () => {
    expect(cartTotal([makeItem({ price: 100, qty: 2 }), makeItem({ slug: 'b', price: 50, qty: 3 })])).toBe(350)
  })

  it('is zero for an empty cart', () => {
    expect(cartTotal([])).toBe(0)
  })
})
