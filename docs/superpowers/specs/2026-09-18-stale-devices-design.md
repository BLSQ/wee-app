# Devices that have stopped syncing — Design

**Date:** 2026-09-18
**Status:** Approved
**Issue:** [#2](https://github.com/BLSQ/wee-app/issues/2)

## Purpose

A supervisor needs to see which devices have gone quiet, so they can call the people carrying them
before data is lost. Today the dashboard shows the syncs that did happen; nothing shows the absence
of one. The database holds one row per sync and no "last sync" column, so a device that stopped
three weeks ago is invisible: it simply stops appearing near the top of `/syncs`.

The page must also show devices that never synced at all. They have no `device_sync` row, so every
inner join written so far drops them.

## Approaches considered

Picking each device's most recent sync:

1. **`LEFT JOIN LATERAL` with `limit 1` (chosen).** For each device, a correlated subquery returns
   its newest `device_sync` row — the shape a Django developer writes with `Subquery` and
   `OuterRef`. It walks the existing `device_sync (device_id, synced_at desc)` index, yields exactly
   one row per device, carries the last user with no second join, and `LEFT` keeps the never-synced
   devices with nulls.
2. `DISTINCT ON (device_id)`. Compact, but it starts from syncs, so keeping devices that have none
   turns the join round and reads backwards.
3. A `group by device_id` subquery of `max(synced_at)`, joined back to `device_sync` for the user.
   The most portable shape, but two joins, and it emits a device twice when two of its syncs share
   a timestamp.

Devices that never synced are shown in **their own block below the stale table**, not mixed into it
and not behind a tab. The block is **folded by default**, showing its count: the list is a standing
inventory problem rather than today's call list, so it belongs on the page without competing with
the devices that did stop syncing. The count stays visible, which is what keeps it from being
forgotten; unfolding it is one click.

## Decision

### The query — `src/features/stale-devices/api/queries.ts`

```ts
export type StaleDevice = {
  id: number
  serial: string
  facilityName: string
  districtName: string
  lastSyncedAt: Date | null
  lastUsername: string | null
}

export async function listStaleDevices(
  db: Kysely<Database>,
  params: { now: Date; days: number },
): Promise<StaleDevice[]>
```

- `now` is a parameter, never `now()` in the SQL. That is the rule in the header of
  `src/server/db/test-helpers.ts`, and it is what lets a test choose the date. The cutoff is
  `now - days × 24h`, computed in TypeScript.
- `device`, left-joined laterally to its newest sync, joined to its facility and to the facility's
  district. The district is the second segment of `org_unit.path`, as in `listRecentSyncs`; no
  recursive query.
- `where last sync is null or last sync < cutoff`. A device that never synced is returned whatever
  `days` is.
- `order by last sync asc nulls first, serial asc`. The serial makes the order deterministic, which
  the tests depend on.

### The page — `src/features/stale-devices/ui/`

- `StaleDeviceTable.tsx` takes `devices: StaleDevice[]` and `emptyMessage: string`. It is rendered
  twice, once per block; a null `lastSyncedAt` renders as "never" and the user as "—", so one
  component serves both. Dates read "34 days ago" with the exact timestamp in the `title`, as in
  `SyncTable`.
- `NeverSyncedSection.tsx` wraps the second table in a Mantine `Collapse`, closed at first, behind a
  button reading "Never synced (12)". `keepMounted={false}`, so the rows leave the document while it
  is closed rather than staying there for a screen reader to read out. It owns its open/closed state,
  which is why it is a component of its own: the page stays free of state and untested, and the
  fold is tested where the repository says to test it — on a component that takes props.
- `StaleDevicesPage.tsx` holds a Mantine `NumberInput` (1–365, default 7). The URL is the only home
  of the value: the box reads it from the route and writes it back with `replace`, so the page needs
  no `useState` and no `useEffect`, and the browser's back button is not filled with every digit
  typed. A keystroke therefore costs a query; the fleet is 200 devices, so debouncing can wait until
  it is visibly needed. The page splits the one list on `lastSyncedAt === null` and shows a count in
  each heading: "Silent for more than 7 days (18)", "Never synced (12)".
- `src/routes/stale-devices.tsx` validates `?days=` with zod — integer, 1–365, `.catch(7)` — so a
  hand-edited URL falls back instead of erroring. The value lives in the URL so a supervisor can
  bookmark it or send it to a colleague.
- One line in `src/features/router.ts` (`staleDevices`) and one in `src/features/nav.ts`
  ("Stale devices" → `/stale-devices`). Nowhere else.
- The tRPC procedure validates its input and calls the query, so it gets no test.

`SyncTable`'s six-line `relativeDays` helper is **copied** into the new feature rather than extracted
to a shared module: features stay independent, and a shared file is one more place parallel pairs
collide. Extract it when a third copy appears.

## Acceptance criteria

- [ ] `/stale-devices` lists devices whose last sync is older than N days, oldest first, with
      serial, facility, district, last sync and last user.
- [ ] A second block, folded by default and showing its count, lists devices that never synced,
      marked as such, whatever N is.
- [ ] Changing the number box changes the list and the URL; reloading `?days=14` keeps the value;
      `?days=abc` falls back to 7.
- [ ] Query tests, seen failing first: a device exactly at the cutoff and one either side; a device
      judged on its *newest* sync, not on an older one; a never-synced device returned for every N;
      never-synced first then oldest first; facility, district and last user resolved.
- [ ] Component tests, seen failing first: a row with its values and its relative date, "never" and
      "—" for a device that never synced, the empty message, and a never-synced section that starts
      folded and opens on a click.
- [ ] `pnpm test`, `pnpm exec tsc --noEmit` and `pnpm format` are clean.
- [ ] ADR additions or updates proposed after implementation.

## Out of scope

Filtering by district or by user (issues #17 and #19). The map (#3). A device detail page (#6).
Pagination or a row limit: the fleet is 200 devices, so the whole list fits. Any contact detail or
action beyond naming the last user — the database holds no phone number.

## Risk

"Older than N days" means N × 24 hours before the request, not N calendar days. A device that synced
yesterday evening and one that synced this morning therefore cross the one-day threshold at
different times of day. Calendar-day truncation was set aside because it needs a time zone, and the
right one is the supervisor's, which the application does not know (there is no sign-in, ADR 0008).

`lastUsername` names the person who last synced the device, which is the best guess at who holds it
now. It can be wrong when a device changes hands.
