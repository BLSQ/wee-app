# wee-app Starter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `wee-app` starter repository — an IASO device-sync dashboard with one complete, tested vertical feature slice, a deterministic seed derived from anonymised IASO data, and the agent configuration and backlog a spec-driven-development workshop needs.

**Architecture:** TanStack Start serves both the React UI and a tRPC API mounted on a splat server route. Kysely talks to Postgres with hand-written types. Every feature lives in `src/features/<name>/`, splitting pure Kysely queries (tested) from thin tRPC procedures and Mantine components (not tested). `src/features/index.ts` is the only shared registration point.

**Tech Stack:** TypeScript, TanStack Start, React, Mantine 8, `@mantine/charts`, MapLibre GL, tRPC 11, `@tanstack/react-query`, Kysely, `pg`, Vitest, Prettier, Neon Postgres, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-13-wee-app-design.md`

## Global Constraints

- Node 22, pnpm 10. The repository pins `packageManager` in `package.json`.
- **Everything in the repository is written in English** — code, comments, identifiers, docs, commit messages, PR descriptions.
- Package name and repository name: `wee-app`. Remote: `https://github.com/BLSQ/wee-app.git`.
- **No linter, no ESLint, no e2e framework, no authentication, no CI workflow.** These are backlog tickets. Adding any of them is a plan violation.
- Prettier is the only formatter. Vitest is the only test runner.
- No ORM. All database access goes through Kysely query builders.
- No PostGIS. Geometry is GeoJSON stored in `jsonb`.
- No committed personally identifiable information. `data/users.json` carries `id` and a generated `username` only.
- The seed is deterministic: the same command always produces the same rows.
- Every dashboard query is read-only. Tests assert against the seeded database with no fixtures, mocks or rollback.
- Database connection comes from `DATABASE_URL`; tests use `TEST_DATABASE_URL`.
- Source dump for Task 2 only: `~/Downloads/devcoda2_dump_25042023.sql.zip`. It is never committed.

## Local verification database

Tasks 3 onwards need a reachable Postgres. Neon is not provisioned during implementation. Use a throwaway local cluster:

```bash
export PGDATA="$TMPDIR/wee-pg"
initdb -U postgres -D "$PGDATA" >/dev/null
pg_ctl -D "$PGDATA" -o "-k $TMPDIR -h 127.0.0.1 -p 55432" -l "$TMPDIR/pg.log" start
createdb -h 127.0.0.1 -p 55432 -U postgres wee_app
createdb -h 127.0.0.1 -p 55432 -U postgres wee_app_test
```

Then in `.env` (git-ignored):

```
DATABASE_URL=postgres://postgres@127.0.0.1:55432/wee_app
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/wee_app_test
```

Stop it with `pg_ctl -D "$PGDATA" stop`. This cluster is a local convenience only — it is never referenced by committed files. The README documents Neon.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `package.json`, `tsconfig.json`, `vite.config.ts`, `.prettierrc`, `vitest.config.ts` | Toolchain |
| `scripts/extract-dump.ts` | One-off: IASO dump → `data/*.json`. Never runs in the app. |
| `scripts/migrate.ts` | Runs Kysely migrations |
| `scripts/seed.ts` | Thin runner: generate, then insert |
| `data/org-units.json`, `data/users.json` | Committed reference data |
| `data/data.test.ts` | Guards counts and the absence of PII |
| `src/server/db/types.ts` | Kysely `Database` interface |
| `src/server/db/index.ts` | Kysely instance factory |
| `src/server/db/migrations/001-initial-schema.ts` | Schema |
| `src/server/db/seed/generate.ts` | Pure seed generator |
| `src/server/db/seed/generate.test.ts` | Determinism and calibration of the generator |
| `src/server/db/migrations.test.ts` | Schema shape, sitting outside `migrations/` on purpose |
| `src/server/db/seed/seeded-database.test.ts` | The seeded database really holds what the spec promises |
| `src/server/trpc/base.ts` | `initTRPC`, context, `router`, `publicProcedure` |
| `src/features/index.ts` | **The shared contact point**: `appRouter` + `navItems` |
| `src/features/device-syncs/api/queries.ts` | Pure Kysely queries |
| `src/features/device-syncs/api/queries.test.ts` | Query tests |
| `src/features/device-syncs/api/router.ts` | tRPC procedures |
| `src/features/device-syncs/ui/SyncsPage.tsx`, `ui/SyncTable.tsx` | Mantine UI |
| `src/ui/AppShell.tsx`, `src/ui/theme.ts` | Shell |
| `src/lib/trpc.ts` | tRPC client |
| `src/routes/__root.tsx`, `index.tsx`, `syncs.tsx`, `api/trpc/$.ts` | Routes, all thin |
| `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.claude/settings.json` | Agent configuration |
| `skills/` | Vendored Superpowers 6.3.0 + project skills |
| `docs/adr/0001…0009` | Initial ADRs |
| `README.md`, `BACKLOG.md`, `.env.example`, `vercel.json` | Docs and deployment |

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.prettierrc`, `.npmrc`, `src/router.tsx`, `src/routes/__root.tsx`, `src/routes/index.tsx`
- Test: `src/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `pnpm dev`, `pnpm test`, `pnpm format`. Path alias `~/*` → `src/*`.

- [ ] **Step 1: Scaffold TanStack Start outside the repo, then copy in**

The repository root is not empty (it has `.git`, `docs/`, `.gitignore`), so scaffold elsewhere and copy.

```bash
pnpx create-start-app wee-app --template typescript --package-manager pnpm --no-git
```

Run it in `$TMPDIR`. Then copy everything except `.git` into the repository root:

```bash
cd $TMPDIR/wee-app && tar cf - --exclude=.git --exclude=node_modules . | (cd /path/to/repo && tar xf -)
```

- [ ] **Step 2: Add the project dependencies**

```bash
pnpm add @mantine/core @mantine/hooks @mantine/charts recharts maplibre-gl \
  @trpc/server @trpc/client @trpc/tanstack-react-query @tanstack/react-query \
  kysely pg zod superjson
pnpm add -D typescript vitest prettier dotenv tsx \
  @types/pg @types/node @types/geojson wkx @turf/simplify
```

`wkx` and `@turf/simplify` are devDependencies used only by `scripts/extract-dump.ts`.
`superjson` is a runtime dependency: without a transformer, tRPC serialises
`Date` to a string while the type still says `Date`, and every date in the UI
becomes a silent lie.

- [ ] **Step 3: Set the package metadata and scripts**

In `package.json`, set `"name": "wee-app"`, `"private": true`, `"type": "module"`, `"packageManager": "pnpm@10.13.1"`, and:

```json
"scripts": {
  "dev": "vite dev",
  "build": "vite build",
  "start": "node .output/server/index.mjs",
  "test": "vitest run",
  "test:watch": "vitest",
  "db:migrate": "tsx scripts/migrate.ts",
  "db:seed": "tsx scripts/seed.ts",
  "format": "prettier --write ."
}
```

- [ ] **Step 4: Configure the path alias**

In `tsconfig.json` `compilerOptions`, add:

```json
"baseUrl": ".",
"paths": { "~/*": ["./src/*"] }
```

Confirm `vite.config.ts` matches the framework shape (order matters — the Start plugin comes before the React plugin):

```ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  server: { port: 3000 },
  resolve: { tsconfigPaths: true },
  plugins: [tanstackStart(), viteReact()],
})
```

- [ ] **Step 5: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'data/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: { alias: { '~': resolve(__dirname, 'src') } },
})
```

Create `vitest.setup.ts`:

```ts
import { config } from 'dotenv'
config({ path: '.env' })
```

- [ ] **Step 6: Configure Prettier**

Create `.prettierrc`:

```json
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 100
}
```

Create `.prettierignore` containing:

```
.output
dist
pnpm-lock.yaml
data
skills
src/routeTree.gen.ts
```

- [ ] **Step 7: Write the failing smoke test**

Create `src/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import pkg from '../package.json' with { type: 'json' }

