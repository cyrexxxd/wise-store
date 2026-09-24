import { describe, expect, it } from 'vitest'
import { storeTypeOf, validateCheckout, visibleStoreProducts } from './catalog'
import type { EasyDonateProduct } from './easydonate'

function product(overrides: Partial<EasyDonateProduct> = {}): EasyDonateProduct {
  return {
    id: 1,
    name: 'Роль Wise',
    price: 245,
    old_price: null,
    type: 'group',
    number: 1,
    is_hidden: 0,
    commands: ['lp user {user} parent addtemp wise 30d accumulate'],
    description: 'Роль',
    image: null,
    sort_index: 1,
    ...overrides,
  }
}

describe('storeTypeOf', () => {
  it('maps EasyDonate groups to the roles section', () => {
    expect(storeTypeOf(product())).toBe('rank')
  })

  it('detects crate keys by the givekey command, not by EasyDonate type', () => {
    expect(storeTypeOf(product({ type: 'other', commands: ['givekey {user} title 1'] }))).toBe('crate_key')
  })

  it('falls back to other for unknown products', () => {
    expect(storeTypeOf(product({ type: 'item', commands: ['give {user} diamond 1'] }))).toBe('other')
  })
})

describe('visibleStoreProducts', () => {
  it('drops hidden products, hides commands and filters by type', () => {
    const list = [product({ id: 1 }), product({ id: 2, is_hidden: 1 }), product({ id: 3, type: 'other', commands: ['givekey {user} title 1'] })]
    const all = visibleStoreProducts(list)
    expect(all.map((p) => p.slug)).toEqual(['1', '3'])
    expect(all[0]).not.toHaveProperty('commands')
    expect(visibleStoreProducts(list, 'crate_key').map((p) => p.slug)).toEqual(['3'])
  })
})

describe('validateCheckout', () => {
  const catalog = [product({ id: 10 }), product({ id: 11, is_hidden: 1 })]

  it('accepts a valid cart and merges duplicate lines', () => {
    const result = validateCheckout(' Notch ', [{ slug: '10', qty: 1 }, { slug: '10', qty: 2 }], catalog)
    expect(result).toEqual({ ok: true, nick: 'Notch', products: { '10': 3 } })
  })

  it.each(['ab', 'имя', 'bad nick', 'a'.repeat(17), 42])('rejects invalid nick %s', (nick) => {
    expect(validateCheckout(nick, [{ slug: '10', qty: 1 }], catalog).ok).toBe(false)
  })

  it('rejects an empty cart', () => {
    expect(validateCheckout('Notch', [], catalog).ok).toBe(false)
  })

  it('rejects hidden or unknown products', () => {
    expect(validateCheckout('Notch', [{ slug: '11', qty: 1 }], catalog).ok).toBe(false)
    expect(validateCheckout('Notch', [{ slug: '999', qty: 1 }], catalog).ok).toBe(false)
  })

  it.each([0, -1, 1.5, 100, '1'])('rejects quantity %s', (qty) => {
    expect(validateCheckout('Notch', [{ slug: '10', qty }], catalog).ok).toBe(false)
  })
})
