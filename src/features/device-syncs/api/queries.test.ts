import { afterAll, describe, expect, it } from 'vitest'
import { testDb } from '#/server/db'
import { listRecentSyncs } from './queries'

const db = testDb()
afterAll(() => db.destroy())

describe('listRecentSyncs', () => {
  it('returns the requested number of rows', async () => {
    expect(await listRecentSyncs(db, { limit: 25 })).toHaveLength(25)
  })

  it('returns the most recent syncs first', async () => {
    const rows = await listRecentSyncs(db, { limit: 50 })
    const times = rows.map((row) => row.syncedAt.getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('starts with the most recent sync in the database', async () => {
    const [first] = await listRecentSyncs(db, { limit: 1 })
    const latest = await db
      .selectFrom('device_sync')
      .select(({ fn }) => fn.max('synced_at').as('syncedAt'))
      .executeTakeFirstOrThrow()
    expect(first.syncedAt).toEqual(latest.syncedAt)
  })

  it('resolves the device, the user and the facility', async () => {
    const [row] = await listRecentSyncs(db, { limit: 1 })
    expect(row.deviceSerial).toMatch(/^SL-\d{4}$/)
    expect(row.username).toMatch(/^user_\d{3}$/)
    expect(row.facilityName).not.toBe('')
  })

  it('names the district the facility belongs to', async () => {
    const rows = await listRecentSyncs(db, { limit: 50 })
    const districts = await db
      .selectFrom('org_unit')
      .select('name')
      .where('level', '=', 2)
      .execute()
    const districtNames = new Set(districts.map((district) => district.name))
    for (const row of rows) {
      expect(districtNames).toContain(row.districtName)
    }
  })

  it('carries the three sync counters', async () => {
    const [row] = await listRecentSyncs(db, { limit: 1 })
    expect(row).toMatchObject({
      submissionCount: expect.any(Number),
      orgUnitCount: expect.any(Number),
      entityCount: expect.any(Number),
    })
  })
})
