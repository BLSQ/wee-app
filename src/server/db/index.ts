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
