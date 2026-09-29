import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { normalizeKzPhone, phoneHash } from './phone'

describe('normalizeKzPhone', () => {
  it.each([
    ['87071234567', '87071234567'],
    ['+7 (707) 123-45-67', '87071234567'],
    ['77071234567', '87071234567'],
    ['7071234567', '87071234567'],
    ['8 707 123 45 67', '87071234567'],
    ['+7 (700) 123-45-67', '87001234567'],
  ])('%s → %s', (input, out) => {
    expect(normalizeKzPhone(input)).toBe(out)
  })

  it.each(['', '123', '+1 555 123 4567', '84951234567', '+7 600 123 45 67', 'abc', 42, null])('rejects %s', (input) => {
    expect(normalizeKzPhone(input)).toBeNull()
  })
})

describe('phoneHash', () => {
  it('matches the reference value of the previous implementation (hashes already stored in orders.phone_hash)', () => {
    // эталон снят с прежней реализации до переноса (29.09): формат сообщения «phone:<номер>» менять нельзя
    expect(phoneHash('87001234567', 'test-phone-hash-secret')).toBe('669a29c5d863d08e1952cf11a05975910891e94dd1c7972ee530abe9c62cd253')
    expect(phoneHash('87001234567', 'test-phone-hash-secret'))
      .toBe(createHmac('sha256', 'test-phone-hash-secret').update('phone:87001234567').digest('hex'))
  })

  it('is an irreversible hash that depends on the secret', () => {
    expect(phoneHash('87071234567', 's')).toMatch(/^[0-9a-f]{64}$/)
    expect(phoneHash('87071234567', 's')).not.toContain('8707')
    expect(phoneHash('87071234567', 's')).not.toBe(phoneHash('87071234567', 'other'))
    expect(phoneHash('87071234567', 's')).not.toBe(phoneHash('87071234568', 's'))
  })
})
