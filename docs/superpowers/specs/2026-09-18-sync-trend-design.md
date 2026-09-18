# Daily sync trend — Design

**Date:** 2026-09-18
**Status:** Approved
**Issue:** [#5](https://github.com/BLSQ/wee-app/issues/5)

## Purpose

The Syncs page answers "what happened last", one row at a time. Nobody can tell from it whether
activity is rising or falling, which is the first question asked of a device fleet. A new page
charts the last 30 days: how many syncs arrived each day, and how much data they carried.

Days with no activity must be drawn as zero. A line that jumps a silent day hides exactly the event
the page exists to show.

## Approaches considered

1. **Two queries, the calendar generated in SQL (chosen).** `listDailyActivity` builds the 30 days
   with `generate_series` and left-joins the syncs onto it, so a silent day arrives as a real row
   with zeros. `getActivityTotals` returns this window's totals and the previous window's in one
   row, with `count(...) filter (where ...)`. Each function is a plain function taking `db`, tested
   for what it promises, and the zero requirement is enforced in the one place that can guarantee
   it.
2. One query for 60 days, arithmetic in the browser. One round trip, but it ships 60 rows to draw
   30 and show three numbers, and "the previous window" becomes a concept the page has to know.
3. Group in SQL, pad to 30 days in TypeScript. The padding is easy to unit-test, but the ticket's
   central requirement then lives outside the database and the next chart has to repeat it.

## Shape

```
src/features/sync-trend/
  api/queries.ts             listDailyActivity, getActivityTotals
  api/queries.test.ts
  api/router.ts              syncTrend.daily, syncTrend.totals
  ui/TrendPage.tsx           two useQuery, Loader / Alert, renders the two below
  ui/ActivityChart.tsx       props: days
  ui/ActivitySummary.tsx     props: totals
  ui/ActivitySummary.test.tsx
```

One line in `src/features/router.ts`, one in `src/features/nav.ts` (label "Trend"), and
`src/routes/trend.tsx` for the route `/trend`.

### Queries

```ts
type DailyActivity = { day: Date; syncCount: number; resourceCount: number }
type ActivityTotals = {
  syncCount: number
  resourceCount: number
  previousSyncCount: number
  previousResourceCount: number
}

listDailyActivity(db, { now: Date; days: number }): Promise<DailyActivity[]>
getActivityTotals(db, { now: Date; days: number }): Promise<ActivityTotals>
```

`resourceCount` is `submission_count + org_unit_count + entity_count`, summed over the day.

The window ends with today, so it runs from `date_trunc('day', now) - 29 days` to the end of today,
and the last bar is a day still in progress.

`now` is a parameter, set by the tRPC procedure and never by the client, so a test can choose the
date. Days are bucketed with `date_trunc('day', synced_at)` in UTC — the test helper already pins
the session to UTC to match Neon and the local container.

Postgres returns `count` and `sum` as `bigint`, which the `pg` driver hands back as a string. Both
carry an `::int` cast, or the chart receives `"62"` where it expects `62`.

Both procedures only validate input and call a query, so neither gets a test.

### Components

`ActivityChart` is `CompositeChart` from `@mantine/charts`, already a dependency: a bar series for
`syncCount` on the left axis and a line series for `resourceCount` on the right, with
`withRightYAxis`. Bars are blue `#2a78d6`, the line orange `#eb6834` — a pair checked against
protanopia, deuteranopia and tritanopia.

**The two y-axes are a deliberate choice, made against the usual advice.** The two series are about
fifteen times apart, and where the line sits against the bars is therefore decided by how the two
scales are picked, not by the data: a reader can infer a correlation the chart invented. The
alternative shown and set aside was two stacked plots, one scale each. Density won, on the grounds
that this page exists to be read at a glance. Revisit if a reader misreads it.

`ActivitySummary` shows total syncs, total resources, and the change against the previous 30 days.
When the previous window is empty there is no percentage to give, so it reads "no comparison"
rather than dividing by zero.

## Acceptance criteria

- [ ] `/trend` is reachable from the navbar and draws the last 30 days from the seeded database.
- [ ] `listDailyActivity` returns exactly 30 rows whatever the data, and a day with no syncs comes
      back as `0` rather than missing. Seen failing first.
- [ ] `resourceCount` adds all three counters; a sync at midnight today lands on today and one 30
      days back falls outside the window.
- [ ] `getActivityTotals` splits the current and previous windows at the right boundary.
- [ ] `ActivitySummary` renders its three numbers from props, and says "no comparison" when the
      previous window is empty.
- [ ] `pnpm test`, `pnpm exec tsc --noEmit` and `pnpm format` are clean.
- [ ] An ADR is proposed for the dual-axis decision.

## Out of scope

Filtering by district or device, a selectable range, CSV export, and drilling from a bar into that
day's syncs.

`ActivityChart` gets no test. jsdom computes no layout, so a chart draws nothing there; what is
testable about it is the data it receives, which `queries.test.ts` covers. A comment in the file
says so, and the preview deployment is where the chart is actually looked at.
