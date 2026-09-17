// Test helpers. Imported by *.test.ts files only, so PGlite stays out of the application.
import { PGlite } from '@electric-sql/pglite'
import { Kysely, PGliteDialect, type Selectable, sql } from 'kysely'
import type { Migration } from 'kysely/migration'
import { migrate } from './migrate.ts'
import type { Database } from './types.ts'

type OrgUnit = Selectable<Database['org_unit']>
type AppUser = Selectable<Database['app_user']>
type Device = Selectable<Database['device']>
type DeviceSync = Selectable<Database['device_sync']>

// Vitest cannot import() a .ts file by path as the scripts do, so Vite collects the migrations.
const migrationModules = import.meta.glob<Migration>('./migrations/*.ts', { eager: true })
const migrations = Object.fromEntries(
  Object.entries(migrationModules).map(([file, migration]) => [
    file.replace('./migrations/', '').replace(/\.ts$/, ''),
    migration,
  ]),
)

/**
 * An empty, migrated Postgres that lives in the test process: no server, no Docker, no seed.
 * Create one per test file in `beforeAll`, and destroy it in `afterAll`.
 */
export async function createTestDb(): Promise<Kysely<Database>> {
  const db = new Kysely<Database>({ dialect: new PGliteDialect({ pglite: new PGlite() }) })
  await migrate(db, { provider: { getMigrations: async () => migrations }, log: () => {} })
  return db
}

/** Empties every table. Call it in `beforeEach`, so each test sees only the rows it inserts. */
export async function resetDb(db: Kysely<Database>): Promise<void> {
  await sql`truncate device_sync, device, app_user, org_unit restart identity cascade`.execute(db)
}

// org_unit, app_user and device have no generated id, so the helpers hand them out.
let lastId = 0
const nextId = () => ++lastId

/** Without a parent, a level 1 unit. With one, a unit one level below it, on its path. */
export async function insertOrgUnit(
  db: Kysely<Database>,
  { name, level, parent }: { name?: string; level?: number; parent?: OrgUnit } = {},
): Promise<OrgUnit> {
  const id = nextId()
  return db
    .insertInto('org_unit')
    .values({
      id,
      name: name ?? `Org unit ${id}`,
      parent_id: parent?.id ?? null,
      level: level ?? (parent ? parent.level + 1 : 1),
      path: parent ? `${parent.path}.${id}` : `${id}`,
      latitude: null,
      longitude: null,
      geometry: null,
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function insertUser(
  db: Kysely<Database>,
  { username }: { username?: string } = {},
): Promise<AppUser> {
  const id = nextId()
  return db
    .insertInto('app_user')
    .values({ id, username: username ?? `user_${id}` })
    .returningAll()
    .executeTakeFirstOrThrow()
}

/** Without a facility, the device gets a new one under a new district and country. */
export async function insertDevice(
  db: Kysely<Database>,
  { serial, facility }: { serial?: string; facility?: OrgUnit } = {},
): Promise<Device> {
  const id = nextId()
  return db
    .insertInto('device')
    .values({
      id,
      serial: serial ?? `SL-${String(id).padStart(4, '0')}`,
      org_unit_id: (facility ?? (await insertFacility(db))).id,
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

/** Without a device or a user, the sync gets new ones. */
export async function insertSync(
  db: Kysely<Database>,
  {
    device,
    user,
    syncedAt = new Date('2026-01-01T00:00:00Z'),
    submissionCount = 0,
    orgUnitCount = 0,
    entityCount = 0,
  }: {
    device?: Device
    user?: AppUser
    syncedAt?: Date
    submissionCount?: number
    orgUnitCount?: number
    entityCount?: number
  } = {},
): Promise<DeviceSync> {
  return db
    .insertInto('device_sync')
    .values({
      device_id: (device ?? (await insertDevice(db))).id,
      user_id: (user ?? (await insertUser(db))).id,
      synced_at: syncedAt,
      submission_count: submissionCount,
      org_unit_count: orgUnitCount,
      entity_count: entityCount,
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

async function insertFacility(db: Kysely<Database>): Promise<OrgUnit> {
  const country = await insertOrgUnit(db)
  const district = await insertOrgUnit(db, { parent: country })
  return insertOrgUnit(db, { parent: district, level: 4 })
}
