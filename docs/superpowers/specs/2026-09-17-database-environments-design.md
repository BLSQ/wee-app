# Database environments — Design

**Date:** 2026-09-17
**Status:** Approved
**Supersedes in part:** the "migrations are run by hand" consequence of ADR 0004

## Problem

The deployed application fails with `relation "device_sync" does not exist`.

Nothing is wrong with the deployment. `pnpm db:migrate` reads `DATABASE_URL` from `.env`, and
`.env` still pointed at a local throwaway Postgres, so the migrations ran there. Neon was never
migrated, and nothing in the pipeline would have noticed.

Two causes, and the fix addresses both:

- **Deploying does not migrate.** ADR 0004 made migrations a manual step, so a deployment can
  reach production against a schema that does not exist.
- **Local setup is improvised.** `.env.example` holds Neon placeholder URLs, so every developer
  invents their own local database. There is no local environment to be wrong about.

## Decision

### Deployment: migrate in the build

Vercel's build command becomes `pnpm db:migrate && pnpm build`, which is what Neon's own
documentation recommends for schema changes on preview branches.

Migrations then run against whatever `DATABASE_URL` the environment provides:

- **Production**: the Neon production branch.
- **Preview**: the branch that Neon's Preview Branching integration creates for that deployment
  and injects into it.

A failing migration fails the build, so the deployment never goes live. That is the property the
manual process lacked.

Seeding stays out of the build. A Neon branch copies its parent's data, so previews inherit the
seed. Production is seeded by hand, once, and before a demo.

### Local: Postgres in Docker

`compose.yaml` runs one `postgres:17` service on port **55432**, with a named volume and a
healthcheck. Port 55432 rather than 5432 so it cannot collide with a Postgres the developer
already runs. An init script creates two databases: `wee_app` and `wee_app_test`.

`.env.example` points at that container and works unchanged — copy it and go.

`pnpm db:reset` migrates and seeds **both** databases in one command.

From a clone:

```bash
pnpm install        # creates .env from .env.example if it is missing
docker compose up -d
pnpm db:reset
pnpm dev
```

### Bootstrap, on clone and in every worktree

Copying `.env.example` by hand is exactly the step that produced this bug, so nothing is left to
the reader. `scripts/postinstall.mjs` runs from `pnpm install`: plain Node, no dependency, it
creates `.env` from `.env.example` only when `.env` is missing, and prints the two commands that
follow. It does nothing when `CI` or `VERCEL` is set, so a build never writes an env file.

A new worktree has no `node_modules`, so `pnpm install` runs there too and the bootstrap happens
again. `CLAUDE.md` carries the same sequence, so an agent starting in a fresh worktree does not
have to infer it.

Neon Local, Neon's own recommendation for local development, was considered and set aside: it
needs a Neon API key and project id for every participant, and it does not work offline. The code
uses no Neon-specific feature, so a plain Postgres container is faithful enough.

## Components

| File | Change |
| --- | --- |
| `compose.yaml` | New. One `postgres:17` service, port 55432, named volume, healthcheck. |
| `docker/init-databases.sh` | New. Creates `wee_app_test` alongside `wee_app`. |
| `.env.example` | Points at the container; usable as is. |
| `src/server/db/migrate.ts` | New. `migrate(url)`, extracted from `scripts/migrate.ts`. |
| `src/server/db/seed/run.ts` | New. `seed(url)`, extracted from `scripts/seed.ts`. |
| `scripts/migrate.ts`, `scripts/seed.ts` | Become thin callers, keeping `TARGET_DATABASE_URL`. |
| `scripts/db-reset.ts` | New. Runs migrate then seed, for `DATABASE_URL` then `TEST_DATABASE_URL`. |
| `scripts/postinstall.mjs` | New. Creates `.env` from `.env.example` when missing; silent under CI. |
| `package.json` | Adds `db:reset` and a `postinstall` hook. |
| `vercel.json` | `buildCommand: "pnpm db:migrate && pnpm build"`. |
| `README.md` | Setup rewritten around Docker; deployment section covers the integration. |
| `CLAUDE.md` | Commands list gains `pnpm db:reset`. |
| `BACKLOG.md` | Ticket 10 rewritten (below). |
| `docs/adr/0012`, `docs/adr/0013` | Migrations at deploy; local Postgres in Docker. |

The extraction of `migrate(url)` and `seed(url)` exists so that `db:reset` can run both against two
databases in one process, instead of juggling environment variables across four shell commands.

## Testing

The test suite does not change: it reads `TEST_DATABASE_URL`, which now points at the container
rather than at whatever each developer had running.

`pnpm db:reset` is verified by running it against the container and then running the suite, which
already asserts the seeded contents (1332 org units, 200 devices, districts behind).

No test covers the Vercel build command; ticket 8 (CI) and ticket 7 (smoke test) are where that
belongs.

## Risks

| Risk | Mitigation |
| --- | --- |
| Migrations run before the new code is served, so a non-backward-compatible migration breaks production for the length of a deploy | Recorded in ADR 0012. At this size the window is seconds; revisit if the application gets traffic |
| Docker is a new prerequisite, and its daemon is not running by default | README states it; any Postgres 14+ works instead, since only the connection string matters |
| Port 55432 is already taken by the throwaway cluster created while building the starter | The container refuses to start on a taken port rather than picking another silently; the README says to stop that cluster first |
| A build that migrates needs database credentials at build time | Already true of the Neon integration; no new secret |
| `db:reset` seeds the test database, so a developer can wipe test data mid-run | It only ever touches the two URLs in `.env`; both are local |
| Worktrees share the single local database, so a migration in one worktree is visible in the others | Accepted: one database is what a workshop wants. A worktree that needs isolation changes the port and database name in its own `.env` |

## Out of scope

Continuous integration (ticket 8), end-to-end tests (ticket 7), and Neon Local as a documented
alternative. Backfilling a rollback story for migrations: `down` exists, nothing calls it.

## Backlog impact

Ticket 10, "Reproducible development environment", loses its database half. It is rewritten around
what remains: pinning and enforcing Node and pnpm versions, and documenting what an agent needs.
It drops from M to S.
