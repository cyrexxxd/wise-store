import { describe, expect, it } from 'vitest'
import { iconUrl, itemIcon } from './productIcon'

describe('iconUrl', () => {
  it('serves shop icons and item icons as SVG', () => {
    expect(iconUrl('crown_cat')).toBe('/icons/crown_cat.svg')
    expect(iconUrl(itemIcon('hat', 'farmer'))).toBe('/icons/hat/farmer.svg')
  })

  it('maps icon names saved in old carts', () => {
    expect(iconUrl('shield')).toBe('/icons/crown_cat.svg')
    expect(iconUrl('gem')).toBe('/icons/claws_1.svg')
  })

  it('never builds a path from unexpected input', () => {
    expect(iconUrl('../../etc/passwd')).toBe('/icons/crate.svg')
    expect(iconUrl('a/b/c')).toBe('/icons/crate.svg')
  })
})
