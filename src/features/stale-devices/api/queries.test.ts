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
import { listStaleDevices } from './queries'

let db: Kysely<Database>
beforeAll(async () => {
  db = await createTestDb()
})
beforeEach(() => resetDb(db))
afterAll(() => db.destroy())

const now = new Date('2026-09-18T12:00:00Z')
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000)

describe('listStaleDevices', () => {
  it('returns a stale device with its facility, district, last sync and last user', async () => {
    const country = await insertOrgUnit(db, { name: 'Sierra Leone' })
    const district = await insertOrgUnit(db, { name: 'Bombali', parent: country })
    const chiefdom = await insertOrgUnit(db, { name: 'Gbendembu', parent: district })
    const facility = await insertOrgUnit(db, { name: 'Gbendembu CHC', parent: chiefdom })
    const device = await insertDevice(db, { serial: 'SL-0117', facility })
    const user = await insertUser(db, { username: 'amara' })
    await insertSync(db, { device, user, syncedAt: daysAgo(34) })

    const rows = await listStaleDevices(db, { now, days: 7 })

    expect(rows).toMatchObject([
      {
        serial: 'SL-0117',
        facilityName: 'Gbendembu CHC',
        districtName: 'Bombali',
        lastSyncedAt: daysAgo(34),
        lastUsername: 'amara',
      },
    ])
  })

  it('leaves out a device that synced inside the window', async () => {
    const device = await insertDevice(db)
    await insertSync(db, { device, syncedAt: daysAgo(3) })

    expect(await listStaleDevices(db, { now, days: 7 })).toEqual([])
  })

  it('leaves out a device that synced exactly at the cutoff', async () => {
    // The cutoff is now - 7 days, and the test is "older than", not "older or equal".
    const device = await insertDevice(db)
    await insertSync(db, { device, syncedAt: daysAgo(7) })

    expect(await listStaleDevices(db, { now, days: 7 })).toEqual([])
  })

  it('judges a device on its newest sync, not an older one', async () => {
    const device = await insertDevice(db)
    await insertSync(db, { device, syncedAt: daysAgo(40) })
    await insertSync(db, { device, syncedAt: daysAgo(2) })

    expect(await listStaleDevices(db, { now, days: 7 })).toEqual([])
  })

  it('returns a device that never synced, whatever the threshold', async () => {
    await insertDevice(db, { serial: 'SL-0201' })

    const rows = await listStaleDevices(db, { now, days: 365 })

    expect(rows).toMatchObject([{ serial: 'SL-0201', lastSyncedAt: null, lastUsername: null }])
  })

  it('puts the never-synced devices first, then the oldest sync first', async () => {
    // Serials run the other way round, so a sort on the serial alone would fail this.
    const recent = await insertDevice(db, { serial: 'SL-0001' })
    await insertSync(db, { device: recent, syncedAt: daysAgo(10) })
    const older = await insertDevice(db, { serial: 'SL-0005' })
    await insertSync(db, { device: older, syncedAt: daysAgo(30) })
    await insertDevice(db, { serial: 'SL-0009' })

    const rows = await listStaleDevices(db, { now, days: 7 })

    expect(rows.map((row) => row.serial)).toEqual(['SL-0009', 'SL-0005', 'SL-0001'])
  })
})
