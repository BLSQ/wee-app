# 0006. Synthetic seed derived from anonymised IASO data

**Status:** Accepted
**Date:** 2026-09-13

## Context

The dashboard needs realistic geography and sync activity. An IASO development dump provides the
Sierra Leone org unit hierarchy, with district and chiefdom polygons and facility coordinates, and
41 users. Its device tables are empty.

## Decision

- `scripts/extract-dump.ts` is run once by a maintainer. It keeps source version 1 of the org units
  and writes `data/org-units.json` and `data/users.json`, which are committed.
- **Users keep their id and a generated username. Nothing else leaves the dump.**
- Org unit level comes from depth in the parent chain, not from IASO's org unit type, which marks
  the country, four districts and 67 facilities as `Unknown`.
- `src/server/db/seed/generate.ts` generates 200 devices and about 6,000 syncs over 90 days with a
  fixed-seed PRNG: three healthy districts, two that stopped syncing ten days ago, one nearly
  silent, the rest mixed, and 12 devices that never synced.

## Consequences

`pnpm db:seed` needs no dump, no PostGIS and no network.

**Determinism is load-bearing.** Tests read the seeded database and assert on its contents, with no
fixtures, mocks or rollback. That only works while the application is read-only: the first ticket
that writes to the database must revisit this.

The seed uses the real clock, so the data ages: re-seed before a demo. Tests that depend on recency
measure against the most recent sync, not against `now()`.
