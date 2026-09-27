import { describe, expect, it } from 'vitest'
import { CATALOG, deliveryCommands, publicProducts, validateCheckout } from './catalog'

describe('catalog', () => {
  it('has the owner prices in tenge and CAT < Wise < Premium order', () => {
    const price = (slug: string) => CATALOG.find((p) => p.slug === slug)!.price
    expect([price('role-cat'), price('role-wise'), price('role-premium')]).toEqual([1599, 2599, 3799])
    expect(publicProducts('rank').map((p) => p.slug)).toEqual(['role-cat', 'role-wise', 'role-premium'])
    expect(publicProducts('currency').map((p) => [p.amount, p.price])).toEqual([[100, 500], [250, 1250], [500, 2500], [1100, 5000]])
  })

  it('never exposes delivery commands', () => {
    for (const p of publicProducts()) expect(p).not.toHaveProperty('deliver')
  })

  it('only uses commands the WiseDelivery allowlist permits', () => {
    for (const p of CATALOG) {
      for (const t of p.deliver) expect(t).toMatch(/^(lp user \{nick\} parent addtemp [a-z]+ 30d accumulate|claws deliver \{nick\} \d+ wise-\{delivery\}$|tellraw \{nick\} )/)
    }
  })
})

describe('validateCheckout', () => {
  it('prices the cart from the catalog and merges duplicate lines', () => {
    const r = validateCheckout(' Notch ', [{ slug: 'claws-100', qty: 1 }, { slug: 'claws-100', qty: 2 }])
    expect(r).toEqual({ ok: true, nick: 'Notch', lines: [{ slug: 'claws-100', qty: 3, name: '100 Когтей', price: 500, deliver: ['claws deliver {nick} 100 wise-{delivery}'] }], total: 1500 })
  })

  it.each(['ab', 'имя', 'bad nick', 'a'.repeat(17), 42])('rejects invalid nick %s', (nick) => {
    expect(validateCheckout(nick, [{ slug: 'claws-100', qty: 1 }]).ok).toBe(false)
  })

  it('rejects an empty cart and unknown products', () => {
    expect(validateCheckout('Notch', []).ok).toBe(false)
    expect(validateCheckout('Notch', [{ slug: '1120632', qty: 1 }]).ok).toBe(false)
  })

  it.each([0, -1, 1.5, 21, '1'])('rejects quantity %s', (qty) => {
    expect(validateCheckout('Notch', [{ slug: 'claws-100', qty }]).ok).toBe(false)
  })
})

describe('deliveryCommands', () => {
  it('gives every unit its own line (each gets its own delivery UUID → own ref)', () => {
    const cmds = deliveryCommands([{ slug: 'claws-100', qty: 2, deliver: ['claws deliver {nick} 100 wise-{delivery}'] }])
    expect(cmds).toEqual([
      { lineNo: 1, template: 'claws deliver {nick} 100 wise-{delivery}' },
      { lineNo: 2, template: 'claws deliver {nick} 100 wise-{delivery}' },
    ])
  })

  it('uses the templates saved with the order, not the current catalog', () => {
    expect(deliveryCommands([{ slug: 'removed-product', qty: 1, deliver: ['tellraw {nick} {}'] }])).toEqual([{ lineNo: 1, template: 'tellraw {nick} {}' }])
    expect(() => deliveryCommands([{ slug: 'removed-product', qty: 1, deliver: [] }])).toThrow()
  })
})
