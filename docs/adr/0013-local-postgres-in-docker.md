# 0013. Local Postgres in Docker

**Status:** Accepted
**Date:** 2026-09-17

## Context

`.env.example` held Neon placeholder URLs, so every developer invented their own local database and
`pnpm db:migrate` silently migrated whichever one they happened to have. That is how the schema
went missing in production (ADR 0012).

Neon Local, Neon's own recommendation for local development, creates an ephemeral branch per
`docker compose up`. It needs a Neon API key and project id for every developer, and it does not
work offline.

## Decision

One `postgres:17` container, defined in `compose.yaml`, listens on port 55432 and holds both
`wee_app` and `wee_app_test`.

The Compose project has a fixed name, `wee-app`. Without it, Compose names the project after the
directory, so each git worktree started its own empty Postgres on the same port: the second one
failed to bind, or the first `pnpm db:reset` ran against a server that was still initialising. With
a fixed name, every clone and worktree on the machine shares one container and one volume.

`pnpm db:reset` waits for the server and creates a missing database itself, so `compose.yaml`
mounts no file from the checkout and is identical from any directory.

`pnpm install` runs `scripts/postinstall.mjs`, which copies `.env.example` to `.env` when `.env` is
missing and does nothing under `CI` or `VERCEL`. `pnpm db:reset` migrates and seeds both databases.

## Consequences

A clone reaches a seeded database in three commands. A fresh worktree only needs `pnpm install`:
the database is already running and seeded.

Worktrees share the local schema. A worktree that adds a migration changes the database for the
others until `pnpm db:reset` is run from the checkout in use.

Docker becomes a prerequisite. Any Postgres 14 or later works instead, since only the connection
string matters.

Worktrees share the one local database, which is what a workshop wants. A worktree that needs
isolation changes the port and database name in its own `.env`.

Port 55432 rather than 5432, so the container cannot collide with a Postgres already installed on
the machine.

The code uses no Neon-specific feature, so the difference between this container and production is
not exercised. A ticket that starts using one must revisit this.
