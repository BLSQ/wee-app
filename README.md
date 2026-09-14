# wee-app

A dashboard showing which IASO mobile devices have synchronised recently, and which districts are
falling behind.

It is also the starting point of a workshop on spec-driven development and test-driven development
with coding agents. Much of what a production application needs is deliberately missing: see
[What is deliberately missing](#what-is-deliberately-missing).

## Setup

Requirements: Node 22 and pnpm 10.

```bash
pnpm install
cp .env.example .env
```

## Database

The application needs two Postgres databases: one for the app, one that the tests read from.
[Neon](https://neon.tech) is what we deploy on (ADR 0004), but any Postgres 14 or later works
locally.

1. Create a Neon project. Copy its connection string into `DATABASE_URL` in `.env`.
2. Create a second branch, for example `test`. Copy its connection string into `TEST_DATABASE_URL`.
3. Migrate and seed both:

```bash
pnpm db:migrate
pnpm db:seed

TARGET_DATABASE_URL="$TEST_DATABASE_URL" pnpm db:migrate
TARGET_DATABASE_URL="$TEST_DATABASE_URL" pnpm db:seed
```

(`$TEST_DATABASE_URL` must be set in your shell for that form; otherwise paste the URL.)

The seed is synthetic sync activity over real Sierra Leone geography, anonymised (ADR 0006). It is
generated relative to the current date, so **re-seed before a demo** to keep "ten days behind"
meaning ten days.

## Running

```bash
pnpm dev                 # http://localhost:3000
pnpm test                # Vitest, against TEST_DATABASE_URL
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

The agent instructions are in [`AGENTS.md`](AGENTS.md); `CLAUDE.md` and `GEMINI.md` point to it.
The skills that drive the loop are [Superpowers](https://github.com/obra/superpowers), vendored in
`skills/` so they work with any agent and without installing anything.

## Deployment

1. Import the repository in Vercel. The build command is `pnpm build`; Nitro produces Vercel's
   output format automatically.
2. Set `DATABASE_URL` in the Vercel project to the Neon connection string.
3. Run migrations yourself (`pnpm db:migrate`) before deploying a change that needs them. The build
   never migrates.

Do not deploy with real data: there is no authentication yet (ADR 0008).

## What is deliberately missing

No authentication, no end-to-end tests, no continuous integration, no linter, no enforced module
boundaries, no reproducible development environment, and very little documentation.

These are not oversights. They are the workshop: see [`BACKLOG.md`](BACKLOG.md).
