# Sync activity per user — implementation plan

> **For agentic workers:** implement directly, task by task, with `superpowers:test-driven-development`.
> `CLAUDE.md` rules out subagent-driven development for this repository. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** A Users page listing every user with their syncs, submissions, distinct devices and last
sync over a switchable window of 7, 30 or 90 days, sortable by any column.

**Architecture:** One SQL aggregate per window returns about 41 rows; the browser sorts them in
place. The window is an enum on the wire; the server turns it into a cutoff date. The query takes
that cutoff as a parameter, so tests pin the window instead of racing the clock.

**Tech Stack:** Kysely on Postgres, tRPC, TanStack Router and Query, Mantine, Vitest with PGlite and
jsdom.

**Spec:** `docs/superpowers/specs/2026-09-18-user-activity-design.md`

## Global Constraints

- A feature lives in `src/features/<name>/` and registers itself in `src/features/router.ts`
  (server) and `src/features/nav.ts` (client), nowhere else.
- Browser code never imports from `src/server/`, except `import type`.
- Never mock `db` or tRPC. No snapshots. Pages, routes and a procedure that only validates input
  get no test.
- Every aggregate is cast with `::int`: `pg` returns `bigint` as a **string**.
- Commands: `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm dev`.

---

## File structure

| File | Responsibility |
|---|---|
| `src/features/user-activity/periods.ts` | The three windows: value, label, length in days. Imported by both sides, imports nothing. |
| `src/features/user-activity/api/queries.ts` | `listUserActivity(db, { since })` — the aggregate. |
| `src/features/user-activity/api/queries.test.ts` | The aggregate, on in-process Postgres. |
| `src/features/user-activity/api/router.ts` | `userActivity.list`: period enum → cutoff date → query. |
| `src/features/user-activity/ui/UserActivityTable.tsx` | Takes rows, owns the sort. |
| `src/features/user-activity/ui/UserActivityTable.test.tsx` | The table, in jsdom. |
| `src/features/user-activity/ui/PeriodSelect.tsx` | Controlled `value` / `onChange` switch. |
| `src/features/user-activity/ui/PeriodSelect.test.tsx` | The switch, in jsdom. |
| `src/features/user-activity/ui/UserActivityPage.tsx` | Holds the period, fetches, renders. |
| `src/routes/users.tsx` | Mounts the page at `/users`. |

---

### Task 1: The query

**Files:**
- Create: `src/features/user-activity/periods.ts`
- Create: `src/features/user-activity/api/queries.ts`
- Test: `src/features/user-activity/api/queries.test.ts`

**Interfaces:**
- Consumes: `createTestDb`, `resetDb`, `insertUser`, `insertDevice`, `insertSync` from
  `#/server/db/test-helpers`.
- Produces: `type UserActivity`, `listUserActivity(db, { since: Date }): Promise<UserActivity[]>`,
  and `PERIODS` / `type Period` from `../periods`.

- [ ] **Step 1: Write `periods.ts`** (no test of its own: it is data, and Tasks 2 and 3 use it)

```ts
/** The windows the Users page offers. Imported by the browser and by the server: keep it free of imports. */
export const PERIODS = {
  '7d': { label: '7 days', days: 7 },
  '30d': { label: '30 days', days: 30 },
  '90d': { label: '3 months', days: 90 },
} as const

export type Period = keyof typeof PERIODS

export const PERIOD_VALUES = Object.keys(PERIODS) as Period[]
```

- [ ] **Step 2: Write the failing test**

`src/features/user-activity/api/queries.test.ts`:

