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

    const result = await listRecentSyncs(db, { limit: 2, offset: 0 })
    expect(result.rows).toHaveLength(2)
  })

  it('returns the most recent syncs first', async () => {
    // Inserted newest first, so the ids alone would give the opposite order.
    const newer = await insertSync(db, { syncedAt: new Date('2026-09-02T08:00:00Z') })
    const older = await insertSync(db, { syncedAt: new Date('2026-09-01T08:00:00Z') })

    const result = await listRecentSyncs(db, { limit: 10, offset: 0 })

    expect(result.rows.map((row) => row.id)).toEqual([newer.id, older.id])
  })

  it('puts the later insert first when two syncs share a time', async () => {
    const syncedAt = new Date('2026-09-01T08:00:00Z')
    const first = await insertSync(db, { syncedAt })
    const second = await insertSync(db, { syncedAt })

    const result = await listRecentSyncs(db, { limit: 10, offset: 0 })

    expect(result.rows.map((row) => row.id)).toEqual([second.id, first.id])
  })

  it('resolves the device, the user, the facility and its district', async () => {
    const country = await insertOrgUnit(db, { name: 'Sierra Leone' })
    const district = await insertOrgUnit(db, { name: 'Bo', parent: country })
    const chiefdom = await insertOrgUnit(db, { name: 'Kakua', parent: district })
    const facility = await insertOrgUnit(db, { name: 'Bo Government Hospital', parent: chiefdom })
    const device = await insertDevice(db, { serial: 'SL-0042', facility })
    const user = await insertUser(db, { username: 'amara' })
    await insertSync(db, { device, user })

    const result = await listRecentSyncs(db, { limit: 1, offset: 0 })
    const [row] = result.rows

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

    const result = await listRecentSyncs(db, { limit: 1, offset: 0 })
    const [row] = result.rows

    expect(row).toMatchObject({ syncedAt, submissionCount: 12, orgUnitCount: 3, entityCount: 5 })
  })

  it('sees a sync written after a first read', async () => {
    const device = await insertDevice(db)
    const first = await insertSync(db, { device, syncedAt: new Date('2026-09-03T08:00:00Z') })
    const firstResult = await listRecentSyncs(db, { limit: 10, offset: 0 })
    expect(firstResult.rows).toHaveLength(1)

    // Written later, but synced earlier: it belongs after the first one.
    const late = await insertSync(db, { device, syncedAt: new Date('2026-09-01T08:00:00Z') })

    const result = await listRecentSyncs(db, { limit: 10, offset: 0 })
    expect(result.rows.map((row) => row.id)).toEqual([first.id, late.id])
  })

  describe('search', () => {
    async function insertNamedSync(names: {
      serial: string
      username: string
      facility: string
      district: string
    }) {
      const country = await insertOrgUnit(db, { name: 'Sierra Leone' })
      const district = await insertOrgUnit(db, { name: names.district, parent: country })
      const chiefdom = await insertOrgUnit(db, { name: 'Kakua', parent: district })
      const facility = await insertOrgUnit(db, { name: names.facility, parent: chiefdom })
      const device = await insertDevice(db, { serial: names.serial, facility })
      const user = await insertUser(db, { username: names.username })
      return insertSync(db, { device, user })
    }

    const wanted = {
      serial: 'TABLET-WANTED',
      username: 'amara',
      facility: 'Bo Government Hospital',
      district: 'Bo',
    }
    const other = {
      serial: 'TABLET-OTHER',
      username: 'fatmata',
      facility: 'Kenema Clinic',
      district: 'Kenema',
    }

    beforeEach(async () => {
      await insertNamedSync(wanted)
      await insertNamedSync(other)
    })

    const serials = async (search: string) => {
      const result = await listRecentSyncs(db, { limit: 10, offset: 0, search })
      return result.rows.map((row) => row.deviceSerial)
    }

    it('matches a device serial', async () => {
      expect(await serials('TABLET-WANTED')).toEqual(['TABLET-WANTED'])
    })

    it('matches a username', async () => {
      expect(await serials('amara')).toEqual(['TABLET-WANTED'])
    })

    it('matches a facility name', async () => {
      expect(await serials('Bo Government')).toEqual(['TABLET-WANTED'])
    })

    it('matches a district name', async () => {
      expect(await serials('Kenema')).toEqual(['TABLET-OTHER'])
    })

    it('ignores case', async () => {
      expect(await serials('AMARA')).toEqual(['TABLET-WANTED'])
    })

    it('matches on part of a word', async () => {
      expect(await serials('mar')).toEqual(['TABLET-WANTED'])
    })

    it('narrows the total, not only the rows', async () => {
      const result = await listRecentSyncs(db, { limit: 10, offset: 0, search: 'amara' })

      expect(result.total).toBe(1)
    })

    it('counts every match, beyond the current page', async () => {
      const result = await listRecentSyncs(db, { limit: 1, offset: 0, search: 'TABLET' })

      expect(result.rows).toHaveLength(1)
      expect(result.total).toBe(2)
    })

    it('finds nothing when no field matches', async () => {
      expect(await serials('freetown')).toEqual([])
    })
  })

  describe('pagination', () => {
    it('returns the next rows at the next offset', async () => {
      const device = await insertDevice(db)
      const first = await insertSync(db, { device, syncedAt: new Date('2026-09-03T08:00:00Z') })
      const second = await insertSync(db, { device, syncedAt: new Date('2026-09-02T08:00:00Z') })
      const third = await insertSync(db, { device, syncedAt: new Date('2026-09-01T08:00:00Z') })

      const page1 = await listRecentSyncs(db, { limit: 2, offset: 0 })
      const page2 = await listRecentSyncs(db, { limit: 2, offset: 2 })

      expect(page1.rows.map((row) => row.id)).toEqual([first.id, second.id])
      expect(page2.rows.map((row) => row.id)).toEqual([third.id])
    })

    it('reports the total across every page', async () => {
      const device = await insertDevice(db)
      for (let i = 0; i < 3; i++) await insertSync(db, { device })

      const result = await listRecentSyncs(db, { limit: 2, offset: 0 })

      expect(result.rows).toHaveLength(2)
      expect(result.total).toBe(3)
    })

    it('returns no rows past the last page', async () => {
      await insertSync(db)

      const result = await listRecentSyncs(db, { limit: 50, offset: 50 })

      expect(result.rows).toEqual([])
      expect(result.total).toBe(1)
    })
  })

  describe('sorting', () => {
    const insertWithSerial = async (serial: string) =>
      insertSync(db, { device: await insertDevice(db, { serial }) })

    beforeEach(async () => {
      await insertWithSerial('TABLET-C')
      await insertWithSerial('TABLET-A')
      await insertWithSerial('TABLET-B')
    })

    it('orders by device serial ascending', async () => {
      const result = await listRecentSyncs(db, {
        limit: 10,
        offset: 0,
        sortBy: 'device',
        sortOrder: 'asc',
      })

      expect(result.rows.map((row) => row.deviceSerial)).toEqual([
        'TABLET-A',
        'TABLET-B',
        'TABLET-C',
      ])
    })

    it('orders by device serial descending', async () => {
      const result = await listRecentSyncs(db, {
        limit: 10,
        offset: 0,
        sortBy: 'device',
        sortOrder: 'desc',
      })

      expect(result.rows.map((row) => row.deviceSerial)).toEqual([
        'TABLET-C',
        'TABLET-B',
        'TABLET-A',
      ])
    })

    it('keeps the sort across pages', async () => {
      const page2 = await listRecentSyncs(db, {
        limit: 2,
        offset: 2,
        sortBy: 'device',
        sortOrder: 'asc',
      })

      expect(page2.rows.map((row) => row.deviceSerial)).toEqual(['TABLET-C'])
    })

    it('orders by username', async () => {
      await resetDb(db)
      for (const username of ['carol', 'alice', 'bob']) {
        await insertSync(db, { user: await insertUser(db, { username }) })
      }

      const result = await listRecentSyncs(db, {
        limit: 10,
        offset: 0,
        sortBy: 'user',
        sortOrder: 'asc',
      })

      expect(result.rows.map((row) => row.username)).toEqual(['alice', 'bob', 'carol'])
    })
  })
})
