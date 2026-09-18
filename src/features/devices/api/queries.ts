import { type Kysely, sql } from 'kysely'
import type { Database } from '#/server/db'

/** The syncs a device page shows at most. */
export const DEVICE_SYNC_LIMIT = 100

export type DeviceListItem = {
  id: number
  serial: string
  facilityName: string
  districtName: string
  syncCount: number
  lastSyncedAt: Date | null
}

/**
 * Every device, ordered by serial, with how much it has synced.
 *
 * The district is the facility's level 2 ancestor, and `org_unit.path` holds the dot-joined
 * ancestor ids, so it is the second path segment: no recursive query needed. `nullif` is what
 * keeps a path with no second segment from failing the whole query — that row drops out instead.
 *
 * The join on `device_sync` is a left join, so the devices that never synced stay in the list.
 */
export async function listDevices(db: Kysely<Database>): Promise<DeviceListItem[]> {
  return db
    .selectFrom('device')
    .innerJoin('org_unit as facility', 'facility.id', 'device.org_unit_id')
    .innerJoin('org_unit as district', (join) =>
      join.on('district.id', '=', sql<number>`nullif(split_part(facility.path, '.', 2), '')::int`),
    )
    .leftJoin('device_sync as sync', 'sync.device_id', 'device.id')
    .select([
      'device.id as id',
      'device.serial as serial',
      'facility.name as facilityName',
      'district.name as districtName',
      // count() returns a bigint, which the driver hands back as a string: cast it.
      sql<number>`count(sync.id)::int`.as('syncCount'),
      sql<Date | null>`max(sync.synced_at)`.as('lastSyncedAt'),
    ])
    .groupBy(['device.id', 'device.serial', 'facility.name', 'district.name'])
    .orderBy('device.serial')
    .execute()
}

export type DeviceSummary = {
  id: number
  serial: string
  facilityName: string
  districtName: string
}

export type DeviceSyncRow = {
  id: number
  username: string
  syncedAt: Date
  submissionCount: number
  orgUnitCount: number
  entityCount: number
}

export type DeviceUser = {
  id: number
  username: string
  syncCount: number
  lastSyncedAt: Date
}

export type DeviceDetail = {
  device: DeviceSummary
  syncs: DeviceSyncRow[]
  syncCount: number
  users: DeviceUser[]
}

/**
 * One device with its history, or `null` when no device has that id. Returning `null` rather than
 * throwing is what lets the page show a message instead of an error alert.
 *
 * `syncs` is capped at `syncLimit`; `syncCount` is the real total, so the page can say how many
 * it is not showing.
 */
export async function getDeviceDetail(
  db: Kysely<Database>,
  params: { deviceId: number; syncLimit: number },
): Promise<DeviceDetail | null> {
  const device = await db
    .selectFrom('device')
    .innerJoin('org_unit as facility', 'facility.id', 'device.org_unit_id')
    .innerJoin('org_unit as district', (join) =>
      join.on('district.id', '=', sql<number>`nullif(split_part(facility.path, '.', 2), '')::int`),
    )
    .select([
      'device.id as id',
      'device.serial as serial',
      'facility.name as facilityName',
      'district.name as districtName',
    ])
    .where('device.id', '=', params.deviceId)
    .executeTakeFirst()

  if (!device) return null

  const [syncs, users, counted] = await Promise.all([
    db
      .selectFrom('device_sync as sync')
      .innerJoin('app_user as user', 'user.id', 'sync.user_id')
      .select([
        'sync.id as id',
        'user.username as username',
        'sync.synced_at as syncedAt',
        'sync.submission_count as submissionCount',
        'sync.org_unit_count as orgUnitCount',
        'sync.entity_count as entityCount',
      ])
      .where('sync.device_id', '=', params.deviceId)
      .orderBy('sync.synced_at', 'desc')
      .orderBy('sync.id', 'desc')
      .limit(params.syncLimit)
      .execute(),
    db
      .selectFrom('device_sync as sync')
      .innerJoin('app_user as user', 'user.id', 'sync.user_id')
      .select([
        'user.id as id',
        'user.username as username',
        sql<number>`count(*)::int`.as('syncCount'),
        sql<Date>`max(sync.synced_at)`.as('lastSyncedAt'),
      ])
      .where('sync.device_id', '=', params.deviceId)
      .groupBy(['user.id', 'user.username'])
      .orderBy('syncCount', 'desc')
      .orderBy('user.username')
      .execute(),
    db
      .selectFrom('device_sync')
      .select(sql<number>`count(*)::int`.as('syncCount'))
      .where('device_id', '=', params.deviceId)
      .executeTakeFirstOrThrow(),
  ])

  return { device, syncs, users, syncCount: counted.syncCount }
}
