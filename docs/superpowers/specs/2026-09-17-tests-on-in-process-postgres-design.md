# Run the tests on an in-process Postgres — Design

**Date:** 2026-09-17
**Status:** Approved

## Purpose

The query tests read a shared, seeded Postgres in Docker and assert on the seed's contents. That
works only while the application is read-only, it needs Docker to run `pnpm test`, and a test does
not show the data it depends on. Several workshop issues will write to the database.

## Decision

Tests run on PGlite, a Postgres compiled to WebAssembly that runs inside the test process. Kysely
0.29 ships a `PGliteDialect`, so the only new dependency is `@electric-sql/pglite`, in
`devDependencies`.

- `src/server/db/testing.ts`, imported by tests only:
  - `createTestDb()`: a new in-memory PGlite, migrated with the real migrations, returned as
    `Kysely<Database>`. One per test file, in `beforeAll`.
  - `resetDb(db)`: truncates the four tables and restarts identities. Called in `beforeEach`.
  - `insertOrgUnit`, `insertUser`, `insertDevice`, `insertSync`: each inserts one row, fills
    defaults for the fields the test does not name, and returns the row. `insertFacility` builds the
    four levels a facility needs; it was added after review.
- `migrate(db)` and `seed(db)` take a `Kysely<Database>` instead of a connection string. The scripts
  pass `createDb(url)` and destroy it.
- Each test inserts the rows it needs. No test reads the seed, except one that runs `seed(db)` on
  PGlite and checks the counts, if it runs in under five seconds. Otherwise that test is deleted:
  `generate.test.ts` already covers the generator without a database.
- `prepare.test.ts` keeps only the timeout test, which needs no server.
- `TEST_DATABASE_URL`, `testDb()` and the `wee_app_test` database are removed. Docker serves
  `pnpm dev` only.

Measured in a throwaway probe: a migrated PGlite in about 1.2 s, a truncate in about 3 ms, and
`listRecentSyncs` runs unchanged.

## Acceptance criteria

- [ ] `pnpm test` passes with the Docker container stopped.
- [ ] `queries.test.ts` inserts its own rows, and at least one test writes and reads back.
- [ ] No file mentions `TEST_DATABASE_URL` or `wee_app_test`.
- [ ] `pnpm db:reset`, `pnpm dev`, `tsc` and Prettier still work.
- [ ] `@electric-sql/pglite` is not reachable from the application bundle.
- [ ] ADRs 0003, 0006, 0008 and 0013, `CLAUDE.md` and `README.md` describe the new setup. The ADRs
      are edited in place: the repository is still being scaffolded.

## Out of scope

Changing the development or deployed database. A transaction per test. Testing the tRPC layer or the
UI. The `ensureDatabase` paths that need a running server lose their tests; `pnpm db:reset`
exercises them.

## Risk

PGlite is not the Postgres 17 that Neon runs, and it holds a single connection. A feature PGlite
lacks would show in the preview deployment and not in the tests.
