# wee-app — Design

**Date:** 2026-09-13
**Status:** Approved
**Repository:** https://github.com/BLSQ/wee-app
**Context:** Starter repository for a Bluesquare workshop on spec-driven development and TDD with Superpowers.

## 1. Purpose

`wee-app` is a device-sync dashboard for IASO: it shows which mobile devices
have synchronised recently, and which regions are falling behind.

The application is real enough to be useful, but it exists to serve a workshop.
Two consequences follow, and they constrain every decision below:

- **The repository must leave work to do.** Missing linting, missing end-to-end
  tests, missing authentication and missing documentation are not oversights.
  They are the backlog. Anything added to the starter is a ticket taken away
  from the participants.
- **Four to six pairs work in parallel for two to three hours.** The code must
  be partitioned so that two pairs almost never edit the same file, and so that
  a pair can go from ticket to merged pull request inside the session.

## 2. Scope

### In scope (the starter)

- Postgres schema, migrations, and a deterministic seed derived from a real
  IASO database dump.
- One complete vertical feature slice — a list of the most recent device syncs
  — including its Kysely queries, its tRPC router, its Mantine UI, and its
  tests. It is the pattern every other slice copies.
- The application shell: navigation, theme, tRPC wiring, database access.
- Agent configuration: vendored Superpowers skills, `AGENTS.md`, initial ADRs.
- A backlog of tickets.

### Out of scope (deliberately — these are tickets)

Authentication, end-to-end tests, continuous integration, linting, module
boundary enforcement, a reproducible development environment, documentation,
and every dashboard feature beyond the example slice.

### Non-goals

- Reproducing IASO's data model faithfully. The schema is a simplification.
- Production-grade operations. There is no monitoring, no backup strategy, no
  migration rollback story.

## 3. Data

### 3.1 Source

The source is a `pg_dump` of an IASO development database (PostgreSQL 14 with
PostGIS), containing the Sierra Leone demonstration hierarchy.

What the dump provides:

| Table | Rows | Use |
| --- | --- | --- |
| `iaso_orgunit` | 9 113 across 14 source versions | Geography |
| `auth_user` | 41 | Users |
| `iaso_device`, `iaso_deviceownership`, `iaso_deviceposition` | 0 | — |

Only source version 1 is internally consistent. Restricted to it, the hierarchy
has 1 332 org units:

| Level | Meaning | Count | Geometry |
| --- | --- | --- | --- |
| 1 | Country (Sierra Leone) | 1 | — |
| 2 | Province — in practice a district | 9 | Polygon, all present |
| 3 | District — in practice a chiefdom | 152 | Polygon, all present |
| 4 | Health facility | 1 170 | 601 have GPS points |

**Level is derived from depth in the parent chain, not from
`org_unit_type_id`.** Seventy-one facilities in source version 1 carry the
`Unknown` org unit type while being ordinary MCHP, CHP and CHC units parented
to a chiefdom; Sierra Leone itself is typed `Unknown` too. Depth classifies all
of them correctly and needs no special cases.

The device tables are empty, so **all sync data is synthetic**.

### 3.2 Extraction

A one-off script — run once by the repository author, not part of the
application — reads the dump and writes two committed JSON files:

- `data/org-units.json` — the 1 332 org units of source version 1, levelled by
  depth, with PostGIS WKB geometries converted to GeoJSON.
- `data/users.json` — 41 users reduced to `{ id, username }`, where `username`
  is generated (`user_004`).

**No personally identifiable information is committed.** Names, email
addresses, password hashes, `external_user_id` and `dhis2_id` are dropped
during extraction, not filtered at read time.

Committing the extracted data rather than the dump means `pnpm db:seed` needs
no 66 MB file, no PostGIS client, and no network access.

### 3.3 Schema

Four tables.

```
org_unit
  id           integer primary key
  name         text not null
  parent_id    integer null references org_unit(id)
  level        smallint not null      -- 1 country .. 4 facility
  path         text not null          -- materialised ancestry, e.g. '1.2.34'
  latitude     double precision null
  longitude    double precision null
  geometry     jsonb null             -- GeoJSON, levels 2 and 3 only

app_user
  id           integer primary key
  username     text not null unique

device
  id           integer primary key
  serial       text not null unique   -- 'SL-0142'
  org_unit_id  integer not null references org_unit(id)   -- a facility

device_sync
  id                integer primary key generated always as identity
  device_id         integer not null references device(id)
  user_id           integer not null references app_user(id)
  synced_at         timestamptz not null
  submission_count  integer not null
  org_unit_count    integer not null
  entity_count      integer not null
```

