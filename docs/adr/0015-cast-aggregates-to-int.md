# 0015. Cast aggregates to int in the SQL

**Status:** Accepted
**Date:** 2026-09-18

## Context

The Users page (issue #7) counts syncs, submissions and devices per user. Postgres returns
`count()` and `sum()` as `bigint`, and `pg` hands `bigint` back as a **string**, because a JavaScript
number cannot hold every 64-bit integer. A table that sorts on such a column puts `"9"` above
`"10"` and nobody sees an error.

The tests do not catch it. Measured on this schema:

|                                 | uncast `count(*)` | `count(*)::int` |
| ------------------------------- | ----------------- | --------------- |
| `pg` — dev, preview, production | `string "6066"`   | `number 6066`   |
| PGlite — every test (ADR 0003)  | `number 6066`     | `number 6066`   |

PGlite is the more forgiving of the two, so a query test asserting `typeof === 'number'` passes
whether or not the cast is there. ADR 0003 anticipated PGlite lacking something Neon has; this is
the mirror image, and the more dangerous one, because the test stays green.

## Decision

Every aggregate in a query is cast in the SQL: `count(sync.id)::int`,
`coalesce(sum(sync.submission_count), 0)::int`.

We did not set a global type parser — `pg.types.setTypeParser(20, Number)` in `createDb`, which
would return every `bigint` as a number and make the two databases agree. It moves the fix far from
the query that needs it, it silently loses precision above 2^53, and it would make the tests pass
for a reason that is invisible in the code under review. No column in this schema is `bigint`, so
today only aggregates are affected either way.

## Consequences

The cast sits in the SQL a reviewer reads, next to the aggregate it fixes.

Nothing enforces it. A new aggregate without a cast passes `pnpm test` and breaks sorting in the
preview. Until there is an end-to-end smoke test (issue #9), code review is the only check, and
this ADR is what a reviewer is expected to know.

`::int` overflows above 2^31. Every count here is bounded by the number of rows in `device_sync`,
which is far below that. A query that could exceed it should cast to `::bigint`, keep the string
and say so.

Revisit if a table gains a `bigint` column, which would make the global type parser the smaller of
the two evils.
