# Daily sync trend — Implementation Plan

**Goal:** `/trend` charts the last 30 days of syncs and the resources they carried, with silent days
drawn as zero, above three summary numbers.

**Spec:** `docs/superpowers/specs/2026-09-18-sync-trend-design.md`

**Constraints:** one page (ADR 0009). Implemented directly, test first, commit after each task.
`WINDOW_DAYS = 30`. Bars blue `#2a78d6`, line orange `#eb6834`. Days are UTC. Every `count` and
`sum` carries an `::int` cast, or the `pg` driver returns a string.

## Task 1: `listDailyActivity`

Create `src/features/sync-trend/api/queries.ts` and `src/features/sync-trend/api/queries.test.ts`.

- [ ] Write the first test, copying the `beforeAll` / `beforeEach` / `afterAll` block from
      `src/features/device-syncs/api/queries.test.ts`: with no rows at all,
      `listDailyActivity(db, { now: new Date('2026-09-18T12:00:00Z'), days: 30 })` returns 30 rows,
      every one `{ syncCount: 0, resourceCount: 0 }`, the first day `2026-08-20T00:00:00Z` and the
      last `2026-09-18T00:00:00Z`. Run it, watch it fail on the missing module.
- [ ] Write the query:

```ts
import { type Kysely, sql } from 'kysely'
import type { Database } from '#/server/db'

export type DailyActivity = { day: Date; syncCount: number; resourceCount: number }

/**
 * One row per day for the last `days` days, ending today. The calendar comes from
 * `generate_series` and the syncs are joined onto it, so a day with no sync is a
 * row of zeros rather than a missing row: the chart must not jump the gap.
 */
export async function listDailyActivity(
  db: Kysely<Database>,
  params: { now: Date; days: number },
): Promise<DailyActivity[]> {
  const today = sql`date_trunc('day', ${params.now}::timestamptz)`
  const { rows } = await sql<DailyActivity>`
    select
      day,
      count(sync.id)::int as "syncCount",
      coalesce(
        sum(sync.submission_count + sync.org_unit_count + sync.entity_count), 0
      )::int as "resourceCount"
    from generate_series(
      ${today} - make_interval(days => ${params.days - 1}),
      ${today},
      interval '1 day'
    ) as day
    left join device_sync as sync
      on sync.synced_at >= day and sync.synced_at < day + interval '1 day'
    group by day
    order by day
  `.execute(db)
  return rows
}
```

- [ ] Add the remaining tests, each watched failing first by breaking the query and restoring it:
      a day with two syncs reports `syncCount: 2`; `resourceCount` adds all three counters
      (`insertSync(db, { syncedAt, submissionCount: 3, orgUnitCount: 2, entityCount: 5 })` gives
      `10`); a sync at `2026-09-18T00:00:00Z` lands on the last day and one at
      `2026-08-19T23:59:59Z` appears nowhere while the result is still 30 rows.
- [ ] `pnpm test`. Commit.

## Task 2: `getActivityTotals`

Modify `queries.ts` and `queries.test.ts`.

- [ ] Write the failing test: three syncs in the current window and one in the previous window give
      `{ syncCount: 3, previousSyncCount: 1 }`, with `resourceCount` and `previousResourceCount`
      summing the three counters over each side. Watch it fail.
- [ ] Write the query:

```ts
export type ActivityTotals = {
  syncCount: number
  resourceCount: number
  previousSyncCount: number
  previousResourceCount: number
}

/** Totals for the window, and for the `days` before it, so the page can show a change. */
export async function getActivityTotals(
  db: Kysely<Database>,
  params: { now: Date; days: number },
): Promise<ActivityTotals> {
  const today = sql`date_trunc('day', ${params.now}::timestamptz)`
  const start = sql`${today} - make_interval(days => ${params.days - 1})`
  const resources = sql`submission_count + org_unit_count + entity_count`
  const { rows } = await sql<ActivityTotals>`
    select
      count(*) filter (where synced_at >= ${start})::int as "syncCount",
      coalesce(sum(${resources}) filter (where synced_at >= ${start}), 0)::int
        as "resourceCount",
      count(*) filter (where synced_at < ${start})::int as "previousSyncCount",
      coalesce(sum(${resources}) filter (where synced_at < ${start}), 0)::int
        as "previousResourceCount"
    from device_sync
    where synced_at >= ${start} - make_interval(days => ${params.days})
      and synced_at < ${today} + interval '1 day'
  `.execute(db)
  return rows[0]
}
```

- [ ] Add the boundary tests: a sync at the first second of the window counts as current, one a
      second earlier as previous, and one older than both windows is counted nowhere. With an empty
      table every number is `0`, not `null`.
- [ ] `pnpm test`. Commit.

## Task 3: the procedures, the route and the page

Create `src/features/sync-trend/api/router.ts`, `src/features/sync-trend/ui/TrendPage.tsx` and
`src/routes/trend.tsx`. Modify `src/features/router.ts` and `src/features/nav.ts`.

