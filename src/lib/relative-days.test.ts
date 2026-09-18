import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { relativeDays } from './relative-days'

describe('relativeDays', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it.each([
    ['2026-09-10T08:00:00Z', 'today'],
    ['2026-09-09T08:00:00Z', 'yesterday'],
    ['2026-09-05T08:00:00Z', '5 days ago'],
  ])('reads %s as "%s"', (date, label) => {
    expect(relativeDays(new Date(date))).toBe(label)
  })

  it('says never when there is no date', () => {
    expect(relativeDays(null)).toBe('never')
  })
})
