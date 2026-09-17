# Database Environments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the repository one local database that sets itself up on clone, and make every deployment migrate the database it is about to serve.

**Architecture:** A `postgres:17` container holds both the application and test databases. A `postinstall` script copies `.env.example` to `.env` so no one has to. `migrate(url)` and `seed(url)` become functions, so `pnpm db:reset` can migrate and seed both databases in one process. Vercel's build command gains `pnpm db:migrate`, so a preview migrates its own Neon branch and production migrates its own.

**Tech Stack:** Docker Compose, Postgres 17, Kysely migrations, tsx, Node (plain `.mjs` for the bootstrap), Vitest, Vercel, Neon.

**Spec:** `docs/superpowers/specs/2026-09-17-database-environments-design.md`

## Global Constraints

- Everything in the repository is in English: code, comments, docs, commits, PRs.
- No linter, no e2e framework, no auth, no CI workflow. Those remain backlog tickets.
- Local Postgres listens on **55432**, user `postgres`, no password, databases `wee_app` and `wee_app_test`.
- The bootstrap never overwrites an existing `.env`, and does nothing when `CI` or `VERCEL` is set.
- Seeding never runs in a Vercel build. Only migrations do.
- The existing test suite must stay green: 30 tests across 7 files.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `compose.yaml` | The one local Postgres service |
| `docker/init-databases.sh` | Creates `wee_app_test` beside `wee_app` on first start |
| `scripts/postinstall.mjs` | Creates `.env` from `.env.example` when missing; exports `ensureEnvFile` |
| `scripts/postinstall.test.ts` | Tests that bootstrap, in a temporary directory |
| `src/server/db/migrate.ts` | `migrate(url)` — runs Kysely migrations |
| `src/server/db/seed/run.ts` | `seed(url)` — truncates, loads reference data, generates and inserts |
| `scripts/migrate.ts`, `scripts/seed.ts` | Thin CLI callers, keeping `TARGET_DATABASE_URL` |
| `scripts/db-reset.ts` | Migrates then seeds `DATABASE_URL`, then `TEST_DATABASE_URL` |
| `vercel.json` | Build command that migrates before building |
| `.env.example`, `README.md`, `CLAUDE.md`, issue #12 | Documentation and defaults |
| `docs/adr/0012`, `docs/adr/0013` | The two decisions |

---

### Task 1: Local Postgres and the bootstrap

**Files:**

- Create: `compose.yaml`, `docker/init-databases.sh`, `scripts/postinstall.mjs`
- Modify: `.env.example`, `package.json`, `vitest.config.ts`
- Test: `scripts/postinstall.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `ensureEnvFile({ cwd, env }): 'created' | 'exists' | 'skipped'` from `scripts/postinstall.mjs`; a running database on `127.0.0.1:55432` with `wee_app` and `wee_app_test`.

- [ ] **Step 1: Write the failing test**

Create `scripts/postinstall.test.ts`:

```ts
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ensureEnvFile } from './postinstall.mjs'

const workspace = (files: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'wee-app-'))
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content)
  return dir
}

describe('ensureEnvFile', () => {
  it('creates .env from .env.example when it is missing', () => {
    const cwd = workspace({ '.env.example': 'DATABASE_URL=postgres://local\n' })
    expect(ensureEnvFile({ cwd, env: {} })).toBe('created')
    expect(readFileSync(join(cwd, '.env'), 'utf8')).toBe('DATABASE_URL=postgres://local\n')
  })

  it('never overwrites an existing .env', () => {
    const cwd = workspace({ '.env.example': 'DATABASE_URL=example\n', '.env': 'DATABASE_URL=mine\n' })
    expect(ensureEnvFile({ cwd, env: {} })).toBe('exists')
    expect(readFileSync(join(cwd, '.env'), 'utf8')).toBe('DATABASE_URL=mine\n')
  })

  it('does nothing in a build', () => {
    const cwd = workspace({ '.env.example': 'DATABASE_URL=example\n' })
    expect(ensureEnvFile({ cwd, env: { VERCEL: '1' } })).toBe('skipped')
    expect(ensureEnvFile({ cwd, env: { CI: '1' } })).toBe('skipped')
  })
})
```

- [ ] **Step 2: Let vitest see the scripts directory**

In `vitest.config.ts`, change `include` to:

```ts
include: ['src/**/*.test.ts', 'data/**/*.test.ts', 'scripts/**/*.test.ts'],
```

In `tsconfig.json` `compilerOptions`, add `"allowJs": true`. Without it `pnpm exec tsc --noEmit`
cannot resolve the `.mjs` import from the test and fails. The bootstrap stays plain JavaScript on
purpose: it runs before anything is built, in a worktree that may have nothing installed yet, so
depending on `tsx` would be one dependency too many.

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test scripts/postinstall.test.ts`
Expected: FAIL — `Cannot find module './postinstall.mjs'`.

