import { describe, expect, it } from 'vitest'
import { extractAuthError } from './useAuthApi'

describe('extractAuthError', () => {
  it('extracts code/message from a $fetch-style error with a data payload', () => {
    const error = { data: { code: 'INVALID_CODE', message: 'Код неверный, истёк или уже использован.' } }
    expect(extractAuthError(error)).toEqual({ code: 'INVALID_CODE', message: 'Код неверный, истёк или уже использован.' })
  })

  it('returns null for an error without a data payload', () => {
    expect(extractAuthError(new Error('network down'))).toBeNull()
  })

  it('returns null when data is present but missing code/message', () => {
    expect(extractAuthError({ data: { foo: 'bar' } })).toBeNull()
  })

  it('returns null for non-object input', () => {
    expect(extractAuthError('nope')).toBeNull()
    expect(extractAuthError(null)).toBeNull()
    expect(extractAuthError(undefined)).toBeNull()
  })
})
