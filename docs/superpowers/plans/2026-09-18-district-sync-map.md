# District sync health map — implementation plan

> **For agentic workers:** implement this directly, task by task, in this session. `CLAUDE.md`
> rules out `subagent-driven-development` for this repository. Steps use `- [ ]` for tracking.

**Goal:** colour Sierra Leone's thirteen districts on `/syncs` by the share of their devices that
synced in the last seven days, and let a click filter the table below.

**Architecture:** one new query returns per-district counts and the `geometry` jsonb column; a
pure module turns counts into a percentage, a bucket and a GeoJSON `FeatureCollection`; a MapLibre
component draws it and reports clicks; the selected district lives in the URL.

**Tech stack:** Kysely on Postgres, tRPC, TanStack Router, Mantine, `maplibre-gl` (already a
dependency, so far unused), Vitest with PGlite and jsdom.

**Spec:** `docs/superpowers/specs/2026-09-18-district-sync-map-design.md`

## Global constraints

- Everything in English: code, comments, commits.
- The window is **7 days**; the thresholds are **80%** and **50%**; the no-devices colour is grey.
- Aggregates are cast to `int` in SQL. `count()` is a `bigint`, which `pg` returns as a string.
- A query that depends on the current time takes `now: Date` as a parameter, never `now()` in SQL.
- Browser code never imports from `src/server/`, except `import type`.
- In this environment `pnpm` is at `/home/mbayang/.local/share/pnpm/bin/pnpm`; the plan writes
  `pnpm` for readability.
- Every task: red test, green test, `pnpm exec tsc --noEmit`, commit.

---

### Task 1: the district health query

**Files:** modify `src/server/db/test-helpers.ts`, `src/features/device-syncs/api/queries.ts`,
`src/features/device-syncs/api/queries.test.ts`

**Produces:** `DistrictSyncHealth = { id, name, deviceCount, syncedDeviceCount, geometry }` and
`districtSyncHealth(db, { now, days }): Promise<DistrictSyncHealth[]>`, ordered by name.

- [ ] Give `insertOrgUnit` an optional `geometry?: GeoJSON.MultiPolygon` parameter, stored with
      `JSON.stringify`. No test of its own; Task 1's geometry test covers it.
- [ ] Write the failing tests in `queries.test.ts`, in a `describe('districtSyncHealth')`. Build
      the fixture with `insertOrgUnit` (country → district → chiefdom → facility), `insertDevice`
      and `insertSync`, and pass an explicit `now`:
      - counts every device in the district, whether or not it ever synced
      - counts a device once however many times it synced in the window
      - ignores a sync older than the window (8 days), counts one inside it (6 days)
      - returns a district that has no devices at all, with both counts zero
      - returns the district's `geometry` as a parsed object
      - a device with no sync ever stays in `deviceCount` and out of `syncedDeviceCount`
- [ ] Run `pnpm test queries` and see them fail.
- [ ] Implement `districtSyncHealth`: select from `org_unit as district` where `level = 2`, left
      join `org_unit as facility` on `facility.level = 4 and split_part(facility.path, '.', 2)::int
      = district.id`, left join `device` on `device.org_unit_id = facility.id`. Two aggregates as
      `sql<number>` fragments: `cast(count(device.id) as int)`, and the same with
      `filter (where exists (select 1 from device_sync s where s.device_id = device.id and
      s.synced_at >= ${since}))`. `since = new Date(now.getTime() - days * 86_400_000)`. Group by
      the three district columns, order by name.
- [ ] Run `pnpm test queries` and `pnpm exec tsc --noEmit`. Both pass.
- [ ] Commit: `feat: query sync health per district`.

### Task 2: filter the syncs list by district, and expose both over tRPC

**Files:** modify `src/features/device-syncs/api/queries.ts`, `queries.test.ts`, `api/router.ts`

**Consumes:** Task 1. **Produces:** `deviceSyncs.districtHealth` and `districtId` on
`deviceSyncs.list`.

- [ ] Write the failing tests: with syncs in two districts, `listRecentSyncs(db, { limit: 10,
      districtId })` returns only that district's rows; without `districtId` it returns both.
- [ ] Run `pnpm test queries` and see them fail.
- [ ] Add `districtId?: number` to the params and, when set, a `where` on
      `split_part(facility.path, '.', 2)::int`.
- [ ] Run `pnpm test queries`. All green, including the untouched existing cases.
- [ ] Add to `deviceSyncsRouter`: `districtHealth: publicProcedure.query(({ ctx }) =>
      districtSyncHealth(ctx.db, { now: new Date(), days: 7 }))`, and
      `districtId: z.number().int().optional()` on `list`'s input. No test: both only validate
      input and call a query.
- [ ] Run `pnpm exec tsc --noEmit`. Commit: `feat: filter syncs by district over tRPC`.

### Task 3: the pure health module

