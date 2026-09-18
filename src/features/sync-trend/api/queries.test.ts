import type { Kysely } from 'kysely'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '#/server/db'
import { createTestDb, insertSync, resetDb } from '#/server/db/test-helpers'
import { type DailyActivity, listDailyActivity } from './queries'

let db: Kysely<Database>
beforeAll(async () => {
  db = await createTestDb()
})
beforeEach(() => resetDb(db))
afterAll(() => db.destroy())

// Midday, so a bug that shifts the window by half a day is visible.
const now = new Date('2026-09-18T12:00:00Z')

describe('listDailyActivity', () => {
  it('returns one row per day even when nothing synced', async () => {
    const rows = await listDailyActivity(db, { now, days: 30 })

    expect(rows).toHaveLength(30)
    expect(rows[0]).toEqual({
      day: new Date('2026-08-20T00:00:00Z'),
      syncCount: 0,
      resourceCount: 0,
    })
    expect(rows.at(-1)).toEqual({
      day: new Date('2026-09-18T00:00:00Z'),
      syncCount: 0,
      resourceCount: 0,
    })
  })

  it('counts every sync of a day on that day', async () => {
    await insertSync(db, { syncedAt: new Date('2026-09-01T06:00:00Z') })
    await insertSync(db, { syncedAt: new Date('2026-09-01T22:00:00Z') })
    await insertSync(db, { syncedAt: new Date('2026-09-02T09:00:00Z') })

    const rows = await listDailyActivity(db, { now, days: 30 })

    expect(byDay(rows, '2026-09-01').syncCount).toBe(2)
    expect(byDay(rows, '2026-09-02').syncCount).toBe(1)
    expect(byDay(rows, '2026-09-03').syncCount).toBe(0)
  })

  it('adds the three counters of every sync into resourceCount', async () => {
    const syncedAt = new Date('2026-09-01T06:00:00Z')
    await insertSync(db, { syncedAt, submissionCount: 3, orgUnitCount: 2, entityCount: 5 })
    await insertSync(db, { syncedAt, submissionCount: 1, orgUnitCount: 0, entityCount: 0 })

    const rows = await listDailyActivity(db, { now, days: 30 })

    expect(byDay(rows, '2026-09-01').resourceCount).toBe(11)
  })

  it('puts a sync at midnight on that day and leaves the window shut behind it', async () => {
    // The first instant of the last day is inside; a second before the first day is outside.
    await insertSync(db, { syncedAt: new Date('2026-09-18T00:00:00Z') })
    await insertSync(db, { syncedAt: new Date('2026-08-19T23:59:59Z') })

    const rows = await listDailyActivity(db, { now, days: 30 })

    expect(rows).toHaveLength(30)
    expect(byDay(rows, '2026-09-18').syncCount).toBe(1)
    expect(rows.reduce((total, row) => total + row.syncCount, 0)).toBe(1)
  })
})

function byDay(rows: DailyActivity[], day: string): DailyActivity {
  const row = rows.find((candidate) => candidate.day.toISOString().startsWith(day))
  if (!row) throw new Error(`No row for ${day} in ${rows.map((r) => r.day.toISOString())}`)
  return row
}
