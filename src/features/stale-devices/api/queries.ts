import { type Kysely, sql } from 'kysely'
import type { Database } from '#/server/db'

export type StaleDevice = {
  id: number
  serial: string
  facilityName: string
  districtName: string
  lastSyncedAt: Date | null
  lastUsername: string | null
}

const DAY_MS = 86_400_000

/**
 * Devices that have stopped syncing: last sync older than `days`, oldest first,
 * plus every device that never synced at all, whatever `days` is.
 *
 * `now` is a parameter, not now() in the SQL, so a test can choose the date.
 *
 * Each device's newest sync comes from a `left join lateral`: a subquery allowed
 * to refer to the row it is joined to (`device.id` below), like a Django
 * Subquery/OuterRef. It reads the device_sync (device_id, synced_at desc) index
 * and yields one row per device; `left` keeps the devices that have no sync, with
 * nulls. The district is the second segment of org_unit.path, as in
 * listRecentSyncs.
 */
export async function listStaleDevices(
  db: Kysely<Database>,
  params: { now: Date; days: number },
): Promise<StaleDevice[]> {
  const cutoff = new Date(params.now.getTime() - params.days * DAY_MS)

  return (
    db
      .selectFrom('device')
      .innerJoin('org_unit as facility', 'facility.id', 'device.org_unit_id')
      .innerJoin('org_unit as district', (join) =>
        join.on('district.id', '=', sql<number>`split_part(facility.path, '.', 2)::int`),
      )
      .leftJoinLateral(
        (eb) =>
          eb
            .selectFrom('device_sync as sync')
            .innerJoin('app_user as user', 'user.id', 'sync.user_id')
            .select(['sync.synced_at', 'user.username'])
            .whereRef('sync.device_id', '=', 'device.id')
            .orderBy('sync.synced_at', 'desc')
            .limit(1)
            .as('last'),
        (join) => join.onTrue(),
      )
      .select([
        'device.id as id',
        'device.serial as serial',
        'facility.name as facilityName',
        'district.name as districtName',
        'last.synced_at as lastSyncedAt',
        'last.username as lastUsername',
      ])
      .where((eb) => eb.or([eb('last.synced_at', 'is', null), eb('last.synced_at', '<', cutoff)]))
      // Postgres sorts nulls last on asc, and a device that never synced is the most stale of all.
      .orderBy('last.synced_at', (ob) => ob.asc().nullsFirst())
      .orderBy('device.serial', 'asc')
      .execute()
  )
}
