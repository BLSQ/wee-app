// Lives outside migrations/ on purpose: FileMigrationProvider loads every file there.
import { type Kysely, sql } from 'kysely'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '#/server/db'
import { createTestDb } from '#/server/db/test-helpers'

let db: Kysely<Database>
beforeAll(async () => {
  db = await createTestDb()
})
afterAll(() => db.destroy())

const columnsOf = async (table: string) => {
  const { rows } = await sql<{ column_name: string }>`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = ${table}
  `.execute(db)
  return rows.map((row) => row.column_name).sort()
}

describe('schema', () => {
  it('creates device_sync with the fields the use case needs', async () => {
    expect(await columnsOf('device_sync')).toEqual([
      'device_id',
      'entity_count',
      'id',
      'org_unit_count',
      'submission_count',
      'synced_at',
      'user_id',
    ])
  })

  it('stores geometry as jsonb, not PostGIS', async () => {
    const { rows } = await sql<{ data_type: string }>`
      select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'org_unit' and column_name = 'geometry'
    `.execute(db)
    expect(rows[0]?.data_type).toBe('jsonb')
  })
})
