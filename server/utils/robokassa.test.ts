import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { formatOutSum, parseHashAlgo, parseResult, paymentSignature, paymentUrl, sameAmount, verifyResult, type RobokassaConfig } from './robokassa'

const cfg: RobokassaConfig = { login: 'demo', password1: 'password_1', password2: 'password_2', hash: 'md5', isTest: true }
const md5 = (s: string) => createHash('md5').update(s).digest('hex')
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

describe('payment link', () => {
  it('signs MerchantLogin:OutSum:InvId:Password1 like the docs example', () => {
    // пример из docs.robokassa.kz: md5("demo:990.00:12:password_1")
    expect(paymentSignature(cfg, '990.00', 12)).toBe(md5('demo:990.00:12:password_1'))
  })

  it('uses SHA-256 when configured', () => {
    expect(paymentSignature({ ...cfg, hash: 'sha256' }, '1599.00', 7)).toBe(sha256('demo:1599.00:7:password_1'))
  })

  it('builds the URL with test flag, amount in tenge and a trimmed description', () => {
    const url = new URL(paymentUrl(cfg, { invId: 7, kzt: 1599, description: 'x'.repeat(150) }))
    expect(url.origin + url.pathname).toBe('https://auth.robokassa.kz/Merchant/Index.aspx')
    expect(url.searchParams.get('OutSum')).toBe('1599.00')
    expect(url.searchParams.get('InvId')).toBe('7')
    expect(url.searchParams.get('IsTest')).toBe('1')
    expect(url.searchParams.get('Description')).toHaveLength(100)
    expect(url.searchParams.get('SignatureValue')).toBe(md5('demo:1599.00:7:password_1'))
  })

  it('omits IsTest in production mode', () => {
    expect(new URL(paymentUrl({ ...cfg, isTest: false }, { invId: 1, kzt: 500, description: 'x' })).searchParams.has('IsTest')).toBe(false)
  })

  it.each([0, -5, Number.NaN])('refuses a non-positive amount %s', (kzt) => {
    expect(() => formatOutSum(kzt)).toThrow()
  })

  it('parses the hash setting', () => {
    expect(parseHashAlgo('SHA256')).toBe('sha256')
    expect(parseHashAlgo('SHA-256')).toBe('sha256')
    expect(parseHashAlgo('md5')).toBe('md5')
    expect(parseHashAlgo('sha512')).toBeNull()
    expect(parseHashAlgo('')).toBeNull()
  })
})

describe('ResultURL', () => {
  const signed = (outSum: string, invId: number, pass = 'password_2') => md5(`${outSum}:${invId}:${pass}`).toUpperCase()

  it('accepts a correct notification (raw OutSum string, upper-case signature)', () => {
    const n = parseResult({ OutSum: '1599.000000', InvId: '42', SignatureValue: signed('1599.000000', 42) })!
    expect(n).toEqual({ outSum: '1599.000000', invId: 42, signature: signed('1599.000000', 42) })
    expect(verifyResult(cfg, n)).toBe(true)
  })

  it('rejects a signature made with password #1 or a tampered amount', () => {
    expect(verifyResult(cfg, parseResult({ OutSum: '1599.000000', InvId: '42', SignatureValue: signed('1599.000000', 42, 'password_1') })!)).toBe(false)
    expect(verifyResult(cfg, parseResult({ OutSum: '1.000000', InvId: '42', SignatureValue: signed('1599.000000', 42) })!)).toBe(false)
  })

  it('rejects malformed fields', () => {
    expect(parseResult({ OutSum: '1', InvId: 'abc', SignatureValue: 'x' })).toBeNull()
    expect(parseResult({ OutSum: '1', InvId: '0', SignatureValue: 'x' })).toBeNull()
    expect(parseResult({ InvId: '5', SignatureValue: 'x' })).toBeNull()
  })

  it('compares amounts in tiyn', () => {
    expect(sameAmount('1599.000000', 1599)).toBe(true)
    expect(sameAmount('1599.01', 1599)).toBe(false)
    expect(sameAmount('1599', 1599)).toBe(true)
    expect(sameAmount('1e3', 1000)).toBe(false)
  })
})
