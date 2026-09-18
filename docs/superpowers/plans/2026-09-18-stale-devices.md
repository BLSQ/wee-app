# Stale devices page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `executing-plans` to implement this plan
> task by task. `CLAUDE.md` forbids `subagent-driven-development` in this repository.

**Goal:** A `/stale-devices` page listing every device whose last sync is older than N days, with
never-synced devices in their own block below.

**Architecture:** One query function takes `db`, `now` and `days` and returns one row per device,
its newest sync found with a `left join lateral`. One table component renders both blocks, a null
`lastSyncedAt` being the "never synced" case. The URL is the only home of N: the number box reads
it and writes it, with no local state.

**Tech Stack:** Kysely on Postgres, tRPC, TanStack Router, Mantine, Vitest (PGlite for queries,
jsdom for components).

**Spec:** `docs/superpowers/specs/2026-09-18-stale-devices-design.md`

## Global Constraints

- Everything in English: code, comments, commits.
- A feature lives in `src/features/stale-devices/` and registers itself in `src/features/router.ts`
  and `src/features/nav.ts`, nowhere else.
- Browser code never imports from `src/server/`, except `import type`.
- A query that depends on the current time takes `now: Date`; never `now()` in the SQL.
- Never mock `db` or tRPC. No snapshots. Pages, routes and a pass-through tRPC procedure get no test.
- Every task: test first, seen failing, then the code, then `pnpm test` green, then a commit.

---

### Task 1: The query

**Files:**
- Create: `src/features/stale-devices/api/queries.ts`
- Test: `src/features/stale-devices/api/queries.test.ts`

**Interfaces:**
- Consumes: `createTestDb`, `resetDb`, `insertOrgUnit`, `insertUser`, `insertDevice`, `insertSync`
  from `#/server/db/test-helpers`.
- Produces: `type StaleDevice = { id: number; serial: string; facilityName: string;
  districtName: string; lastSyncedAt: Date | null; lastUsername: string | null }` and
  `listStaleDevices(db, { now: Date, days: number }): Promise<StaleDevice[]>`.

- [ ] **Step 1: Write the failing test**

```ts
import type { Kysely } from 'kysely'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '#/server/db'
import {
  createTestDb,
  insertDevice,
  insertOrgUnit,
  insertSync,
  insertUser,
  resetDb,
} from '#/server/db/test-helpers'
import { listStaleDevices } from './queries'

let db: Kysely<Database>
beforeAll(async () => {
  db = await createTestDb()
})
beforeEach(() => resetDb(db))
afterAll(() => db.destroy())

const now = new Date('2026-09-18T12:00:00Z')
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000)

describe('listStaleDevices', () => {
  it('returns a stale device with its facility, district, last sync and last user', async () => {
    const country = await insertOrgUnit(db, { name: 'Sierra Leone' })
    const district = await insertOrgUnit(db, { name: 'Bombali', parent: country })
    const chiefdom = await insertOrgUnit(db, { name: 'Gbendembu', parent: district })
    const facility = await insertOrgUnit(db, { name: 'Gbendembu CHC', parent: chiefdom })
    const device = await insertDevice(db, { serial: 'SL-0117', facility })
    const user = await insertUser(db, { username: 'amara' })
    await insertSync(db, { device, user, syncedAt: daysAgo(34) })

    const rows = await listStaleDevices(db, { now, days: 7 })

    expect(rows).toMatchObject([
      {
        serial: 'SL-0117',
        facilityName: 'Gbendembu CHC',
        districtName: 'Bombali',
        lastSyncedAt: daysAgo(34),
        lastUsername: 'amara',
      },
    ])
  })

  it('leaves out a device that synced inside the window', async () => {
    const device = await insertDevice(db)
    await insertSync(db, { device, syncedAt: daysAgo(3) })

    expect(await listStaleDevices(db, { now, days: 7 })).toEqual([])
  })

  it('leaves out a device that synced exactly at the cutoff', async () => {
    // The cutoff is now - 7 days, and the test is "older than", not "older or equal".
    const device = await insertDevice(db)
    await insertSync(db, { device, syncedAt: daysAgo(7) })

    expect(await listStaleDevices(db, { now, days: 7 })).toEqual([])
  })

  it('judges a device on its newest sync, not an older one', async () => {
    const device = await insertDevice(db)
    await insertSync(db, { device, syncedAt: daysAgo(40) })
    await insertSync(db, { device, syncedAt: daysAgo(2) })

    expect(await listStaleDevices(db, { now, days: 7 })).toEqual([])
  })

  it('returns a device that never synced, whatever the threshold', async () => {
    await insertDevice(db, { serial: 'SL-0201' })

    const rows = await listStaleDevices(db, { now, days: 365 })

    expect(rows).toMatchObject([{ serial: 'SL-0201', lastSyncedAt: null, lastUsername: null }])
  })

  it('puts the never-synced devices first, then the oldest sync first', async () => {
    // Serials run the other way round, so a sort on the serial alone would fail this.
    const recent = await insertDevice(db, { serial: 'SL-0001' })
    await insertSync(db, { device: recent, syncedAt: daysAgo(10) })
    const older = await insertDevice(db, { serial: 'SL-0005' })
    await insertSync(db, { device: older, syncedAt: daysAgo(30) })
    await insertDevice(db, { serial: 'SL-0009' })

    const rows = await listStaleDevices(db, { now, days: 7 })

    expect(rows.map((row) => row.serial)).toEqual(['SL-0009', 'SL-0005', 'SL-0001'])
  })
})
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm exec vitest run src/features/stale-devices/api/queries.test.ts`
Expected: FAIL — `Failed to resolve import "./queries"`.

