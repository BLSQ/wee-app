import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { FileMigrationProvider, Migrator } from 'kysely/migration'
import { createDb } from './index.ts'

export async function migrate(connectionString: string): Promise<void> {
  const db = createDb(connectionString)
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.resolve('src/server/db/migrations'),
    }),
  })

  const { error, results } = await migrator.migrateToLatest()
  for (const result of results ?? []) {
    console.log(`${result.status}: ${result.migrationName}`)
  }
  await db.destroy()
  if (error) throw error
}
