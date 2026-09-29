import { describe, expect, it, vi } from 'vitest'
import { formatPaid, notifyDiscord } from './discord'

const URL = 'https://discord.com/api/webhooks/123456/abc-DEF_789'

describe('formatPaid', () => {
  it('shows order, nick, items, amount and provider', () => {
    const text = formatPaid({
      invId: 12, nick: 'Cyrex_x', amountKzt: 3099, provider: 'kaspipos', isTest: false,
      items: [{ slug: 'claws-100', qty: 1, name: '100 Когтей', price: 500, deliver: [] }, { slug: 'role-wise', qty: 2, name: 'Роль Wise', price: 2599, deliver: [] }],
    })
    expect(text).toBe('💰 **#12** · `Cyrex_x` · 100 Когтей, Роль Wise ×2 · **3 099 ₸** · Kaspi')
  })

  it('marks test orders', () => {
    expect(formatPaid({ invId: 1, nick: 'a', items: [], amountKzt: 1, provider: 'robokassa', isTest: true })).toMatch(/Robokassa · ТЕСТ$/)
  })
})

describe('notifyDiscord', () => {
  it('does nothing without a webhook URL (outside Nitro too)', async () => {
    const post = vi.fn()
    expect(await notifyDiscord('hi', { post })).toBe(false)
    expect(post).not.toHaveBeenCalled()
  })

  it('refuses a URL that is not a Discord webhook', async () => {
    const post = vi.fn()
    expect(await notifyDiscord('hi', { url: 'https://evil.example/api/webhooks/1/x', post })).toBe(false)
    expect(post).not.toHaveBeenCalled()
  })

  it('posts JSON with mentions disabled', async () => {
    const post = vi.fn().mockResolvedValue({ status: 204 })
    expect(await notifyDiscord('@everyone купил', { url: URL, post })).toBe(true)
    const [url, init] = post.mock.calls[0]!
    expect(url).toBe(URL)
    expect(JSON.parse(init.body)).toEqual({ content: '@everyone купил', allowed_mentions: { parse: [] } })
  })

  it('never throws when Discord is down', async () => {
    const post = vi.fn().mockRejectedValue(new Error('timeout'))
    await expect(notifyDiscord('hi', { url: URL, post })).resolves.toBe(false)
    const post500 = vi.fn().mockResolvedValue({ status: 500 })
    await expect(notifyDiscord('hi', { url: URL, post: post500 })).resolves.toBe(false)
  })
})
