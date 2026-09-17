import { type Kysely, sql } from 'kysely'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from './types'
import {
  createTestDb,
  insertDevice,
  insertFacility,
  insertOrgUnit,
  insertSync,
  insertUser,
  resetDb,
} from './testing'

let db: Kysely<Database>
beforeAll(async () => {
  db = await createTestDb()
})
beforeEach(() => resetDb(db))
afterAll(() => db.destroy())

const countRows = async (table: keyof Database) => {
  const { count } = await db
    .selectFrom(table)
    .select(({ fn }) => fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow()
  return Number(count)
}

describe('createTestDb', () => {
  it('returns a migrated database with no rows', async () => {
    const { rows } = await sql<{ table_name: string }>`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_name not like 'kysely_%'
      order by table_name
    `.execute(db)
    expect(rows.map((row) => row.table_name)).toEqual([
      'app_user',
      'device',
      'device_sync',
      'org_unit',
    ])
    expect(await countRows('org_unit')).toBe(0)
  })
})

describe('insertOrgUnit', () => {
  it('starts a hierarchy at level 1 when it has no parent', async () => {
    const country = await insertOrgUnit(db, { name: 'Sierra Leone' })
    expect(country).toMatchObject({
      name: 'Sierra Leone',
      level: 1,
      parent_id: null,
      path: `${country.id}`,
    })
  })

  it('places a child under its parent', async () => {
    const country = await insertOrgUnit(db)
    const district = await insertOrgUnit(db, { name: 'Bo', parent: country })
    expect(district).toMatchObject({
      parent_id: country.id,
      level: 2,
      path: `${country.id}.${district.id}`,
    })
  })
})

describe('insertFacility', () => {
  it('builds a level 4 unit with a four-segment path', async () => {
    const facility = await insertFacility(db, { name: 'Bo CHC' })
    expect(facility).toMatchObject({ name: 'Bo CHC', level: 4 })
    expect(facility.path.split('.')).toHaveLength(4)
    expect(facility.path.endsWith(`.${facility.id}`)).toBe(true)
  })
})

describe('insertDevice', () => {
  it('attaches the device to the given facility', async () => {
    const facility = await insertFacility(db)
    const device = await insertDevice(db, { serial: 'SL-0042', facility })
    expect(device).toMatchObject({ serial: 'SL-0042', org_unit_id: facility.id })
  })
})

describe('insertSync', () => {
  it('creates the device, the user and the facility it was not given', async () => {
    const sync = await insertSync(db)
    expect(await countRows('device')).toBe(1)
    expect(await countRows('app_user')).toBe(1)
    expect(sync.device_id).toEqual(expect.any(Number))
  })

  it('uses the device, the user and the values it was given', async () => {
    const device = await insertDevice(db)
    const user = await insertUser(db, { username: 'amara' })
    const syncedAt = new Date('2026-09-01T10:00:00Z')
    const sync = await insertSync(db, { device, user, syncedAt, submissionCount: 7 })
    expect(sync).toMatchObject({
      device_id: device.id,
      user_id: user.id,
      synced_at: syncedAt,
      submission_count: 7,
    })
    expect(await countRows('device')).toBe(1)
  })
})

describe('resetDb', () => {
  it('empties every table and restarts the sync ids', async () => {
    await insertSync(db)
    await insertSync(db)
    await resetDb(db)
    for (const table of ['device_sync', 'device', 'app_user', 'org_unit'] as const) {
      expect(await countRows(table)).toBe(0)
    }
    expect((await insertSync(db)).id).toBe(1)
  })
})