- [ ] **Step 4: Write the bootstrap**

Create `scripts/postinstall.mjs`. Plain Node, no dependency, because it runs before anything is
built and inside every fresh worktree:

```js
import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Copies .env.example to .env unless .env already exists.
 * Returns what it did, so the behaviour is testable.
 */
export function ensureEnvFile({ cwd = process.cwd(), env = process.env } = {}) {
  if (env.CI || env.VERCEL) return 'skipped'
  const target = join(cwd, '.env')
  if (existsSync(target)) return 'exists'
  copyFileSync(join(cwd, '.env.example'), target)
  return 'created'
}

if (import.meta.filename === process.argv[1]) {
  if (ensureEnvFile() === 'created') {
    console.log('Created .env from .env.example. Next: docker compose up -d && pnpm db:reset')
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test scripts/postinstall.test.ts`
Expected: PASS, three tests.

- [ ] **Step 6: Hook it into install**

In `package.json`, add to `scripts`:

```json
"postinstall": "node scripts/postinstall.mjs"
```

- [ ] **Step 7: Write the compose file**

Create `compose.yaml`:

```yaml
services:
  db:
    image: postgres:17
    # 55432, not 5432, so it cannot collide with a Postgres already on the machine.
    ports:
      - '55432:5432'
    environment:
      POSTGRES_USER: postgres
      POSTGRES_DB: wee_app
      # Local only, and it keeps the connection strings free of a password.
      POSTGRES_HOST_AUTH_METHOD: trust
    volumes:
      - db-data:/var/lib/postgresql/data
      - ./docker/init-databases.sh:/docker-entrypoint-initdb.d/init-databases.sh:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres -d wee_app']
      interval: 2s
      timeout: 3s
      retries: 30

volumes:
  db-data:
```

- [ ] **Step 8: Write the init script**

Create `docker/init-databases.sh`, and make it executable with `chmod +x docker/init-databases.sh`:

```sh
#!/bin/sh
# Runs once, on first start of an empty data volume. POSTGRES_DB creates wee_app;
# the test database has to be created here.
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c 'CREATE DATABASE wee_app_test'
```

- [ ] **Step 9: Point `.env.example` at the container**

Replace `.env.example` with:

```
# Local Postgres from compose.yaml. `pnpm install` copies this file to .env.
DATABASE_URL=postgres://postgres@127.0.0.1:55432/wee_app
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:55432/wee_app_test

# In production these come from the Neon integration on Vercel, not from a file.
```

- [ ] **Step 10: Start the database and verify it**

The throwaway cluster built earlier in this repository listens on the same port. Stop it first, or
the container cannot bind:

```bash
pg_ctl -D "$TMPDIR/wee-pg" stop 2>/dev/null || true
docker compose up -d
docker compose ps
psql postgres://postgres@127.0.0.1:55432/postgres -Atc "select datname from pg_database where datname like 'wee%'"
```

Expected: the service is `healthy`, and the query prints `wee_app` and `wee_app_test`.

If Docker is not running, start Docker Desktop first — `docker info` must succeed.

- [ ] **Step 11: Commit**

```bash
chmod +x docker/init-databases.sh
git add compose.yaml docker .env.example scripts/postinstall.mjs scripts/postinstall.test.ts package.json vitest.config.ts
git commit -m "Run local Postgres in Docker and create .env on install"
```

---

### Task 2: One command that migrates and seeds both databases

**Files:**

- Create: `src/server/db/migrate.ts`, `src/server/db/seed/run.ts`, `scripts/db-reset.ts`
- Modify: `scripts/migrate.ts`, `scripts/seed.ts`, `package.json`

**Interfaces:**

- Consumes: `createDb(connectionString)` from `src/server/db/index.ts`; `generateSeedData` from `src/server/db/seed/generate.ts`.
- Produces: `migrate(connectionString: string): Promise<void>` and `seed(connectionString: string): Promise<{ orgUnits: number; devices: number; syncs: number }>`; the `pnpm db:reset` command.

- [ ] **Step 1: Extract the migration runner**

Create `src/server/db/migrate.ts`:

```ts
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { FileMigrationProvider, Migrator } from 'kysely/migration'
import { createDb } from './index.ts'

export async function migrate(connectionString: string): Promise<void> {
  const db = createDb(connectionString)
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
  if (error) throw error
}
```

- [ ] **Step 2: Make `scripts/migrate.ts` a thin caller**

Replace its contents with:

