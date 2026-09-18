# 0016. A lateral join for the latest row per parent

**Status:** Proposed
**Date:** 2026-09-18

## Context

`device_sync` holds one row per sync and there is no last-sync column on `device`. Listing the
devices that have stopped syncing needs each device's newest sync — and needs to keep the devices
that have no sync at all, which every inner join written so far drops.

This is not one query's problem. A device detail page (issue #6), sync activity per user (#7) and
sync health per district (#3) all need the latest row of a group, and the seed deliberately contains
devices that never synced (ADR 0006), so the sync-less case is permanent.

## Decision

We take the latest row per parent with a `left join lateral` and `limit 1` — a subquery allowed to
refer to the row it is joined to. Kysely writes it as
`leftJoinLateral((eb) => eb.selectFrom(...).whereRef(...).orderBy(...).limit(1).as('last'), (join) => join.onTrue())`.

Two alternatives were rejected:

- `distinct on (device_id)` starts from the syncs, so keeping the devices that have none turns the
  join round and reads backwards.
- A `group by` subquery of `max(synced_at)` joined back to `device_sync` needs two joins to recover
  the columns of that row, and emits a parent twice when two of its rows share a timestamp.

## Consequences

The lateral reads the existing `device_sync (device_id, synced_at desc)` index, returns exactly one
row per parent, and carries the rest of that row — here the user who synced — with no second join.
Ordering it differently, or taking the two latest rows, is a one-line change.

It is Postgres and MySQL only. That costs nothing: the application is Postgres everywhere
(ADR 0013), and PGlite runs laterals, so the tests exercise the real thing.

A lateral runs its subquery once per outer row. At 200 devices that is free. If a query ever fans
out to thousands of parents and the index stops carrying it, the answer is a denormalised
`last_synced_at` column maintained on write — which is a schema decision, and would supersede this.
