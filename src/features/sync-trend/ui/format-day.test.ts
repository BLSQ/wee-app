import { describe, expect, it } from 'vitest'
import { formatDay } from './format-day'

// Late in the day, so a bug that compares timestamps rather than days shows up.
const now = new Date('2026-09-18T22:00:00Z')

describe('formatDay', () => {
  it.each([
    ['2026-09-18', '18 September 2026 (today)'],
    ['2026-09-17', '17 September 2026 (yesterday)'],
    ['2026-09-13', '13 September 2026 (5 days ago)'],
    ['2026-08-31', '31 August 2026 (18 days ago)'],
    ['2026-08-20', '20 August 2026 (29 days ago)'],
  ])('reads %s as "%s"', (day, expected) => {
    expect(formatDay(day, now)).toBe(expected)
  })

  it('counts whole days, not elapsed hours', () => {
    // A minute into the day is still "today", and a minute before it was "yesterday".
    expect(formatDay('2026-09-18', new Date('2026-09-18T00:01:00Z'))).toContain('(today)')
    expect(formatDay('2026-09-17', new Date('2026-09-18T00:01:00Z'))).toContain('(yesterday)')
  })
})