Design notes:

- **`path` is a materialised ancestry string, not a recursive CTE.** Rolling a
  facility-level device up to its district is a `LIKE` on `path`, which keeps
  "who has not synced, by region" readable in about twenty lines of Kysely.
  This is the single most important affordance in the schema for the workshop.
- **`user_id` lives on `device_sync`, not on `device`.** The same tablet can be
  used by different people; this matches both reality and IASO's
  `deviceownership` model, and it matches the fields requested for the use case.
- **`device.org_unit_id` points at a facility.** Regional aggregation therefore
  always goes through `path`, which is the interesting query to write.
- **Geometry is GeoJSON in `jsonb`.** See ADR 0007. MapLibre consumes it
  directly and Neon needs no PostGIS extension.

Indexes: `device_sync(device_id, synced_at desc)`, `device_sync(synced_at)`,
`org_unit(path)`, `device(org_unit_id)`.

### 3.4 Seed

`scripts/seed.ts` loads the two JSON files, then generates devices and syncs
with a **fixed-seed pseudo-random generator**. The same command always produces
the same database.

Shape of the generated data:

- ~200 devices distributed across facilities, weighted so that districts differ
  in device density.
- ~8 000 syncs spread over the preceding 90 days.
- Calibrated so the dashboard has something to show: three districts healthy,
  two that stopped syncing about ten days ago, one nearly silent, and a handful
  of devices that have never synced at all.

Determinism is not a convenience — it is what makes the testing strategy in
§5.3 work.

## 4. Architecture

### 4.1 Stack

| Concern | Choice | ADR |
| --- | --- | --- |
| Full stack framework | TanStack Start | 0002 |
| UI | Mantine, `@mantine/charts` | — |
| API | tRPC | 0003 |
| Database access | Kysely (hand-written types, no codegen) | 0003 |
| Database | Neon Postgres | 0004 |
| Hosting | Vercel | 0004 |
| Maps | MapLibre GL | 0007 |
| Tests | Vitest | — |
| Formatting | Prettier | — |

### 4.2 Layout

```
wee-app/
├── AGENTS.md                 source of truth for agents
├── CLAUDE.md                 @AGENTS.md
├── GEMINI.md                 @AGENTS.md
├── README.md
├── BACKLOG.md
├── .claude/settings.json     includeCoAuthoredBy: false
├── skills/                   vendored Superpowers + project skills
├── docs/adr/
├── docs/superpowers/{specs,plans}/
├── data/                     org-units.json, users.json
├── scripts/                  migrate.ts, seed.ts
└── src/
    ├── routes/               TanStack Start file routes (thin)
    ├── server/db/            kysely instance, types, migrations
    ├── server/trpc/base.ts   initTRPC, context, publicProcedure
    ├── ui/                   AppShell, theme
    ├── lib/trpc.ts           client
    └── features/
        ├── index.ts          the shared contact point
        └── device-syncs/
            ├── api/queries.ts
            ├── api/queries.test.ts
            ├── api/router.ts
            └── ui/SyncsPage.tsx, SyncTable.tsx
```

### 4.3 Feature slices

A feature owns one folder under `src/features/` and touches exactly two things
outside it: a three-line route file, and two lines in `src/features/index.ts`.

```ts
// src/features/index.ts
import { router } from '~/server/trpc/base'
import { deviceSyncsRouter } from './device-syncs/api/router'

export const appRouter = router({
  deviceSyncs: deviceSyncsRouter,
})
export type AppRouter = typeof appRouter

export const navItems = [{ label: 'Syncs', to: '/syncs' }]
```

The registry is explicit rather than discovered by globbing (ADR 0005). The
decisive reason is not taste: composing a tRPC router from an array erases the
end-to-end type inference that justifies choosing tRPC in the first place.

Within a slice, the layering exists to make the code testable:

| File | Responsibility | Tested |
| --- | --- | --- |
| `api/queries.ts` | Pure functions `(db, params) => rows`. All Kysely lives here. | Yes — this is the unit under test |
| `api/router.ts` | tRPC procedures, Zod input validation. Thin. | No |
| `ui/*.tsx` | Mantine components consuming tRPC hooks. | No |

### 4.4 Application shell

