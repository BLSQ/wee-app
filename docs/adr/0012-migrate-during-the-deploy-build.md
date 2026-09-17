# 0012. Migrate during the deploy build

**Status:** Accepted
**Date:** 2026-09-17

## Context

The deployed application failed with `relation "device_sync" does not exist`. Nothing was wrong
with the deployment: ADR 0004 made migrations a manual step, and `pnpm db:migrate` migrates
whatever `DATABASE_URL` sits in the developer's `.env` — which pointed at a local database. The
production database was never migrated, and nothing in the pipeline noticed.

## Decision

Vercel's build command is `pnpm db:migrate && pnpm build`.

Neon's Preview Branching integration gives every preview deployment its own database branch and
injects its `DATABASE_URL`, so a preview migrates its own branch and production migrates its own.
This is what Neon's documentation recommends for applying schema changes to preview branches.

Seeding stays manual and out of the build: a Neon branch inherits its parent's data, so previews
are seeded already.

## Consequences

A failing migration fails the build, so a deployment can no longer reach production against a
schema that does not exist. That is the property the manual process lacked.

The last consequence of ADR 0004 — "migrations are run by hand, never during the build" — no
longer holds. The rest of ADR 0004, the choice of Neon and Vercel, stands.

Migrations now run before the new code is served, so a migration must be backward compatible with
the code still running. At this size the window is seconds; revisit if the application ever takes
real traffic.

There is no rollback path. `down` exists in every migration and nothing calls it.
