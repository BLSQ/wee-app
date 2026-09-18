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
  params: {
    limit: number
    offset: number
    search?: string
    sortBy?: 'device' | 'user' | 'facility' | 'district'
    sortOrder?: 'asc' | 'desc'
  },
): Promise<{ rows: RecentSync[]; total: number }> {
  let query = db
    .selectFrom('device_sync as sync')
    .innerJoin('device', 'device.id', 'sync.device_id')
    .innerJoin('app_user as user', 'user.id', 'sync.user_id')
    .innerJoin('org_unit as facility', 'facility.id', 'device.org_unit_id')
    .innerJoin('org_unit as district', (join) =>
      join.on('district.id', '=', sql<number>`split_part(facility.path, '.', 2)::int`),
    )

  if (params.search) {
    const term = `%${params.search}%`
    query = query.where((eb) =>
      eb.or([
        eb('device.serial', 'ilike', term),
        eb('user.username', 'ilike', term),
        eb('facility.name', 'ilike', term),
        eb('district.name', 'ilike', term),
      ]),
    )
  }

  let sortQuery = query.select([
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

  const sortOrder = params.sortOrder ?? 'asc'
  if (params.sortBy) {
    switch (params.sortBy) {
      case 'device':
        sortQuery = sortQuery.orderBy('device.serial', sortOrder)
        break
      case 'user':
        sortQuery = sortQuery.orderBy('user.username', sortOrder)
        break
      case 'facility':
        sortQuery = sortQuery.orderBy('facility.name', sortOrder)
        break
      case 'district':
        sortQuery = sortQuery.orderBy('district.name', sortOrder)
        break
    }
  } else {
    sortQuery = sortQuery.orderBy('sync.synced_at', 'desc')
    sortQuery = sortQuery.orderBy('sync.id', 'desc')
  }

  const rows = await sortQuery.limit(params.limit).offset(params.offset).execute()

  const countQuery = query.select(({ fn }) => [fn.countAll().as('count')])
  const [result] = await countQuery.execute()
  const total = Number(result?.count ?? 0)

  return { rows, total }
}
