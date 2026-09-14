import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import type { Database } from './types'

export type { Database } from './types'

export function createDb(connectionString = process.env.DATABASE_URL): Kysely<Database> {
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, max: 5 }) }),
  })
}

/** The seeded database the tests read from. Never the application database. */
export function testDb(): Kysely<Database> {
  const url = process.env.TEST_DATABASE_URL
  if (!url) throw new Error('TEST_DATABASE_URL is not set')
  return createDb(url)
}
