import { describe, expect, it } from 'vitest'
import { approxRub, formatKzt, formatPrice } from './formatPrice'

// ru-RU группирует разряды неразрывным пробелом U+00A0
const NBSP = ' '

describe('formatPrice', () => {
  it('groups thousands with a non-breaking space', () => {
    expect(formatPrice(1990)).toBe(`1${NBSP}990`)
    expect(formatPrice(990)).toBe('990')
  })
})

describe('tenge', () => {
  it('formats tenge with the tenge sign', () => {
    expect(formatKzt(3799)).toBe(`3${NBSP}799 ₸`)
  })

  it('gives a rounded ruble hint', () => {
    expect(approxRub(3599, 5.3)).toBe('≈ 680 ₽')
    expect(approxRub(1599, 5.3)).toBe('≈ 300 ₽')
    expect(approxRub(500, 0)).toBe('')
  })
})