```ts
import type { Kysely } from 'kysely'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Database } from '#/server/db'
import {
  createTestDb,
  insertDevice,
  insertSync,
  insertUser,
  resetDb,
} from '#/server/db/test-helpers'
import { listUserActivity } from './queries'

let db: Kysely<Database>
beforeAll(async () => {
  db = await createTestDb()
})
beforeEach(() => resetDb(db))
afterAll(() => db.destroy())

const since = new Date('2026-09-01T00:00:00Z')

describe('listUserActivity', () => {
  it('sums the syncs, the submissions and the distinct devices of the window', async () => {
    const user = await insertUser(db, { username: 'amara' })
    const device = await insertDevice(db)
    await insertSync(db, {
      user,
      device,
      syncedAt: new Date('2026-09-02T08:00:00Z'),
      submissionCount: 12,
    })
    await insertSync(db, {
      user,
      device,
      syncedAt: new Date('2026-09-03T08:00:00Z'),
      submissionCount: 3,
    })

    const rows = await listUserActivity(db, { since })

    expect(rows).toEqual([
      {
        userId: user.id,
        username: 'amara',
        syncCount: 2,
        submissionCount: 15,
        // Two syncs from the same device are one device.
        deviceCount: 1,
        lastSyncAt: new Date('2026-09-03T08:00:00Z'),
      },
    ])
  })

  it('counts each device once', async () => {
    const user = await insertUser(db)
    await insertSync(db, { user, device: await insertDevice(db), syncedAt: since })
    await insertSync(db, { user, device: await insertDevice(db), syncedAt: since })

    const [row] = await listUserActivity(db, { since })

    expect(row.deviceCount).toBe(2)
  })

  it('keeps a user who never synced', async () => {
    const user = await insertUser(db, { username: 'idle' })

    expect(await listUserActivity(db, { since })).toEqual([
      {
        userId: user.id,
        username: 'idle',
        syncCount: 0,
        submissionCount: 0,
        deviceCount: 0,
        lastSyncAt: null,
      },
    ])
  })

  it('keeps a user whose syncs all predate the window, with nothing counted', async () => {
    const user = await insertUser(db, { username: 'quiet' })
    await insertSync(db, {
      user,
      syncedAt: new Date('2026-08-31T23:59:00Z'),
      submissionCount: 99,
    })

    const [row] = await listUserActivity(db, { since })

    expect(row).toMatchObject({ username: 'quiet', syncCount: 0, submissionCount: 0, lastSyncAt: null })
  })

  it('returns the counts as numbers', async () => {
    // pg hands bigint back as a string, so count() needs a cast. Without it the
    // table would sort "9" above "10".
    await insertSync(db, { user: await insertUser(db), syncedAt: since })

    const [row] = await listUserActivity(db, { since })

    expect(typeof row.syncCount).toBe('number')
    expect(typeof row.submissionCount).toBe('number')
    expect(typeof row.deviceCount).toBe('number')
  })

  it('lists the users in alphabetical order', async () => {
    await insertUser(db, { username: 'zara' })
    await insertUser(db, { username: 'amara' })

    const rows = await listUserActivity(db, { since })

    expect(rows.map((row) => row.username)).toEqual(['amara', 'zara'])
  })
})
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm test src/features/user-activity`
Expected: FAIL — `Failed to resolve import "./queries"`.

- [ ] **Step 4: Write the query**

`src/features/user-activity/api/queries.ts`:

```ts
import { type Kysely, sql } from 'kysely'
import type { Database } from '#/server/db'

export type UserActivity = {
  userId: number
  username: string
  syncCount: number
  submissionCount: number
  deviceCount: number
  /** null when the user synced nothing inside the window. */
  lastSyncAt: Date | null
}

/**
 * One row per user, counting only the syncs at or after `since`.
 *
 * The window predicate sits in the `on` clause of the left join, not in a `where`:
 * in a `where` it would drop the users with no activity, who are the point of the page.
 * Every aggregate is cast to int because `pg` returns bigint as a string.
 */
export async function listUserActivity(
  db: Kysely<Database>,
  params: { since: Date },
): Promise<UserActivity[]> {
  return db
    .selectFrom('app_user as user')
    .leftJoin('device_sync as sync', (join) =>
      join.onRef('sync.user_id', '=', 'user.id').on('sync.synced_at', '>=', params.since),
    )
    .select([
      'user.id as userId',
      'user.username as username',
      sql<number>`count(sync.id)::int`.as('syncCount'),
      sql<number>`coalesce(sum(sync.submission_count), 0)::int`.as('submissionCount'),
      sql<number>`count(distinct sync.device_id)::int`.as('deviceCount'),
      sql<Date | null>`max(sync.synced_at)`.as('lastSyncAt'),
    ])
    .groupBy(['user.id', 'user.username'])
    .orderBy('user.username')
    .execute()
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `pnpm test src/features/user-activity` — expected: 6 passed.
Then `pnpm exec tsc --noEmit` — expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/features/user-activity
git commit -m "Aggregate sync activity per user"
```

