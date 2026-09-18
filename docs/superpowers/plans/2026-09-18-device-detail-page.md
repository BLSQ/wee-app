# Device detail page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task by task. `CLAUDE.md` forbids subagent-driven development here. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** A `/devices` list and a `/devices/$deviceId` page showing one device's facts, its sync
history and its users, reachable from the serials in the Syncs table.

**Architecture:** A new feature `src/features/devices/`, registered in `src/features/router.ts` and
`src/features/nav.ts`. Two query functions taking `db`, two thin tRPC procedures, three prop-taking
components with tests, two pages with none. `device-syncs` links to the new page by naming its
route path — never by importing its code.

**Tech Stack:** TanStack Start + Router, tRPC 11, Kysely 0.29 on Postgres, Mantine, Vitest with
PGlite (`*.test.ts`, Node) and Testing Library (`*.test.tsx`, jsdom).

**Spec:** `docs/superpowers/specs/2026-09-18-device-detail-page-design.md`

## Global Constraints

- Everything in English: code, comments, commits.
- Browser code never imports from `src/server/`, except `import type`.
- Database access lives in `src/features/devices/api/queries.ts`, as plain functions taking `db`.
- Never mock `db` or tRPC. No snapshots. Pages and routes get no test; a tRPC procedure that only
  validates input and calls a query gets none either.
- Every test is seen failing before the code that makes it pass is written.
- The sync history cap is `DEVICE_SYNC_LIMIT = 100`, exported from `queries.ts`.
- Commit after each task. Run `pnpm test` and `pnpm exec tsc --noEmit` before each commit.

---

### Task 1: A shared `relativeDays`, with `never`

`relativeDays` is private to `SyncTable.tsx`, and four tables now need it. It also has to say
something for a device that has never synced.

**Files:**
- Create: `src/lib/relative-days.ts`, `src/lib/relative-days.test.ts`
- Modify: `src/features/device-syncs/ui/SyncTable.tsx` (delete the local copy, import instead)

**Produces:** `relativeDays(date: Date | null): string` — `'today'`, `'yesterday'`,
`'N days ago'`, or `'never'` when `date` is `null`.

- [ ] **Step 1: Write the failing test** in `src/lib/relative-days.test.ts`

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { relativeDays } from './relative-days'

describe('relativeDays', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it.each([
    ['2026-09-10T08:00:00Z', 'today'],
    ['2026-09-09T08:00:00Z', 'yesterday'],
    ['2026-09-05T08:00:00Z', '5 days ago'],
  ])('reads %s as "%s"', (date, label) => {
    expect(relativeDays(new Date(date))).toBe(label)
  })

  it('says never when there is no date', () => {
    expect(relativeDays(null)).toBe('never')
  })
})
```

- [ ] **Step 2: Run it and watch it fail.** `pnpm test relative-days` — expected: cannot resolve
      `./relative-days`.

- [ ] **Step 3: Write the module**

```ts
const DAY_MS = 86_400_000

/** How long ago, in whole days, in the words the tables use. `null` means it never happened. */
export function relativeDays(date: Date | null): string {
  if (!date) return 'never'
  const days = Math.floor((Date.now() - date.getTime()) / DAY_MS)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}
