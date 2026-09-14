import { describe, expect, it } from 'vitest'
import orgUnits from '../../../../data/org-units.json' with { type: 'json' }
import users from '../../../../data/users.json' with { type: 'json' }
import { generateSeedData } from './generate'

const NOW = new Date('2026-09-13T12:00:00Z')
const DAY_MS = 86_400_000
const input = { orgUnits, userIds: users.map((user) => user.id), now: NOW }

const unitById = new Map(orgUnits.map((unit) => [unit.id, unit]))
const districtOfFacility = (id: number) => Number(unitById.get(id)?.path.split('.')[1])

describe('generateSeedData', () => {
  it('is deterministic', () => {
    expect(generateSeedData(input)).toEqual(generateSeedData(input))
  })

  it('creates 200 devices, each attached to a facility', () => {
    const { devices } = generateSeedData(input)
    expect(devices).toHaveLength(200)
    for (const device of devices) {
      expect(unitById.get(device.org_unit_id)?.level).toBe(4)
    }
  })

  it('gives every device a unique serial', () => {
    const { devices } = generateSeedData(input)
    expect(new Set(devices.map((device) => device.serial)).size).toBe(200)
  })

  it('leaves exactly 12 devices that have never synced', () => {
    const { devices, syncs } = generateSeedData(input)
    const synced = new Set(syncs.map((sync) => sync.device_id))
    expect(devices.filter((device) => !synced.has(device.id))).toHaveLength(12)
  })

  it('places devices in all thirteen districts', () => {
    const { devices } = generateSeedData(input)
    const districts = new Set(devices.map((device) => districtOfFacility(device.org_unit_id)))
    expect(districts.size).toBe(13)
  })

  it('keeps every sync inside the last 90 days', () => {
    const { syncs } = generateSeedData(input)
    const earliest = NOW.getTime() - 90 * DAY_MS
    for (const sync of syncs) {
      expect(sync.synced_at.getTime()).toBeGreaterThanOrEqual(earliest)
      expect(sync.synced_at.getTime()).toBeLessThanOrEqual(NOW.getTime())
    }
  })

  it('leaves at least three districts healthy and at least three behind', () => {
    const { devices, syncs } = generateSeedData(input)
    const districtOfDevice = new Map(
      devices.map((device) => [device.id, districtOfFacility(device.org_unit_id)]),
    )
    const latestByDistrict = new Map<number, number>()
    for (const sync of syncs) {
      const district = districtOfDevice.get(sync.device_id) ?? 0
      const latest = Math.max(latestByDistrict.get(district) ?? 0, sync.synced_at.getTime())
      latestByDistrict.set(district, latest)
    }
    const daysBehind = [...latestByDistrict.values()].map((t) => (NOW.getTime() - t) / DAY_MS)
    expect(daysBehind.filter((days) => days < 2).length).toBeGreaterThanOrEqual(3)
    expect(daysBehind.filter((days) => days > 7).length).toBeGreaterThanOrEqual(3)
  })

  it('only references known users', () => {
    const { syncs } = generateSeedData(input)
    const known = new Set(users.map((user) => user.id))
    expect(syncs.every((sync) => known.has(sync.user_id))).toBe(true)
  })
})
