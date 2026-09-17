import orgUnits from '../../../../data/org-units.json' with { type: 'json' }
import users from '../../../../data/users.json' with { type: 'json' }
import type { Kysely } from 'kysely'
import type { Database } from '../types.ts'
import { generateSeedData } from './generate.ts'

const CHUNK = 1000

/** Replaces the contents of `db` with the seed. The caller owns the connection. */
export async function seed(
  db: Kysely<Database>,
): Promise<{ orgUnits: number; devices: number; syncs: number }> {
  // Empty the tables rather than drop them: the schema belongs to the migrations.
  await db.deleteFrom('device_sync').execute()
  await db.deleteFrom('device').execute()
  await db.deleteFrom('app_user').execute()
  await db.deleteFrom('org_unit').execute()

  // Parents before children, so the self-reference holds at every insert.
  for (let level = 1; level <= 4; level++) {
    const rows = orgUnits
      .filter((unit) => unit.level === level)
      .map((unit) => ({
        id: unit.id,
        name: unit.name,
        parent_id: unit.parentId,
        level: unit.level,
        path: unit.path,
        latitude: unit.latitude,
        longitude: unit.longitude,
        geometry: unit.geometry === null ? null : JSON.stringify(unit.geometry),
      }))
    for (let i = 0; i < rows.length; i += CHUNK) {
      await db
        .insertInto('org_unit')
        .values(rows.slice(i, i + CHUNK))
        .execute()
    }
  }

  await db.insertInto('app_user').values(users).execute()

  // `now` is the real clock: "ten days behind" stays ten days behind whenever this
  // runs. Determinism covers the shape of the data, not the absolute instant.
  const { devices, syncs } = generateSeedData({
    orgUnits,
    userIds: users.map((user) => user.id),
    now: new Date(),
  })

  await db.insertInto('device').values(devices).execute()
  for (let i = 0; i < syncs.length; i += CHUNK) {
    await db
      .insertInto('device_sync')
      .values(syncs.slice(i, i + CHUNK))
      .execute()
  }

  return { orgUnits: orgUnits.length, devices: devices.length, syncs: syncs.length }
}