- [ ] **Step 3: Write the query**

```ts
import { type Kysely, sql } from 'kysely'
import type { Database } from '#/server/db'

export type StaleDevice = {
  id: number
  serial: string
  facilityName: string
  districtName: string
  lastSyncedAt: Date | null
  lastUsername: string | null
}

const DAY_MS = 86_400_000

/**
 * Devices that have stopped syncing: last sync older than `days`, oldest first,
 * plus every device that never synced at all, whatever `days` is.
 *
 * `now` is a parameter, not now() in the SQL, so a test can choose the date.
 *
 * Each device's newest sync comes from a `left join lateral`: a subquery allowed
 * to refer to the row it is joined to (`device.id` below), like a Django
 * Subquery/OuterRef. It reads the device_sync (device_id, synced_at desc) index
 * and yields one row per device; `left` keeps the devices that have no sync, with
 * nulls. The district is the second segment of org_unit.path, as in
 * listRecentSyncs.
 */
export async function listStaleDevices(
  db: Kysely<Database>,
  params: { now: Date; days: number },
): Promise<StaleDevice[]> {
  const cutoff = new Date(params.now.getTime() - params.days * DAY_MS)

  return db
    .selectFrom('device')
    .innerJoin('org_unit as facility', 'facility.id', 'device.org_unit_id')
    .innerJoin('org_unit as district', (join) =>
      join.on('district.id', '=', sql<number>`split_part(facility.path, '.', 2)::int`),
    )
    .leftJoinLateral(
      (eb) =>
        eb
          .selectFrom('device_sync as sync')
          .innerJoin('app_user as user', 'user.id', 'sync.user_id')
          .select(['sync.synced_at', 'user.username'])
          .whereRef('sync.device_id', '=', 'device.id')
          .orderBy('sync.synced_at', 'desc')
          .limit(1)
          .as('last'),
      (join) => join.onTrue(),
    )
    .select([
      'device.id as id',
      'device.serial as serial',
      'facility.name as facilityName',
      'district.name as districtName',
      'last.synced_at as lastSyncedAt',
      'last.username as lastUsername',
    ])
    .where((eb) => eb.or([eb('last.synced_at', 'is', null), eb('last.synced_at', '<', cutoff)]))
    // Postgres sorts nulls last on asc, and a device that never synced is the most stale of all.
    .orderBy('last.synced_at', (ob) => ob.asc().nullsFirst())
    .orderBy('device.serial', 'asc')
    .execute()
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `pnpm exec vitest run src/features/stale-devices/api/queries.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/stale-devices/api
git commit -m "Add the stale devices query"
```

---

### Task 2: The table component

**Files:**
- Create: `src/features/stale-devices/ui/StaleDeviceTable.tsx`
- Test: `src/features/stale-devices/ui/StaleDeviceTable.test.tsx`

**Interfaces:**
- Consumes: `StaleDevice` from `../api/queries`; `renderWithProviders`, `screen`, `within` from
  `#/ui/test-helpers`.
- Produces: `StaleDeviceTable({ devices: StaleDevice[]; emptyMessage: string })`. Five columns, in
  order: Device, Facility, District, Last sync, Last user.

- [ ] **Step 1: Write the failing test**

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, within } from '#/ui/test-helpers'
import type { StaleDevice } from '../api/queries'
import { StaleDeviceTable } from './StaleDeviceTable'