```ts
import { config } from 'dotenv'
import { migrate } from '../src/server/db/migrate.ts'

config({ quiet: true })

// TARGET_DATABASE_URL lets the same command migrate another database.
const url = process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

await migrate(url)
```

- [ ] **Step 3: Extract the seed runner**

Create `src/server/db/seed/run.ts`, moving the body of `scripts/seed.ts` into a function. The
`geometry` column is written as a JSON string, and org units are inserted level by level so the
self-reference always resolves:

```ts
import orgUnits from '../../../../data/org-units.json' with { type: 'json' }
import users from '../../../../data/users.json' with { type: 'json' }
import { createDb } from '../index.ts'
import { generateSeedData } from './generate.ts'

const CHUNK = 1000

export async function seed(
  connectionString: string,
): Promise<{ orgUnits: number; devices: number; syncs: number }> {
  const db = createDb(connectionString)

  // Empty the tables rather than drop them: the schema belongs to the migrations.
  await db.deleteFrom('device_sync').execute()
  await db.deleteFrom('device').execute()
  await db.deleteFrom('app_user').execute()
  await db.deleteFrom('org_unit').execute()

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
      await db
        .insertInto('org_unit')
        .values(rows.slice(i, i + CHUNK))
        .execute()
    }
  }

  await db.insertInto('app_user').values(users).execute()

  // `now` is the real clock: "ten days behind" stays ten days behind whenever this
  // runs. Determinism covers the shape of the data, not the absolute instant.
  const { devices, syncs } = generateSeedData({
    orgUnits,
    userIds: users.map((user) => user.id),
    now: new Date(),
  })

  await db.insertInto('device').values(devices).execute()
  for (let i = 0; i < syncs.length; i += CHUNK) {
    await db
      .insertInto('device_sync')
      .values(syncs.slice(i, i + CHUNK))
      .execute()
  }

  await db.destroy()
  return { orgUnits: orgUnits.length, devices: devices.length, syncs: syncs.length }
}
```

- [ ] **Step 4: Make `scripts/seed.ts` a thin caller**

Replace its contents with:

```ts
import { config } from 'dotenv'
import { seed } from '../src/server/db/seed/run.ts'

config({ quiet: true })

const url = process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

const counts = await seed(url)
console.log(`seeded ${counts.orgUnits} org units, ${counts.devices} devices, ${counts.syncs} syncs`)
```

- [ ] **Step 5: Write the reset script**

Create `scripts/db-reset.ts`:

```ts
import { config } from 'dotenv'
import { migrate } from '../src/server/db/migrate.ts'
import { seed } from '../src/server/db/seed/run.ts'

config({ quiet: true })

const targets = [
  ['application', process.env.DATABASE_URL],
  ['test', process.env.TEST_DATABASE_URL],
] as const

for (const [name, url] of targets) {
  if (!url) throw new Error(`${name} database URL is not set`)
  console.log(`\n== ${name} database ==`)
  await migrate(url)
  const counts = await seed(url)
  console.log(`seeded ${counts.orgUnits} org units, ${counts.devices} devices, ${counts.syncs} syncs`)
}
```

- [ ] **Step 6: Add the command**

In `package.json` `scripts`, after `db:seed`:

```json
"db:reset": "tsx scripts/db-reset.ts"
```

- [ ] **Step 7: Run it against the container**

Run: `pnpm db:reset`
Expected: two blocks, each `Success: 001-initial-schema` then `seeded 1332 org units, 200 devices, ~6000 syncs`.

- [ ] **Step 8: Run the whole suite and type-check**

```bash
pnpm test
pnpm exec tsc --noEmit
```

Expected: 30 tests pass across 7 files — the seeded-database tests now read the container. No type errors.

- [ ] **Step 9: Commit**

```bash
git add src/server/db/migrate.ts src/server/db/seed/run.ts scripts package.json
git commit -m "Add pnpm db:reset, migrating and seeding both databases"
```

---

### Task 3: Migrate on deploy, and document both environments

**Files:**

- Modify: `vercel.json`, `README.md`, `CLAUDE.md`, and issue #12 on GitHub
- Create: `docs/adr/0012-migrate-during-the-deploy-build.md`, `docs/adr/0013-local-postgres-in-docker.md`

**Interfaces:**

- Consumes: `pnpm db:migrate` and `pnpm db:reset` from Task 2.
- Produces: nothing code depends on.

- [ ] **Step 1: Migrate in the build**

In `vercel.json`, change the build command:

```json
"buildCommand": "pnpm db:migrate && pnpm build"
```

- [ ] **Step 2: Verify the build command locally**

Run: `pnpm db:migrate && pnpm build`
Expected: the migration reports nothing to apply, and the build finishes. This is the exact command Vercel will run.

- [ ] **Step 3: Write ADR 0012**

