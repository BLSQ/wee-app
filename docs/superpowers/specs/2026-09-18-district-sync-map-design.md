# District sync health map

**Issue:** [#3](https://github.com/BLSQ/wee-app/issues/3) · **Date:** 2026-09-18

## Purpose

The syncs table lists what happened. It does not show *where* the problem is. A map of Sierra
Leone's thirteen districts, coloured by the share of each district's devices that synced in the
last seven days, does — and clicking a district narrows the table underneath it.

## Approaches considered

**Where the map data comes from.** One query returns the counts *and* the `geometry` column, and
the component builds the GeoJSON. Serving geometry from a second, cacheable procedure was set
aside: it splits one screen across two round trips for a payload of about 70 KB. Building the
`FeatureCollection` in SQL was set aside too — it moves presentation into the query and makes it
hard to read and to assert on.

**How MapLibre gets into React.** `maplibre-gl` directly, in a `useEffect`. It is already a
dependency and unused. `react-map-gl`, the declarative wrapper, reads better but is a new
dependency with its own API to learn in a three-hour workshop, and it hides the MapLibre concepts
the next ticket needs.

**The colour scale.** Three buckets and a "no devices" grey, rather than a continuous gradient:
discrete steps are readable at a glance and a boundary is a pure function a test can pin. Five
buckets would mostly add legend entries no district lands in.

**Where the map lives.** On `/syncs`, above the existing table, inside the `device-syncs` feature,
because the selection drives the table. No new feature folder, no new nav entry.

**Selection state.** The selected district lives in the URL as `?district=<id>`, typed with
`validateSearch`, rather than in `useState`: the page can be linked to, and a stray value is
rejected before it reaches the API.

## The query

`districtSyncHealth(db, { now, days })` in `src/features/device-syncs/api/queries.ts`:

```ts
export type DistrictSyncHealth = {
  id: number
  name: string
  deviceCount: number
  syncedDeviceCount: number
  geometry: GeoJSON.MultiPolygon | null
}
```

It starts from the districts and joins outwards, so a district with no devices still comes back:

```sql
select d.id, d.name, d.geometry,
       cast(count(dev.id) as int) as device_count,
       cast(count(dev.id) filter (
         where exists (select 1 from device_sync s
                       where s.device_id = dev.id and s.synced_at >= $since)
       ) as int) as synced_device_count
from org_unit d
left join org_unit f on f.level = 4 and split_part(f.path, '.', 2)::int = d.id
left join device dev on dev.org_unit_id = f.id
where d.level = 2
group by d.id, d.name, d.geometry
order by d.name
```

- It reuses the `split_part(path, '.', 2)` expression `listRecentSyncs` already uses to find a
  facility's district: no recursive query, and no PostGIS, because `geometry` is plain `jsonb`
  (ADR 0007).
- `cast(... as int)` is required, not cosmetic. Postgres `count()` is a `bigint`, which the `pg`
  driver returns as a **string** while PGlite may return a number — the tests-pass,
  production-breaks gap ADR 0003 warns about.
- `now` is a parameter rather than `now()` in the SQL, so a test chooses the date. The procedure
  fixes `days` at 7.
- The percentage is not in the query. The query returns two counts; a pure function derives the
  rest.

`listRecentSyncs` gains an optional `districtId`, applied with the same `split_part` expression.
Its existing behaviour and tests are unchanged.

tRPC gains `deviceSyncs.districtHealth` (no input) and `districtId` on `deviceSyncs.list`. Neither
procedure gets a test: both only validate input and call a query.

## The components

All four are new, in `src/features/device-syncs/ui/`.

`health.ts` — no React, no MapLibre:

```ts
export const BUCKETS = [
  { key: 'healthy',    label: '80% or more', color: '#2f9e44' },
  { key: 'at-risk',    label: '50 – 79%',    color: '#f08c00' },
  { key: 'critical',   label: 'under 50%',   color: '#e03131' },
  { key: 'no-devices', label: 'no devices',  color: '#adb5bd' },
]
bucketOf(row): Bucket             // deviceCount === 0 → 'no-devices'
percentOf(row): number | null     // null when there are no devices
toFeatureCollection(rows): GeoJSON.FeatureCollection
```

`toFeatureCollection` writes `id`, `name`, `percent` and the bucket's `color` onto each feature's
properties, so the map paints itself with `['get', 'color']` and the legend reads the same table.
One colour list, two consumers.

`DistrictLegend.tsx` — four swatches with their labels. Props only.

`DistrictMap.tsx` — the MapLibre canvas. Props: `districts`, `selectedDistrictId`, `onSelect`. A
`useEffect` creates the map on mount and destroys it on unmount. The style is a flat grey
background layer plus a GeoJSON source with a fill layer, a thin outline, and a second outline
filtered to the hovered or selected district. `mousemove` sets the hover; `click` calls `onSelect`
and opens a popup with the district name, its device count and its percentage; a click off the
districts clears the selection. The map fits its bounds to the data, so nothing hard-codes where
Sierra Leone is.

Two constraints the stack imposes: MapLibre touches `window` and TanStack Start renders on the
server first, so the map is created only after mount; and `maplibre-gl.css` is loaded from the
route's `head` links, the way `__root.tsx` already loads Mantine's.

`SyncsPage.tsx` reads `?district=` from the route, runs both queries, and puts the map and legend
above the table. With a district selected it says so above the table, with a "show all" button.

## Testing

| What | Where | Why |
| --- | --- | --- |
| `districtSyncHealth`, and the new filter on `listRecentSyncs` | `api/queries.test.ts`, in-process Postgres | It is SQL. Cases: counts every device in the district; counts a device once however often it synced; ignores a sync older than the window; keeps a district with no devices; returns the geometry; a never-synced device stays in the denominator. |
| `bucketOf`, `percentOf`, `toFeatureCollection` | `ui/health.test.ts`, Node | Pure. The boundaries are 80 and 50 exactly, and zero devices is not zero percent. |
| `DistrictLegend` | `ui/DistrictLegend.test.tsx`, jsdom | Takes props. |

`DistrictMap` gets no test: jsdom has no WebGL, so the canvas cannot render, and `pnpm test` runs
no browser. The preview deployment of the pull request is the check — the line ADR 0003 already
draws for layout and CSS.

`insertOrgUnit` in `src/server/db/test-helpers.ts` gains an optional `geometry`, so a query test
can assert the polygon comes back.

## Acceptance criteria

1. `/syncs` shows the thirteen districts, each coloured by the share of its devices that synced in
   the last seven days, with a four-entry legend.
2. Hovering outlines a district; clicking opens a popup with its name, device count and sync
   percentage.
3. Clicking a district filters the table below to that district's syncs, and the URL carries the
   selection.
4. A district with no devices is grey, not red.
5. Drawing the map needs no API key, no tile service and no network request.
6. `pnpm test` and `pnpm exec tsc --noEmit` pass.

## Out of scope

Chiefdom polygons and facility points. A date-range control. Any metric other than the share of
devices that synced. The map on any page other than `/syncs`.