describe('project scaffold', () => {
  it('is named wee-app', () => {
    expect(pkg.name).toBe('wee-app')
  })

  it('has no linter dependency, because linting is a backlog ticket', () => {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(Object.keys(deps).filter((d) => d.includes('eslint'))).toEqual([])
  })
})
```

- [ ] **Step 8: Run the test**

Run: `pnpm test`
Expected: PASS, two tests. If `create-start-app` installed ESLint, remove it — the second test exists to catch exactly that.

- [ ] **Step 9: Verify the dev server**

Run: `pnpm dev`
Expected: the app serves on `http://localhost:3000`. Stop it.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Scaffold the TanStack Start application"
```

---

### Task 2: Extract anonymised IASO reference data

**Files:**
- Create: `scripts/extract-dump.ts`, `data/org-units.json`, `data/users.json`
- Test: `data/data.test.ts`

**Interfaces:**
- Consumes: the dump at a path given as `process.argv[2]`.
- Produces: two JSON files with these exact shapes, consumed by Task 4.

```ts
type OrgUnitRecord = {
  id: number
  name: string
  parentId: number | null
  level: 1 | 2 | 3 | 4
  path: string            // dot-joined ancestor ids, e.g. '1.2.34'
  latitude: number | null
  longitude: number | null
  geometry: GeoJSON.MultiPolygon | null
}

type UserRecord = { id: number; username: string }
```

- [ ] **Step 1: Write the failing guard test**

Create `data/data.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import orgUnits from './org-units.json' with { type: 'json' }
import users from './users.json' with { type: 'json' }

const byLevel = (level: number) => orgUnits.filter((o) => o.level === level)

