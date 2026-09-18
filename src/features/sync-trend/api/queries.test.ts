import type { Kysely } from 'kysely'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '#/server/db'
import { createTestDb, insertSync, resetDb } from '#/server/db/test-helpers'
import { type DailyActivity, getActivityTotals, listDailyActivity } from './queries'

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

describe('getActivityTotals', () => {
  it('is all zeros when nothing synced', async () => {
    expect(await getActivityTotals(db, { now, days: 30 })).toEqual({
      syncCount: 0,
      resourceCount: 0,
      previousSyncCount: 0,
      previousResourceCount: 0,
    })
  })

  it('totals the window and the window before it', async () => {
    const inWindow = { submissionCount: 2, orgUnitCount: 1, entityCount: 1 } // 4 resources each
    await insertSync(db, { syncedAt: new Date('2026-09-01T06:00:00Z'), ...inWindow })
    await insertSync(db, { syncedAt: new Date('2026-09-02T06:00:00Z'), ...inWindow })
    await insertSync(db, { syncedAt: new Date('2026-09-03T06:00:00Z'), ...inWindow })
    await insertSync(db, {
      syncedAt: new Date('2026-08-01T06:00:00Z'),
      submissionCount: 5,
      orgUnitCount: 0,
      entityCount: 0,
    })

    expect(await getActivityTotals(db, { now, days: 30 })).toEqual({
      syncCount: 3,
      resourceCount: 12,
      previousSyncCount: 1,
      previousResourceCount: 5,
    })
  })

  it('splits the two windows at the first instant of the current one', async () => {
    // The window runs from 2026-08-20, the one before it from 2026-07-21. A second
    // before each start falls on the other side, and a second before both is counted
    // nowhere.
    await insertSync(db, { syncedAt: new Date('2026-08-20T00:00:00Z') })
    await insertSync(db, { syncedAt: new Date('2026-08-19T23:59:59Z') })
    await insertSync(db, { syncedAt: new Date('2026-07-21T00:00:00Z') })
    await insertSync(db, { syncedAt: new Date('2026-07-20T23:59:59Z') })

    const totals = await getActivityTotals(db, { now, days: 30 })

    expect(totals.syncCount).toBe(1)
    expect(totals.previousSyncCount).toBe(2)
  })
})

function byDay(rows: DailyActivity[], day: string): DailyActivity {
  const row = rows.find((candidate) => candidate.day.toISOString().startsWith(day))
  if (!row) throw new Error(`No row for ${day} in ${rows.map((r) => r.day.toISOString())}`)
  return row
}
