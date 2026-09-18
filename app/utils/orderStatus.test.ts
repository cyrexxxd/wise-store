import { describe, expect, it } from 'vitest'
import { orderStatusView } from './orderStatus'

describe('orderStatusView', () => {
  it('maps created to a neutral label', () => {
    expect(orderStatusView('created')).toEqual({ label: 'Создан', tone: 'neutral' })
  })

  it('maps paid to a success label', () => {
    expect(orderStatusView('paid')).toEqual({ label: 'Оплачен', tone: 'success' })
  })

  it('maps failed to a danger label', () => {
    expect(orderStatusView('failed')).toEqual({ label: 'Не оплачен', tone: 'danger' })
  })

  it('maps refunded to a warning label', () => {
    expect(orderStatusView('refunded')).toEqual({ label: 'Возврат', tone: 'warning' })
  })

  it('falls back to the raw status for an unknown value instead of hiding it', () => {
    expect(orderStatusView('some_future_status')).toEqual({ label: 'some_future_status', tone: 'neutral' })
  })
})