```

- [ ] **Step 4: Point `SyncTable.tsx` at it.** Delete `DAY_MS` and the local `relativeDays`, and add
      `import { relativeDays } from '#/lib/relative-days'`. Nothing else in that file changes.

- [ ] **Step 5: Run `pnpm test`.** All green, including the untouched `SyncTable.test.tsx`.

- [ ] **Step 6: Commit.**

```bash
git add src/lib/relative-days.ts src/lib/relative-days.test.ts src/features/device-syncs/ui/SyncTable.tsx
git commit -m "Share relativeDays, and let it say never"
```

---

### Task 2: `listDevices`

**Files:**
- Create: `src/features/devices/api/queries.ts`, `src/features/devices/api/queries.test.ts`

**Produces:**

```ts
export type DeviceListItem = {
  id: number
  serial: string
  facilityName: string
  districtName: string
  syncCount: number
  lastSyncedAt: Date | null
}
export function listDevices(db: Kysely<Database>): Promise<DeviceListItem[]>
```

- [ ] **Step 1: Write the failing test.** Copy the `beforeAll` / `beforeEach` / `afterAll` frame
      from `src/features/device-syncs/api/queries.test.ts`, then:

```ts
describe('listDevices', () => {
  it('returns every device with its facility and district', async () => {
    const country = await insertOrgUnit(db, { name: 'Sierra Leone' })
    const district = await insertOrgUnit(db, { name: 'Bo', parent: country })
    const chiefdom = await insertOrgUnit(db, { name: 'Kakua', parent: district })
    const facility = await insertOrgUnit(db, { name: 'Bo Government Hospital', parent: chiefdom })
    await insertDevice(db, { serial: 'SL-0042', facility })

    expect(await listDevices(db)).toEqual([
      expect.objectContaining({
        serial: 'SL-0042',
        facilityName: 'Bo Government Hospital',
        districtName: 'Bo',
      }),
    ])
  })

  it('counts the syncs and keeps the most recent one', async () => {
    const device = await insertDevice(db)
    await insertSync(db, { device, syncedAt: new Date('2026-09-01T08:00:00Z') })
    await insertSync(db, { device, syncedAt: new Date('2026-09-03T08:00:00Z') })

    const [row] = await listDevices(db)

    expect(row).toMatchObject({
      syncCount: 2,
      lastSyncedAt: new Date('2026-09-03T08:00:00Z'),
    })
  })

  it('keeps a device that never synced, with no count and no date', async () => {
    await insertDevice(db, { serial: 'SL-0001' })

    expect(await listDevices(db)).toEqual([
      expect.objectContaining({ serial: 'SL-0001', syncCount: 0, lastSyncedAt: null }),
    ])
  })

  it('orders devices by serial', async () => {
    await insertDevice(db, { serial: 'SL-0009' })
    await insertDevice(db, { serial: 'SL-0002' })

    expect((await listDevices(db)).map((row) => row.serial)).toEqual(['SL-0002', 'SL-0009'])
  })
})
```

- [ ] **Step 2: Run it and watch it fail.** `pnpm test devices/api` — expected: cannot resolve
      `./queries`.

- [ ] **Step 3: Write the query.**

```ts
import { type Kysely, sql } from 'kysely'
import type { Database } from '#/server/db'

/** The syncs a device page shows at most. */
export const DEVICE_SYNC_LIMIT = 100

export type DeviceListItem = {
  id: number
  serial: string
  facilityName: string
  districtName: string
  syncCount: number
  lastSyncedAt: Date | null
}

/**
 * Every device, ordered by serial, with how much it has synced.
 *
 * The district is the facility's level 2 ancestor, and `org_unit.path` holds the dot-joined
 * ancestor ids, so it is the second path segment — the same trick as `listRecentSyncs`.
 * The join on `device_sync` is a left join, so the devices that never synced stay in the list.
 */