describe('org-units.json', () => {
  it('holds every org unit of source version 1', () => {
    expect(orgUnits).toHaveLength(1332)
  })

  it('classifies by depth, not by IASO org unit type', () => {
    expect(byLevel(1)).toHaveLength(1)
    expect(byLevel(2)).toHaveLength(9)
    expect(byLevel(3)).toHaveLength(152)
    expect(byLevel(4)).toHaveLength(1170)
  })

  it('carries a polygon for every district and chiefdom', () => {
    expect(byLevel(2).every((o) => o.geometry !== null)).toBe(true)
    expect(byLevel(3).every((o) => o.geometry !== null)).toBe(true)
  })

  it('carries GPS coordinates for the facilities that have them', () => {
    const located = orgUnits.filter((o) => o.latitude !== null && o.longitude !== null)
    expect(located).toHaveLength(601)
  })

  it('builds a path whose segment count equals the level', () => {
    for (const unit of orgUnits) {
      expect(unit.path.split('.')).toHaveLength(unit.level)
      expect(unit.path.split('.').at(-1)).toBe(String(unit.id))
    }
  })

  it('exposes only the expected keys', () => {
    const allowed = [
      'id', 'name', 'parentId', 'level', 'path', 'latitude', 'longitude', 'geometry',
    ].sort()
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test data/data.test.ts`
Expected: FAIL — `Cannot find module './org-units.json'`.

- [ ] **Step 3: Write the extraction script**

Create `scripts/extract-dump.ts`. It parses the `COPY` blocks of a plain `pg_dump`, which are tab-separated with `\N` for null.

```ts
import { createReadStream, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { Geometry } from 'wkx'
import simplify from '@turf/simplify'

const SOURCE_VERSION = '1'
const SIMPLIFY_TOLERANCE = 0.001 // degrees, roughly 110 m — plenty for a dashboard map

type Copy = { columns: string[]; rows: string[][] }

async function readCopyBlocks(path: string, tables: string[]): Promise<Map<string, Copy>> {
  const wanted = new Set(tables)
  const out = new Map<string, Copy>()
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity })
  let current: { table: string; copy: Copy } | null = null

  for await (const line of rl) {
    if (current) {
      if (line === '\\.') {
        out.set(current.table, current.copy)
        current = null
      } else {
        current.copy.rows.push(line.split('\t'))
      }
      continue
    }
    const match = /^COPY public\.(\w+) \(([^)]+)\) FROM stdin;$/.exec(line)
    if (match && wanted.has(match[1])) {
      current = {
        table: match[1],
        copy: { columns: match[2].split(', '), rows: [] },
      }
    }
  }
  return out
}

const value = (copy: Copy, row: string[], column: string): string | null => {
  const raw = row[copy.columns.indexOf(column)]
  return raw === '\\N' ? null : raw
}

function toGeoJson(hex: string | null) {
  if (!hex) return null
  const geo = Geometry.parse(Buffer.from(hex, 'hex')).toGeoJSON() as GeoJSON.Geometry
  if (geo.type !== 'MultiPolygon' && geo.type !== 'Polygon') return null
  const simplified = simplify(
    { type: 'Feature', properties: {}, geometry: geo },
    { tolerance: SIMPLIFY_TOLERANCE, highQuality: false, mutate: true },
  )
  return simplified.geometry as GeoJSON.MultiPolygon
}

function pointCoordinates(hex: string | null): [number | null, number | null] {
  if (!hex) return [null, null]
  const geo = Geometry.parse(Buffer.from(hex, 'hex')).toGeoJSON() as GeoJSON.Point
  if (geo.type !== 'Point') return [null, null]
  const [longitude, latitude] = geo.coordinates
  return [latitude, longitude]
}

async function main() {
  const dumpPath = process.argv[2]
  if (!dumpPath) throw new Error('usage: tsx scripts/extract-dump.ts <path-to-dump.sql>')

  const blocks = await readCopyBlocks(dumpPath, ['iaso_orgunit', 'auth_user'])
  const orgUnitCopy = blocks.get('iaso_orgunit')!
  const userCopy = blocks.get('auth_user')!

  const raw = orgUnitCopy.rows
    .filter((row) => value(orgUnitCopy, row, 'version_id') === SOURCE_VERSION)
    .map((row) => {
      const [latitude, longitude] = pointCoordinates(value(orgUnitCopy, row, 'location'))
      return {
        id: Number(value(orgUnitCopy, row, 'id')),
        name: value(orgUnitCopy, row, 'name')!,
        parentId: value(orgUnitCopy, row, 'parent_id')
          ? Number(value(orgUnitCopy, row, 'parent_id'))
          : null,
        latitude,
        longitude,
        geometry: toGeoJson(value(orgUnitCopy, row, 'simplified_geom')),
      }
    })

  // Level and path come from depth in the parent chain. IASO's org unit type is
  // unreliable here: 71 facilities and the country itself are typed 'Unknown'.
  const byId = new Map(raw.map((unit) => [unit.id, unit]))
  const pathOf = new Map<number, number[]>()
  const ancestry = (id: number): number[] => {
    const cached = pathOf.get(id)
    if (cached) return cached
    const unit = byId.get(id)!
    const chain = unit.parentId === null ? [id] : [...ancestry(unit.parentId), id]
    pathOf.set(id, chain)
    return chain
  }

  const orgUnits = raw.map((unit) => {
    const chain = ancestry(unit.id)
    return {
      id: unit.id,
      name: unit.name,
      parentId: unit.parentId,
      level: chain.length,
      path: chain.join('.'),
      latitude: unit.latitude,
      longitude: unit.longitude,
      geometry: unit.geometry,
    }
  })

  // Anonymise: keep the id so foreign keys still line up, drop everything else.
  const users = userCopy.rows
    .map((row) => Number(value(userCopy, row, 'id')))
    .sort((a, b) => a - b)
    .map((id, index) => ({ id, username: `user_${String(index + 1).padStart(3, '0')}` }))

  writeFileSync('data/org-units.json', JSON.stringify(orgUnits) + '\n')
  writeFileSync('data/users.json', JSON.stringify(users, null, 2) + '\n')
  console.log(`org units: ${orgUnits.length}, users: ${users.length}`)
}

main()
```

- [ ] **Step 4: Run the extraction**

```bash
unzip -o ~/Downloads/devcoda2_dump_25042023.sql.zip -d "$TMPDIR/dump"
pnpm tsx scripts/extract-dump.ts "$TMPDIR/dump/devcoda2_dump_25042023.sql"
```

Expected: `org units: 1332, users: 41`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test data/data.test.ts`
Expected: PASS.

If the level counts differ, the depth classification is wrong — fix `ancestry`, not the test. The spec fixes these numbers at 1 / 9 / 152 / 1170.

- [ ] **Step 6: Check the committed size**

```bash
du -h data/org-units.json
```

Expected: under 3 MB. If larger, raise `SIMPLIFY_TOLERANCE` to `0.002` and re-run steps 4 and 5.

- [ ] **Step 7: Verify no PII leaked**

```bash
grep -ci -E "@|pbkdf2|password" data/users.json data/org-units.json
```

Expected: `0` for `users.json`. `org-units.json` may legitimately match nothing; any hit means an unexpected column was carried over.

- [ ] **Step 8: Commit**

```bash
git add scripts/extract-dump.ts data/
git commit -m "Extract anonymised IASO reference data from the development dump"
```

---

### Task 3: Database layer and schema

**Files:**
- Create: `src/server/db/types.ts`, `src/server/db/index.ts`, `src/server/db/migrations/001-initial-schema.ts`, `scripts/migrate.ts`, `.env.example`
- Test: `src/server/db/migrations.test.ts` — **not** inside `migrations/`, which `FileMigrationProvider` reads wholesale

**Interfaces:**
- Consumes: `DATABASE_URL`, `TEST_DATABASE_URL`.
- Produces:
  - `createDb(connectionString?: string): Kysely<Database>` from `~/server/db`
  - `testDb(): Kysely<Database>` from `~/server/db`, bound to `TEST_DATABASE_URL`
  - the `Database` interface with tables `org_unit`, `app_user`, `device`, `device_sync`

- [ ] **Step 1: Write the Kysely types**

Create `src/server/db/types.ts`:

```ts
import type { Generated, JSONColumnType } from 'kysely'

export interface OrgUnitTable {
  id: number
  name: string
  parent_id: number | null
  level: number
  path: string
  latitude: number | null
  longitude: number | null
  geometry: JSONColumnType<GeoJSON.MultiPolygon | null>
}

export interface AppUserTable {
  id: number
  username: string
}

export interface DeviceTable {
  id: number
  serial: string
  org_unit_id: number
}

export interface DeviceSyncTable {
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
```

`JSONColumnType<T>` reads as `T` and is written as a JSON string, which is why
the seed stringifies `geometry` on insert.

- [ ] **Step 2: Write the connection factory**

Create `src/server/db/index.ts`:

```ts
import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'
import type { Database } from './types'

export type { Database } from './types'

export function createDb(connectionString = process.env.DATABASE_URL): Kysely<Database> {
  if (!connectionString) throw new Error('DATABASE_URL is not set')
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString, max: 5 }) }),
  })
}

export function testDb(): Kysely<Database> {
  const url = process.env.TEST_DATABASE_URL
  if (!url) throw new Error('TEST_DATABASE_URL is not set')
  return createDb(url)
}
```

- [ ] **Step 3: Write the migration**

Create `src/server/db/migrations/001-initial-schema.ts`:

```ts
import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('org_unit')
    .addColumn('id', 'integer', (c) => c.primaryKey())
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('parent_id', 'integer', (c) => c.references('org_unit.id'))
    .addColumn('level', 'smallint', (c) => c.notNull())
    .addColumn('path', 'text', (c) => c.notNull())
    .addColumn('latitude', 'double precision')
    .addColumn('longitude', 'double precision')
    .addColumn('geometry', 'jsonb')
    .execute()

  await db.schema.createIndex('org_unit_path_idx').on('org_unit').column('path').execute()

  await db.schema
    .createTable('app_user')
    .addColumn('id', 'integer', (c) => c.primaryKey())
    .addColumn('username', 'text', (c) => c.notNull().unique())
    .execute()

  await db.schema
    .createTable('device')
    .addColumn('id', 'integer', (c) => c.primaryKey())
    .addColumn('serial', 'text', (c) => c.notNull().unique())
    .addColumn('org_unit_id', 'integer', (c) => c.notNull().references('org_unit.id'))
    .execute()

  await db.schema
    .createIndex('device_org_unit_idx')
    .on('device')
    .column('org_unit_id')
    .execute()

  await db.schema
    .createTable('device_sync')
    .addColumn('id', 'integer', (c) => c.primaryKey().generatedAlwaysAsIdentity())
    .addColumn('device_id', 'integer', (c) => c.notNull().references('device.id'))
    .addColumn('user_id', 'integer', (c) => c.notNull().references('app_user.id'))
    .addColumn('synced_at', 'timestamptz', (c) => c.notNull())
    .addColumn('submission_count', 'integer', (c) => c.notNull())
    .addColumn('org_unit_count', 'integer', (c) => c.notNull())
    .addColumn('entity_count', 'integer', (c) => c.notNull())
    .execute()

  await sql`create index device_sync_device_synced_idx
            on device_sync (device_id, synced_at desc)`.execute(db)
  await sql`create index device_sync_synced_idx on device_sync (synced_at desc)`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('device_sync').execute()
  await db.schema.dropTable('device').execute()
  await db.schema.dropTable('app_user').execute()
  await db.schema.dropTable('org_unit').execute()
}
```

- [ ] **Step 4: Write the migration runner**

Create `scripts/migrate.ts`:

```ts
import 'dotenv/config'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { FileMigrationProvider, Migrator } from 'kysely'
import { createDb } from '../src/server/db'

const target = process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL

async function main() {
  const db = createDb(target)
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.resolve('src/server/db/migrations'),
    }),
  })

  const { error, results } = await migrator.migrateToLatest()
  for (const result of results ?? []) {
    console.log(`${result.status}: ${result.migrationName}`)
  }
  await db.destroy()
  if (error) {
    console.error(error)
    process.exit(1)
  }
}

main()
```

`FileMigrationProvider` reads `.ts` files, so `migrations.test.ts` must not live in that folder. Put it one level up.

- [ ] **Step 5: Write the failing schema test**

Create `src/server/db/migrations.test.ts`:

```ts
import { afterAll, describe, expect, it } from 'vitest'
import { sql } from 'kysely'
import { testDb } from '~/server/db'

const db = testDb()
afterAll(() => db.destroy())

const columnsOf = async (table: string) => {
  const { rows } = await sql<{ column_name: string }>`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = ${table}
  `.execute(db)
  return rows.map((r) => r.column_name).sort()
}

describe('schema', () => {
  it('creates device_sync with the fields the use case needs', async () => {
    expect(await columnsOf('device_sync')).toEqual([
      'device_id', 'entity_count', 'id', 'org_unit_count',
      'submission_count', 'synced_at', 'user_id',
    ])
  })

  it('stores geometry as jsonb, not PostGIS', async () => {
    const { rows } = await sql<{ data_type: string }>`
      select data_type from information_schema.columns
      where table_name = 'org_unit' and column_name = 'geometry'
    `.execute(db)
    expect(rows[0].data_type).toBe('jsonb')
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm test src/server/db/migrations.test.ts`
Expected: FAIL — the columns query returns an empty array.

- [ ] **Step 7: Migrate both databases**

```bash
pnpm db:migrate
TARGET_DATABASE_URL="$TEST_DATABASE_URL" pnpm db:migrate
```

Expected: `Success: 001-initial-schema` twice.

- [ ] **Step 8: Run the test to verify it passes**

Run: `pnpm test src/server/db/migrations.test.ts`
Expected: PASS.

- [ ] **Step 9: Write `.env.example`**

```
# Neon connection string for the application
DATABASE_URL=postgres://user:password@host.neon.tech/wee_app?sslmode=require

# A separate Neon branch used by `pnpm test`
TEST_DATABASE_URL=postgres://user:password@host.neon.tech/wee_app_test?sslmode=require
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Add the Kysely database layer and the initial schema"
```

---

### Task 4: Deterministic seed

**Files:**
- Create: `src/server/db/seed/generate.ts`, `scripts/seed.ts`
- Test: `src/server/db/seed/generate.test.ts`, `src/server/db/seed/seeded-database.test.ts`

**Interfaces:**
- Consumes: `data/org-units.json`, `data/users.json`, `Database` from Task 3.
- Produces:

```ts
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

export function generateSeedData(input: {
  orgUnits: { id: number; level: number; path: string }[]
  userIds: number[]
  now: Date
}): SeedData
```

- [ ] **Step 1: Write the failing generator test**

Create `src/server/db/seed/generate.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import orgUnits from '../../../../data/org-units.json' with { type: 'json' }
import users from '../../../../data/users.json' with { type: 'json' }
import { generateSeedData } from './generate'

const NOW = new Date('2026-09-13T12:00:00Z')
const input = {
  orgUnits,
  userIds: users.map((u) => u.id),
  now: NOW,
}

const districtOf = (path: string) => Number(path.split('.')[1])
const facilityById = new Map(orgUnits.map((o) => [o.id, o]))

describe('generateSeedData', () => {
  it('is deterministic', () => {
    expect(generateSeedData(input)).toEqual(generateSeedData(input))
  })

  it('creates 200 devices, each attached to a facility', () => {
    const { devices } = generateSeedData(input)
    expect(devices).toHaveLength(200)
    for (const device of devices) {
      expect(facilityById.get(device.org_unit_id)?.level).toBe(4)
    }
  })

  it('gives every device a unique serial', () => {
    const { devices } = generateSeedData(input)
    expect(new Set(devices.map((d) => d.serial)).size).toBe(200)
  })

  it('leaves exactly 12 devices that have never synced', () => {
    const { devices, syncs } = generateSeedData(input)
    const synced = new Set(syncs.map((s) => s.device_id))
    expect(devices.filter((d) => !synced.has(d.id))).toHaveLength(12)
  })

  it('places every device in one of the nine districts', () => {
    const { devices } = generateSeedData(input)
    const districts = new Set(
      devices.map((d) => districtOf(facilityById.get(d.org_unit_id)!.path)),
    )
    expect(districts.size).toBe(9)
  })

  it('keeps every sync inside the last 90 days', () => {
    const { syncs } = generateSeedData(input)
    const earliest = new Date(NOW.getTime() - 90 * 86_400_000)
    for (const sync of syncs) {
      expect(sync.synced_at.getTime()).toBeGreaterThanOrEqual(earliest.getTime())
      expect(sync.synced_at.getTime()).toBeLessThanOrEqual(NOW.getTime())
    }
  })

  it('leaves at least three districts healthy and at least two behind', () => {
    const { devices, syncs } = generateSeedData(input)
    const deviceDistrict = new Map(
      devices.map((d) => [d.id, districtOf(facilityById.get(d.org_unit_id)!.path)]),
    )
    const latest = new Map<number, number>()
    for (const sync of syncs) {
      const district = deviceDistrict.get(sync.device_id)!
      latest.set(district, Math.max(latest.get(district) ?? 0, sync.synced_at.getTime()))
    }
    const ageDays = [...latest.values()].map((t) => (NOW.getTime() - t) / 86_400_000)
    expect(ageDays.filter((d) => d < 2).length).toBeGreaterThanOrEqual(3)
    expect(ageDays.filter((d) => d > 7).length).toBeGreaterThanOrEqual(2)
  })

  it('only ever references known users', () => {
    const { syncs } = generateSeedData(input)
    const known = new Set(users.map((u) => u.id))
    expect(syncs.every((s) => known.has(s.user_id))).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test src/server/db/seed/generate.test.ts`
Expected: FAIL — `Cannot find module './generate'`.

- [ ] **Step 3: Write the generator**

Create `src/server/db/seed/generate.ts`:

```ts
const SEED = 20260913
const DEVICE_COUNT = 200
const NEVER_SYNCED_COUNT = 12
const WINDOW_DAYS = 90
const DAY_MS = 86_400_000

/** Deterministic PRNG. A dependency-free mulberry32. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Profile = 'healthy' | 'dropped' | 'silent' | 'mixed'

/**
 * District health, assigned by sorted district id so the calibration never moves.
 * Three healthy, two that stopped ten days ago, one nearly silent, three mixed.
 */
const PROFILES: Profile[] = [
  'healthy', 'healthy', 'healthy',
  'dropped', 'dropped',
  'silent',
  'mixed', 'mixed', 'mixed',
]

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

export function generateSeedData(input: {
  orgUnits: { id: number; level: number; path: string }[]
  userIds: number[]
  now: Date
}): SeedData {
  const { orgUnits, userIds, now } = input
  const random = mulberry32(SEED)
  const pick = <T,>(items: T[]): T => items[Math.floor(random() * items.length)]
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1))

  const districtOf = (path: string) => Number(path.split('.')[1])
  const districtIds = [...new Set(orgUnits.filter((o) => o.level === 2).map((o) => o.id))].sort(
    (a, b) => a - b,
  )
  const profileOf = new Map<number, Profile>(
    districtIds.map((id, index) => [id, PROFILES[index % PROFILES.length]]),
  )

  const facilitiesByDistrict = new Map<number, number[]>()
  for (const unit of orgUnits) {
    if (unit.level !== 4) continue
    const district = districtOf(unit.path)
    const list = facilitiesByDistrict.get(district)
    if (list) list.push(unit.id)
    else facilitiesByDistrict.set(district, [unit.id])
  }

  // Every district gets at least one device; the rest are spread round-robin so
  // density varies without leaving a district empty.
  const devices: SeedData['devices'] = []
  const deviceDistrict = new Map<number, number>()
  for (let index = 0; index < DEVICE_COUNT; index++) {
    const district = districtIds[index % districtIds.length]
    const facilities = facilitiesByDistrict.get(district)!
    const id = index + 1
    devices.push({
      id,
      serial: `SL-${String(id).padStart(4, '0')}`,
      org_unit_id: pick(facilities),
    })
    deviceDistrict.set(id, district)
  }

  // The last N devices never sync. Taking them from the tail keeps the choice
  // stable when DEVICE_COUNT changes.
  const silentDevices = new Set(
    devices.slice(DEVICE_COUNT - NEVER_SYNCED_COUNT).map((d) => d.id),
  )

  const syncs: SeedData['syncs'] = []
  for (const device of devices) {
    if (silentDevices.has(device.id)) continue

    const profile = profileOf.get(deviceDistrict.get(device.id)!)!
    const primaryUser = pick(userIds)

    // Each profile is expressed as an interval between syncs and a cut-off, in
    // days before `now`, after which the device goes quiet.
    let intervalMin: number
    let intervalMax: number
    let quietAfterDaysAgo: number
    if (profile === 'healthy') {
      ;[intervalMin, intervalMax, quietAfterDaysAgo] = [1, 3, 0]
    } else if (profile === 'dropped') {
      ;[intervalMin, intervalMax, quietAfterDaysAgo] = [1, 4, 10]
    } else if (profile === 'silent') {
      ;[intervalMin, intervalMax, quietAfterDaysAgo] = [6, 12, 25]
    } else {
      const lagging = random() < 0.3
      ;[intervalMin, intervalMax, quietAfterDaysAgo] = lagging ? [2, 6, 9] : [1, 4, 0]
    }

    let daysAgo = WINDOW_DAYS - between(0, 3)
    while (daysAgo > quietAfterDaysAgo) {
      const hour = between(6, 19)
      const minute = between(0, 59)
      const timestamp = new Date(now.getTime() - daysAgo * DAY_MS)
      timestamp.setUTCHours(hour, minute, 0, 0)
      syncs.push({
        device_id: device.id,
        user_id: random() < 0.8 ? primaryUser : pick(userIds),
        synced_at: timestamp,
        submission_count: between(0, 40),
        org_unit_count: between(0, 5),
        entity_count: between(0, 15),
      })
      daysAgo -= between(intervalMin, intervalMax)
    }
  }

  syncs.sort((a, b) => a.synced_at.getTime() - b.synced_at.getTime())
  return { devices, syncs }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/server/db/seed/generate.test.ts`
Expected: PASS, eight tests.

If the "at least two behind" assertion fails, the `dropped` profile's `quietAfterDaysAgo` is being overridden by a `mixed` district that is fresher. Adjust `PROFILES`, never the test.

- [ ] **Step 5: Write the seed runner**

Create `scripts/seed.ts`:

```ts
import 'dotenv/config'
import orgUnits from '../data/org-units.json' with { type: 'json' }
import users from '../data/users.json' with { type: 'json' }
import { createDb } from '../src/server/db'
import { generateSeedData } from '../src/server/db/seed/generate'

const target = process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL
const CHUNK = 1000

async function main() {
  const db = createDb(target)

  // Truncate rather than drop: the schema belongs to the migration.
  await db.deleteFrom('device_sync').execute()
  await db.deleteFrom('device').execute()
  await db.deleteFrom('app_user').execute()
  await db.deleteFrom('org_unit').execute()

  // Parents before children, so the self-reference holds.
  for (let level = 1; level <= 4; level++) {
    const rows = orgUnits
      .filter((unit) => unit.level === level)
      .map((unit) => ({
        id: unit.id,
        name: unit.name,
        parent_id: unit.parentId,
        level: unit.level,
        path: unit.path,
        latitude: unit.latitude,
        longitude: unit.longitude,
        geometry: unit.geometry === null ? null : JSON.stringify(unit.geometry),
      }))
    for (let i = 0; i < rows.length; i += CHUNK) {
      await db.insertInto('org_unit').values(rows.slice(i, i + CHUNK)).execute()
    }
  }

  await db.insertInto('app_user').values(users).execute()

  const { devices, syncs } = generateSeedData({
    orgUnits,
    userIds: users.map((u) => u.id),
    now: new Date(),
  })

  await db.insertInto('device').values(devices).execute()
  for (let i = 0; i < syncs.length; i += CHUNK) {
    await db.insertInto('device_sync').values(syncs.slice(i, i + CHUNK)).execute()
  }

  console.log(`seeded ${orgUnits.length} org units, ${devices.length} devices, ${syncs.length} syncs`)
  await db.destroy()
}

main()
```

Note the one intentional difference from the generator test: the runner passes `new Date()`, so "ten days behind" stays ten days behind whenever the seed is run. Determinism covers the shape of the data, not the absolute instant.

- [ ] **Step 6: Write the failing seeded-database test**

Create `src/server/db/seed/seeded-database.test.ts`:

```ts
import { afterAll, describe, expect, it } from 'vitest'
import { sql } from 'kysely'
import { testDb } from '~/server/db'

const db = testDb()
afterAll(() => db.destroy())

describe('the seeded database', () => {
  it('holds the full org unit hierarchy', async () => {
    const { rows } = await sql<{ level: number; count: string }>`
      select level, count(*)::text as count from org_unit group by level order by level
    `.execute(db)
    expect(rows).toEqual([
      { level: 1, count: '1' },
      { level: 2, count: '9' },
      { level: 3, count: '152' },
      { level: 4, count: '1170' },
    ])
  })

  it('holds 200 devices and 41 users', async () => {
    const devices = await db
      .selectFrom('device')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow()
    const users = await db
      .selectFrom('app_user')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .executeTakeFirstOrThrow()
    expect(devices.count).toBe('200')
    expect(users.count).toBe('41')
  })

  it('leaves some districts visibly behind', async () => {
    const { rows } = await sql<{ days_behind: number }>`
      select extract(day from now() - max(s.synced_at))::int as days_behind
      from device_sync s
      join device d on d.id = s.device_id
      join org_unit f on f.id = d.org_unit_id
      group by split_part(f.path, '.', 2)
    `.execute(db)
    expect(rows.filter((r) => r.days_behind > 7).length).toBeGreaterThanOrEqual(2)
    expect(rows.filter((r) => r.days_behind < 2).length).toBeGreaterThanOrEqual(3)
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `pnpm test src/server/db/seed`
Expected: the generator tests pass, `seeded-database.test.ts` FAILS — the tables are empty.

- [ ] **Step 8: Seed both databases**

```bash
pnpm db:seed
TARGET_DATABASE_URL="$TEST_DATABASE_URL" pnpm db:seed
```

Expected: `seeded 1332 org units, 200 devices, ~7000 syncs`.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `pnpm test src/server/db`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Add the deterministic device sync seed"
```

---

### Task 5: tRPC wiring and the feature registry

**Files:**
- Create: `src/server/trpc/base.ts`, `src/features/index.ts`, `src/routes/api/trpc/$.ts`, `src/lib/trpc.ts`
- Modify: `src/routes/__root.tsx`

**Interfaces:**
- Consumes: `createDb` from Task 3.
- Produces:
  - `router`, `publicProcedure`, `type Context` from `~/server/trpc/base`
  - `appRouter`, `type AppRouter`, `navItems` from `~/features`
  - `trpc` client hooks from `~/lib/trpc`

- [ ] **Step 1: Write the tRPC base**

Create `src/server/trpc/base.ts`:

```ts
import { initTRPC } from '@trpc/server'
import superjson from 'superjson'
import { createDb, type Database } from '~/server/db'
import type { Kysely } from 'kysely'

export type Context = { db: Kysely<Database> }

let shared: Kysely<Database> | undefined

export function createContext(): Context {
  shared ??= createDb()
  return { db: shared }
}

// superjson keeps Date a Date across the wire. Without it every `syncedAt`
// arrives as a string while TypeScript still claims it is a Date.
const t = initTRPC.context<Context>().create({ transformer: superjson })

export const router = t.router
export const publicProcedure = t.procedure
```

- [ ] **Step 2: Write the registry with no features yet**

Create `src/features/index.ts`:

```ts
import { router } from '~/server/trpc/base'

/**
 * The only file a feature slice touches outside its own folder.
 * Adding a slice means adding one router entry and one nav item here.
 *
 * The router is composed explicitly rather than collected from a glob: building
 * it from an array erases tRPC's end-to-end type inference, which is the whole
 * reason for using tRPC. See docs/adr/0005.
 */
export const appRouter = router({})

export type AppRouter = typeof appRouter

export const navItems: { label: string; to: string }[] = []
```

- [ ] **Step 3: Mount tRPC on a splat server route**

Create `src/routes/api/trpc/$.ts`:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '~/features'
import { createContext } from '~/server/trpc/base'

const handle = ({ request }: { request: Request }) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    router: appRouter,
    createContext,
  })

