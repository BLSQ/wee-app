# wee-app

A small dashboard of IASO device synchronisations: which devices synced recently, and which have
gone quiet. It is not connected to IASO. It runs on its own Postgres database with synthetic data,
and it is read-only for now.

The repository is the starting point of a workshop on spec-driven and test-driven development with
coding agents. Much of what a production application needs is left out on purpose and tracked as
[issues](https://github.com/BLSQ/wee-app/issues).

- App: https://wee-app-one.vercel.app
- Backlog: https://github.com/orgs/BLSQ/projects/12

## Setup

Requirements: Claude Code, Node 22.12 or newer, pnpm 10, a Docker runtime with Compose, and the
GitHub CLI.

```bash
pnpm install        # also creates .env
docker compose up -d
pnpm db:reset       # migrates and seeds the application and test databases
pnpm dev            # http://localhost:3000
```

Postgres runs in Docker on port 55432, in one container shared by every clone and git worktree on
the machine: a new worktree only needs `pnpm install`. The seed is synthetic sync activity over real
Sierra Leone org units, without personal data. It is relative to today's date: run
`pnpm db:reset` again to refresh it.

Other commands: `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm format`.

## Code

```
src/
├── features/
│   ├── router.ts         list of feature APIs (server)
│   ├── nav.ts            menu entries (client)
│   └── device-syncs/     the existing feature
│       ├── api/queries.ts       SQL with Kysely, plain functions taking `db`: tested
│       ├── api/queries.test.ts
│       ├── api/router.ts        tRPC procedures
│       └── ui/                  Mantine components
├── routes/               one file per page
├── server/               database, migrations, seed, tRPC setup
└── ui/                   application shell and theme
```

A new feature is a folder next to `device-syncs/`, built the same way, plus a route file and one
line in each of `router.ts` and `nav.ts`. Browser code never imports server code.

## How we work

1. Pick an issue on the [board](https://github.com/orgs/BLSQ/projects/12).
2. In Claude Code, run `/brainstorming <issue URL>`. The agent creates a git worktree, reads
   `docs/adr/`, asks one or two rounds of questions and proposes approaches.
3. It writes a one-page spec, then a one-page plan, in `docs/superpowers/`.
4. It implements test first and opens a pull request. Nothing is committed to `main`.
5. Someone else reviews. If there are conflicts, ask the agent to merge `main` and resolve them.
6. The agent proposes an ADR when a decision is worth recording. Past decisions are in `docs/adr/`.

The agent instructions are in [`CLAUDE.md`](CLAUDE.md). The skills are
[Superpowers](https://github.com/obra/superpowers), copied into `.claude/skills/`, so there is
nothing to install. This repository targets Claude Code only.

## Deployment

Vercel and Neon. Every pull request gets a preview URL and its own Neon database branch, forked
from production when the preview is first created and deleted when the pull request closes. The build command is
`pnpm db:migrate && pnpm build`, so each deployment migrates the database it serves.
The server is one Vercel function that re-exports the build's `fetch` handler.

Production was seeded once, with `TARGET_DATABASE_URL="<connection string>" pnpm db:seed`.
