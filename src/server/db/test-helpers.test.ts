import type { Kysely } from 'kysely'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, insertOrgUnit, insertSync, resetDb } from './test-helpers'
import type { Database } from './types'

// Only what the query tests would not catch. They exercise the other helpers.
let db: Kysely<Database>
beforeAll(async () => {
  db = await createTestDb()
})
afterAll(() => db.destroy())

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