- [ ] `api/router.ts`. `now` is set here and never by the client, so a test can choose the date;
      both procedures only call a query, so neither gets a test (`CLAUDE.md`):

```ts
import { publicProcedure, router } from '#/server/trpc/base'
import { getActivityTotals, listDailyActivity } from './queries'

const WINDOW_DAYS = 30

export const syncTrendRouter = router({
  daily: publicProcedure.query(({ ctx }) =>
    listDailyActivity(ctx.db, { now: new Date(), days: WINDOW_DAYS }),
  ),
  totals: publicProcedure.query(({ ctx }) =>
    getActivityTotals(ctx.db, { now: new Date(), days: WINDOW_DAYS }),
  ),
})
```

- [ ] `src/features/router.ts`: import `syncTrendRouter` and add `syncTrend: syncTrendRouter`.
- [ ] `src/features/nav.ts`: add `{ label: 'Trend', to: '/trend' }`.
- [ ] `src/routes/trend.tsx`, copying `src/routes/syncs.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { TrendPage } from '#/features/sync-trend/ui/TrendPage'

export const Route = createFileRoute('/trend')({ component: TrendPage })
```

- [ ] `TrendPage.tsx`, modelled on `SyncsPage.tsx`: `Title` "Last 30 days", two `useQuery` calls on
      `trpc.syncTrend.daily.queryOptions()` and `trpc.syncTrend.totals.queryOptions()`, a `Loader`
      while either is pending, an `Alert color="red"` for either error, then `<ActivitySummary>` and
      `<ActivityChart>`. Leave both components as one-line stubs for now so the page compiles.
- [ ] `pnpm dev`, open `/trend`: the navbar has "Trend" and the page loads without a client-bundle
      error. `pnpm exec tsc --noEmit`. Commit.

## Task 4: `ActivitySummary`

Create `src/features/sync-trend/ui/ActivitySummary.tsx` and `ActivitySummary.test.tsx`.

- [ ] Write the failing tests with `renderWithProviders`: given
      `{ syncCount: 250, resourceCount: 4800, previousSyncCount: 200, previousResourceCount: 4000 }`
      the document shows `250`, `4800` and `+25%`; with `previousSyncCount: 400` it shows `-38%`;
      with `previousSyncCount: 0` it shows "no comparison" and no `%`.
- [ ] Implement it. Props are `{ totals: ActivityTotals }`. Three `Paper`s in a `Group`, each a
      dimmed `Text` label over a large `Text`: "Syncs", "Resources created", and "vs previous 30
      days". The change is over syncs, which is the question the page answers:

```tsx
function percentChange(current: number, previous: number) {
  if (previous === 0) return null // Nothing to divide by, and no honest number to show.
  return Math.round(((current - previous) / previous) * 100)
}
```

      Render `null` as "no comparison", and otherwise the rounded number with an explicit sign.
- [ ] `pnpm test`. Commit.

## Task 5: `ActivityChart`, then review

Create `src/features/sync-trend/ui/ActivityChart.tsx`. Modify `TrendPage.tsx`.

- [ ] Write the component. It takes `{ days: DailyActivity[] }`. The x axis needs a string, so the
      `Date` becomes `MM-DD` from its ISO form, which is UTC like the bucketing:

```tsx
import { CompositeChart } from '@mantine/charts'
import type { DailyActivity } from '../api/queries'

// Not tested: jsdom computes no layout, so a chart draws nothing there. What is
// testable about this component is the data it receives, which queries.test.ts
// covers, and how it looks, which the preview deployment shows. See CLAUDE.md.
export function ActivityChart({ days }: { days: DailyActivity[] }) {
  const data = days.map((day) => ({
    day: day.day.toISOString().slice(5, 10),
    syncCount: day.syncCount,
    resourceCount: day.resourceCount,
  }))

  return (
    <CompositeChart
      h={320}
      data={data}
      dataKey="day"
      withLegend
      withRightYAxis
      yAxisLabel="Syncs"
      rightYAxisLabel="Resources created"
      curveType="linear"
      series={[
        { name: 'syncCount', label: 'Syncs', color: '#2a78d6', type: 'bar' },
        {
          name: 'resourceCount',
          label: 'Resources created',
          color: '#eb6834',
          type: 'line',
          yAxisId: 'right',
        },
      ]}
    />
  )
}
```

- [ ] Replace the stubs in `TrendPage.tsx` with the real components.
- [ ] `pnpm dev` and look at `/trend` against the seeded database: 30 bars, a line on the right
      axis, a legend, and the districts that stopped syncing visible as a fall. Confirm a silent day
      reads as a zero bar and the line touching the floor, not as a gap.
- [ ] `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm format`, `pnpm build`. Commit.
- [ ] One round of review (`requesting-code-review`), fixes, then propose the ADR for the dual-axis
      decision (`writing-adrs`). Push the branch and open the pull request.
