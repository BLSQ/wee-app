# Tests on an in-process Postgres — Implementation Plan

**Goal:** `pnpm test` runs on PGlite, with no Docker and no seed, and tests may write.

**Spec:** `docs/superpowers/specs/2026-09-17-tests-on-in-process-postgres-design.md`

**Constraints:** one page (ADR 0009). Implemented directly, test first. `@electric-sql/pglite` is a
dev dependency and is imported by `src/server/db/testing.ts` only. Commit after each task.

## Task 1: `createTestDb`, `resetDb` and the factories

Files: create `src/server/db/testing.ts` and `src/server/db/testing.test.ts`; modify
`src/server/db/migrate.ts`, `scripts/migrate.ts`, `scripts/db-reset.ts`, `package.json`.

- [x] `pnpm add -D @electric-sql/pglite`.
- [x] Write `testing.test.ts`, and watch it fail because `./testing` does not exist:
  - `createTestDb()` returns a database with the four tables and no rows;
  - `insertOrgUnit(db, { name: 'Bo', parent: country })` returns a row whose `path` is
    `${country.path}.${id}` and whose `level` is `country.level + 1`;
  - `insertSync(db)` with no arguments inserts the device, user and facility it needs;
  - after `resetDb(db)` every table is empty and a new sync gets id 1.
- [x] `migrate.ts`: `migrate(db: Kysely<Database>): Promise<void>`, which no longer creates or
      destroys the connection. The two scripts pass `createDb(url)` and destroy it.
- [x] `testing.ts`:
  - `createTestDb(): Promise<Kysely<Database>>`: `new PGlite()`, `PGliteDialect`, `migrate(db)`;
  - `resetDb(db)`: `truncate device_sync, device, app_user, org_unit restart identity cascade`;
  - `insertOrgUnit(db, { name?, level?, parent? })`, `insertUser(db, { username? })`,
    `insertDevice(db, { serial?, facility? })`,
    `insertSync(db, { device?, user?, syncedAt?, submissionCount?, orgUnitCount?, entityCount? })`.
    Ids come from a module counter; each returns the inserted row (`returningAll`).
- [x] Tests pass. Commit.

## Task 2: move the database tests to PGlite

Files: `src/features/device-syncs/api/queries.test.ts`, `src/server/db/migrations.test.ts`,
`src/server/db/seed/run.ts`, `src/server/db/seed/seeded-database.test.ts`, `scripts/seed.ts`,
`scripts/db-reset.ts`, `src/server/db/prepare.test.ts`.

- [x] Rewrite `queries.test.ts` with inserted rows: the limit, newest first (two syncs with explicit
      dates), the tie on `synced_at` broken by id, the district resolved from a three-level path,
      the three counters, and a sync inserted after a first read shows up in the second.
- [x] `migrations.test.ts`: `createTestDb()` instead of `testDb()`.
- [x] `seed(db)` takes a `Kysely<Database>`. `seeded-database.test.ts` runs it on PGlite and keeps
      its three assertions. Time it: over five seconds, delete the file instead.
- [x] `prepare.test.ts`: keep the timeout test only.
- [x] Stop the check: `TEST_DATABASE_URL= pnpm test` passes. Commit.

## Task 3: remove the test database

Files: `src/server/db/index.ts`, `scripts/db-reset.ts`, `.env.example`, `vitest.setup.ts`,
`vitest.config.ts`.

- [x] Delete `testDb()`. `db-reset.ts` handles `DATABASE_URL` only. Remove `TEST_DATABASE_URL` from
      `.env.example`. Delete `vitest.setup.ts` and its `setupFiles` entry if no test reads `.env`
      any more.
- [x] `git grep -n "TEST_DATABASE_URL\|wee_app_test\|testDb"` returns only the spec and this plan.
- [x] `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm format`, `pnpm build`; then
      `grep -rl pglite dist/` prints nothing. `pnpm db:reset` works. Commit.

## Task 4: documents

Files: `docs/adr/0003-*.md`, `0006-*.md`, `0008-*.md`, `0013-*.md`, `CLAUDE.md`, `README.md`.

- [x] 0003: queries are tested on an in-process Postgres; name the PGlite and Neon gap.
- [x] 0006: the seed serves `pnpm dev` and the previews; remove "Determinism is load-bearing".
- [x] 0008: remove the paragraph about the read-only assumption.
- [x] 0013: one local database; tests need no Docker; drop the shared test database remarks.
- [x] `CLAUDE.md`: the two test rules. `README.md`: the `db:reset` comment and the test section.
- [ ] Commit, push, open the pull request. Then update the deck on `gh-pages`: the Vitest row and
      the "tests assert against them" speaker note.