export async function listDevices(db: Kysely<Database>): Promise<DeviceListItem[]> {
  return db
    .selectFrom('device')
    .innerJoin('org_unit as facility', 'facility.id', 'device.org_unit_id')
    .innerJoin('org_unit as district', (join) =>
      join.on('district.id', '=', sql<number>`split_part(facility.path, '.', 2)::int`),
    )
    .leftJoin('device_sync as sync', 'sync.device_id', 'device.id')
    .select([
      'device.id as id',
      'device.serial as serial',
      'facility.name as facilityName',
      'district.name as districtName',
      // count(*) is a bigint, which the driver hands back as a string: cast it.
      sql<number>`count(sync.id)::int`.as('syncCount'),
      sql<Date | null>`max(sync.synced_at)`.as('lastSyncedAt'),
    ])
    .groupBy(['device.id', 'device.serial', 'facility.name', 'district.name'])
    .orderBy('device.serial')
    .execute()
}
```

- [ ] **Step 4: Run `pnpm test devices/api`.** All four pass.

- [ ] **Step 5: Commit.**

```bash
git add src/features/devices/api/queries.ts src/features/devices/api/queries.test.ts
git commit -m "Add listDevices"
```

---

### Task 3: `getDeviceDetail`

**Files:**
- Modify: `src/features/devices/api/queries.ts`, `src/features/devices/api/queries.test.ts`

**Consumes:** the file and imports from Task 2.

**Produces:**

```ts
export type DeviceSummary = { id: number; serial: string; facilityName: string; districtName: string }
export type DeviceSyncRow = {
  id: number
  username: string
  syncedAt: Date
  submissionCount: number
  orgUnitCount: number
  entityCount: number
}
export type DeviceUser = { id: number; username: string; syncCount: number; lastSyncedAt: Date }
export type DeviceDetail = {
  device: DeviceSummary
  syncs: DeviceSyncRow[]
  syncCount: number
  users: DeviceUser[]
}
export function getDeviceDetail(
  db: Kysely<Database>,
  params: { deviceId: number; syncLimit: number },
): Promise<DeviceDetail | null>
```

- [ ] **Step 1: Write the failing test**, appended to `queries.test.ts`.

```ts
describe('getDeviceDetail', () => {
  it('returns null for an id no device has', async () => {
    expect(await getDeviceDetail(db, { deviceId: 999, syncLimit: 10 })).toBeNull()
  })

  it('returns the device with its facility and district', async () => {
    const country = await insertOrgUnit(db, { name: 'Sierra Leone' })
    const district = await insertOrgUnit(db, { name: 'Bo', parent: country })
    const chiefdom = await insertOrgUnit(db, { name: 'Kakua', parent: district })
    const facility = await insertOrgUnit(db, { name: 'Bo Government Hospital', parent: chiefdom })
    const device = await insertDevice(db, { serial: 'SL-0042', facility })

    const detail = await getDeviceDetail(db, { deviceId: device.id, syncLimit: 10 })

    expect(detail?.device).toMatchObject({
      serial: 'SL-0042',
      facilityName: 'Bo Government Hospital',
      districtName: 'Bo',
    })
  })

  it('returns the syncs newest first, with the user and the counters', async () => {
    const device = await insertDevice(db)
    const user = await insertUser(db, { username: 'amara' })
    await insertSync(db, { device, user, syncedAt: new Date('2026-09-01T08:00:00Z') })
    const newer = await insertSync(db, {
      device,
      user,
      syncedAt: new Date('2026-09-03T08:00:00Z'),
      submissionCount: 12,
      orgUnitCount: 3,
      entityCount: 5,
    })

    const detail = await getDeviceDetail(db, { deviceId: device.id, syncLimit: 10 })

    expect(detail?.syncs[0]).toMatchObject({
      id: newer.id,
      username: 'amara',
      syncedAt: new Date('2026-09-03T08:00:00Z'),
      submissionCount: 12,
      orgUnitCount: 3,
      entityCount: 5,
    })
    expect(detail?.syncs).toHaveLength(2)
  })

  it('ignores the syncs of other devices', async () => {
    const device = await insertDevice(db)
    await insertSync(db, { device })
    await insertSync(db)

    const detail = await getDeviceDetail(db, { deviceId: device.id, syncLimit: 10 })

    expect(detail?.syncs).toHaveLength(1)
    expect(detail?.users).toHaveLength(1)
  })

  it('caps the syncs at the limit but counts them all', async () => {
    const device = await insertDevice(db)
    for (let i = 0; i < 3; i++) await insertSync(db, { device })

    const detail = await getDeviceDetail(db, { deviceId: device.id, syncLimit: 2 })

    expect(detail?.syncs).toHaveLength(2)
    expect(detail?.syncCount).toBe(3)
  })

  it('lists the users, busiest first, with their last use', async () => {
    const device = await insertDevice(db)
    const amara = await insertUser(db, { username: 'amara' })
    const fatu = await insertUser(db, { username: 'fatu' })
    await insertSync(db, { device, user: fatu, syncedAt: new Date('2026-09-01T08:00:00Z') })
    await insertSync(db, { device, user: amara, syncedAt: new Date('2026-09-02T08:00:00Z') })
    await insertSync(db, { device, user: amara, syncedAt: new Date('2026-09-04T08:00:00Z') })

    const detail = await getDeviceDetail(db, { deviceId: device.id, syncLimit: 10 })

    expect(detail?.users).toEqual([
      { id: amara.id, username: 'amara', syncCount: 2, lastSyncedAt: new Date('2026-09-04T08:00:00Z') },
      { id: fatu.id, username: 'fatu', syncCount: 1, lastSyncedAt: new Date('2026-09-01T08:00:00Z') },
    ])
  })

  it('returns a device that never synced, with nothing to show', async () => {
    const device = await insertDevice(db)

    const detail = await getDeviceDetail(db, { deviceId: device.id, syncLimit: 10 })

    expect(detail).toMatchObject({ syncs: [], users: [], syncCount: 0 })
  })
})
```

- [ ] **Step 2: Run it and watch it fail.** `pnpm test devices/api` — expected:
      `getDeviceDetail is not a function` / not exported.

- [ ] **Step 3: Write the query**, appended to `queries.ts` (types as in **Produces** above).

```ts
/**
 * One device with its history, or `null` when no device has that id. Returning `null` rather
 * than throwing is what lets the page show a message instead of an error alert.
 *
 * `syncs` is capped at `syncLimit`; `syncCount` is the real total, so the page can say how
 * many it is not showing.
 */
