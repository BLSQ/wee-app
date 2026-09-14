import { type Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('org_unit')
    .addColumn('id', 'integer', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('parent_id', 'integer', (col) => col.references('org_unit.id'))
    .addColumn('level', 'smallint', (col) => col.notNull())
    .addColumn('path', 'text', (col) => col.notNull())
    .addColumn('latitude', 'double precision')
    .addColumn('longitude', 'double precision')
    .addColumn('geometry', 'jsonb')
    .execute()

  await db.schema.createIndex('org_unit_path_idx').on('org_unit').column('path').execute()

  await db.schema
    .createTable('app_user')
    .addColumn('id', 'integer', (col) => col.primaryKey())
    .addColumn('username', 'text', (col) => col.notNull().unique())
    .execute()

  await db.schema
    .createTable('device')
    .addColumn('id', 'integer', (col) => col.primaryKey())
    .addColumn('serial', 'text', (col) => col.notNull().unique())
    .addColumn('org_unit_id', 'integer', (col) => col.notNull().references('org_unit.id'))
    .execute()

  await db.schema.createIndex('device_org_unit_idx').on('device').column('org_unit_id').execute()

  await db.schema
    .createTable('device_sync')
    .addColumn('id', 'integer', (col) => col.primaryKey().generatedAlwaysAsIdentity())
    .addColumn('device_id', 'integer', (col) => col.notNull().references('device.id'))
    .addColumn('user_id', 'integer', (col) => col.notNull().references('app_user.id'))
    .addColumn('synced_at', 'timestamptz', (col) => col.notNull())
    .addColumn('submission_count', 'integer', (col) => col.notNull())
    .addColumn('org_unit_count', 'integer', (col) => col.notNull())
    .addColumn('entity_count', 'integer', (col) => col.notNull())
    .execute()

  await sql`create index device_sync_device_synced_idx on device_sync (device_id, synced_at desc)`.execute(
    db,
  )
  await sql`create index device_sync_synced_idx on device_sync (synced_at desc)`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('device_sync').execute()
  await db.schema.dropTable('device').execute()
  await db.schema.dropTable('app_user').execute()
  await db.schema.dropTable('org_unit').execute()
}
