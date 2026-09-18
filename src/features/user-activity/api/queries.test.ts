import type { Kysely } from 'kysely'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '#/server/db'
import {
  createTestDb,
  insertDevice,
  insertSync,
  insertUser,
  resetDb,
} from '#/server/db/test-helpers'
import { listUserActivity } from './queries'

let db: Kysely<Database>
beforeAll(async () => {
  db = await createTestDb()
})
beforeEach(() => resetDb(db))
afterAll(() => db.destroy())

const since = new Date('2026-09-01T00:00:00Z')

describe('listUserActivity', () => {
  it('sums the syncs, the submissions and the distinct devices of the window', async () => {
    const user = await insertUser(db, { username: 'amara' })
    const device = await insertDevice(db)
    await insertSync(db, {
      user,
      device,
      syncedAt: new Date('2026-09-02T08:00:00Z'),
      submissionCount: 12,
    })
    await insertSync(db, {
      user,
      device,
      syncedAt: new Date('2026-09-03T08:00:00Z'),
      submissionCount: 3,
    })

    const rows = await listUserActivity(db, { since })

    expect(rows).toEqual([
      {
        userId: user.id,
        username: 'amara',
        syncCount: 2,
        submissionCount: 15,
        // Two syncs from the same device are one device.
        deviceCount: 1,
        lastSyncAt: new Date('2026-09-03T08:00:00Z'),
      },
    ])
  })

  it('counts each device once', async () => {
    const user = await insertUser(db)
    await insertSync(db, { user, device: await insertDevice(db), syncedAt: since })
    await insertSync(db, { user, device: await insertDevice(db), syncedAt: since })

    const [row] = await listUserActivity(db, { since })

    expect(row.deviceCount).toBe(2)
  })

  it('keeps a user who never synced', async () => {
    const user = await insertUser(db, { username: 'idle' })

    expect(await listUserActivity(db, { since })).toEqual([
      {
        userId: user.id,
        username: 'idle',
        syncCount: 0,
        submissionCount: 0,
        deviceCount: 0,
        lastSyncAt: null,
      },
    ])
  })

  it('keeps a user whose syncs all predate the window, with nothing counted', async () => {
    const user = await insertUser(db, { username: 'quiet' })
    await insertSync(db, {
      user,
      syncedAt: new Date('2026-08-31T23:59:00Z'),
      submissionCount: 99,
    })

    const [row] = await listUserActivity(db, { since })

    expect(row).toMatchObject({
      username: 'quiet',
      syncCount: 0,
      submissionCount: 0,
      lastSyncAt: null,
    })
  })

  it('returns the counts as numbers', async () => {
    // pg hands bigint back as a string, so count() needs a cast. Without it the
    // table would sort "9" above "10".
    await insertSync(db, { user: await insertUser(db), syncedAt: since })

    const [row] = await listUserActivity(db, { since })

    expect(typeof row.syncCount).toBe('number')
    expect(typeof row.submissionCount).toBe('number')
    expect(typeof row.deviceCount).toBe('number')
  })

  it('lists the users in alphabetical order', async () => {
    await insertUser(db, { username: 'zara' })
    await insertUser(db, { username: 'amara' })

    const rows = await listUserActivity(db, { since })

    expect(rows.map((row) => row.username)).toEqual(['amara', 'zara'])
  })
})
