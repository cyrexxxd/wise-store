import { describe, expect, it } from 'vitest'
import { iconForProduct } from './productIcon'

describe('iconForProduct', () => {
  it('maps crate_key to the crate icon', () => {
    expect(iconForProduct({ type: 'crate_key', slug: 'crate-titles', name: 'Кейс титулов' })).toBe('crate')
  })

  it('maps title to the title icon', () => {
    expect(iconForProduct({ type: 'title', slug: 'title-recruit', name: 'Титул Recruit' })).toBe('title')
  })

  it('maps rank to the shield icon', () => {
    expect(iconForProduct({ type: 'rank', slug: 'rank-vip', name: 'VIP' })).toBe('shield')
  })

  it('maps an unknown/currency type to the gem icon', () => {
    expect(iconForProduct({ type: 'currency', slug: 'gems-500', name: '500 кристаллов' })).toBe('gem')
    expect(iconForProduct({ type: 'something_new', slug: 'x', name: 'X' })).toBe('gem')
  })

  it('picks a cosmetic icon by keyword in the slug or name', () => {
    expect(iconForProduct({ type: 'cosmetic', slug: 'farmer-hat', name: 'Шляпа фермера' })).toBe('hat')
    expect(iconForProduct({ type: 'cosmetic', slug: 'butterfly-wings', name: 'Крылья бабочки' })).toBe('wings')
    expect(iconForProduct({ type: 'cosmetic', slug: 'sword-trail', name: 'Эффект меча' })).toBe('sword')
    expect(iconForProduct({ type: 'cosmetic', slug: 'dragon-pet', name: 'Питомец-дракон' })).toBe('pet')
  })

  it('falls back to hat for a cosmetic with no recognizable keyword', () => {
    expect(iconForProduct({ type: 'cosmetic', slug: 'mystery-item', name: 'Загадочный предмет' })).toBe('hat')
  })
})
