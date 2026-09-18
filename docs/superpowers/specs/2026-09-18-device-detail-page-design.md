# Device detail page with its sync history — Design

**Date:** 2026-09-18
**Status:** Approved
**Issue:** [#6](https://github.com/BLSQ/wee-app/issues/6)

## Purpose

From the Syncs table a supervisor sees one line per sync and no way to ask "what has this device
been doing?". Issue #6 wants a page per device: where it lives, its whole sync history, and the
people who have used it — reachable from the serials already on screen.

That last link is the reason this needs a design. `device-syncs` would have to point at another
feature for the first time, and nothing in the repository says how one feature may depend on
another. Four to six pairs build features in parallel, so whatever this pull request does becomes
the precedent.

## Approaches considered

### How a feature links to another feature

1. **Name the route path, directly (chosen).** `SyncTable` renders
   `<Link to="/devices/$deviceId">`. The dependency is on a URL, not on the other feature's code.
   It is not a loose one: TanStack Router types `to` against `routeTree.gen.ts`, verified on this
   branch — a link to a route that does not exist fails `pnpm exec tsc --noEmit` with
   `Type '"/devices/$deviceId"' is not assignable to type '"." | "/syncs" | "/" | "/api/trpc/$" | ".."'`.
   The generated route tree is the registry, and it is checked.
2. A shared `src/features/links.ts` registry beside `router.ts` and `nav.ts`. Symmetric with
   ADR 0010, but it adds a third shared file for parallel pairs to collide in, and it re-states by
   hand what the route tree already types.
3. A `renderDevice` prop on `SyncTable`, supplied by `SyncsPage`. Decouples the component and not
   the feature — `SyncsPage` lives in `device-syncs` too — while costing a prop and a branch to
   test.

**The rule this sets:** a feature may name another feature's route path. It may never import
another feature's components, queries or types. This belongs in an ADR.

### Where the page lives

A new `src/features/devices/`, not an addition to `device-syncs`. Issues #2 and #17 are also about
devices and land in the same folder; `device-syncs` stays the feature about syncs.

### The page layout

Two columns: the sync history takes the width it needs on the left, the device's facts and its
users sit in a narrow right panel, so both are visible without scrolling. A stacked single column
and a tabbed version were mocked up and set aside — tabs hide half the answer behind a click.

## Shape

### Queries — `src/features/devices/api/queries.ts`, plain functions taking `db`

```ts
listDevices(db): DeviceListItem[]
// { id, serial, facilityName, districtName, syncCount, lastSyncedAt: Date | null }
// Every device, ordered by serial. Left join on device_sync, so the 12 devices that never
// synced are present with syncCount 0 and lastSyncedAt null.

getDeviceDetail(db, { deviceId, syncLimit }): DeviceDetail | null
// {
//   device: { id, serial, facilityName, districtName },
//   syncs: { id, username, syncedAt, submissionCount, orgUnitCount, entityCount }[],
//   syncCount: number,          // total, so the page can say "latest 100 of 144"
//   users:  { id, username, syncCount, lastSyncedAt }[],
// }
// null when no device has that id, so the procedure stays a one-liner and the page renders a
// message rather than a red error alert.
```

The district is the facility's level 2 ancestor, read as `split_part(facility.path, '.', 2)::int`,
exactly as `listRecentSyncs` already does. `users` is a `group by` on `device_sync` joined to
`app_user`, ordered by sync count descending.

`api/router.ts` exposes `devices.list` and `devices.detail` (`z.object({ deviceId: z.number().int() })`).
Both only validate input and call a query, so neither gets a test.

### Components — `src/features/devices/ui/`

| File | Takes | Tested |
| --- | --- | --- |
| `DeviceTable.tsx` | `devices: DeviceListItem[]` | yes |
| `DeviceSyncTable.tsx` | `syncs: DeviceSync[]` | yes |
| `DeviceUserTable.tsx` | `users: DeviceUser[]` | yes |
| `DevicesPage.tsx`, `DevicePage.tsx` | nothing; they fetch and compose | no |

Routes `src/routes/devices.index.tsx` and `src/routes/devices.$deviceId.tsx`. `$deviceId` is
`device.id`, a number: `DevicePage` parses it and renders the not-found message without querying
when it is not an integer.

### Changes outside the new feature

- `src/features/router.ts`, `src/features/nav.ts`: one line each (`Devices` → `/devices`).
- `src/features/device-syncs/api/queries.ts`: `RecentSync` gains `deviceId`, with an assertion in
  `queries.test.ts`.
- `src/features/device-syncs/ui/SyncTable.tsx`: the serial becomes a `Link`.
- `src/lib/relative-days.ts` (new, with a test): `relativeDays` moves out of `SyncTable.tsx`, where
  four tables now need it, and returns `never` for a device that has never synced.

## Acceptance criteria

- [ ] `/devices` lists every device with serial, facility, district, sync count and last sync;
      a device that never synced reads `never`.
- [ ] `/devices/<id>` shows the serial, facility and district; the latest 100 syncs newest first
      with the user and the three counters; and one row per user with their sync count and last use.
- [ ] More than 100 syncs shows how many there are in total.
- [ ] An id matching no device, and a non-numeric id, both render "Device not found" — no crash, no
      red error alert.
- [ ] A serial in the Syncs table opens that device's page.
- [ ] `queries.test.ts` covers both queries, including the never-synced device and the unknown id.
      Each test was seen failing first.
- [ ] `pnpm test`, `pnpm exec tsc --noEmit` and `pnpm format` are clean.
- [ ] An ADR proposes the cross-feature rule above.

## Out of scope

Pagination or a "show all" control on the sync history. Sorting, filtering or searching either
table. Health colouring or ordering by staleness on the device list — that is issue #2. Filtering
devices by user — issue #17. Charts, maps, and any change to the schema or the seed.

## Risk

`renderWithProviders` builds a memory router holding a single root route, so a `Link` to
`/devices/$deviceId` may not resolve inside `SyncTable`'s existing test. If it throws, the fix is to
give that test router the application's real route tree. This shows up at the first failing test,
not at the end.
