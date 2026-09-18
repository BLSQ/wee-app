import { type Kysely, sql } from 'kysely'
import type { Database } from '#/server/db'

export type RecentSync = {
  id: number
  deviceSerial: string
  username: string
  facilityName: string
  districtName: string
  syncedAt: Date
  submissionCount: number
  orgUnitCount: number
  entityCount: number
}

/**
 * The most recent syncs, newest first.
 *
 * A device is attached to a facility. The facility's district is its level 2
 * ancestor, and `org_unit.path` holds the dot-joined ancestor ids, so the
 * district id is the second path segment: no recursive query needed.
 */
export async function listRecentSyncs(
  db: Kysely<Database>,
  params: { limit: number },
): Promise<RecentSync[]> {
  return db
    .selectFrom('device_sync as sync')
    .innerJoin('device', 'device.id', 'sync.device_id')
    .innerJoin('app_user as user', 'user.id', 'sync.user_id')
    .innerJoin('org_unit as facility', 'facility.id', 'device.org_unit_id')
    .innerJoin('org_unit as district', (join) =>
      join.on('district.id', '=', sql<number>`split_part(facility.path, '.', 2)::int`),
    )
    .select([
      'sync.id as id',
      'device.serial as deviceSerial',
      'user.username as username',
      'facility.name as facilityName',
      'district.name as districtName',
      'sync.synced_at as syncedAt',
      'sync.submission_count as submissionCount',
      'sync.org_unit_count as orgUnitCount',
      'sync.entity_count as entityCount',
    ])
    .orderBy('sync.synced_at', 'desc')
    .orderBy('sync.id', 'desc')
    .limit(params.limit)
    .execute()
}

const DAY_MS = 86_400_000

export type DistrictSyncHealth = {
  id: number
  name: string
  deviceCount: number
  syncedDeviceCount: number
  geometry: GeoJSON.MultiPolygon | null
}

/**
 * One row per district, with how many of its devices synced inside the window.
 *
 * It starts from the districts and joins outwards, so a district with no
 * devices comes back with zeroes instead of disappearing. `geometry` is plain
 * jsonb (ADR 0007) and travels as it is, for MapLibre to draw.
 *
 * The counts are cast to int on purpose: `count()` is a bigint, which the `pg`
 * driver hands back as a string.
 */
export async function districtSyncHealth(
  db: Kysely<Database>,
  params: { now: Date; days: number },
): Promise<DistrictSyncHealth[]> {
  const since = new Date(params.now.getTime() - params.days * DAY_MS)

  return db
    .selectFrom('org_unit as district')
    .leftJoin('org_unit as facility', (join) =>
      join
        .on('facility.level', '=', 4)
        .on(sql<number>`split_part(facility.path, '.', 2)::int`, '=', sql`district.id`),
    )
    .leftJoin('device', 'device.org_unit_id', 'facility.id')
    .select([
      'district.id as id',
      'district.name as name',
      'district.geometry as geometry',
      sql<number>`cast(count(device.id) as int)`.as('deviceCount'),
      sql<number>`cast(count(device.id) filter (
        where exists (
          select 1 from device_sync as s
          where s.device_id = device.id and s.synced_at >= ${since}
        )
      ) as int)`.as('syncedDeviceCount'),
    ])
    .where('district.level', '=', 2)
    .groupBy(['district.id', 'district.name', 'district.geometry'])
    .orderBy('district.name')
    .execute()
}
