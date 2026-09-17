// Imported by *.test.ts files only, so PGlite stays out of the application.
import { PGlite } from '@electric-sql/pglite'
import { Kysely, PGliteDialect, type Selectable, sql } from 'kysely'
import type { Migration } from 'kysely/migration'
import { migrate } from './migrate.ts'
import type { Database } from './types.ts'

type Db = Kysely<Database>
type Row<T extends keyof Database> = Selectable<Database[T]>

// Vitest cannot import() a .ts file by path as the scripts do, so Vite collects the migrations.
const migrations = Object.fromEntries(
  Object.entries(import.meta.glob<Migration>('./migrations/*.ts', { eager: true })).map(
    ([file, migration]) => [file.replace('./migrations/', '').replace(/\.ts$/, ''), migration],
  ),
)

/** An empty, migrated Postgres inside the test process. One per test file, in `beforeAll`. */
export async function createTestDb(): Promise<Db> {
  const db = new Kysely<Database>({ dialect: new PGliteDialect({ pglite: new PGlite() }) })
  await migrate(db, { provider: { getMigrations: async () => migrations }, log: () => {} })
  return db
}

/** Empties every table. Call it in `beforeEach`, so a test sees only the rows it inserts. */
export async function resetDb(db: Db): Promise<void> {
  await sql`truncate device_sync, device, app_user, org_unit restart identity cascade`.execute(db)
}

// org_unit, app_user and device have no generated id, so the helpers hand them out.
let lastId = 0
const nextId = () => ++lastId

/** Without a parent, a level 1 unit. With one, a unit one level below it, on its path. */
export async function insertOrgUnit(
  db: Db,
  { name, parent }: { name?: string; parent?: Row<'org_unit'> } = {},
): Promise<Row<'org_unit'>> {
  const id = nextId()
  return db
    .insertInto('org_unit')
    .values({
      id,
      name: name ?? `Org unit ${id}`,
      parent_id: parent?.id ?? null,
      level: parent ? parent.level + 1 : 1,
      path: parent ? `${parent.path}.${id}` : `${id}`,
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function insertUser(
  db: Db,
  { username }: { username?: string } = {},
): Promise<Row<'app_user'>> {
  const id = nextId()
  return db
    .insertInto('app_user')
    .values({ id, username: username ?? `user_${id}` })
    .returningAll()
    .executeTakeFirstOrThrow()
}

/** Without a facility, the device gets a new one under a new chiefdom, district and country. */
export async function insertDevice(
  db: Db,
  { serial, facility }: { serial?: string; facility?: Row<'org_unit'> } = {},
): Promise<Row<'device'>> {
  const id = nextId()
  if (!facility) {
    const country = await insertOrgUnit(db)
    const district = await insertOrgUnit(db, { parent: country })
    const chiefdom = await insertOrgUnit(db, { parent: district })
    facility = await insertOrgUnit(db, { parent: chiefdom })
  }
  return db
    .insertInto('device')
    .values({ id, serial: serial ?? `SL-${String(id).padStart(4, '0')}`, org_unit_id: facility.id })
    .returningAll()
    .executeTakeFirstOrThrow()
}

/** Without a device or a user, the sync gets new ones. */
export async function insertSync(
  db: Db,
  values: {
    device?: Row<'device'>
    user?: Row<'app_user'>
    syncedAt?: Date
    submissionCount?: number
    orgUnitCount?: number
    entityCount?: number
  } = {},
): Promise<Row<'device_sync'>> {
  return db
    .insertInto('device_sync')
    .values({
      device_id: (values.device ?? (await insertDevice(db))).id,
      user_id: (values.user ?? (await insertUser(db))).id,
      synced_at: values.syncedAt ?? new Date('2026-01-01T00:00:00Z'),
      submission_count: values.submissionCount ?? 0,
      org_unit_count: values.orgUnitCount ?? 0,
      entity_count: values.entityCount ?? 0,
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}