Create `docs/adr/0012-migrate-during-the-deploy-build.md`, status `Accepted`, date `2026-09-17`.

Context: the deployed application failed with `relation "device_sync" does not exist`, because
migrations were a manual step (ADR 0004) run against whatever `DATABASE_URL` sat in a developer's
`.env`.

Decision: Vercel's build command is `pnpm db:migrate && pnpm build`. Neon's Preview Branching
integration gives each preview its own branch and injects its `DATABASE_URL`, so a preview migrates
its own branch and production migrates its own. This is what Neon's documentation recommends.
Seeding stays manual: a Neon branch inherits its parent's data.

Consequences: a failing migration fails the build, so the broken deployment never goes live. The
last consequence of ADR 0004, "migrations are run by hand, never during the build", no longer
holds; the rest of ADR 0004 stands. Migrations now run before the new code is served, so they must
be backward compatible with the code still running — at this size the window is seconds. There is
no rollback path: `down` exists and nothing calls it.

- [ ] **Step 4: Write ADR 0013**

Create `docs/adr/0013-local-postgres-in-docker.md`, status `Accepted`, date `2026-09-17`.

Context: `.env.example` held Neon placeholders, so every developer invented a local database, and
`pnpm db:migrate` silently migrated whichever one they had. Neon Local, Neon's own recommendation,
needs an API key and project id per developer and does not work offline.

Decision: one `postgres:17` container on port 55432 holds `wee_app` and `wee_app_test`.
`pnpm install` copies `.env.example` to `.env` through `scripts/postinstall.mjs`, and
`pnpm db:reset` migrates and seeds both databases.

Consequences: a clone reaches a seeded database in three commands, and a fresh worktree bootstraps
itself because it has no `node_modules`. Docker becomes a prerequisite; any Postgres 14 or later
works instead, since only the connection string matters. Worktrees share one local database, which
is what a workshop wants; a worktree needing isolation changes the port and database name in its
own `.env`. The code uses no Neon-specific feature, so the difference from production is not
exercised.

- [ ] **Step 5: Rewrite the README setup and deployment sections**

The **Setup** section becomes: requirements are Node 22, pnpm 10 and Docker running; then

```bash
pnpm install        # also creates .env from .env.example
docker compose up -d
pnpm db:reset
pnpm dev
```

State that `pnpm db:reset` migrates and seeds both the application and test databases, that the
seed is generated relative to the current date so re-running it refreshes "ten days behind", and
that any Postgres 14 or later works if someone prefers not to use Docker.

The **Deployment** section becomes: install Neon's Preview Branching integration on the Vercel
project so each preview gets its own database branch; the build command
`pnpm db:migrate && pnpm build` migrates the database that deployment will serve; seed production
once by hand with `TARGET_DATABASE_URL="<production url>" pnpm db:seed`; and there is still no
authentication (ADR 0008), so do not deploy real data.

- [ ] **Step 6: Update `CLAUDE.md`**

Add `pnpm db:reset` to the Commands line, and add one rule under `## Rules`:

```md
- In a fresh clone or worktree: `pnpm install && docker compose up -d && pnpm db:reset`.
  `pnpm install` writes `.env` itself; never hand-edit it to point at a deployed database.
```

- [ ] **Step 7: Rewrite issue #12**

Replace the issue with a version that no longer covers the database, sized **S**:

```md
## Pin the toolchain

**Size:** S · **Type:** cross-cutting

Nothing stops two developers, or a developer and an agent, from running different Node or pnpm
versions. The database is no longer a variable (ADR 0013), the toolchain still is.

**Acceptance criteria**

- [ ] The Node and pnpm versions are declared and enforced, so a wrong version fails loudly
      rather than producing a confusing error later.
- [ ] `docker compose up -d` is checked or explained when a database connection fails.
- [ ] `CLAUDE.md` states what an agent needs to run the project.

**Touches shared files:** `package.json`, root configuration, `README.md`, `CLAUDE.md`.
```

- [ ] **Step 8: Verify the documentation matches reality**

```bash
grep -n "db:reset" README.md CLAUDE.md package.json
grep -rn "cp .env.example" README.md || echo "no manual copy left"
pnpm exec prettier --check .
```

Expected: `db:reset` appears in all three, no manual copy instruction survives, formatting is clean.

- [ ] **Step 9: Commit**

```bash
git add vercel.json README.md CLAUDE.md docs/adr
git commit -m "Migrate during the deploy build and document both environments"
```

---

## After the plan

The deployed application still has an empty schema. Once this is merged and deployed, the build
migrates production itself; production then needs its seed once:

```bash
TARGET_DATABASE_URL="<production url>" pnpm db:seed
```