export const Route = createFileRoute('/api/trpc/$')({
  server: { handlers: { GET: handle, POST: handle } },
})
```

- [ ] **Step 4: Write the client**

Create `src/lib/trpc.ts`:

```ts
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import { QueryClient } from '@tanstack/react-query'
import superjson from 'superjson'
import type { AppRouter } from '~/features'

export const queryClient = new QueryClient()

const client = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: '/api/trpc', transformer: superjson })],
})

export const trpc = createTRPCOptionsProxy<AppRouter>({ client, queryClient })
```

- [ ] **Step 5: Verify it type-checks and serves**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

Run: `pnpm dev`, then in another shell:

```bash
curl -s 'http://localhost:3000/api/trpc/nothing' | head -c 200
```

Expected: a tRPC JSON error naming the missing procedure — which proves the handler is mounted. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Wire tRPC through a splat server route and add the feature registry"
```

---

### Task 6: `device-syncs` queries

**Files:**
- Create: `src/features/device-syncs/api/queries.ts`
- Test: `src/features/device-syncs/api/queries.test.ts`

**Interfaces:**
- Consumes: `Database` from Task 3, the seeded test database from Task 4.
- Produces:

```ts
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

export function listRecentSyncs(
  db: Kysely<Database>,
  params: { limit: number },
): Promise<RecentSync[]>
```

