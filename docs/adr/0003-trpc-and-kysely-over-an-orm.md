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
judge a dashboard query. Queries are plain functions taking `db`, so they are tested directly
against a database.

There are no models, relations or lazy loading. Writing a join is the developer's job.

Hand-written types can drift from the migrations. We accept that: codegen would need a reachable
database at build time, which is the kind of setup failure that eats a workshop. Revisit if the
schema grows past a dozen tables.