export async function getDeviceDetail(
  db: Kysely<Database>,
  params: { deviceId: number; syncLimit: number },
): Promise<DeviceDetail | null> {
  const device = await db
    .selectFrom('device')
    .innerJoin('org_unit as facility', 'facility.id', 'device.org_unit_id')
    .innerJoin('org_unit as district', (join) =>
      join.on('district.id', '=', sql<number>`split_part(facility.path, '.', 2)::int`),
    )
    .select([
      'device.id as id',
      'device.serial as serial',
      'facility.name as facilityName',
      'district.name as districtName',
    ])
    .where('device.id', '=', params.deviceId)
    .executeTakeFirst()

  if (!device) return null

  const [syncs, users, counted] = await Promise.all([
    db
      .selectFrom('device_sync as sync')
      .innerJoin('app_user as user', 'user.id', 'sync.user_id')
      .select([
        'sync.id as id',
        'user.username as username',
        'sync.synced_at as syncedAt',
        'sync.submission_count as submissionCount',
        'sync.org_unit_count as orgUnitCount',
        'sync.entity_count as entityCount',
      ])
      .where('sync.device_id', '=', params.deviceId)
      .orderBy('sync.synced_at', 'desc')
      .orderBy('sync.id', 'desc')
      .limit(params.syncLimit)
      .execute(),
    db
      .selectFrom('device_sync as sync')
      .innerJoin('app_user as user', 'user.id', 'sync.user_id')
      .select([
        'user.id as id',
        'user.username as username',
        sql<number>`count(*)::int`.as('syncCount'),
        sql<Date>`max(sync.synced_at)`.as('lastSyncedAt'),
      ])
      .where('sync.device_id', '=', params.deviceId)
      .groupBy(['user.id', 'user.username'])
      .orderBy('syncCount', 'desc')
      .orderBy('user.username')
      .execute(),
    db
      .selectFrom('device_sync')
      .select(sql<number>`count(*)::int`.as('syncCount'))
      .where('device_id', '=', params.deviceId)
      .executeTakeFirstOrThrow(),
  ])

  return { device, syncs, users, syncCount: counted.syncCount }
}
```

If `.orderBy('syncCount', 'desc')` does not typecheck against the select alias in this Kysely
version, use `.orderBy(sql`count(*)`, 'desc')` instead.

- [ ] **Step 4: Run `pnpm test devices/api`.** All seven new tests pass, and Task 2's four still do.

- [ ] **Step 5: Commit.**

```bash
git add src/features/devices/api/queries.ts src/features/devices/api/queries.test.ts
git commit -m "Add getDeviceDetail"
```

---

### Task 4: `DeviceTable`

**Files:**
- Create: `src/features/devices/ui/DeviceTable.tsx`, `src/features/devices/ui/DeviceTable.test.tsx`

**Consumes:** `DeviceListItem` from Task 2, `relativeDays` from Task 1.
**Produces:** `<DeviceTable devices={DeviceListItem[]} />`. The serial is a
`<Link to="/devices/$deviceId">`.

- [ ] **Step 1: Write the failing test.** Copy the frame of `SyncTable.test.tsx` — the fake clock
      matters, the table shows relative dates.

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, within } from '#/ui/test-helpers'
import type { DeviceListItem } from '../api/queries'
import { DeviceTable } from './DeviceTable'

const device = (values: Partial<DeviceListItem> = {}): DeviceListItem => ({
  id: 1,
  serial: 'SL-0042',
  facilityName: 'Bo Government Hospital',
  districtName: 'Bo',
  syncCount: 44,
  lastSyncedAt: new Date('2026-09-10T08:00:00Z'),
  ...values,
})

describe('DeviceTable', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('shows a row for each device, with its values', async () => {
    await renderWithProviders(
      <DeviceTable devices={[device(), device({ id: 2, serial: 'SL-0007' })]} />,
    )

    const cells = within(screen.getByRole('row', { name: /SL-0042/ }))
      .getAllByRole('cell')
      .map((cell) => cell.textContent)
    expect(cells).toEqual(['SL-0042', 'Bo Government Hospital', 'Bo', '44', 'today'])
    expect(screen.getByRole('row', { name: /SL-0007/ })).toBeVisible()
  })

  it('links a serial to that device', async () => {
    await renderWithProviders(<DeviceTable devices={[device({ id: 7 })]} />)

    expect(screen.getByRole('link', { name: 'SL-0042' })).toHaveAttribute('href', '/devices/7')
  })

  it('says never for a device that has not synced', async () => {
    await renderWithProviders(<DeviceTable devices={[device({ syncCount: 0, lastSyncedAt: null })]} />)

    expect(screen.getByRole('row', { name: /SL-0042/ })).toHaveTextContent('never')
  })

  it('says so when there is no device', async () => {
    await renderWithProviders(<DeviceTable devices={[]} />)

    expect(screen.getByText('No devices yet')).toBeVisible()
  })
})
```

