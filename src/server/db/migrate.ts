import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import type { Kysely } from 'kysely'
import { FileMigrationProvider, type MigrationProvider, Migrator } from 'kysely/migration'
import type { Database } from './types.ts'

// Loads the migration files with a native import(), which needs tsx: fine for the scripts.
const migrationFiles = () =>
  new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.resolve('src/server/db/migrations'),
  })

/** Migrates `db` to the latest schema. The caller owns the connection. */
export async function migrate(
  db: Kysely<Database>,
  {
    provider = migrationFiles(),
    log = console.log,
  }: { provider?: MigrationProvider; log?: (line: string) => void } = {},
): Promise<void> {
  const migrator = new Migrator({ db, provider })

  const { error, results } = await migrator.migrateToLatest()
  for (const result of results ?? []) {
    log(`${result.status}: ${result.migrationName}`)
  }
  if (error) throw error
}
