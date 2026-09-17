# wee-app

A dashboard showing which IASO mobile devices have synchronised recently, and which districts are
falling behind.

It is also the starting point of a workshop on spec-driven development and test-driven development
with coding agents. Much of what a production application needs is deliberately missing: see
[What is deliberately missing](#what-is-deliberately-missing).

## Setup

Requirements: Node 22, pnpm 10, and Docker running.

```bash
pnpm install        # also creates .env from .env.example
docker compose up -d
pnpm db:reset
pnpm dev            # http://localhost:3000
```

`pnpm db:reset` migrates **and** seeds both databases: `wee_app` for the application and
`wee_app_test` for the tests. Both live in the container defined by `compose.yaml`, on port 55432
so it cannot collide with a Postgres already installed on your machine (ADR 0013).

The seed is synthetic sync activity over real Sierra Leone geography, anonymised (ADR 0006). It is
generated relative to the current date, so re-run `pnpm db:reset` to make "ten days behind" mean
ten days again.

If you would rather not use Docker, any Postgres 14 or later works: create two databases and point
`DATABASE_URL` and `TEST_DATABASE_URL` at them in `.env`.

## Running

```bash
pnpm dev                 # http://localhost:3000
pnpm test                # Vitest, against TEST_DATABASE_URL
pnpm db:reset            # migrate and seed both databases again
pnpm exec tsc --noEmit   # type-check
pnpm format              # Prettier
```

## How the code is organised

```
src/
├── features/
│   ├── router.ts         feature registry, server side: tRPC routers
│   ├── nav.ts            feature registry, client side: navigation items
│   └── device-syncs/     the example feature, the pattern to copy
│       ├── api/queries.ts       Kysely queries, plain functions taking `db`: tested
│       ├── api/queries.test.ts
│       ├── api/router.ts        tRPC procedures: thin
│       └── ui/                  Mantine components
├── routes/               TanStack Start file routes: one thin file per page
├── server/db/            Kysely instance, types, migrations, seed generator
├── server/trpc/          tRPC setup
├── ui/                   application shell and theme
└── lib/                  tRPC client
```

A new feature is a folder under `src/features/`, one route file under `src/routes/`, and one line
in each of `src/features/router.ts` and `src/features/nav.ts` (ADR 0010). Browser code never
imports server code.

## How we work

Every ticket goes through the same loop:

1. **Brainstorm** the ticket with your agent. It reads `docs/adr/` first.
2. **Spec**: half a page, in `docs/superpowers/specs/`.
3. **Plan**: one page of steps, in `docs/superpowers/plans/`.
4. **Failing test**, then the implementation that makes it pass.
5. **Pull request** from a git worktree. Nothing is committed to `main`.
6. **ADR**: the agent proposes adding or updating one; the reviewer decides.

The agent instructions are in [`CLAUDE.md`](CLAUDE.md). The skills that drive the loop are
[Superpowers](https://github.com/obra/superpowers), vendored in `.claude/skills/`: Claude Code
loads them automatically, with nothing to install. This repository targets Claude Code only
(ADR 0011).

## Deployment

The database side is settled; the hosting side is not.

**Database.** Install Neon's **Preview Branching** integration on the Vercel project: each preview
deployment then gets its own database branch, with its `DATABASE_URL` injected into that
deployment. The build command is `pnpm db:migrate && pnpm build`, so every deployment migrates the
database it is about to serve, and a failing migration fails the build (ADR 0012). Seed production
once, by hand:

```bash
TARGET_DATABASE_URL="<production connection string>" pnpm db:seed
```

Previews need no seeding: a Neon branch is a copy of its parent's data.

**Serving the application.** This is an open question — backlog ticket 12. `pnpm build` emits
`dist/client` and `dist/server/server.js`, and that file exports a fetch handler rather than
starting a server, so it needs a host or a small entry point of its own. We do not use Nitro, the
usual adapter, because its dev server is unusable (ADR 0004).

Do not deploy with real data: there is no authentication yet (ADR 0008).

## What is deliberately missing

No authentication, no end-to-end tests, no continuous integration, no linter, no enforced module
boundaries, no reproducible development environment, and very little documentation.

These are not oversights. They are the workshop: see [`BACKLOG.md`](BACKLOG.md).