- [ ] **Step 2: Run it and watch it fail.** `pnpm test DeviceTable`.

**If the `Link` throws** — `renderWithProviders` builds a memory router with a single root route —
fix it once, here, in `src/ui/test-helpers.tsx`: replace the one-off `createRootRoute` with the
application's `routeTree` from `#/routeTree.gen`, keeping `createMemoryHistory()` and a root route
that renders `ui`. Update the comment in that file to say why. Run `pnpm test` afterwards: every
existing component test must still pass.

- [ ] **Step 3: Write the component.**

```tsx
import { Table, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { relativeDays } from '#/lib/relative-days'
import type { DeviceListItem } from '../api/queries'

export function DeviceTable({ devices }: { devices: DeviceListItem[] }) {
  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Serial</Table.Th>
          <Table.Th>Facility</Table.Th>
          <Table.Th>District</Table.Th>
          <Table.Th>Syncs</Table.Th>
          <Table.Th>Last sync</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {devices.length === 0 && (
          <Table.Tr>
            <Table.Td colSpan={5}>
              <Text size="sm" c="dimmed" ta="center">
                No devices yet
              </Text>
            </Table.Td>
          </Table.Tr>
        )}
        {devices.map((device) => (
          <Table.Tr key={device.id}>
            <Table.Td>
              {/* device-syncs and devices link by route path, never by importing each other. */}
              <Link to="/devices/$deviceId" params={{ deviceId: String(device.id) }}>
                {device.serial}
              </Link>
            </Table.Td>
            <Table.Td>{device.facilityName}</Table.Td>
            <Table.Td>{device.districtName}</Table.Td>
            <Table.Td>{device.syncCount}</Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed" title={device.lastSyncedAt?.toISOString()}>
                {relativeDays(device.lastSyncedAt)}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
```

The `to` will not typecheck until Task 6 creates the route. That is the point of the design: run
`pnpm exec tsc --noEmit` at the end of Task 6, not now.

- [ ] **Step 4: Run `pnpm test DeviceTable`.** All four pass.

- [ ] **Step 5: Commit.**

```bash
git add src/features/devices/ui/DeviceTable.tsx src/features/devices/ui/DeviceTable.test.tsx src/ui/test-helpers.tsx
git commit -m "Add the device list table"
```

---

### Task 5: `DeviceSyncTable` and `DeviceUserTable`

**Files:**
- Create: `src/features/devices/ui/DeviceSyncTable.tsx` + `.test.tsx`,
  `src/features/devices/ui/DeviceUserTable.tsx` + `.test.tsx`

**Consumes:** `DeviceSyncRow`, `DeviceUser` from Task 3; `relativeDays` from Task 1.
**Produces:** `<DeviceSyncTable syncs={DeviceSyncRow[]} />`, `<DeviceUserTable users={DeviceUser[]} />`.

- [ ] **Step 1: Write `DeviceSyncTable.test.tsx`**

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, within } from '#/ui/test-helpers'
import type { DeviceSyncRow } from '../api/queries'
import { DeviceSyncTable } from './DeviceSyncTable'

const sync = (values: Partial<DeviceSyncRow> = {}): DeviceSyncRow => ({
  id: 1,
  username: 'amara',
  syncedAt: new Date('2026-09-10T08:00:00Z'),
  submissionCount: 12,
  orgUnitCount: 3,
  entityCount: 5,
  ...values,
})