**Files:** create `src/features/device-syncs/ui/health.ts` and `ui/health.test.ts`

**Consumes:** `DistrictSyncHealth` (type only). **Produces:** `BUCKETS`, `bucketOf(row)`,
`percentOf(row)`, `toFeatureCollection(rows)`.

- [ ] Write `health.test.ts`, a `.test.ts` so it runs in Node, not jsdom:
      - `percentOf` is `null` when `deviceCount` is 0, and rounds: 2 of 3 → 67
      - `bucketOf` at the boundaries: 80 → `healthy`, 79 → `at-risk`, 50 → `at-risk`,
        49 → `critical`, 0 devices → `no-devices` (not `critical`)
      - `toFeatureCollection` skips a district whose `geometry` is null, and puts `id`, `name`,
        `percent` and the bucket's `color` on each feature's properties
- [ ] Run `pnpm test health` and see it fail.
- [ ] Implement. `BUCKETS` is the single colour table: `healthy #2f9e44`, `at-risk #f08c00`,
      `critical #e03131`, `no-devices #adb5bd`, each with a label for the legend.
- [ ] Run `pnpm test health` and `pnpm exec tsc --noEmit`. Commit: `feat: derive district sync
      health buckets`.

### Task 4: the legend

**Files:** create `src/features/device-syncs/ui/DistrictLegend.tsx` and `DistrictLegend.test.tsx`

**Consumes:** `BUCKETS`. **Produces:** `<DistrictLegend />`, no props.

- [ ] Write `DistrictLegend.test.tsx` on the `SyncTable.test.tsx` pattern, with
      `renderWithProviders`: the four labels are visible, in the order of `BUCKETS`.
- [ ] Run `pnpm test DistrictLegend` and see it fail.
- [ ] Implement: a Mantine `Group` of swatch + label per bucket.
- [ ] Run `pnpm test DistrictLegend` and `pnpm exec tsc --noEmit`. Commit: `feat: add the district
      health legend`.

### Task 5: the map

**Files:** create `src/features/device-syncs/ui/DistrictMap.tsx`; modify `src/routes/__root.tsx`

**Consumes:** `toFeatureCollection`. **Produces:** `<DistrictMap districts selectedDistrictId
onSelect />`.

No test: jsdom has no WebGL and `pnpm test` runs no browser. The preview deployment is the check.

- [ ] Add `maplibre-gl/dist/maplibre-gl.css?url` to the root route's `links`, beside Mantine's.
- [ ] Write the component. A `useEffect` creates the `Map` on a ref'd `div` with a style of one
      background layer (`#f1f3f5`) and no tile source, adds a `geojson` source from
      `toFeatureCollection`, then a `fill` layer painted `['get', 'color']`, a thin outline, and a
      second outline layer filtered to the hovered or selected id. `fitBounds` to the data so
      nothing hard-codes where Sierra Leone is. Cleanup calls `map.remove()`.
- [ ] Wire the events: `mousemove` and `mouseleave` on the fill layer set the hover and the
      cursor; `click` on the layer calls `onSelect(id)` and opens a `Popup` with the district name,
      `deviceCount` and the percentage; `click` on the map outside the layer calls `onSelect(null)`.
- [ ] Render the map only once mounted, so the server pass never touches `window`.
- [ ] Run `pnpm exec tsc --noEmit`. Commit: `feat: draw districts on a MapLibre map`.

### Task 6: put it on the page

**Files:** modify `src/routes/syncs.tsx` and `src/features/device-syncs/ui/SyncsPage.tsx`

**Consumes:** Tasks 2–5.

- [ ] Add `validateSearch` to the route with `z.object({ district: z.number().int().optional() })`,
      so a stray value is rejected before it reaches the API.
- [ ] In `SyncsPage`, read `district` from the route, query `districtHealth`, pass `districtId` to
      the `list` query, and render the map and legend above the table. `onSelect` navigates with
      the new search value rather than setting state.
- [ ] When a district is selected, show its name above the table with a "show all" button that
      clears the search param.
- [ ] Run `pnpm test` — the whole suite, including the untouched `SyncTable` tests.
- [ ] Run `pnpm exec tsc --noEmit` and `pnpm format`.
- [ ] Run `pnpm dev` and check the six acceptance criteria in the spec by hand: thirteen districts
      coloured, legend, hover outline, click popup, table filtered, URL carries the district, a
      district with no devices grey.
- [ ] Commit: `feat: show district sync health on the syncs page`.

### After the tasks

- [ ] Request one round of review (`requesting-code-review`).
- [ ] Propose an ADR (`writing-adrs`): drawing maps with `maplibre-gl` directly rather than
      `react-map-gl`, and leaving the WebGL canvas untested, are both decisions a later reader
      would otherwise have to reverse-engineer.
- [ ] Push the branch and open the pull request. Never merge into `main` locally.