---

### Task 2: The table

**Files:**
- Create: `src/features/user-activity/ui/UserActivityTable.tsx`
- Test: `src/features/user-activity/ui/UserActivityTable.test.tsx`

**Interfaces:**
- Consumes: `UserActivity` from `../api/queries`; `renderWithProviders`, `screen`, `within`,
  `userEvent` from `#/ui/test-helpers`.
- Produces: `UserActivityTable({ rows }: { rows: UserActivity[] })`.

- [ ] **Step 1: Write the failing test**

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, userEvent, within } from '#/ui/test-helpers'
import type { UserActivity } from '../api/queries'
import { UserActivityTable } from './UserActivityTable'

const activity = (values: Partial<UserActivity> = {}): UserActivity => ({
  userId: 1,
  username: 'amara',
  syncCount: 4,
  submissionCount: 12,
  deviceCount: 2,
  lastSyncAt: new Date('2026-09-09T08:00:00Z'),
  ...values,
})

const usernames = () =>
  screen
    .getAllByRole('row')
    .slice(1) // the header row
    .map((row) => within(row).getAllByRole('cell')[0].textContent)

describe('UserActivityTable', () => {
  // The table shows dates relative to now. Only Date is faked, so clicks still work.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('shows a row for each user, with its values', async () => {
    await renderWithProviders(
      <UserActivityTable rows={[activity(), activity({ userId: 2, username: 'fatu' })]} />,
    )

    const cells = within(screen.getByRole('row', { name: /amara/ }))
      .getAllByRole('cell')
      .map((cell) => cell.textContent)
    expect(cells).toEqual(['amara', '4', '12', '2', 'yesterday'])
    expect(screen.getByRole('row', { name: /fatu/ })).toBeVisible()
  })

  it('opens sorted by username', async () => {
    await renderWithProviders(
      <UserActivityTable
        rows={[activity({ userId: 1, username: 'zara' }), activity({ userId: 2, username: 'amara' })]}
      />,
    )

    expect(usernames()).toEqual(['amara', 'zara'])
  })

  it('sorts by a column when its header is clicked, and reverses on a second click', async () => {
    await renderWithProviders(
      <UserActivityTable
        rows={[
          activity({ userId: 1, username: 'amara', syncCount: 4 }),
          activity({ userId: 2, username: 'fatu', syncCount: 9 }),
        ]}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /Syncs/ }))
    expect(usernames()).toEqual(['amara', 'fatu'])

    await userEvent.click(screen.getByRole('button', { name: /Syncs/ }))
    expect(usernames()).toEqual(['fatu', 'amara'])
  })

  it('shows a dash for a user with no sync in the window, and keeps them last when sorting by it', async () => {
    await renderWithProviders(
      <UserActivityTable
        rows={[
          activity({ userId: 1, username: 'idle', lastSyncAt: null }),
          activity({ userId: 2, username: 'zara' }),
        ]}
      />,
    )

    // Alphabetically the quiet user comes first, so the order below is the sort's doing.
    expect(usernames()).toEqual(['idle', 'zara'])
    expect(screen.getByRole('row', { name: /idle/ })).toHaveTextContent('—')

    // Ascending, then descending: a blank is never the most recent.
    await userEvent.click(screen.getByRole('button', { name: /Last sync/ }))
    expect(usernames()).toEqual(['zara', 'idle'])

    await userEvent.click(screen.getByRole('button', { name: /Last sync/ }))
    expect(usernames()).toEqual(['zara', 'idle'])
  })

  it('says so when there is no user', async () => {
    await renderWithProviders(<UserActivityTable rows={[]} />)

    expect(screen.getByText('No users yet')).toBeVisible()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test UserActivityTable`
Expected: FAIL — `Failed to resolve import "./UserActivityTable"`.

- [ ] **Step 3: Write the table**

```tsx
import { Table, Text, UnstyledButton } from '@mantine/core'
import { useState } from 'react'
import type { UserActivity } from '../api/queries'

const DAY_MS = 86_400_000

function relativeDays(date: Date) {
  const days = Math.floor((Date.now() - date.getTime()) / DAY_MS)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

type SortKey = 'username' | 'syncCount' | 'submissionCount' | 'deviceCount' | 'lastSyncAt'

const columns: { key: SortKey; label: string }[] = [
  { key: 'username', label: 'User' },
  { key: 'syncCount', label: 'Syncs' },
  { key: 'submissionCount', label: 'Submissions' },
  { key: 'deviceCount', label: 'Devices' },
  { key: 'lastSyncAt', label: 'Last sync' },
]

/** A Date compares as its epoch, so one comparison serves every column. */
function value(row: UserActivity, key: SortKey): string | number | null {
  const raw = row[key]
  return raw instanceof Date ? raw.getTime() : raw
}

function sortRows(rows: UserActivity[], key: SortKey, direction: 'asc' | 'desc'): UserActivity[] {
  return [...rows].sort((a, b) => {
    const left = value(a, key)
    const right = value(b, key)
    // A user with nothing in the window stays at the bottom, whichever way the column points.
    if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1
    const order =
      typeof left === 'string' && typeof right === 'string'
        ? left.localeCompare(right)
        : Number(left) - Number(right)
    return direction === 'asc' ? order : -order
  })
}

export function UserActivityTable({ rows }: { rows: UserActivity[] }) {
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'username',
    direction: 'asc',
  })

  const toggle = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' },
    )

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          {columns.map((column) => (
            <Table.Th key={column.key}>
              <UnstyledButton fz="sm" fw={700} onClick={() => toggle(column.key)}>
                {column.label}
                {sort.key === column.key && (sort.direction === 'asc' ? ' ▲' : ' ▼')}
              </UnstyledButton>
            </Table.Th>
          ))}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.length === 0 && (
          <Table.Tr>
            <Table.Td colSpan={columns.length}>
              <Text size="sm" c="dimmed" ta="center">
                No users yet
              </Text>
            </Table.Td>
          </Table.Tr>
        )}
        {sortRows(rows, sort.key, sort.direction).map((row) => (
          <Table.Tr key={row.userId} style={{ opacity: row.lastSyncAt ? 1 : 0.55 }}>
            <Table.Td>{row.username}</Table.Td>
            <Table.Td>{row.syncCount}</Table.Td>
            <Table.Td>{row.submissionCount}</Table.Td>
            <Table.Td>{row.deviceCount}</Table.Td>
            <Table.Td>
              {row.lastSyncAt ? (
                <Text size="sm" c="dimmed" title={row.lastSyncAt.toISOString()}>
                  {relativeDays(row.lastSyncAt)}
                </Text>
              ) : (
                '—'
              )}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `pnpm test UserActivityTable` — expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/features/user-activity/ui
git commit -m "Show user activity in a sortable table"
```

---

### Task 3: The page, the procedure and the registry

**Files:**
- Create: `src/features/user-activity/ui/PeriodSelect.tsx`, `PeriodSelect.test.tsx`,
  `UserActivityPage.tsx`, `src/features/user-activity/api/router.ts`, `src/routes/users.tsx`
- Modify: `src/features/router.ts`, `src/features/nav.ts`, `src/routeTree.gen.ts` (generated)

**Interfaces:**
- Consumes: `PERIODS`, `PERIOD_VALUES`, `type Period` from `../periods`; `listUserActivity` from
  `./queries`; `UserActivityTable`; `trpc` from `#/lib/trpc`.
- Produces: `userActivityRouter` with `list({ period })`, and the `/users` route.

- [ ] **Step 1: Write the failing test for the switch**

`src/features/user-activity/ui/PeriodSelect.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, userEvent } from '#/ui/test-helpers'
import { PeriodSelect } from './PeriodSelect'

describe('PeriodSelect', () => {
  it('offers the three windows and marks the current one', async () => {
    await renderWithProviders(<PeriodSelect value="7d" onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: '7 days' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '30 days' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: '3 months' })).toBeVisible()
  })

  it('reports the window the user picks', async () => {
    const onChange = vi.fn()
    await renderWithProviders(<PeriodSelect value="7d" onChange={onChange} />)

    await userEvent.click(screen.getByRole('radio', { name: '3 months' }))

    expect(onChange).toHaveBeenCalledWith('90d')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test PeriodSelect`
Expected: FAIL — `Failed to resolve import "./PeriodSelect"`.

- [ ] **Step 3: Write the switch**

```tsx
import { SegmentedControl } from '@mantine/core'
import { PERIODS, PERIOD_VALUES, type Period } from '../periods'

export function PeriodSelect({
  value,
  onChange,
}: {
  value: Period
  onChange: (period: Period) => void
}) {
  return (
    <SegmentedControl
      value={value}
      onChange={(next) => onChange(next as Period)}
      data={PERIOD_VALUES.map((period) => ({ value: period, label: PERIODS[period].label }))}
    />
  )
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `pnpm test PeriodSelect` — expected: 2 passed.

- [ ] **Step 5: Write the procedure, the page, the route and the two registry lines**

`src/features/user-activity/api/router.ts`:

```ts
import { z } from 'zod'
import { publicProcedure, router } from '#/server/trpc/base'
import { PERIODS } from '../periods'
import { listUserActivity } from './queries'

const DAY_MS = 86_400_000

export const userActivityRouter = router({
  list: publicProcedure
    .input(z.object({ period: z.enum(['7d', '30d', '90d']).default('7d') }))
    .query(({ ctx, input }) =>
      listUserActivity(ctx.db, {
        since: new Date(Date.now() - PERIODS[input.period].days * DAY_MS),
      }),
    ),
})
```

`src/features/user-activity/ui/UserActivityPage.tsx`:

```tsx
import { Alert, Group, Loader, Stack, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { trpc } from '#/lib/trpc'
import type { Period } from '../periods'
import { PeriodSelect } from './PeriodSelect'
import { UserActivityTable } from './UserActivityTable'

export function UserActivityPage() {
  const [period, setPeriod] = useState<Period>('7d')
  const { data, isPending, error } = useQuery(trpc.userActivity.list.queryOptions({ period }))

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Users</Title>
        <PeriodSelect value={period} onChange={setPeriod} />
      </Group>
      {isPending && <Loader />}
      {error && <Alert color="red">{error.message}</Alert>}
      {data && <UserActivityTable rows={data} />}
    </Stack>
  )
}
```

`src/routes/users.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { UserActivityPage } from '#/features/user-activity/ui/UserActivityPage'

export const Route = createFileRoute('/users')({ component: UserActivityPage })
```

In `src/features/router.ts`, add the import and the entry:

```ts
import { userActivityRouter } from './user-activity/api/router'
// ...
export const appRouter = router({
  deviceSyncs: deviceSyncsRouter,
  userActivity: userActivityRouter,
})
```

In `src/features/nav.ts`, add the item:

```ts
export const navItems: { label: string; to: string }[] = [
  { label: 'Syncs', to: '/syncs' },
  { label: 'Users', to: '/users' },
]
```

- [ ] **Step 6: Regenerate the route tree, then typecheck**

`src/routeTree.gen.ts` is written by the TanStack Start Vite plugin, so it only learns about
`/users` once a dev server has run. `pnpm exec tsc --noEmit` fails before this step.

Run: `pnpm dev`, wait for the server to print its URL, stop it with Ctrl-C, then
`git diff --stat src/routeTree.gen.ts` — expected: the file mentions `/users`.

Run: `pnpm exec tsc --noEmit` — expected: no output.

- [ ] **Step 7: Look at it**

Run `pnpm dev` and open `/users`. Check: the nav has **Users**; the table lists users; the switch
moves between 7 days, 30 days and 3 months and the numbers change; clicking **Syncs** reorders the
rows; a user with no activity is dimmed with an em-dash. (The seed uses the real clock — run
`pnpm db:reset` first if the data looks stale.)

- [ ] **Step 8: Run everything and commit**

Run: `pnpm test` — expected: all files pass, 57 tests.
Run: `pnpm exec tsc --noEmit` — expected: no output.
Run: `pnpm format`

```bash
git add src/features src/routes src/routeTree.gen.ts
git commit -m "Add the Users page"
```

---

### Task 4: Close the loop

- [ ] **Step 1:** Propose an ADR addition or update with the `writing-adrs` skill. Likely candidate:
  nothing new — the feature follows ADRs 0003, 0005 and 0010. Say so explicitly rather than
  inventing one. If the `::int` rule for `pg` bigints is not written down anywhere, that is the one
  worth adding.
- [ ] **Step 2:** One round of review with `requesting-code-review`.
- [ ] **Step 3:** Push the branch and open the pull request against `main`, referencing issue #7.
  Never merge locally.
