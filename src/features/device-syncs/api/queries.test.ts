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
import { districtSyncHealth, listRecentSyncs } from './queries'

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

  describe('filtered by district', () => {
    /** One sync in Bo and one in Pujehun, with the district ids to ask for. */
    async function insertTwoDistricts() {
      const country = await insertOrgUnit(db, { name: 'Sierra Leone' })
      const districts = []
      for (const name of ['Bo', 'Pujehun']) {
        const district = await insertOrgUnit(db, { name, parent: country })
        const chiefdom = await insertOrgUnit(db, { parent: district })
        const facility = await insertOrgUnit(db, { parent: chiefdom })
        await insertSync(db, { device: await insertDevice(db, { facility }) })
        districts.push(district)
      }
      return districts
    }

    it('returns only the syncs of the district asked for', async () => {
      const [bo] = await insertTwoDistricts()

      const rows = await listRecentSyncs(db, { limit: 10, districtId: bo.id })

      expect(rows.map((row) => row.districtName)).toEqual(['Bo'])
    })

    it('returns every district when none is asked for', async () => {
      await insertTwoDistricts()

      const rows = await listRecentSyncs(db, { limit: 10 })

      expect(rows.map((row) => row.districtName).sort()).toEqual(['Bo', 'Pujehun'])
    })

    it('returns nothing for a district with no syncs', async () => {
      await insertTwoDistricts()

      expect(await listRecentSyncs(db, { limit: 10, districtId: 999 })).toEqual([])
    })
  })
})

describe('districtSyncHealth', () => {
  const now = new Date('2026-09-18T12:00:00Z')
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000)
  const square: GeoJSON.MultiPolygon = {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [-13, 8],
          [-12, 8],
          [-12, 9],
          [-13, 9],
          [-13, 8],
        ],
      ],
    ],
  }

  /** A country with one district, one chiefdom and one facility to hang devices on. */
  async function insertDistrict(name: string, geometry?: GeoJSON.MultiPolygon) {
    const country = await insertOrgUnit(db, { name: 'Sierra Leone' })
    const district = await insertOrgUnit(db, { name, parent: country, geometry })
    const chiefdom = await insertOrgUnit(db, { parent: district })
    const facility = await insertOrgUnit(db, { parent: chiefdom })
    return { district, facility }
  }

  it('counts every device in the district, synced or not', async () => {
    const { facility } = await insertDistrict('Bo')
    await insertDevice(db, { facility })
    await insertDevice(db, { facility })

    const [row] = await districtSyncHealth(db, { now, days: 7 })

    expect(row).toMatchObject({ name: 'Bo', deviceCount: 2, syncedDeviceCount: 0 })
  })

  it('counts a device once however many times it synced', async () => {
    const { facility } = await insertDistrict('Bo')
    const device = await insertDevice(db, { facility })
    await insertSync(db, { device, syncedAt: daysAgo(1) })
    await insertSync(db, { device, syncedAt: daysAgo(2) })

    const [row] = await districtSyncHealth(db, { now, days: 7 })

    expect(row).toMatchObject({ deviceCount: 1, syncedDeviceCount: 1 })
  })

  it('ignores a sync older than the window', async () => {
    const { facility } = await insertDistrict('Bo')
    await insertSync(db, { device: await insertDevice(db, { facility }), syncedAt: daysAgo(8) })
    await insertSync(db, { device: await insertDevice(db, { facility }), syncedAt: daysAgo(6) })

    const [row] = await districtSyncHealth(db, { now, days: 7 })

    expect(row).toMatchObject({ deviceCount: 2, syncedDeviceCount: 1 })
  })

  it('returns a district that has no devices at all', async () => {
    await insertDistrict('Bonthe')

    const rows = await districtSyncHealth(db, { now, days: 7 })

    expect(rows).toEqual([
      expect.objectContaining({ name: 'Bonthe', deviceCount: 0, syncedDeviceCount: 0 }),
    ])
  })

  it('returns the district geometry as a parsed object', async () => {
    await insertDistrict('Bo', square)

    const [row] = await districtSyncHealth(db, { now, days: 7 })

    expect(row.geometry).toEqual(square)
  })

  it('leaves the geometry null when the district has none', async () => {
    await insertDistrict('Bo')

    const [row] = await districtSyncHealth(db, { now, days: 7 })

    expect(row.geometry).toBeNull()
  })

  it('returns one row per district, by name', async () => {
    await insertDistrict('Pujehun')
    await insertDistrict('Bo')

    const rows = await districtSyncHealth(db, { now, days: 7 })

    expect(rows.map((row) => row.name)).toEqual(['Bo', 'Pujehun'])
  })

  it('keeps a device that never synced in the denominator', async () => {
    const { facility } = await insertDistrict('Bo')
    await insertSync(db, { device: await insertDevice(db, { facility }), syncedAt: daysAgo(1) })
    await insertDevice(db, { facility })

    const [row] = await districtSyncHealth(db, { now, days: 7 })

    expect(row).toMatchObject({ deviceCount: 2, syncedDeviceCount: 1 })
  })

  it('counts each district separately', async () => {
    const bo = await insertDistrict('Bo')
    const pujehun = await insertDistrict('Pujehun')
    await insertSync(db, {
      device: await insertDevice(db, { facility: bo.facility }),
      syncedAt: daysAgo(1),
    })
    await insertDevice(db, { facility: pujehun.facility })

    const rows = await districtSyncHealth(db, { now, days: 7 })

    expect(rows).toEqual([
      expect.objectContaining({ name: 'Bo', deviceCount: 1, syncedDeviceCount: 1 }),
      expect.objectContaining({ name: 'Pujehun', deviceCount: 1, syncedDeviceCount: 0 }),
    ])
  })
})
