# 0003. tRPC and Kysely instead of an ORM

**Status:** Accepted
**Date:** 2026-09-13

## Context

The dashboard is almost entirely read queries with joins and aggregations over a small schema.
We want those queries to be visible, testable in isolation, and typed end to end.

## Decision

- **tRPC** carries typed procedures from server to client, with `superjson` so a `Date` stays a
  `Date` across the wire.
- **Kysely** builds SQL. There is no ORM.
- The Kysely `Database` interface in `src/server/db/types.ts` is written by hand.

## Consequences

The SQL a query sends is readable in the code that sends it, which is what a reviewer needs to
judge a dashboard query.

Queries are plain functions taking `db`, so a test calls them directly. Tests run them on PGlite, a
Postgres compiled to WebAssembly that lives in the test process, through the `PGliteDialect` that
Kysely ships. Each test file gets an empty, migrated database from `createTestDb()` in
`src/server/db/test-helpers.ts` and inserts the rows it needs, so `pnpm test` needs no server and a test
may write. Mocking `db` was set aside: the logic of a query is its SQL, and a mock would not run it.

PGlite is not the Postgres 17 that Neon runs, and it holds a single connection. A feature PGlite
lacks would show in the preview deployment and not in the tests.

Components are tested without the network. A page fetches with tRPC and passes the data
to components as props, so a component test needs neither the network nor a mock of tRPC: it renders
the component with props in jsdom, through Testing Library, and reads the document by role and text.
`vitest.config.ts` picks the environment from the file extension: `*.test.ts` runs in Node and
`*.test.tsx` in jsdom. A per-file environment comment was set aside because it is easy to forget,
and Vitest's browser mode because it downloads browsers and overlaps issue #9. jsdom computes no
layout and no CSS: how a page looks is checked in the preview deployment.

There are no models, relations or lazy loading. Writing a join is the developer's job.

Hand-written types can drift from the migrations. We accept that: codegen would need a reachable
database at build time, which is the kind of setup failure that eats a workshop. Revisit if the
schema grows past a dozen tables.