- [ ] **Step 1: Write the failing test**

Create `src/features/device-syncs/api/queries.test.ts`:

```ts
import { afterAll, describe, expect, it } from 'vitest'
import { testDb } from '~/server/db'
import { listRecentSyncs } from './queries'

const db = testDb()
afterAll(() => db.destroy())

describe('listRecentSyncs', () => {
  it('returns at most the requested number of rows', async () => {
    expect(await listRecentSyncs(db, { limit: 25 })).toHaveLength(25)
  })

  it('returns the most recent syncs first', async () => {
    const rows = await listRecentSyncs(db, { limit: 50 })
    const times = rows.map((row) => row.syncedAt.getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  it('resolves the device, the user, the facility and its district', async () => {
    const [row] = await listRecentSyncs(db, { limit: 1 })
    expect(row.deviceSerial).toMatch(/^SL-\d{4}$/)
    expect(row.username).toMatch(/^user_\d{3}$/)
    expect(row.facilityName.length).toBeGreaterThan(0)
    expect(row.districtName.length).toBeGreaterThan(0)
  })

  it('names a district that really is a level 2 org unit', async () => {
    const rows = await listRecentSyncs(db, { limit: 50 })
    const districts = await db
      .selectFrom('org_unit')
      .select('name')
      .where('level', '=', 2)
      .execute()
    const known = new Set(districts.map((d) => d.name))
    for (const row of rows) expect(known.has(row.districtName)).toBe(true)
  })

  it('carries the three sync counters', async () => {
    const [row] = await listRecentSyncs(db, { limit: 1 })
    expect(row.submissionCount).toBeGreaterThanOrEqual(0)
    expect(row.orgUnitCount).toBeGreaterThanOrEqual(0)
    expect(row.entityCount).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test src/features/device-syncs`