- `src/routes/__root.tsx` renders the Mantine provider and the `AppShell`.
- `AppShell` renders `navItems` as the sidebar. Adding a slice adds a nav entry
  with no edit to the shell.
- `src/routes/index.tsx` redirects to `/syncs`.
- `src/routes/api.trpc.$.ts` is the tRPC HTTP handler.

### 4.5 The example slice: `device-syncs`

A single page at `/syncs` inside the AppShell: an unpaginated, sortable Mantine
table of recent syncs, one row per sync, showing device serial, username, org
unit, sync time, and submission count.

Unpaginated on purpose. Pagination is state management noise that would
lengthen the example without teaching anything about the spec-to-test-to-code
cycle. The query is bounded with a `LIMIT`.

## 5. Cross-cutting concerns

### 5.1 Migrations

Kysely's built-in `Migrator` driven by `scripts/migrate.ts`. No separate
migration tool. Migrations are TypeScript files in `src/server/db/migrations/`.

Migrations are **never run during the Vercel build**. `pnpm db:migrate` is an
explicit, operator-run command, documented in the README.

### 5.2 Database types

`src/server/db/types.ts` declares the Kysely `Database` interface by hand —
about thirty lines for four tables. No `kysely-codegen`.

The trade-off is deliberate: codegen requires a reachable database at build
time, which is exactly the kind of setup failure that derails a workshop.
Drift between migration and type is a one-line manual edit, and noticing it is
itself instructive.

### 5.3 Testing

Vitest only. No Playwright, no mocks, no fixtures, no test containers.

Every dashboard query is read-only, and the seed is deterministic. Tests
therefore run against a seeded database and assert on its actual contents. A
`TEST_DATABASE_URL` points at a dedicated Neon branch; the README explains how
to create it.

This removes transaction rollback helpers, factory functions, and database
cleanup from the starter entirely. It works because the application is
read-only, and the spec says so out loud so that the first ticket which
introduces writes knows it must revisit this decision.

### 5.4 Error handling

Errors are not engineered in the starter. tRPC returns its default error shape;
TanStack Router's default error boundary catches render failures. Making error
handling deliberate is a legitimate future ticket, not starter scope.

### 5.5 Deployment

Vercel, with Neon as the database. Preview environments per pull request are
the reason for this pairing (ADR 0004) — they are what makes the workshop's
"open a PR, review it, merge it" loop tangible.

The repository commits configuration and a README procedure. It provisions
nothing: creating the Neon project, connecting Vercel, and setting secrets are
manual steps performed by the repository owner.

There is no CI workflow in the starter. Setting one up is ticket 8.

## 6. Agent configuration

### 6.1 Portability

`AGENTS.md` is the source of truth. `CLAUDE.md` and `GEMINI.md` each contain a
single line pointing at it. Instructions therefore apply to Claude Code, Codex,
Cursor and Gemini alike.

Superpowers 6.3.0 is **vendored** into `skills/` — copied, version-pinned, and
committed. A clone works offline with no plugin marketplace and no install
step, including the brainstorming visual companion and its server scripts.

### 6.2 Project rules

Three project-specific behaviours are expressed as rules in `AGENTS.md`, not as
patches to the vendored skills, so that Superpowers can be upgraded by
replacing the directory:

1. Read every file in `docs/adr/` before brainstorming.
2. Propose ADR additions or updates after implementing a plan.
3. Offer the visual companion for layout, map and data-shape questions without
   waiting to be asked.

A fourth rule states that everything in the repository is written in English.

`skills/project/writing-adrs/SKILL.md` defines the ADR format and the update
procedure that rules 1 and 2 refer to.

`.claude/settings.json` sets `includeCoAuthoredBy: false` so commits and pull
requests are attributed to the human author alone.

### 6.3 Pace

Superpowers is deliberately unhurried. That is right in normal work and wrong
in a three-hour session: a pair that spends forty minutes in brainstorming
never reaches a merged pull request, and the point of the workshop is to watch
the whole loop close at least once.

The governing principle is therefore: **no step is skipped, every step is
short.** Superpowers is slow because of the number of round trips and the
length of its artefacts, not because of the steps themselves. Making the spec
optional would remove precisely what the participants came to see.

Every ticket runs the full loop — brainstorm, spec, plan, failing test,
implementation, pull request, ADR proposal — under this budget:

- Ask clarifying questions in **one batch of at most three**, not one per
  message. This is the single largest saving and it costs nothing.
