import { describe, expect, it } from 'vitest'
import { formatPrice, formatPriceWithCurrency } from './formatPrice'

// Intl formats ru-RU grouping with U+00A0 (non-breaking space), not a plain U+0020 space —
// visually identical to the original store.js output, but the code point differs, so tests
// build the expected string explicitly instead of typing a literal space that would mismatch.
const NBSP = ' '

describe('formatPrice', () => {
  it('groups thousands with a non-breaking space, matching the ru-RU locale used in the original mockup', () => {
    expect(formatPrice(1990)).toBe(`1${NBSP}990`)
  })

  it('leaves small numbers unchanged', () => {
    expect(formatPrice(990)).toBe('990')
  })

  it('formats zero as a plain digit', () => {
    expect(formatPrice(0)).toBe('0')
  })
})

describe('formatPriceWithCurrency', () => {
  it('renders KZT as the tenge sign, matching the mockup', () => {
    expect(formatPriceWithCurrency(990, 'KZT')).toBe('990 ₸')
  })

  it('falls back to the raw currency code for anything else', () => {
    expect(formatPriceWithCurrency(10, 'USD')).toBe('10 USD')
  })
})
