import type { Generated, JSONColumnType } from 'kysely'

// Hand-written on purpose: codegen would need a reachable database at build time.
// Keep this file in step with src/server/db/migrations/.

interface OrgUnitTable {
  id: number
  name: string
  parent_id: number | null
  /** 1 country, 2 district, 3 chiefdom, 4 facility */
  level: number
  /** Dot-joined ancestor ids, e.g. '1.2.34'. The second segment is the district. */
  path: string
  latitude: number | null
  longitude: number | null
  /** Read as GeoJSON, written as a JSON string. Districts and chiefdoms only. */
  geometry: JSONColumnType<GeoJSON.MultiPolygon | null, string | null, string | null>
}

interface AppUserTable {
  id: number
  username: string
}

interface DeviceTable {
  id: number
  serial: string
  /** Always a facility. */
  org_unit_id: number
}

interface DeviceSyncTable {
  id: Generated<number>
  device_id: number
  user_id: number
  synced_at: Date
  submission_count: number
  org_unit_count: number
  entity_count: number
}

export interface Database {
  org_unit: OrgUnitTable
  app_user: AppUserTable
  device: DeviceTable
  device_sync: DeviceSyncTable
}