- A spec is **half a page**: purpose, the shape of the query or component,
  acceptance criteria, what is explicitly out of scope.
- A plan is **one page of steps**, not prose.
- Do not use `subagent-driven-development`. Implement directly.
- One round of review, not several.
- Reach for the visual companion instead of describing a layout or a map in
  prose. It is faster, not slower, for anything spatial.

Backlog tickets carry their own context and acceptance criteria (§8) so that
brainstorming starts from a real brief and converges quickly, without the
brainstorm becoming a formality.

The budget lives in its own `## Pace` section of `AGENTS.md` so it can be
deleted in one edit once the repository outlives the workshop. ADR 0009 records
it as a temporary, workshop-scoped concession and states what it must never
trade away.

### 6.4 Development workflow

Work happens on a git worktree branch and lands through a pull request. Nothing
is committed to `main` directly. Superpowers' `using-git-worktrees` and
`finishing-a-development-branch` skills cover the mechanics; `AGENTS.md` states
the rule.

Tasks are tracked as GitHub issues on a GitHub Project board, managed as a
Kanban. `BACKLOG.md` holds the ticket text until the repository is pushed.

## 7. Initial ADRs

| # | Decision |
| --- | --- |
| 0001 | Record architecture decisions |
| 0002 | Full-stack TypeScript (TanStack Start) over React plus Python |
| 0003 | tRPC and Kysely instead of an ORM |
| 0004 | Neon and Vercel, chosen for preview environments |
| 0005 | Explicit feature registry over automatic discovery |
| 0006 | Synthetic seed derived from anonymised IASO data |
| 0007 | GeoJSON in `jsonb` instead of PostGIS |
| 0008 | No authentication yet |
| 0009 | A workshop pace budget for agents |

ADR 0004 records why deployment as an OpenHEXA web app was set aside: the
per-pull-request preview environment was the deciding criterion.

ADR 0008 exists so that the deferral is visible and dated rather than looking
like neglect — it is ticket 6.

## 8. Backlog

`BACKLOG.md` holds eleven tickets, each with context and acceptance criteria,
written to be pasted into a GitHub issue unchanged.

| # | Ticket | Size |
| --- | --- | --- |
| 1 | Stale devices view with an adjustable threshold | S |
| 2 | District coverage map (MapLibre) | M |
| 3 | Thirty-day sync trend chart (Mantine Charts) | S |
| 4 | Device detail page with sync history | S |
| 5 | Per-user activity view | M |
| 6 | Authentication with better-auth for Bluesquare accounts | L |
| 7 | End-to-end smoke test, locally and in CI | M |
| 8 | Continuous integration: typecheck and vitest on pull requests | S |
| 9 | Linting, dead code detection, module boundary rules | M |
| 10 | Reproducible development environment for humans and agents | M |
| 11 | There is no documentation | M |

Tickets 1 to 5 are vertical slices and are conflict-free by construction.
Tickets 6 to 11 are cross-cutting and will contend for root configuration,
`package.json` and CI files. The Kanban work-in-progress limit is the intended
mitigation, and the contention is itself worth discussing during the session.

## 9. Risks

| Risk | Mitigation |
| --- | --- |
| Committed GeoJSON is larger than expected | Measure during implementation; simplify polygons further, or drop facility-level geometry, if `data/org-units.json` exceeds a few megabytes |
| Neon setup consumes workshop time | README gives an exact procedure; the seed is a single command; the repository owner validates the path end to end beforehand |
| Cross-cutting tickets collide | Kanban WIP limit; the collision is surfaced as a discussion topic rather than hidden |
| Two to three hours is short for a full brainstorm-to-merge cycle | The pace budget in §6.3 caps clarifying questions, spec writing and review rounds; tickets 1, 3, 4 and 8 are sized S specifically so at least one pair completes the loop early and can demonstrate it |
| The pace budget is read as permission to skip the method, so participants never see what Superpowers is for | The budget shortens artefacts and round trips; it never makes a step optional. ADR 0009 states this as the constraint the budget must not trade away |
| A pair invents its own conventions | The `device-syncs` slice is complete and tested; `AGENTS.md` names it as the pattern |

## 10. Open questions

None. Items previously undecided — repository name (`wee-app`), CI in the
starter (no), backlog format (a single `BACKLOG.md`), and pagination in the
example slice (none) — are settled above.
