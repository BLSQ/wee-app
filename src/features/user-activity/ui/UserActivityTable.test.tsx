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
        rows={[
          activity({ userId: 1, username: 'zara' }),
          activity({ userId: 2, username: 'amara' }),
        ]}
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
