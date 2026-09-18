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
          user({
            id: 2,
            username: 'fatu',
            syncCount: 13,
            lastSyncedAt: new Date('2026-09-06T08:00:00Z'),
          }),
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