describe('DeviceSyncTable', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('shows a row for each sync, with its values', async () => {
    await renderWithProviders(
      <DeviceSyncTable syncs={[sync(), sync({ id: 2, username: 'fatu' })]} />,
    )

    const cells = within(screen.getByRole('row', { name: /amara/ }))
      .getAllByRole('cell')
      .map((cell) => cell.textContent)
    expect(cells).toEqual(['today', 'amara', '12', '3', '5'])
    expect(screen.getByRole('row', { name: /fatu/ })).toBeVisible()
  })

  it('reads an older sync as days ago', async () => {
    await renderWithProviders(
      <DeviceSyncTable syncs={[sync({ syncedAt: new Date('2026-09-05T08:00:00Z') })]} />,
    )

    expect(screen.getByRole('row', { name: /amara/ })).toHaveTextContent('5 days ago')
  })

  it('says so when there is no sync', async () => {
    await renderWithProviders(<DeviceSyncTable syncs={[]} />)

    expect(screen.getByText('No syncs yet')).toBeVisible()
  })
})
```

- [ ] **Step 2: Write `DeviceUserTable.test.tsx`**

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, within } from '#/ui/test-helpers'
import type { DeviceUser } from '../api/queries'
import { DeviceUserTable } from './DeviceUserTable'

const user = (values: Partial<DeviceUser> = {}): DeviceUser => ({
  id: 1,
  username: 'amara',
  syncCount: 31,
  lastSyncedAt: new Date('2026-09-10T08:00:00Z'),
  ...values,
})

describe('DeviceUserTable', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('shows a row for each user, with its values', async () => {
    await renderWithProviders(
      <DeviceUserTable
        users={[
          user(),
          user({ id: 2, username: 'fatu', syncCount: 13, lastSyncedAt: new Date('2026-09-06T08:00:00Z') }),
        ]}
      />,
    )

    const cells = within(screen.getByRole('row', { name: /amara/ }))
      .getAllByRole('cell')
      .map((cell) => cell.textContent)
    expect(cells).toEqual(['amara', '31', 'today'])
    expect(screen.getByRole('row', { name: /fatu/ })).toHaveTextContent('4 days ago')
  })

  it('says so when nobody has used the device', async () => {
    await renderWithProviders(<DeviceUserTable users={[]} />)

    expect(screen.getByText('No users yet')).toBeVisible()
  })
})
```

- [ ] **Step 3: Run them and watch them fail.** `pnpm test DeviceSyncTable DeviceUserTable`.

- [ ] **Step 4: Write `DeviceSyncTable.tsx`.** No serial column — the page title already says which
      device this is.

```tsx
import { Table, Text } from '@mantine/core'
import { relativeDays } from '#/lib/relative-days'
import type { DeviceSyncRow } from '../api/queries'

export function DeviceSyncTable({ syncs }: { syncs: DeviceSyncRow[] }) {
  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Synced</Table.Th>
          <Table.Th>User</Table.Th>
          <Table.Th>Submissions</Table.Th>
          <Table.Th>Org units</Table.Th>
          <Table.Th>Entities</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {syncs.length === 0 && (
          <Table.Tr>
            <Table.Td colSpan={5}>
              <Text size="sm" c="dimmed" ta="center">
                No syncs yet
              </Text>
            </Table.Td>
          </Table.Tr>
        )}
        {syncs.map((sync) => (
          <Table.Tr key={sync.id}>
            <Table.Td>
              <Text size="sm" c="dimmed" title={sync.syncedAt.toISOString()}>
                {relativeDays(sync.syncedAt)}
              </Text>
            </Table.Td>
            <Table.Td>{sync.username}</Table.Td>
            <Table.Td>{sync.submissionCount}</Table.Td>
            <Table.Td>{sync.orgUnitCount}</Table.Td>
            <Table.Td>{sync.entityCount}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
```

- [ ] **Step 5: Write `DeviceUserTable.tsx`.**

```tsx
import { Table, Text } from '@mantine/core'
import { relativeDays } from '#/lib/relative-days'
import type { DeviceUser } from '../api/queries'

export function DeviceUserTable({ users }: { users: DeviceUser[] }) {
  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>User</Table.Th>
          <Table.Th>Syncs</Table.Th>
          <Table.Th>Last used</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {users.length === 0 && (
          <Table.Tr>
            <Table.Td colSpan={3}>
              <Text size="sm" c="dimmed" ta="center">
                No users yet
              </Text>
            </Table.Td>
          </Table.Tr>
        )}
        {users.map((user) => (
          <Table.Tr key={user.id}>
            <Table.Td>{user.username}</Table.Td>
            <Table.Td>{user.syncCount}</Table.Td>
            <Table.Td>
              <Text size="sm" c="dimmed" title={user.lastSyncedAt.toISOString()}>
                {relativeDays(user.lastSyncedAt)}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
```

