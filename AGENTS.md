# wee-app

IASO device-sync dashboard. TanStack Start, Mantine, tRPC and Kysely on Postgres (Neon).

## Rules

- Everything in this repository is in English: code, comments, docs, commits, PRs.
- Read `skills/using-superpowers/SKILL.md` first. Skills in `skills/` are mandatory, not advisory.
- Before brainstorming, read every file in `docs/adr/`.
- After implementing a plan, propose ADR additions or updates: `skills/project/writing-adrs/SKILL.md`.
- Offer the brainstorming visual companion for any layout, map or data-shape question.
  Do not wait to be asked.
- Work in a git worktree and open a pull request. Never commit to `main`.
- A feature lives in `src/features/<name>/` and registers itself in `src/features/index.ts`,
  nowhere else. `src/features/device-syncs/` is the pattern to copy.
- Database access goes in `api/queries.ts` as plain functions taking `db`. That is what you test.
- Tests are Vitest against a migrated and seeded database (`TEST_DATABASE_URL`). No mocks.
- No linter, e2e framework, auth or CI yet. They are tickets in `BACKLOG.md`, not gaps to fill
  in passing.

## Pace

This repository is used in a three-hour workshop. No step of the loop is skipped; every step is
short.

- Ask clarifying questions in one batch of at most three, never one per message.
- A spec is half a page: purpose, shape of the query or component, acceptance criteria, out of
  scope.
- A plan is one page of steps.
- Do not use `subagent-driven-development`. Implement directly.
- One round of review.

## Commands

`pnpm dev` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm db:migrate` · `pnpm db:seed` ·
`pnpm format`
