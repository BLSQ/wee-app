# Sync activity per user

**Issue:** [#7](https://github.com/BLSQ/wee-app/issues/7)
**Date:** 2026-09-18

## Purpose

Sync problems are often people problems. A supervisor needs to see, per user, how much syncing
happened over a chosen window and who went quiet.

A new **Users** page lists every user in the directory with their number of syncs, submissions,
distinct devices and last sync. Three buttons switch the window between the last 7 days (the
default), 30 days and 3 months. Every column sorts. A user with no activity in the window keeps
their row, dimmed, showing zeros and an em-dash.

## Approaches considered

**Server aggregates, browser sorts — chosen.** One SQL query per window returns one row per user,
about 41 of them. The browser re-sorts that array in place; only a change of window refetches.

**Server aggregates and sorts.** Sort column and direction join the tRPC input and SQL orders the
rows. The right call at ten thousand users; here it spends a round trip to reorder 41 rows, and
every new sortable column widens the input union.

**Browser aggregates.** Fetch the raw syncs and group them in TypeScript. Ships thousands of rows
to compute four numbers, and moves the `group by` somewhere no query test can see it.

The layout was chosen from two mockups: alphabetical by username with quiet rows dimmed, rather
than quietest-first with a badge. The page reads as a directory you look people up in; the sort
headers are there when you want the other reading.

## Shape of the query

`src/features/user-activity/api/queries.ts`:

```ts
type UserActivity = {
  userId: number
  username: string
  syncCount: number
  submissionCount: number
  deviceCount: number
  lastSyncAt: Date | null // null = nothing in the window
}

listUserActivity(db, { since: Date }): Promise<UserActivity[]>
```

```sql
select u.id, u.username,
       count(s.id)::int                          as sync_count,
       coalesce(sum(s.submission_count), 0)::int as submission_count,
       count(distinct s.device_id)::int          as device_count,
       max(s.synced_at)                          as last_sync_at
from app_user u
left join device_sync s on s.user_id = u.id and s.synced_at >= $since
group by u.id, u.username
```

Two details carry the whole query:

- The window predicate sits in the `on` clause, not in `where`. In `where` it would drop exactly
  the inactive users the issue asks to keep. This is Django's `FilteredRelation`.
- Every count is cast with `::int`. Postgres returns `count()` as `bigint`, and `pg` hands
  `bigint` back as a **string**, so without the cast the table would sort `"9"` above `"10"`.

The function takes `since` as a `Date` rather than a period name, so a test pins the window instead
of racing the clock.

No migration: every column already exists and `device_sync (synced_at desc)` is already indexed.

## Shape of the components

`userActivity.list` takes `{ period: '7d' | '30d' | '90d' }`, turns it into a `since` date and calls
the query. It does nothing else.

`UserActivityPage` holds the period in state, passes it to `useQuery`, and renders a loader, an
alert or the table — as `SyncsPage` does today. Changing the period changes the tRPC input and
react-query refetches.

`UserActivityTable` takes `rows: UserActivity[]` and owns the sort: column and direction in state,
sorting the array it was handed. Default `username` ascending. `lastSyncAt` nulls sort to the bottom
in both directions — a blank is never "the most recent". It touches neither the network nor tRPC, so
it is testable on props alone.

New files: `src/features/user-activity/{api/queries.ts, api/queries.test.ts, api/router.ts,
ui/UserActivityPage.tsx, ui/UserActivityTable.tsx, ui/UserActivityTable.test.tsx}` and
`src/routes/users.tsx`. One line each in `src/features/router.ts` and `src/features/nav.ts`.

## Acceptance criteria

- `/users` is reachable from a **Users** nav entry and lists one row per `app_user` row.
- Columns: user, syncs, submissions, devices, last sync.
- The window switches between 7 days, 30 days and 3 months, and opens on 7 days.
- Clicking a column header sorts by it; clicking again reverses it. `lastSyncAt` nulls stay last.
- A user with no sync in the window appears with zeros and an em-dash, dimmed.
- Counts are `number`, not `string`.
- `pnpm test` and `pnpm exec tsc --noEmit` pass.

### Tests

Query, on in-process Postgres: a user with no syncs at all appears with zeros and `lastSyncAt`
null; a user whose only sync predates `since` also appears with zeros; two syncs from one device
count as one device; the counts come back as `number`.

Table, in jsdom: one row per user; clicking **Syncs** reorders the rows; a quiet user's row shows
the em-dash.

No test for the route, the page or the procedure (`CLAUDE.md`).

## Out of scope

Per-user drill-down, a district or team column (`app_user` holds only an id and a username — there
is nothing to join to), custom date ranges, CSV export, pagination.
