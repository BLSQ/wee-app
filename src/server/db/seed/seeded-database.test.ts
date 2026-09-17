import { type Kysely, sql } from 'kysely'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '#/server/db'
import { createTestDb } from '#/server/db/testing'
import { seed } from './run'

// The only test file that reads the seed: it checks that the seed script still works.
let db: Kysely<Database>
beforeAll(async () => {
  db = await createTestDb()
  await seed(db)
})
afterAll(() => db.destroy())

describe('the seeded database', () => {
  it('holds the full org unit hierarchy', async () => {
    const { rows } = await sql<{ level: number; count: number }>`
      select level, count(*)::int as count from org_unit group by level order by level
    `.execute(db)
    expect(rows).toEqual([
      { level: 1, count: 1 },
      { level: 2, count: 13 },
      { level: 3, count: 152 },
      { level: 4, count: 1166 },
    ])
  })

  it('holds 200 devices and 41 users', async () => {
    const { rows } = await sql<{ devices: number; users: number }>`
      select (select count(*) from device)::int as devices,
             (select count(*) from app_user)::int as users
    `.execute(db)
    expect(rows[0]).toEqual({ devices: 200, users: 41 })
  })

  // Measured against the most recent sync rather than now(), so the assertion
  // still holds when the test database was seeded days before the tests run.
  it('leaves some districts visibly behind the others', async () => {
    const { rows } = await sql<{ days_behind: number }>`
      with latest as (
        select split_part(f.path, '.', 2) as district, max(s.synced_at) as synced_at
        from device_sync s
        join device d on d.id = s.device_id
        join org_unit f on f.id = d.org_unit_id
        group by 1
      )
      select extract(epoch from (select max(synced_at) from latest) - synced_at)::float / 86400
        as days_behind
      from latest
    `.execute(db)
    expect(rows).toHaveLength(13)
    expect(rows.filter((row) => row.days_behind < 1).length).toBeGreaterThanOrEqual(3)
    expect(rows.filter((row) => row.days_behind > 7).length).toBeGreaterThanOrEqual(3)
  })
})