Expected: FAIL — `Cannot find module './queries'`.

- [ ] **Step 3: Write the query**

Create `src/features/device-syncs/api/queries.ts`:

```ts
import { sql, type Kysely } from 'kysely'
import type { Database } from '~/server/db'

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
 * The district is the level 2 ancestor of the facility the device is attached
 * to. `org_unit.path` holds the dot-joined ancestor ids, so the second segment
 * is the district id — no recursive CTE needed.
 */
export async function listRecentSyncs(
  db: Kysely<Database>,
  params: { limit: number },
): Promise<RecentSync[]> {
  const rows = await db
    .selectFrom('device_sync as s')
    .innerJoin('device as d', 'd.id', 's.device_id')
    .innerJoin('app_user as u', 'u.id', 's.user_id')
    .innerJoin('org_unit as f', 'f.id', 'd.org_unit_id')
    .innerJoin('org_unit as district', (join) =>
      join.on(
        'district.id',
        '=',
        sql<number>`split_part(f.path, '.', 2)::int`,
      ),
    )
    .select([
      's.id as id',
      'd.serial as deviceSerial',
      'u.username as username',
      'f.name as facilityName',
      'district.name as districtName',
      's.synced_at as syncedAt',
      's.submission_count as submissionCount',
      's.org_unit_count as orgUnitCount',
      's.entity_count as entityCount',
    ])
    .orderBy('s.synced_at', 'desc')
    .limit(params.limit)
    .execute()

  return rows
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/features/device-syncs`
Expected: PASS, five tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add the recent device syncs query"
```

---

### Task 7: `device-syncs` tRPC router and registration

**Files:**
- Create: `src/features/device-syncs/api/router.ts`
- Modify: `src/features/index.ts`

**Interfaces:**
- Consumes: `listRecentSyncs` from Task 6, `router`/`publicProcedure` from Task 5.
- Produces: `deviceSyncsRouter` with a `list` query taking `{ limit?: number }`; `appRouter.deviceSyncs.list`; a `Syncs` nav item pointing at `/syncs`.

- [ ] **Step 1: Write the router**

Create `src/features/device-syncs/api/router.ts`:

```ts
import { z } from 'zod'
import { publicProcedure, router } from '~/server/trpc/base'
import { listRecentSyncs } from './queries'

export const deviceSyncsRouter = router({
  list: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
    .query(({ ctx, input }) => listRecentSyncs(ctx.db, { limit: input.limit })),
})
```

- [ ] **Step 2: Register it**

Replace the body of `src/features/index.ts`:

```ts
import { router } from '~/server/trpc/base'
import { deviceSyncsRouter } from './device-syncs/api/router'

/**
 * The only file a feature slice touches outside its own folder.
 * Adding a slice means adding one router entry and one nav item here.
 *
 * The router is composed explicitly rather than collected from a glob: building
 * it from an array erases tRPC's end-to-end type inference, which is the whole
 * reason for using tRPC. See docs/adr/0005.
 */
export const appRouter = router({
  deviceSyncs: deviceSyncsRouter,
})

export type AppRouter = typeof appRouter

export const navItems: { label: string; to: string }[] = [
  { label: 'Syncs', to: '/syncs' },
]
```

- [ ] **Step 3: Verify the procedure answers**

Run: `pnpm dev`, then:

```bash
curl -s 'http://localhost:3000/api/trpc/deviceSyncs.list?input=%7B%22limit%22%3A2%7D' | head -c 400
```

Expected: JSON containing two syncs with `deviceSerial` and `districtName`. Stop the server.

- [ ] **Step 4: Type-check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Expose recent device syncs over tRPC"
```

---

### Task 8: Application shell and the syncs page

**Files:**
- Create: `src/ui/theme.ts`, `src/ui/AppShell.tsx`, `src/features/device-syncs/ui/SyncTable.tsx`, `src/features/device-syncs/ui/SyncsPage.tsx`, `src/routes/syncs.tsx`
- Modify: `src/routes/__root.tsx`, `src/routes/index.tsx`

**Interfaces:**
- Consumes: `navItems` and `trpc` from Tasks 5 and 7.
- Produces: `/syncs` rendering the table inside the shell; `/` redirecting to `/syncs`.

- [ ] **Step 1: Write the theme**

Create `src/ui/theme.ts`:

```ts
import { createTheme } from '@mantine/core'

export const theme = createTheme({
  primaryColor: 'blue',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
})
```

- [ ] **Step 2: Write the shell**

Create `src/ui/AppShell.tsx`:

```tsx
import { AppShell as MantineAppShell, Group, NavLink, Title } from '@mantine/core'
import { Link, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { navItems } from '~/features'

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <MantineAppShell header={{ height: 56 }} navbar={{ width: 200, breakpoint: 'sm' }} padding="md">
      <MantineAppShell.Header>
        <Group h="100%" px="md">
          <Title order={4}>Device Sync Dashboard</Title>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p="xs">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            component={Link}
            to={item.to}
            label={item.label}
            active={pathname === item.to}
          />
        ))}
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>{children}</MantineAppShell.Main>
    </MantineAppShell>
  )
}
```

- [ ] **Step 3: Wire the root route**

Rewrite `src/routes/__root.tsx`, keeping whatever `HeadContent`/`Scripts` shape `create-start-app` generated and adding the providers:

```tsx
import { MantineProvider } from '@mantine/core'
import { QueryClientProvider } from '@tanstack/react-query'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { AppShell } from '~/ui/AppShell'
import { theme } from '~/ui/theme'
import { queryClient } from '~/lib/trpc'
import '@mantine/core/styles.css'

export const Route = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>
        <AppShell>
          <Outlet />
        </AppShell>
      </MantineProvider>
    </QueryClientProvider>
  ),
})
```