const device = (values: Partial<StaleDevice> = {}): StaleDevice => ({
  id: 1,
  serial: 'SL-0117',
  facilityName: 'Gbendembu CHC',
  districtName: 'Bombali',
  lastSyncedAt: new Date('2026-08-15T08:00:00Z'),
  lastUsername: 'amara',
  ...values,
})

const cellsOf = (serial: RegExp) =>
  within(screen.getByRole('row', { name: serial }))
    .getAllByRole('cell')
    .map((cell) => cell.textContent)

describe('StaleDeviceTable', () => {
  // The table shows dates relative to now. Only Date is faked, so clicks still work.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-18T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('shows a row for each device, with its values', async () => {
    await renderWithProviders(
      <StaleDeviceTable
        devices={[device(), device({ id: 2, serial: 'SL-0042', lastUsername: 'fatu' })]}
        emptyMessage="Nothing here"
      />,
    )

    expect(cellsOf(/SL-0117/)).toEqual([
      'SL-0117',
      'Gbendembu CHC',
      'Bombali',
      '34 days ago',
      'amara',
    ])
    expect(screen.getByRole('row', { name: /SL-0042/ })).toHaveTextContent('fatu')
    expect(screen.queryByText('Nothing here')).not.toBeInTheDocument()
  })

  it('marks a device that never synced', async () => {
    await renderWithProviders(
      <StaleDeviceTable
        devices={[device({ lastSyncedAt: null, lastUsername: null })]}
        emptyMessage="Nothing here"
      />,
    )

    expect(cellsOf(/SL-0117/).slice(3)).toEqual(['never', '—'])
  })

  it('shows the message it is given when the list is empty', async () => {
    await renderWithProviders(
      <StaleDeviceTable devices={[]} emptyMessage="Every device has synced at least once" />,
    )

    expect(screen.getByText('Every device has synced at least once')).toBeVisible()
  })
})
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `pnpm exec vitest run src/features/stale-devices/ui/StaleDeviceTable.test.tsx`
Expected: FAIL — `Failed to resolve import "./StaleDeviceTable"`.

- [ ] **Step 3: Write the component**

```tsx
import { Table, Text } from '@mantine/core'
import type { StaleDevice } from '../api/queries'

const DAY_MS = 86_400_000

// Copied from device-syncs/ui/SyncTable.tsx on purpose: features stay independent here.
// Extract it when a third copy appears.
function relativeDays(date: Date) {
  const days = Math.floor((Date.now() - date.getTime()) / DAY_MS)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export function StaleDeviceTable({
  devices,
  emptyMessage,
}: {
  devices: StaleDevice[]
  emptyMessage: string
}) {
  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Device</Table.Th>
          <Table.Th>Facility</Table.Th>
          <Table.Th>District</Table.Th>
          <Table.Th>Last sync</Table.Th>
          <Table.Th>Last user</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {devices.length === 0 && (
          <Table.Tr>
            <Table.Td colSpan={5}>
              <Text size="sm" c="dimmed" ta="center">
                {emptyMessage}
              </Text>
            </Table.Td>
          </Table.Tr>
        )}
        {devices.map((device) => (
          <Table.Tr key={device.id}>
            <Table.Td>{device.serial}</Table.Td>
            <Table.Td>{device.facilityName}</Table.Td>
            <Table.Td>{device.districtName}</Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed" title={device.lastSyncedAt?.toISOString()}>
                {device.lastSyncedAt ? relativeDays(device.lastSyncedAt) : 'never'}
              </Text>
            </Table.Td>
            <Table.Td>{device.lastUsername ?? '—'}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `pnpm exec vitest run src/features/stale-devices/ui/StaleDeviceTable.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/stale-devices/ui
git commit -m "Add the stale device table"
```

---

### Task 3: The page, the route and the two registries

**Files:**
- Create: `src/features/stale-devices/api/router.ts`,
  `src/features/stale-devices/ui/StaleDevicesPage.tsx`, `src/routes/stale-devices.tsx`
- Modify: `src/features/router.ts`, `src/features/nav.ts`

**Interfaces:**
- Consumes: `listStaleDevices` (Task 1), `StaleDeviceTable` (Task 2), `publicProcedure`/`router`
  from `#/server/trpc/base`, `trpc` from `#/lib/trpc`.
- Produces: `staleDevicesRouter` with `list({ days })`, reachable as `trpc.staleDevices.list`.

No test in this task: a route, a page that only fetches, and a procedure that validates its input
and calls a query all get none (`CLAUDE.md`). The check is Step 5, in the browser.

