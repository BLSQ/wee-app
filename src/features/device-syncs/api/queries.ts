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
