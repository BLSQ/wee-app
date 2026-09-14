import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { config } from 'dotenv'
import { FileMigrationProvider, Migrator } from 'kysely/migration'
import { createDb } from '../src/server/db/index.ts'

config({ quiet: true })

// TARGET_DATABASE_URL lets the same command migrate the test database.
const db = createDb(process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL)

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

if (error) {
  console.error(error)
  process.exit(1)
}
