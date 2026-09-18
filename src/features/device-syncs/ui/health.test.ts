import { describe, expect, it } from 'vitest'
import type { DistrictSyncHealth } from '../api/queries'
import {
  BUCKETS,
  boundsOf,
  bucketOf,
  deviceCountLabel,
  percentOf,
  syncRateLabel,
  toFeatureCollection,
} from './health'

const square: GeoJSON.MultiPolygon = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [-13, 8],
        [-12, 8],
        [-12, 9],
        [-13, 9],
        [-13, 8],
      ],
    ],
  ],
}

const district = (values: Partial<DistrictSyncHealth> = {}): DistrictSyncHealth => ({
  id: 1,
  name: 'Bo',
  deviceCount: 10,
  syncedDeviceCount: 10,
  geometry: square,
  ...values,
})

describe('percentOf', () => {
  it('is the share of devices that synced', () => {
    expect(percentOf(district({ deviceCount: 4, syncedDeviceCount: 3 }))).toBe(75)
  })

  it('rounds to a whole number', () => {
    expect(percentOf(district({ deviceCount: 3, syncedDeviceCount: 2 }))).toBe(67)
  })

  it('is null when the district has no devices', () => {
    expect(percentOf(district({ deviceCount: 0, syncedDeviceCount: 0 }))).toBeNull()
  })
})

describe('bucketOf', () => {
  const keyAt = (deviceCount: number, syncedDeviceCount: number) =>
    bucketOf(district({ deviceCount, syncedDeviceCount })).key

  it.each([
    [100, 100, 'healthy'],
    [100, 80, 'healthy'],
    [100, 79, 'at-risk'],
    [100, 50, 'at-risk'],
    [100, 49, 'critical'],
    [100, 0, 'critical'],
  ])('puts %i devices with %i synced in "%s"', (deviceCount, syncedDeviceCount, key) => {
    expect(keyAt(deviceCount, syncedDeviceCount)).toBe(key)
  })

  it('separates a district with no devices from one where nothing synced', () => {
    expect(keyAt(0, 0)).toBe('no-devices')
    expect(keyAt(5, 0)).toBe('critical')
  })
})

describe('toFeatureCollection', () => {
  it('carries the name, the percentage and the bucket colour', () => {
    const collection = toFeatureCollection([
      district({ id: 7, name: 'Pujehun', deviceCount: 4, syncedDeviceCount: 1 }),
    ])

    expect(collection.features).toHaveLength(1)
    expect(collection.features[0].properties).toEqual({
      id: 7,
      name: 'Pujehun',
      percent: 25,
      deviceCount: 4,
      color: BUCKETS.find((bucket) => bucket.key === 'critical')!.color,
    })
    expect(collection.features[0].geometry).toEqual(square)
  })

  it('skips a district that has no geometry, so the map can still draw', () => {
    const collection = toFeatureCollection([district({ geometry: null }), district({ id: 2 })])

    expect(collection.features.map((feature) => feature.properties.id)).toEqual([2])
  })

  it('gives a district with no devices the grey colour and no percentage', () => {
    const [feature] = toFeatureCollection([
      district({ deviceCount: 0, syncedDeviceCount: 0 }),
    ]).features

    expect(feature.properties.percent).toBeNull()
    expect(feature.properties.color).toBe(
      BUCKETS.find((bucket) => bucket.key === 'no-devices')!.color,
    )
  })
})

describe('boundsOf', () => {
  const at = (...rings: GeoJSON.Position[]) =>
    toFeatureCollection([district({ geometry: { type: 'MultiPolygon', coordinates: [[rings]] } })])

  it('is the extent of every coordinate', () => {
    expect(boundsOf(at([-13, 7], [-11, 9], [-12, 8], [-13, 7]))).toEqual([-13, 7, -11, 9])
  })

  it('spans every district, not just the first', () => {
    const collection = toFeatureCollection([
      district({
        id: 1,
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [-13, 8],
                [-13, 8],
              ],
            ],
          ],
        },
      }),
      district({
        id: 2,
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [-10, 5],
                [-10, 5],
              ],
            ],
          ],
        },
      }),
    ])

    expect(boundsOf(collection)).toEqual([-13, 5, -10, 8])
  })

  it('is null when there is nothing to frame, so the map keeps its view', () => {
    expect(boundsOf(toFeatureCollection([]))).toBeNull()
    expect(boundsOf(toFeatureCollection([district({ geometry: null })]))).toBeNull()
  })
})

describe('the popup wording', () => {
  it.each([
    [0, 'no devices'],
    [1, '1 device'],
    [12, '12 devices'],
  ])('reads %i devices as "%s"', (deviceCount, label) => {
    expect(deviceCountLabel(deviceCount)).toBe(label)
  })

  it('gives the rate when there is one', () => {
    expect(syncRateLabel(47)).toBe('47% synced in the last 7 days')
  })

  it('says there is nothing to report when the district has no devices', () => {
    expect(syncRateLabel(null)).toBe('nothing to report on')
  })
})