- [ ] **Step 1: Write the tRPC procedure**

`src/features/stale-devices/api/router.ts`:

```ts
import { z } from 'zod'
import { publicProcedure, router } from '#/server/trpc/base'
import { listStaleDevices } from './queries'

export const staleDevicesRouter = router({
  list: publicProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(7) }))
    .query(({ ctx, input }) => listStaleDevices(ctx.db, { now: new Date(), days: input.days })),
})
```

- [ ] **Step 2: Write the page**

`src/features/stale-devices/ui/StaleDevicesPage.tsx`. The URL holds N and nothing else does, so the
box reads `useSearch` and writes `navigate`: no `useState`, no `useEffect`. `getRouteApi` reads the
route's typed search parameters without importing the route file, which would be a circular import.

```tsx
import { Alert, Group, Loader, NumberInput, Stack, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { trpc } from '#/lib/trpc'
import { StaleDeviceTable } from './StaleDeviceTable'

const route = getRouteApi('/stale-devices')

export function StaleDevicesPage() {
  const { days } = route.useSearch()
  const navigate = route.useNavigate()
  const { data, isPending, error } = useQuery(trpc.staleDevices.list.queryOptions({ days }))
  const silent = data?.filter((device) => device.lastSyncedAt !== null) ?? []
  const neverSynced = data?.filter((device) => device.lastSyncedAt === null) ?? []

  return (
    <Stack>
      <Title order={3}>Stale devices</Title>
      <Group gap="xs">
        <Text size="sm">Silent for more than</Text>
        <NumberInput
          aria-label="Days without a sync"
          value={days}
          // replace, so stepping through values does not fill the back button.
          onChange={(value) =>
            typeof value === 'number' && navigate({ search: { days: value }, replace: true })
          }
          min={1}
          max={365}
          clampBehavior="strict"
          w={90}
        />
        <Text size="sm">days</Text>
      </Group>
      {isPending && <Loader />}
      {error && <Alert color="red">{error.message}</Alert>}
      {data && (
        <>
          <Title order={4}>
            Silent for more than {days} days ({silent.length})
          </Title>
          <StaleDeviceTable devices={silent} emptyMessage="No device has been silent that long" />
          <Title order={4}>Never synced ({neverSynced.length})</Title>
          <StaleDeviceTable
            devices={neverSynced}
            emptyMessage="Every device has synced at least once"
          />
        </>
      )}
    </Stack>
  )
}
```

- [ ] **Step 3: Write the route and register the feature**

`src/routes/stale-devices.tsx`. `validateSearch` parses `?days=`; `.catch(7)` means a
hand-edited or missing value falls back instead of erroring:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { StaleDevicesPage } from '#/features/stale-devices/ui/StaleDevicesPage'

const searchSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).catch(7),
})

export const Route = createFileRoute('/stale-devices')({
  validateSearch: searchSchema,
  component: StaleDevicesPage,
})
```

In `src/features/router.ts`, add the import and one entry:

```ts
import { staleDevicesRouter } from './stale-devices/api/router'
// ...
export const appRouter = router({
  deviceSyncs: deviceSyncsRouter,
  staleDevices: staleDevicesRouter,
})
```

In `src/features/nav.ts`, add one item:

```ts
export const navItems: { label: string; to: string }[] = [
  { label: 'Syncs', to: '/syncs' },
  { label: 'Stale devices', to: '/stale-devices' },
]
```

- [ ] **Step 4: Run the whole suite and the type checker**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm format`
Expected: all tests pass, no type error. `src/routeTree.gen.ts` is regenerated by `pnpm dev`; if
`tsc` complains that `/stale-devices` is not a known route, start `pnpm dev` once and re-run.

- [ ] **Step 5: Check it in the browser**

Run: `pnpm dev`, then open `http://localhost:3000/stale-devices`.
Expected: devices silent for more than 7 days, oldest first; a "Never synced" block below with the
seed's 12 devices; typing 14 in the box updates both the list and the URL; opening
`/stale-devices?days=30` starts at 30; `/stale-devices?days=abc` falls back to 7.

- [ ] **Step 6: Commit**

```bash
git add src/features src/routes
git commit -m "Add the stale devices page"
```

---

## After the plan

- Propose ADR additions or updates with the `writing-adrs` skill. Likely candidates: the URL as the
  home of page state, and `left join lateral` as the shape for "latest row per parent".
- One round of review, then push the branch and open the pull request. Never merge into `main`
  locally.
