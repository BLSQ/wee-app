import { type Kysely, sql } from 'kysely'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, insertOrgUnit, insertSync, resetDb } from './test-helpers'
import type { Database } from './types'

// Only what the query tests would not catch. They exercise the other helpers.
let db: Kysely<Database>
beforeAll(async () => {
  db = await createTestDb()
})
afterAll(() => db.destroy())

describe('createTestDb', () => {
  // PGlite would otherwise take the machine's time zone, and group days differently from Neon.
  it('groups days in UTC, like the deployed database', async () => {
    await insertSync(db, { syncedAt: new Date('2026-09-01T23:30:00Z') })
    await insertSync(db, { syncedAt: new Date('2026-09-02T00:30:00Z') })

    const { rows } = await sql<{ day: string }>`
      select to_char(date_trunc('day', synced_at), 'YYYY-MM-DD') as day
      from device_sync group by 1 order by 1
    `.execute(db)

    expect(rows.map((row) => row.day)).toEqual(['2026-09-01', '2026-09-02'])
    await resetDb(db)
  })
})

describe('insertOrgUnit', () => {
  it('places a child one level below its parent, on its path', async () => {
    const country = await insertOrgUnit(db)
    const district = await insertOrgUnit(db, { parent: country })

    expect(country).toMatchObject({ level: 1, parent_id: null, path: `${country.id}` })
    expect(district).toMatchObject({
      level: 2,
      parent_id: country.id,
      path: `${country.id}.${district.id}`,
    })
  })
})

describe('resetDb', () => {
  it('empties every table and restarts the sync ids', async () => {
    await insertSync(db)
    await insertSync(db)

    await resetDb(db)

    for (const table of ['device_sync', 'device', 'app_user', 'org_unit'] as const) {
      expect(await db.selectFrom(table).selectAll().execute()).toEqual([])
    }
    expect((await insertSync(db)).id).toBe(1)
  })
})