- [ ] **Step 6: Run `pnpm test devices`.** Everything in the feature passes.

- [ ] **Step 7: Commit.**

```bash
git add src/features/devices/ui
git commit -m "Add the sync history and users tables"
```

---

### Task 6: Wire the feature up

This is the task that makes the route exist, so it is the one that makes Task 4's `Link` compile.

**Files:**
- Create: `src/features/devices/api/router.ts`, `src/features/devices/ui/DevicesPage.tsx`,
  `src/features/devices/ui/DevicePage.tsx`, `src/routes/devices.index.tsx`,
  `src/routes/devices.$deviceId.tsx`
- Modify: `src/features/router.ts`, `src/features/nav.ts`

**Consumes:** everything from Tasks 2–5.
**Produces:** `devices.list` and `devices.detail` on the tRPC router; routes `/devices` and
`/devices/$deviceId`.

No test in this task: routes, pages and input-only procedures are the three things `CLAUDE.md`
exempts.

- [ ] **Step 1: The tRPC router**, `src/features/devices/api/router.ts`

```ts
import { z } from 'zod'
import { publicProcedure, router } from '#/server/trpc/base'
import { DEVICE_SYNC_LIMIT, getDeviceDetail, listDevices } from './queries'

export const devicesRouter = router({
  list: publicProcedure.query(({ ctx }) => listDevices(ctx.db)),
  detail: publicProcedure
    .input(z.object({ deviceId: z.number().int() }))
    .query(({ ctx, input }) =>
      getDeviceDetail(ctx.db, { deviceId: input.deviceId, syncLimit: DEVICE_SYNC_LIMIT }),
    ),
})
```

- [ ] **Step 2: Register the feature.** In `src/features/router.ts`, import `devicesRouter` and add
      `devices: devicesRouter` to `appRouter`. In `src/features/nav.ts`, add
      `{ label: 'Devices', to: '/devices' }` to `navItems`. One line each, as ADR 0010 asks.

- [ ] **Step 3: `DevicesPage.tsx`**, the list page — the shape of `SyncsPage`.

```tsx
import { Alert, Loader, Stack, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '#/lib/trpc'
import { DeviceTable } from './DeviceTable'

export function DevicesPage() {
  const { data, isPending, error } = useQuery(trpc.devices.list.queryOptions())

  return (
    <Stack>
      <Title order={3}>Devices</Title>
      {isPending && <Loader />}
      {error && <Alert color="red">{error.message}</Alert>}
      {data && <DeviceTable devices={data} />}
    </Stack>
  )
}
```

- [ ] **Step 4: `DevicePage.tsx`**, the detail page. Two columns, the side panel on the right.

```tsx
import { Alert, Card, Grid, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '#/lib/trpc'
import { DEVICE_SYNC_LIMIT } from '../api/queries'
import { DeviceSyncTable } from './DeviceSyncTable'
import { DeviceUserTable } from './DeviceUserTable'

export function DevicePage({ deviceId }: { deviceId: string }) {
  const id = Number(deviceId)
  const isValidId = Number.isInteger(id)
  // A non-numeric id can never match a device, so do not ask the server about it.
  const { data, isPending, error } = useQuery(
    trpc.devices.detail.queryOptions({ deviceId: id }, { enabled: isValidId }),
  )

  if (!isValidId || data === null) {
    return (
      <Stack>
        <Title order={3}>Device</Title>
        <Text c="dimmed">Device not found</Text>
      </Stack>
    )
  }

  return (
    <Stack>
      {isPending && <Loader />}
      {error && <Alert color="red">{error.message}</Alert>}
      {data && (
        <>
          <Title order={3}>Device {data.device.serial}</Title>
          <Grid>
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Stack gap="xs">
                <Title order={5}>Sync history</Title>
                <DeviceSyncTable syncs={data.syncs} />
                {data.syncCount > data.syncs.length && (
                  <Text size="sm" c="dimmed">
                    Showing the latest {DEVICE_SYNC_LIMIT} of {data.syncCount} syncs
                  </Text>
                )}
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Stack>
                <Card withBorder padding="sm">
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed" tt="uppercase">Facility</Text>
                      <Text size="sm" fw={600}>{data.device.facilityName}</Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed" tt="uppercase">District</Text>
                      <Text size="sm" fw={600}>{data.device.districtName}</Text>
                    </Group>
                  </Stack>
                </Card>
                <Card withBorder padding="sm">
                  <Stack gap="xs">
                    <Title order={5}>Users</Title>
                    <DeviceUserTable users={data.users} />
                  </Stack>
                </Card>
              </Stack>
            </Grid.Col>
          </Grid>
        </>
      )}
    </Stack>
  )
}
```

