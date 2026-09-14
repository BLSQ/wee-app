import { describe, expect, it } from 'vitest'
import orgUnits from './org-units.json' with { type: 'json' }
import users from './users.json' with { type: 'json' }

const byLevel = (level: number) => orgUnits.filter((unit) => unit.level === level)

describe('org-units.json', () => {
  it('holds every org unit of source version 1', () => {
    expect(orgUnits).toHaveLength(1332)
  })

  it('classifies by depth, not by IASO org unit type', () => {
    expect(byLevel(1)).toHaveLength(1)
    expect(byLevel(2)).toHaveLength(13)
    expect(byLevel(3)).toHaveLength(152)
    expect(byLevel(4)).toHaveLength(1166)
  })

  it('carries a polygon for every district and chiefdom, and for nothing else', () => {
    for (const unit of orgUnits) {
      const expectsGeometry = unit.level === 2 || unit.level === 3
      expect(unit.geometry !== null).toBe(expectsGeometry)
    }
  })

  it('carries GPS coordinates for the org units that have them', () => {
    const located = orgUnits.filter((unit) => unit.latitude !== null && unit.longitude !== null)
    expect(located).toHaveLength(601)
  })

  it('builds a path whose segment count equals the level', () => {
    for (const unit of orgUnits) {
      const segments = unit.path.split('.')
      expect(segments).toHaveLength(unit.level)
      expect(segments.at(-1)).toBe(String(unit.id))
    }
  })

  it('exposes only the expected keys', () => {
    const allowed = ['geometry', 'id', 'latitude', 'level', 'longitude', 'name', 'parentId', 'path']
    for (const unit of orgUnits) {
      expect(Object.keys(unit).sort()).toEqual(allowed)
    }
  })
})

describe('users.json', () => {
  it('holds every user of the dump', () => {
    expect(users).toHaveLength(41)
  })

  it('carries no personally identifiable information', () => {
    for (const user of users) {
      expect(Object.keys(user).sort()).toEqual(['id', 'username'])
      expect(user.username).toMatch(/^user_\d{3}$/)
    }
  })
})
