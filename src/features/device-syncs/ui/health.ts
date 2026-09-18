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

/** What MapLibre draws. A district without geometry is left out rather than faked. */
export function toFeatureCollection(
  districts: DistrictSyncHealth[],
): GeoJSON.FeatureCollection<GeoJSON.MultiPolygon, DistrictProperties> {
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
