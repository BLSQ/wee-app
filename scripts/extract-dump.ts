/**
 * One-off: turns a plain-SQL IASO `pg_dump` into the committed reference data in
 * `data/`. It is not part of the application and never runs at build time.
 *
 *   pnpm tsx scripts/extract-dump.ts path/to/dump.sql
 */
import { createReadStream, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import simplify from '@turf/simplify'
import wkx from 'wkx'

const SOURCE_VERSION = '1'
const SIMPLIFY_TOLERANCE = 0.001 // degrees, roughly 110 m: plenty for a dashboard map

type Copy = { columns: string[]; rows: string[][] }

async function readCopyBlocks(path: string, tables: string[]): Promise<Map<string, Copy>> {
  const wanted = new Set(tables)
  const blocks = new Map<string, Copy>()
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity })
  let current: { table: string; copy: Copy } | null = null

  for await (const line of lines) {
    if (current) {
      if (line === '\\.') {
        blocks.set(current.table, current.copy)
        current = null
      } else {
        current.copy.rows.push(line.split('\t'))
      }
      continue
    }
    const match = /^COPY public\.(\w+) \(([^)]+)\) FROM stdin;$/.exec(line)
    if (match && wanted.has(match[1])) {
      current = { table: match[1], copy: { columns: match[2].split(', '), rows: [] } }
    }
  }
  return blocks
}

const read = (copy: Copy, row: string[], column: string): string | null => {
  const raw = row[copy.columns.indexOf(column)]
  return raw === '\\N' ? null : raw
}

const parseWkb = (hex: string) =>
  wkx.Geometry.parse(Buffer.from(hex, 'hex')).toGeoJSON() as GeoJSON.Geometry

function toMultiPolygon(hex: string | null): GeoJSON.MultiPolygon | null {
  if (!hex) return null
  const geometry = parseWkb(hex)
  const multi: GeoJSON.MultiPolygon | null =
    geometry.type === 'MultiPolygon'
      ? geometry
      : geometry.type === 'Polygon'
        ? { type: 'MultiPolygon', coordinates: [geometry.coordinates] }
        : null
  if (!multi) return null
  return simplify(multi, { tolerance: SIMPLIFY_TOLERANCE, highQuality: false, mutate: true })
}

function toLatLng(hex: string | null): [number | null, number | null] {
  if (!hex) return [null, null]
  const geometry = parseWkb(hex)
  if (geometry.type !== 'Point') return [null, null]
  const [longitude, latitude] = geometry.coordinates
  return [latitude, longitude]
}

async function main() {
  const dumpPath = process.argv[2]
  if (!dumpPath) throw new Error('usage: pnpm tsx scripts/extract-dump.ts <path-to-dump.sql>')

  const blocks = await readCopyBlocks(dumpPath, ['iaso_orgunit', 'auth_user'])
  const units = blocks.get('iaso_orgunit')
  const authUsers = blocks.get('auth_user')
  if (!units || !authUsers) throw new Error('dump is missing iaso_orgunit or auth_user')

  const raw = units.rows
    .filter((row) => read(units, row, 'version_id') === SOURCE_VERSION)
    .map((row) => {
      const parentId = read(units, row, 'parent_id')
      const [latitude, longitude] = toLatLng(read(units, row, 'location'))
      return {
        id: Number(read(units, row, 'id')),
        name: read(units, row, 'name') ?? '',
        parentId: parentId === null ? null : Number(parentId),
        latitude,
        longitude,
        simplifiedGeom: read(units, row, 'simplified_geom'),
      }
    })

  // Level and path come from depth in the parent chain. IASO's org unit type is
  // unreliable here: the country, 4 districts and 67 facilities are typed 'Unknown'.
  const byId = new Map(raw.map((unit) => [unit.id, unit]))
  const chains = new Map<number, number[]>()
  const ancestry = (id: number): number[] => {
    const cached = chains.get(id)
    if (cached) return cached
    const unit = byId.get(id)
    if (!unit) throw new Error(`org unit ${id} has a parent outside source version 1`)
    const chain = unit.parentId === null ? [id] : [...ancestry(unit.parentId), id]
    chains.set(id, chain)
    return chain
  }

  const orgUnits = raw.map((unit) => {
    const chain = ancestry(unit.id)
    const level = chain.length
    return {
      id: unit.id,
      name: unit.name,
      parentId: unit.parentId,
      level,
      path: chain.join('.'),
      latitude: unit.latitude,
      longitude: unit.longitude,
      // Only districts and chiefdoms are drawn on a map.
      geometry: level === 2 || level === 3 ? toMultiPolygon(unit.simplifiedGeom) : null,
    }
  })

  // Anonymise: keep the id so foreign keys still line up, drop everything else.
  const users = authUsers.rows
    .map((row) => Number(read(authUsers, row, 'id')))
    .sort((a, b) => a - b)
    .map((id, index) => ({ id, username: `user_${String(index + 1).padStart(3, '0')}` }))

  writeFileSync('data/org-units.json', JSON.stringify(orgUnits) + '\n')
  writeFileSync('data/users.json', JSON.stringify(users, null, 2) + '\n')
  console.log(`org units: ${orgUnits.length}, users: ${users.length}`)
}

main()
