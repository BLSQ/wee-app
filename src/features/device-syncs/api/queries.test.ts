import type { Kysely } from 'kysely'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '#/server/db'
import {
  createTestDb,
  insertDevice,
  insertOrgUnit,
  insertSync,
  insertUser,
  resetDb,
} from '#/server/db/test-helpers'
import { listRecentSyncs } from './queries'

let db: Kysely<Database>
beforeAll(async () => {
  db = await createTestDb()
})
beforeEach(() => resetDb(db))
afterAll(() => db.destroy())

describe('listRecentSyncs', () => {
  it('returns at most the requested number of rows', async () => {
    const device = await insertDevice(db)
    for (let i = 0; i < 3; i++) await insertSync(db, { device })

    expect(await listRecentSyncs(db, { limit: 2 })).toHaveLength(2)
  })

  it('returns the most recent syncs first', async () => {
    // Inserted newest first, so the ids alone would give the opposite order.
    const newer = await insertSync(db, { syncedAt: new Date('2026-09-02T08:00:00Z') })
    const older = await insertSync(db, { syncedAt: new Date('2026-09-01T08:00:00Z') })

    const rows = await listRecentSyncs(db, { limit: 10 })

    expect(rows.map((row) => row.id)).toEqual([newer.id, older.id])
  })

  it('puts the later insert first when two syncs share a time', async () => {
    const syncedAt = new Date('2026-09-01T08:00:00Z')
    const first = await insertSync(db, { syncedAt })
    const second = await insertSync(db, { syncedAt })

    const rows = await listRecentSyncs(db, { limit: 10 })

    expect(rows.map((row) => row.id)).toEqual([second.id, first.id])
  })

  it('resolves the device, the user, the facility and its district', async () => {
    const country = await insertOrgUnit(db, { name: 'Sierra Leone' })
    const district = await insertOrgUnit(db, { name: 'Bo', parent: country })
    const chiefdom = await insertOrgUnit(db, { name: 'Kakua', parent: district })
    const facility = await insertOrgUnit(db, { name: 'Bo Government Hospital', parent: chiefdom })
    const device = await insertDevice(db, { serial: 'SL-0042', facility })
    const user = await insertUser(db, { username: 'amara' })
    await insertSync(db, { device, user })

    const [row] = await listRecentSyncs(db, { limit: 1 })

    expect(row).toMatchObject({
      deviceSerial: 'SL-0042',
      username: 'amara',
      facilityName: 'Bo Government Hospital',
      districtName: 'Bo',
    })
  })

  it('carries the time and the three sync counters', async () => {
    const syncedAt = new Date('2026-09-01T08:00:00Z')
    await insertSync(db, { syncedAt, submissionCount: 12, orgUnitCount: 3, entityCount: 5 })

    const [row] = await listRecentSyncs(db, { limit: 1 })

    expect(row).toMatchObject({ syncedAt, submissionCount: 12, orgUnitCount: 3, entityCount: 5 })
  })

  it('sees a sync written after a first read', async () => {
    const device = await insertDevice(db)
    const first = await insertSync(db, { device, syncedAt: new Date('2026-09-03T08:00:00Z') })
    expect(await listRecentSyncs(db, { limit: 10 })).toHaveLength(1)

    // Written later, but synced earlier: it belongs after the first one.
    const late = await insertSync(db, { device, syncedAt: new Date('2026-09-01T08:00:00Z') })

    const rows = await listRecentSyncs(db, { limit: 10 })
    expect(rows.map((row) => row.id)).toEqual([first.id, late.id])
  })
})
