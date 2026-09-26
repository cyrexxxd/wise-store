import { describe, expect, it } from 'vitest'
import { iconForProduct, iconUrl } from './productIcon'

describe('iconForProduct', () => {
  it('gives each role its own crown', () => {
    expect(iconForProduct({ type: 'rank', slug: '1120632', name: 'Роль Wise' })).toBe('crown_wise')
    expect(iconForProduct({ type: 'rank', slug: '1120633', name: 'Роль CAT' })).toBe('crown_cat')
    expect(iconForProduct({ type: 'rank', slug: '1120634', name: 'Роль Premium' })).toBe('crown_premium')
    expect(iconForProduct({ type: 'rank', slug: '1', name: 'Роль VIP' })).toBe('crown_cat')
  })

  it('maps claws (currency) to the claw', () => {
    expect(iconForProduct({ type: 'currency', slug: '9', name: '300 Когтей' })).toBe('claw')
  })

  it('picks the key by crate kind', () => {
    expect(iconForProduct({ type: 'crate_key', slug: '1120635', name: 'Титульный кейс' })).toBe('key_title')
    expect(iconForProduct({ type: 'crate_key', slug: '7', name: 'Ключ кейса косметики' })).toBe('key_cosmetic')
  })

  it('maps titles and cosmetics', () => {
    expect(iconForProduct({ type: 'title', slug: 't', name: 'Титул Хан' })).toBe('key_title')
    expect(iconForProduct({ type: 'cosmetic', slug: 'c', name: 'Шляпа фермера' })).toBe('tubeteika')
    expect(iconForProduct({ type: 'cosmetic', slug: 'c', name: 'Меч CATiers' })).toBe('claw')
  })

  it('falls back to the crate for an unknown type', () => {
    expect(iconForProduct({ type: 'something_new', slug: 'x', name: 'X' })).toBe('crate')
  })
})

describe('iconUrl', () => {
  it('serves known icons from /icons', () => {
    expect(iconUrl('claw')).toBe('/icons/claw.png')
  })

  it('maps icon names saved in old carts', () => {
    expect(iconUrl('shield')).toBe('/icons/crown_cat.png')
    expect(iconUrl('gem')).toBe('/icons/claw.png')
    expect(iconUrl('nonsense')).toBe('/icons/crate.png')
  })
})
