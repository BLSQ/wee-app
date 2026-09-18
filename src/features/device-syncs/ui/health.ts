import type { DistrictSyncHealth } from '../api/queries'

/**
 * How a district's sync rate becomes a colour. No React and no MapLibre here:
 * the map paints itself from `color`, the legend reads the same list, and the
 * boundaries are a pure function a test can pin.
 */
export type BucketKey = 'healthy' | 'at-risk' | 'critical' | 'no-devices'

export type Bucket = { key: BucketKey; label: string; color: string }

export const BUCKETS: Bucket[] = [
  { key: 'healthy', label: '80% or more', color: '#2f9e44' },
  { key: 'at-risk', label: '50 – 79%', color: '#f08c00' },
  { key: 'critical', label: 'under 50%', color: '#e03131' },
  { key: 'no-devices', label: 'no devices', color: '#adb5bd' },
]

const bucket = (key: BucketKey) => BUCKETS.find((candidate) => candidate.key === key)!

/** The share of the district's devices that synced, or null when it has none. */
export function percentOf(district: DistrictSyncHealth): number | null {
  if (district.deviceCount === 0) return null
  return Math.round((district.syncedDeviceCount / district.deviceCount) * 100)
}

/** A district with no devices is grey, not red: there is nothing to report on. */
export function bucketOf(district: DistrictSyncHealth): Bucket {
  const percent = percentOf(district)
  if (percent === null) return bucket('no-devices')
  if (percent >= 80) return bucket('healthy')
  if (percent >= 50) return bucket('at-risk')
  return bucket('critical')
}

export type DistrictProperties = {
  id: number
  name: string
  percent: number | null
  deviceCount: number
  color: string
}

export type DistrictFeatureCollection = GeoJSON.FeatureCollection<
  GeoJSON.MultiPolygon,
  DistrictProperties
>

/** What MapLibre draws. A district without geometry is left out rather than faked. */
export function toFeatureCollection(districts: DistrictSyncHealth[]): DistrictFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: districts
      .filter((district) => district.geometry !== null)
      .map((district) => ({
        type: 'Feature',
        id: district.id,
        geometry: district.geometry as GeoJSON.MultiPolygon,
        properties: {
          id: district.id,
          name: district.name,
          percent: percentOf(district),
          deviceCount: district.deviceCount,
          color: bucketOf(district).color,
        },
      })),
  }
}

/**
 * The extent of every coordinate, as MapLibre's [west, south, east, north], so
 * the map frames the data instead of hard-coding where Sierra Leone is.
 * Null when there is nothing to frame: the map then keeps the view it has.
 */
export function boundsOf(
  collection: DistrictFeatureCollection,
): [number, number, number, number] | null {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity

  for (const feature of collection.features) {
    for (const polygon of feature.geometry.coordinates) {
      for (const ring of polygon) {
        for (const [longitude, latitude] of ring) {
          west = Math.min(west, longitude)
          east = Math.max(east, longitude)
          south = Math.min(south, latitude)
          north = Math.max(north, latitude)
        }
      }
    }
  }

  const bounds = [west, south, east, north]
  return bounds.every(Number.isFinite) ? (bounds as [number, number, number, number]) : null
}

export function deviceCountLabel(deviceCount: number): string {
  if (deviceCount === 0) return 'no devices'
  return deviceCount === 1 ? '1 device' : `${deviceCount} devices`
}

export function syncRateLabel(percent: number | null): string {
  return percent === null ? 'nothing to report on' : `${percent}% synced in the last 7 days`
}
