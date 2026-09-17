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
- Database access goes in `api/queries.ts` as plain functions taking `db`. Test these first.
- Tests are Vitest on an in-process Postgres: `createTestDb()` from `src/server/db/test-helpers.ts`
  gives each test file an empty, migrated database, and each test inserts the rows it needs with
  the helpers there. No Docker, no seed, and no mock of `db`.
- A component that takes props has a `*.test.tsx` next to it, which runs in jsdom. Render it with
  `renderWithProviders` from `src/ui/test-helpers.tsx`, find elements by role and text, and click
  with `userEvent`. `SyncTable.test.tsx` is the pattern to copy. No snapshots, no assertions on CSS
  classes, no `renderToStaticMarkup`.
- A page fetches with tRPC and passes the data to components as props. It has no component test,
  and tRPC is never mocked. A MapLibre map needs WebGL, which jsdom lacks: test the data the map
  receives, not the map.
- No linter, e2e framework, auth or CI yet. They are GitHub issues, not gaps to fill
  in passing.

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