`DEVICE_SYNC_LIMIT` comes from `api/queries.ts`, which is a server file. Only the constant is
imported, not a function that touches `db`, so no driver reaches the browser bundle — the same
arrangement as the `RecentSync` type that `SyncTable` already imports.

- [ ] **Step 5: The two routes.** The route file, not the page, knows about routing.

```tsx
// src/routes/devices.index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { DevicesPage } from '#/features/devices/ui/DevicesPage'

export const Route = createFileRoute('/devices/')({ component: DevicesPage })
```

```tsx
// src/routes/devices.$deviceId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { DevicePage } from '#/features/devices/ui/DevicePage'

export const Route = createFileRoute('/devices/$deviceId')({ component: RouteComponent })

function RouteComponent() {
  const { deviceId } = Route.useParams()
  return <DevicePage deviceId={deviceId} />
}
```

- [ ] **Step 6: Regenerate the route tree and type-check.** `pnpm dev` rewrites
      `src/routeTree.gen.ts` on start; stop it once the file contains `/devices/$deviceId`. Then
      `pnpm exec tsc --noEmit` — this is where Task 4's `Link` finally compiles. Run `pnpm test`.

- [ ] **Step 7: Look at it.** With `pnpm dev`, open `/devices`, click a serial, and try
      `/devices/999999` and `/devices/abc` — both say "Device not found".

- [ ] **Step 8: Commit.**

```bash
git add src/features/devices src/features/router.ts src/features/nav.ts src/routes src/routeTree.gen.ts
git commit -m "Serve the device list and the device detail page"
```

---

### Task 7: Link the serials in the Syncs table

**Files:**
- Modify: `src/features/device-syncs/api/queries.ts`, `src/features/device-syncs/api/queries.test.ts`,
  `src/features/device-syncs/ui/SyncTable.tsx`, `src/features/device-syncs/ui/SyncTable.test.tsx`

**Consumes:** the `/devices/$deviceId` route from Task 6.

- [ ] **Step 1: Write the two failing tests.**

In `device-syncs/api/queries.test.ts`, extend the existing
`'resolves the device, the user, the facility and its district'` test to assert the id too:

```ts
expect(row).toMatchObject({ deviceId: device.id, deviceSerial: 'SL-0042' })
```

In `device-syncs/ui/SyncTable.test.tsx`, add `deviceId: 1` to the `sync()` factory and a test:

```tsx
it('links a serial to that device', async () => {
  await renderWithProviders(<SyncTable syncs={[sync({ deviceId: 7 })]} />)

  expect(screen.getByRole('link', { name: 'SL-0042' })).toHaveAttribute('href', '/devices/7')
})
```

- [ ] **Step 2: Run them and watch them fail.** `pnpm test device-syncs` — the query test fails on
      `deviceId: undefined`, the component test on no link and on a type error in the factory.

- [ ] **Step 3: Carry the id through.** In `device-syncs/api/queries.ts`, add `deviceId: number` to
      `RecentSync` and `'device.id as deviceId'` to the select. In `SyncTable.tsx`, wrap the serial:

```tsx
<Table.Td>
  {/* A feature may name another feature's route. It may not import its code. */}
  <Link to="/devices/$deviceId" params={{ deviceId: String(sync.deviceId) }}>
    {sync.deviceSerial}
  </Link>
</Table.Td>
```

with `import { Link } from '@tanstack/react-router'`.

- [ ] **Step 4: Run `pnpm test`** — everything, including the first cell assertion in
      `SyncTable.test.tsx`, which still reads `'SL-0042'` because the link's text is the serial.

- [ ] **Step 5: Verify the whole thing.** `pnpm exec tsc --noEmit`, `pnpm format`, `pnpm test`, and
      `pnpm dev`: from `/syncs`, click a serial and land on that device's page.

- [ ] **Step 6: Commit.**

```bash
git add src/features/device-syncs
git commit -m "Link a serial in the syncs table to its device"
```

---

## After the plan

- Propose an ADR with the `writing-adrs` skill: **a feature may name another feature's route path,
  never import its components, queries or types** — with the `tsc` error as the evidence that the
  route tree is a checked contract.
- One round of review, then push the branch and open the pull request. Never merge into `main`
  locally.
