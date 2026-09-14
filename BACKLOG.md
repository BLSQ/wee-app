# Backlog

Each ticket becomes a GitHub issue on the project board. Copy the section as the issue body.

- **Tickets 1 to 5 are features.** Each lives in its own folder under `src/features/`, so they can
  be built in parallel. They meet only in `src/features/index.ts` (ADR 0005).
- **Tickets 6 to 11 are cross-cutting.** They touch root configuration, `package.json` or CI, and
  will collide with each other. The Kanban work-in-progress limit is how we manage that.

Sizes: **S** fits comfortably in the workshop, **M** is tight, **L** will not finish.

---

## 1. Stale devices view with an adjustable threshold

**Size:** S · **Type:** feature

Supervisors need to see which devices have stopped syncing, so they can call the people using them
before data is lost.

**Acceptance criteria**

- [ ] A page lists every device whose last sync is older than N days.
- [ ] N defaults to 7 and can be changed from the page.
- [ ] Devices that have **never** synced appear too, and are visibly distinguished.
- [ ] Each row shows the device serial, facility, district, last sync date and the last user.
- [ ] The most stale devices come first.
- [ ] The query is tested against the seeded database, which holds 12 devices that never synced.

**Touches shared files:** `src/features/index.ts`.

---

## 2. District coverage map

**Size:** M · **Type:** feature

A table does not show where the problem is. A map of the thirteen districts coloured by sync health
does.

**Acceptance criteria**

- [ ] A page shows a MapLibre map of the districts, using `org_unit.geometry` (level 2).
- [ ] Each district is coloured by the share of its devices that synced in the last 7 days.
- [ ] Hovering or clicking a district shows its name, device count and that share.
- [ ] A legend explains the colours.
- [ ] The map needs no API key or paid tile service.
- [ ] The aggregation query is tested.

**Touches shared files:** `src/features/index.ts`.

---

## 3. Thirty-day sync trend

**Size:** S · **Type:** feature

Is sync activity going up or down? A daily trend answers it at a glance.

**Acceptance criteria**

- [ ] A page shows a `@mantine/charts` chart of syncs and submissions per day over the last 30 days.
- [ ] Days with no sync appear as zero, not as a gap.
- [ ] The query is tested, including a day with no syncs.

**Touches shared files:** `src/features/index.ts`.

---

## 4. Device detail page

**Size:** S · **Type:** feature

From any list, a supervisor wants to open one device and see its whole history.

**Acceptance criteria**

- [ ] A page at `/devices/$deviceId` shows the device serial, facility and district.
- [ ] It lists the device's syncs, newest first, with user and counters.
- [ ] It shows which users have used the device.
- [ ] An unknown device id shows a not-found message, not a crash.
- [ ] Device serials in the recent syncs table link to this page.
- [ ] The queries are tested.

**Touches shared files:** `src/features/index.ts`, and `src/features/device-syncs/ui/SyncTable.tsx`,
which belongs to another feature. Discuss how one feature should link to another.

---

## 5. Per-user activity

**Size:** M · **Type:** feature

Sync problems are often people problems. Supervisors want to see activity per user.

**Acceptance criteria**

- [ ] A page lists users with their number of syncs, submissions, distinct devices and last sync.
- [ ] The period can be switched between the last 7, 30 and 90 days.
- [ ] The table can be sorted by any column.
- [ ] Users with no activity in the period are shown.
- [ ] The query is tested.

**Touches shared files:** `src/features/index.ts`.

---

## 6. Authentication for Bluesquare accounts

**Size:** L · **Type:** cross-cutting

The application is public (ADR 0008). Only people with a Bluesquare account should see it.

**Acceptance criteria**

- [ ] Users sign in with their Bluesquare account through OAuth, using better-auth.
- [ ] Every page and every tRPC procedure requires a signed-in user.
- [ ] Signing out works.
- [ ] ADR 0008 is superseded.
- [ ] The testing strategy is revisited: authentication writes to the database, which breaks the
      read-only assumption in ADR 0006.

**Touches shared files:** root route, tRPC context, migrations, `package.json`, environment
variables, deployment settings.

---

## 7. End-to-end smoke test

**Size:** M · **Type:** cross-cutting

Unit tests cover queries, not whether the application actually starts and renders.

**Acceptance criteria**

- [ ] One end-to-end test opens the application and sees rows in the recent syncs table.
- [ ] It runs locally with a single `pnpm` command.
- [ ] It runs in CI on every pull request.
- [ ] The choice of tool is recorded in an ADR.

**Touches shared files:** `package.json`, CI workflow. Depends on ticket 8.

---

## 8. Continuous integration

**Size:** S · **Type:** cross-cutting

Nothing checks a pull request before it is merged.

**Acceptance criteria**

- [ ] A GitHub Actions workflow runs on every pull request.
- [ ] It installs dependencies, type-checks and runs `pnpm test`.
- [ ] Tests run against a Neon branch, through a `TEST_DATABASE_URL` repository secret.
- [ ] A failing check blocks merging into `main`.

**Touches shared files:** `.github/workflows/`.

---

## 9. Linting, dead code and module boundaries

**Size:** M · **Type:** cross-cutting

Conventions exist only in `AGENTS.md`. Nothing stops a feature from reaching into another one.

**Acceptance criteria**

- [ ] A linter runs with a single `pnpm` command.
- [ ] Unused files, exports and dependencies are reported.
- [ ] A rule fails when code outside `src/features/<name>/` imports from inside another feature's
      folder. `src/features/index.ts` is the only exception.
- [ ] The existing code passes.
- [ ] The choices are recorded in an ADR.

**Touches shared files:** `package.json`, root configuration, and any file that fails the new rules.

---

## 10. Reproducible development environment

**Size:** M · **Type:** cross-cutting

There is no guarantee that two developers, or a developer and an agent, run the same Node, pnpm and
Postgres versions.

**Acceptance criteria**

- [ ] Node and pnpm versions are pinned and enforced, not only documented.
- [ ] A developer can get a local Postgres without a Neon account.
- [ ] A new developer goes from clone to passing tests with a documented, short sequence of
      commands.
- [ ] What an agent needs to run the project is documented in `AGENTS.md`.

**Touches shared files:** `package.json`, root configuration, `README.md`, `AGENTS.md`.

---

## 11. There is no documentation

**Size:** M · **Type:** cross-cutting

The README explains setup, and ADRs explain decisions. Nothing explains the domain or how to work
on the code beyond that.

**Acceptance criteria**

- [ ] Decide, and record, what deserves documentation beyond the README and the ADRs.
- [ ] Write it.
- [ ] Make sure agents are pointed at it from `AGENTS.md`.

**Touches shared files:** `README.md`, `AGENTS.md`, `docs/`.
