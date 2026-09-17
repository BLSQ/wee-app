# wee-app

IASO device-sync dashboard. TanStack Start, Mantine, tRPC and Kysely on Postgres (Neon).

## Rules

- Everything in this repository is in English: code, comments, docs, commits, PRs.
- The skills in `.claude/skills/` are loaded automatically. They are mandatory, not advisory.
  Start from `using-superpowers`.
- Before brainstorming, read every file in `docs/adr/`.
- After implementing a plan, propose ADR additions or updates: use the `writing-adrs` skill.
- Worktree first: run `using-git-worktrees` before the first step of `brainstorming` or
  `systematic-debugging`, without asking. Specs, plans and fixes are committed there, then go
  into a pull request. Never commit to `main`.
- Finished work always goes into a pull request. Do not show the three-option menu of
  `finishing-a-development-branch`: push the branch and open the pull request. Never merge into
  `main` locally.
- When you need the user to choose between a few options, ask with the `AskUserQuestion` tool,
  not in prose. This includes clarifying questions and the choice between approaches.
- Use the brainstorming visual companion whenever it is relevant, on every brainstorming path
  and when debugging. Offer it at the first layout, map, diagram or data-shape question, without
  waiting to be asked; once accepted, it is the default for such questions.
- In a fresh clone: `pnpm install && docker compose up -d && pnpm db:reset`. In a new worktree:
  `pnpm install` only. The database container is shared by every checkout on the machine and is
  already seeded; do not start or reset it again. `pnpm install` writes `.env` itself; never
  hand-edit it to point at a deployed database.
- A feature lives in `src/features/<name>/` and registers itself in `src/features/router.ts`
  (server) and `src/features/nav.ts` (client), nowhere else. `src/features/device-syncs/` is the
  pattern to copy.
- Code that runs in the browser never imports from `src/server/`, except `import type`.
- Database access goes in the feature's own `api/queries.ts`, as plain functions taking `db`.
- Test the queries, on an in-process Postgres: copy `queries.test.ts`. Test the components that
  take props, in jsdom: copy `SyncTable.test.tsx`. The test helpers both import explain the rest.
- Pages and routes get no test, and neither does a tRPC procedure that only validates input and
  calls a query. Never mock `db` or tRPC. No snapshots, and no Docker or seed in tests.
- No linter, e2e framework, auth or CI yet. They are GitHub issues, not gaps to fill
  in passing.

## Audience

The people you talk to are developers who mostly write Python and Django. Few know Node, React or
this stack.

- Say what changes for the user first, then how it works. The first time you name a library, a
  hook or an API, say what it is in a few words.

## Pace

This repository is used in a three-hour workshop. No step of the loop is skipped; every step is
short.

- Ask clarifying questions in batches of at most three, never one per message. Ask a second batch
  when the answers open new questions, and no third. Then propose two or three approaches, with a
  recommendation.
- A spec is one page: purpose, approaches considered and why this one, shape of the query or
  component, acceptance criteria, out of scope.
- A plan is one page of steps.
- Do not use `subagent-driven-development`. Implement directly.
- One round of review.

## Commands

`pnpm dev` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm db:reset` · `pnpm db:migrate` ·
`pnpm db:seed` · `pnpm format`