- [ ] **Step 4: Write the table**

Create `src/features/device-syncs/ui/SyncTable.tsx`:

```tsx
import { Table, Text } from '@mantine/core'
import type { RecentSync } from '../api/queries'

const relativeDays = (date: Date) => {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export function SyncTable({ syncs }: { syncs: RecentSync[] }) {
  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Device</Table.Th>
          <Table.Th>User</Table.Th>
          <Table.Th>Facility</Table.Th>
          <Table.Th>District</Table.Th>
          <Table.Th>Last sync</Table.Th>
          <Table.Th>Submissions</Table.Th>
          <Table.Th>Org units</Table.Th>
          <Table.Th>Entities</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {syncs.map((sync) => (
          <Table.Tr key={sync.id}>
            <Table.Td>{sync.deviceSerial}</Table.Td>
            <Table.Td>{sync.username}</Table.Td>
            <Table.Td>{sync.facilityName}</Table.Td>
            <Table.Td>{sync.districtName}</Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed">
                {relativeDays(sync.syncedAt)}
              </Text>
            </Table.Td>
            <Table.Td>{sync.submissionCount}</Table.Td>
            <Table.Td>{sync.orgUnitCount}</Table.Td>
            <Table.Td>{sync.entityCount}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
```

- [ ] **Step 5: Write the page**

Create `src/features/device-syncs/ui/SyncsPage.tsx`:

```tsx
import { Alert, Loader, Stack, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '~/lib/trpc'
import { SyncTable } from './SyncTable'

export function SyncsPage() {
  const { data, isPending, error } = useQuery(
    trpc.deviceSyncs.list.queryOptions({ limit: 50 }),
  )

  return (
    <Stack>
      <Title order={3}>Recent syncs</Title>
      {isPending && <Loader />}
      {error && <Alert color="red">{error.message}</Alert>}
      {data && <SyncTable syncs={data} />}
    </Stack>
  )
}
```

- [ ] **Step 6: Write the routes**

Create `src/routes/syncs.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { SyncsPage } from '~/features/device-syncs/ui/SyncsPage'

export const Route = createFileRoute('/syncs')({ component: SyncsPage })
```

Rewrite `src/routes/index.tsx`:

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/syncs' })
  },
})
```

- [ ] **Step 7: Verify in the browser**

Run: `pnpm dev` and open `http://localhost:3000`.
Expected: it redirects to `/syncs` and shows 50 rows with device serials, usernames, facilities, districts and relative sync times, inside the shell with a `Syncs` nav item.

- [ ] **Step 8: Type-check, format and test**

```bash
pnpm exec tsc --noEmit
pnpm format
pnpm test
```

Expected: no type errors, formatting applied, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Add the application shell and the recent syncs page"
```

---

### Task 9: Agent configuration

**Files:**
- Create: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.claude/settings.json`, `skills/` (vendored), `skills/project/writing-adrs/SKILL.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: the rules every later ticket is executed under.

- [ ] **Step 1: Vendor Superpowers**

```bash
cp -R /Users/pilou/.claude/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills ./skills
rm -rf skills/writing-skills
echo "Superpowers 6.3.0, vendored from https://github.com/obra/superpowers" > skills/VERSION
```

`writing-skills` is dropped: nobody authors new skills during the workshop, and it is the largest directory.

- [ ] **Step 2: Write `AGENTS.md`**

```md
# wee-app

IASO device-sync dashboard. TanStack Start + Mantine + tRPC + Kysely on Neon.

## Rules

- Everything in this repository is in English: code, comments, docs, commits, PRs.
- Read `skills/using-superpowers/SKILL.md` first. Skills are mandatory, not advisory.
- Before brainstorming, read every file in `docs/adr/`.
- After implementing a plan, propose ADR additions or updates.
  See `skills/project/writing-adrs/SKILL.md`.
- Offer the brainstorming visual companion for any layout, map or data-shape
  question. Do not wait to be asked.
- Work in a git worktree, open a pull request. Never commit to `main`.
- A feature lives in `src/features/<name>/` and registers itself in
  `src/features/index.ts` — nowhere else.
- Tests are vitest against the seeded database. `api/queries.ts` is pure and is
  what you test.
- No linter, no e2e framework, no auth, no CI. Those are backlog tickets, not
  missing pieces to fix in passing.

## Pace

This repository is used in a three-hour workshop. No step of the loop is
skipped; every step is short.

- Ask clarifying questions in one batch of at most three, never one per message.
- A spec is half a page: purpose, shape of the query or component, acceptance
  criteria, what is out of scope.
- A plan is one page of steps, not prose.
- Do not use `subagent-driven-development`. Implement directly.
- One round of review, not several.

## Commands

`pnpm dev` · `pnpm test` · `pnpm db:migrate` · `pnpm db:seed` · `pnpm format`
```

- [ ] **Step 3: Write the pointer files**

`CLAUDE.md`:

```md
@AGENTS.md
```

`GEMINI.md`:

```md
@AGENTS.md
```

- [ ] **Step 4: Write `.claude/settings.json`**

```json
{
  "includeCoAuthoredBy": false
}
```

- [ ] **Step 5: Write the project ADR skill**

Create `skills/project/writing-adrs/SKILL.md`:

```md
---
name: writing-adrs
description: Use when a decision changes how wee-app is built, or after implementing a plan, to record or update an architecture decision record
---

# Writing ADRs

Decisions live in `docs/adr/`, numbered `NNNN-kebab-title.md`.

## When to write one

- A choice that a future reader would otherwise have to reverse-engineer.
- A choice that was contested, or that rules an obvious alternative out.
- A choice that a later ticket is expected to revisit.

Do not write one for a decision the code already states plainly.

## When to update one

After implementing a plan, check `docs/adr/` and ask:

1. Did this work contradict an existing ADR? Supersede it — add a new ADR and
   set the old one's status to `Superseded by NNNN`. Never edit the decision of
   an accepted ADR in place.
2. Did this work make a decision no ADR covers? Propose a new one.
3. Did this work confirm a `Proposed` ADR? Move it to `Accepted`.

Propose the change; the human decides.

## Format

    # NNNN. Title

    **Status:** Proposed | Accepted | Superseded by NNNN
    **Date:** YYYY-MM-DD

    ## Context
    What forced a decision. One paragraph.

    ## Decision
    What we chose, in the active voice. One paragraph.

    ## Consequences
    What this makes easy, what it makes hard, and what would make us revisit it.

Keep an ADR under a page. If it needs more, it is a spec, not an ADR.
```

- [ ] **Step 6: Verify the vendored companion works from the repo**

```bash
ls skills/brainstorming/scripts/start-server.sh
ls skills/using-superpowers/SKILL.md
```

Expected: both exist, so a fresh clone has the visual companion with no install step.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add agent configuration and vendor Superpowers 6.3.0"
```

---

### Task 10: Initial ADRs

**Files:**
- Create: `docs/adr/0000-template.md` and `docs/adr/0001`…`0009`

**Interfaces:**
- Consumes: the format from Task 9.
- Produces: what rule 1 of `AGENTS.md` tells every agent to read before brainstorming.

- [ ] **Step 1: Write the template**

`docs/adr/0000-template.md`, matching the format in the skill exactly.

- [ ] **Step 2: Write the nine ADRs**

Each is under a page, dated `2026-09-13`, status `Accepted`, with Context / Decision / Consequences. Content is fixed by the spec:

| File | Decision, and the point each must make |
| --- | --- |
| `0001-record-architecture-decisions.md` | We keep ADRs in `docs/adr/`. Agents read them before brainstorming and propose updates after implementing. |
| `0002-full-stack-typescript.md` | TanStack Start over React plus a Python backend. Participants know Python better, but one language, one deploy and one type chain is what fits a three-hour workshop. Consequence: the team's Python strength is unused. |
| `0003-trpc-and-kysely-over-an-orm.md` | tRPC for end-to-end types, Kysely for SQL that stays visible. No ORM: the workshop is partly about writing queries you can reason about. Types are hand-written; codegen would need a reachable database at build time. |
| `0004-neon-and-vercel.md` | Chosen **for per-pull-request preview environments** — that is the criterion that ruled out deploying as an OpenHEXA web app. Consequence: two more external accounts, and a CTO who is unenthusiastic about Vercel. Revisit when preview environments exist elsewhere. |
| `0005-explicit-feature-registry.md` | `src/features/index.ts` lists slices explicitly. Globbing would remove the merge conflict, but composing a tRPC router from an array erases end-to-end inference. The conflict is one line and is worth discussing. |
| `0006-synthetic-seed-without-pii.md` | Real Sierra Leone geography from an IASO dump; device and sync data generated with a fixed-seed PRNG. Users keep their id and nothing else. Consequence: determinism is load-bearing — the tests depend on it. |
| `0007-geojson-in-jsonb.md` | Geometry is GeoJSON in `jsonb`, not PostGIS. MapLibre consumes it directly and Neon needs no extension. Consequence: no spatial queries. Revisit if a ticket needs `ST_Contains`. |
| `0008-no-authentication-yet.md` | Deliberately deferred, dated, and pointing at backlog ticket 6 (better-auth for Bluesquare accounts). Consequence: the app must not be deployed with real data until this is closed. |
| `0009-workshop-pace-budget.md` | `AGENTS.md` carries a `## Pace` section capping questions, artefact length and review rounds. **It must never make a step optional** — the brainstorm, the failing test and the ADR proposal always happen. Temporary: delete the section when the repository outlives the workshop. |

Worked example — `docs/adr/0005-explicit-feature-registry.md`, written in full so
the other eight have an unambiguous target for length and tone:

```md
# 0005. Explicit feature registry

**Status:** Accepted
**Date:** 2026-09-13

## Context

Four to six pairs work on this repository at the same time, each building a
feature slice under `src/features/<name>/`. Every slice has to publish two
things to the shell: a tRPC router and a navigation entry. Whatever mechanism
we choose becomes the one place where parallel work can collide.

Collecting slices automatically with `import.meta.glob` would remove the
collision entirely — a pair creates a folder and its page appears.

## Decision

We list slices explicitly in `src/features/index.ts`. Adding a slice means
adding one router entry and one nav item to that file.

The decisive argument is not taste. Composing a tRPC router from a
dynamically-built array collapses its type to a union or to `any`, which
destroys the end-to-end inference that is the entire reason for choosing tRPC
over a REST handler. Automatic discovery would buy conflict-free merges at the
cost of the property the stack was picked for.

## Consequences

Every pull request that adds a slice touches `src/features/index.ts`, so
concurrent slices produce a merge conflict there. The conflict is two adjacent
lines and resolving it is mechanical.

Reading `src/features/index.ts` tells you every feature the application has,
which is worth something on its own.

If a future refactor makes type-safe dynamic composition possible, this
decision should be revisited.
```

- [ ] **Step 3: Verify**

```bash
ls docs/adr/ | wc -l
grep -L "^## Consequences" docs/adr/0*.md
```

Expected: 10 files; the second command prints nothing.

- [ ] **Step 4: Commit**

```bash
git add docs/adr
git commit -m "Record the initial architecture decisions"
```

---

### Task 11: README, backlog and deployment configuration

**Files:**
- Create: `README.md`, `BACKLOG.md`, `vercel.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: everything above.
- Produces: the repository a participant clones.

- [ ] **Step 1: Write `README.md`**

Sections, in this order:

1. **What this is** — a device-sync dashboard for IASO, and the starter for a spec-driven-development workshop.
2. **Setup** — clone, `pnpm install`, copy `.env.example` to `.env`.
3. **Database** — create a Neon project; create a second branch for tests; put both connection strings in `.env`; run `pnpm db:migrate` then `pnpm db:seed` against each. Spell out the `TARGET_DATABASE_URL="$TEST_DATABASE_URL"` form for the test branch.
4. **Running** — `pnpm dev`, `pnpm test`, `pnpm format`.
5. **How the code is organised** — the feature slice anatomy, and the rule that `src/features/index.ts` is the only shared file. Point at `src/features/device-syncs/` as the pattern to copy.
6. **How we work** — brainstorm, spec, plan, failing test, implementation, worktree, pull request, ADR. Point at `AGENTS.md` and `skills/`.
7. **Deployment** — connect the repository to Vercel, set `DATABASE_URL`, and note that migrations are run by hand, never in the build.
8. **What is deliberately missing** — link to `BACKLOG.md` and say plainly that the gaps are the workshop.

- [ ] **Step 2: Write `BACKLOG.md`**

Eleven tickets. Each has: a title, two or three sentences of context, acceptance criteria as a checklist, a size (S/M/L), and a "touches shared files" note where true, so a pair can see a collision coming.

| # | Title | Size | Notes it must carry |
| --- | --- | --- | --- |
| 1 | Stale devices view with an adjustable threshold | S | Vertical slice. Devices whose last sync is older than N days, N adjustable in the UI. Include devices that never synced — they are the trap. |
| 2 | District coverage map | M | Vertical slice. MapLibre choropleth over `org_unit.geometry` for level 2, coloured by share of devices synced in the last 7 days. |
| 3 | Thirty-day sync trend chart | S | Vertical slice. `@mantine/charts` area chart of syncs and submissions per day. |
| 4 | Device detail page with sync history | S | Vertical slice. Route `/devices/$deviceId`, needs a link from the syncs table. |
| 5 | Per-user activity view | M | Vertical slice. Submissions and syncs per user over a period, sortable. |
| 6 | Authentication for Bluesquare accounts | L | Cross-cutting. better-auth with OAuth. **Revisits ADR 0008 and the read-only assumption in the spec's testing strategy** — auth introduces writes. |
| 7 | End-to-end smoke test, locally and in CI | M | Cross-cutting. Touches `package.json` and adds a workflow. Depends on ticket 8 existing or creating it. |
| 8 | Continuous integration: typecheck and vitest on pull requests | S | Cross-cutting. Needs a `TEST_DATABASE_URL` secret pointing at a Neon branch. |
| 9 | Linting, dead code detection and module boundary rules | M | Cross-cutting. The boundary rule to enforce: nothing outside `src/features/<name>/` may import from inside another feature. |
| 10 | Reproducible development environment for humans and agents | M | Cross-cutting. Node and pnpm versions pinned and enforced; document what an agent needs. |
| 11 | There is no documentation | M | Cross-cutting. Decide what deserves documenting and what the ADRs already cover. |

Add a short header explaining that tickets 1 to 5 are conflict-free vertical slices, that 6 to 11 contend for root configuration, and that the Kanban WIP limit is how that is managed.

- [ ] **Step 3: Write `vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install --frozen-lockfile"
}
```

Do not add a build step that runs migrations.

- [ ] **Step 4: Confirm `.gitignore` is complete**

It must contain at least:

```
node_modules/
.env
.env*.local
.output/
dist/
.vercel/
.superpowers/
.claude/settings.local.json
```

- [ ] **Step 5: Final verification**

```bash
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm test
pnpm format
pnpm build
```

Expected: all succeed. Then `pnpm dev` and confirm `/syncs` still renders.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add the README, the workshop backlog and the Vercel configuration"
```

- [ ] **Step 7: Report what remains manual**

The repository is complete but not pushed and not deployed. Tell the human, in one message:

- `git push -u origin main` is theirs to run.
- The Neon project, the test branch and the Vercel connection are theirs to create; the README has the procedure.
- The local directory is still named `workshop`; renaming it to `wee-app` must happen outside a running session.
