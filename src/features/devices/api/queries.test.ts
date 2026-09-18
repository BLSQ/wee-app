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
import { getDeviceDetail, listDevices } from './queries'

let db: Kysely<Database>
beforeAll(async () => {
  db = await createTestDb()
})
beforeEach(() => resetDb(db))
afterAll(() => db.destroy())

describe('listDevices', () => {
  it('returns every device with its facility and district', async () => {
    const country = await insertOrgUnit(db, { name: 'Sierra Leone' })
    const district = await insertOrgUnit(db, { name: 'Bo', parent: country })
    const chiefdom = await insertOrgUnit(db, { name: 'Kakua', parent: district })
    const facility = await insertOrgUnit(db, { name: 'Bo Government Hospital', parent: chiefdom })
    await insertDevice(db, { serial: 'SL-0042', facility })

    expect(await listDevices(db)).toEqual([
      expect.objectContaining({
        serial: 'SL-0042',
        facilityName: 'Bo Government Hospital',
        districtName: 'Bo',
      }),
    ])
  })

  it('counts the syncs and keeps the most recent one', async () => {
    const device = await insertDevice(db)
    await insertSync(db, { device, syncedAt: new Date('2026-09-01T08:00:00Z') })
    await insertSync(db, { device, syncedAt: new Date('2026-09-03T08:00:00Z') })

    const [row] = await listDevices(db)

    expect(row).toMatchObject({
      syncCount: 2,
      lastSyncedAt: new Date('2026-09-03T08:00:00Z'),
    })
  })

  it('keeps a device that never synced, with no count and no date', async () => {
    await insertDevice(db, { serial: 'SL-0001' })

    expect(await listDevices(db)).toEqual([
      expect.objectContaining({ serial: 'SL-0001', syncCount: 0, lastSyncedAt: null }),
    ])
  })

  it('drops a device whose org unit has no district, instead of failing', async () => {
    // A device is always attached to a facility, so this should not happen. If it ever does,
    // one bad row must not take the whole page down with it.
    const country = await insertOrgUnit(db, { name: 'Sierra Leone' })
    await insertDevice(db, { serial: 'SL-0001', facility: country })
    await insertDevice(db, { serial: 'SL-0002' })

    expect((await listDevices(db)).map((row) => row.serial)).toEqual(['SL-0002'])
  })

  it('orders devices by serial', async () => {
    await insertDevice(db, { serial: 'SL-0009' })
    await insertDevice(db, { serial: 'SL-0002' })

    expect((await listDevices(db)).map((row) => row.serial)).toEqual(['SL-0002', 'SL-0009'])
  })
})

describe('getDeviceDetail', () => {
  it('returns null for an id no device has', async () => {
    expect(await getDeviceDetail(db, { deviceId: 999, syncLimit: 10 })).toBeNull()
  })

  it('returns the device with its facility and district', async () => {
    const country = await insertOrgUnit(db, { name: 'Sierra Leone' })
    const district = await insertOrgUnit(db, { name: 'Bo', parent: country })
    const chiefdom = await insertOrgUnit(db, { name: 'Kakua', parent: district })
    const facility = await insertOrgUnit(db, { name: 'Bo Government Hospital', parent: chiefdom })
    const device = await insertDevice(db, { serial: 'SL-0042', facility })

    const detail = await getDeviceDetail(db, { deviceId: device.id, syncLimit: 10 })

    expect(detail?.device).toMatchObject({
      serial: 'SL-0042',
      facilityName: 'Bo Government Hospital',
      districtName: 'Bo',
    })
  })

  it('returns the syncs newest first, with the user and the counters', async () => {
    const device = await insertDevice(db)
    const user = await insertUser(db, { username: 'amara' })
    await insertSync(db, { device, user, syncedAt: new Date('2026-09-01T08:00:00Z') })
    const newer = await insertSync(db, {
      device,
      user,
      syncedAt: new Date('2026-09-03T08:00:00Z'),
      submissionCount: 12,
      orgUnitCount: 3,
      entityCount: 5,
    })

    const detail = await getDeviceDetail(db, { deviceId: device.id, syncLimit: 10 })

    expect(detail?.syncs[0]).toMatchObject({
      id: newer.id,
      username: 'amara',
      syncedAt: new Date('2026-09-03T08:00:00Z'),
      submissionCount: 12,
      orgUnitCount: 3,
      entityCount: 5,
    })
    expect(detail?.syncs).toHaveLength(2)
  })

  it('ignores the syncs of other devices', async () => {
    const device = await insertDevice(db)
    await insertSync(db, { device })
    await insertSync(db)

    const detail = await getDeviceDetail(db, { deviceId: device.id, syncLimit: 10 })

    expect(detail?.syncs).toHaveLength(1)
    expect(detail?.users).toHaveLength(1)
  })

  it('caps the syncs at the limit but counts them all', async () => {
    const device = await insertDevice(db)
    for (let i = 0; i < 3; i++) await insertSync(db, { device })

    const detail = await getDeviceDetail(db, { deviceId: device.id, syncLimit: 2 })

    expect(detail?.syncs).toHaveLength(2)
    expect(detail?.syncCount).toBe(3)
  })

  it('lists the users, busiest first, with their last use', async () => {
    const device = await insertDevice(db)
    const amara = await insertUser(db, { username: 'amara' })
    const fatu = await insertUser(db, { username: 'fatu' })
    await insertSync(db, { device, user: fatu, syncedAt: new Date('2026-09-01T08:00:00Z') })
    await insertSync(db, { device, user: amara, syncedAt: new Date('2026-09-02T08:00:00Z') })
    await insertSync(db, { device, user: amara, syncedAt: new Date('2026-09-04T08:00:00Z') })

    const detail = await getDeviceDetail(db, { deviceId: device.id, syncLimit: 10 })

    expect(detail?.users).toEqual([
      {
        id: amara.id,
        username: 'amara',
        syncCount: 2,
        lastSyncedAt: new Date('2026-09-04T08:00:00Z'),
      },
      {
        id: fatu.id,
        username: 'fatu',
        syncCount: 1,
        lastSyncedAt: new Date('2026-09-01T08:00:00Z'),
      },
    ])
  })

  it('returns null for a device whose org unit has no district, instead of failing', async () => {
    const country = await insertOrgUnit(db, { name: 'Sierra Leone' })
    const device = await insertDevice(db, { facility: country })

    expect(await getDeviceDetail(db, { deviceId: device.id, syncLimit: 10 })).toBeNull()
  })

  it('returns a device that never synced, with nothing to show', async () => {
    const device = await insertDevice(db)

    const detail = await getDeviceDetail(db, { deviceId: device.id, syncLimit: 10 })

    expect(detail).toMatchObject({ syncs: [], users: [], syncCount: 0 })
  })
})
