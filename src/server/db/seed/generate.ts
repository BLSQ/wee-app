/**
 * Generates devices and syncs for the seed. Pure and deterministic: the same
 * input always yields the same output, which the tests depend on (ADR 0006).
 */

const SEED = 20260913
const DEVICE_COUNT = 200
const NEVER_SYNCED_COUNT = 12
const WINDOW_DAYS = 90
const DAY_MS = 86_400_000

type Profile = 'healthy' | 'dropped' | 'silent' | 'mixed'

/**
 * District health, assigned in ascending district id order so the calibration
 * never moves: three healthy, two that stopped about ten days ago, one nearly
 * silent, and the rest mixed.
 */
const PROFILES: Profile[] = ['healthy', 'healthy', 'healthy', 'dropped', 'dropped', 'silent']

/** Interval between syncs, and how many days before `now` a device goes quiet. */
const RHYTHM: Record<Exclude<Profile, 'mixed'>, [min: number, max: number, quietDays: number]> = {
  healthy: [1, 3, 0],
  dropped: [1, 4, 10],
  silent: [6, 12, 25],
}

export type SeedData = {
  devices: { id: number; serial: string; org_unit_id: number }[]
  syncs: {
    device_id: number
    user_id: number
    synced_at: Date
    submission_count: number
    org_unit_count: number
    entity_count: number
  }[]
}

/** mulberry32: a tiny, dependency-free seeded PRNG. */
function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function generateSeedData(input: {
  orgUnits: { id: number; level: number; path: string }[]
  userIds: number[]
  now: Date
}): SeedData {
  const { orgUnits, userIds, now } = input
  const random = mulberry32(SEED)
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)]
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1))
  const districtOf = (path: string) => Number(path.split('.')[1])

  const districtIds = orgUnits
    .filter((unit) => unit.level === 2)
    .map((unit) => unit.id)
    .sort((a, b) => a - b)
  const profileOf = new Map(districtIds.map((id, index) => [id, PROFILES[index] ?? 'mixed']))

  const facilitiesByDistrict = new Map<number, number[]>()
  for (const unit of orgUnits) {
    if (unit.level !== 4) continue
    const district = districtOf(unit.path)
    facilitiesByDistrict.set(district, [...(facilitiesByDistrict.get(district) ?? []), unit.id])
  }

  // Round-robin over districts, so every district has devices.
  const devices: SeedData['devices'] = []
  const districtOfDevice = new Map<number, number>()
  for (let index = 0; index < DEVICE_COUNT; index++) {
    const id = index + 1
    const district = districtIds[index % districtIds.length]
    devices.push({
      id,
      serial: `SL-${String(id).padStart(4, '0')}`,
      org_unit_id: pick(facilitiesByDistrict.get(district) ?? []),
    })
    districtOfDevice.set(id, district)
  }

  // The last devices never sync. They are the trap in a "stale devices" query.
  const neverSynced = new Set(devices.slice(-NEVER_SYNCED_COUNT).map((device) => device.id))

  const syncs: SeedData['syncs'] = []
  for (const device of devices) {
    if (neverSynced.has(device.id)) continue

    const profile = profileOf.get(districtOfDevice.get(device.id) ?? 0) ?? 'mixed'
    const [minInterval, maxInterval, quietDays] =
      profile === 'mixed' ? (random() < 0.3 ? [2, 6, 9] : [1, 4, 0]) : RHYTHM[profile]
    const primaryUser = pick(userIds)

    // Start one day inside the window: setting the hour below can move a sync
    // earlier than `now - daysAgo`, which would push day 90 outside the window.
    let daysAgo = WINDOW_DAYS - 1 - between(0, 3)
    while (daysAgo > quietDays) {
      const syncedAt = new Date(now.getTime() - daysAgo * DAY_MS)
      syncedAt.setUTCHours(between(6, 19), between(0, 59), 0, 0)
      syncs.push({
        device_id: device.id,
        user_id: random() < 0.8 ? primaryUser : pick(userIds),
        synced_at: syncedAt,
        submission_count: between(0, 40),
        org_unit_count: between(0, 5),
        entity_count: between(0, 15),
      })
      daysAgo -= between(minInterval, maxInterval)
    }
  }

  syncs.sort((a, b) => a.synced_at.getTime() - b.synced_at.getTime())
  return { devices, syncs }
}
