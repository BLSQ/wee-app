import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, userEvent, within } from '#/ui/test-helpers'
import type { RecentSync } from '../api/queries'
import { SyncTable } from './SyncTable'

const sync = (values: Partial<RecentSync> = {}): RecentSync => ({
  id: 1,
  deviceSerial: 'SL-0042',
  username: 'amara',
  facilityName: 'Bo Government Hospital',
  districtName: 'Bo',
  syncedAt: new Date('2026-09-10T08:00:00Z'),
  submissionCount: 12,
  orgUnitCount: 3,
  entityCount: 5,
  ...values,
})

describe('SyncTable', () => {
  // The table shows dates relative to now. Only Date is faked, so clicks and findBy still work.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('shows a row for each sync, with its values', async () => {
    await renderWithProviders(
      <SyncTable syncs={[sync(), sync({ id: 2, deviceSerial: 'SL-0007', username: 'fatu' })]} />,
    )

    const cells = within(screen.getByRole('row', { name: /SL-0042/ }))
      .getAllByRole('cell')
      .map((cell) => cell.textContent)
    expect(cells).toEqual([
      'SL-0042',
      'amara',
      'Bo Government Hospital',
      'Bo',
      'today',
      '12',
      '3',
      '5',
    ])
    expect(screen.getByRole('row', { name: /SL-0007/ })).toHaveTextContent('fatu')
    expect(screen.queryByText('No syncs yet')).not.toBeInTheDocument()
  })

  describe('the sync date', () => {
    it.each([
      ['2026-09-10T08:00:00Z', 'today'],
      ['2026-09-09T08:00:00Z', 'yesterday'],
      ['2026-09-05T08:00:00Z', '5 days ago'],
    ])('reads a sync from %s as "%s"', async (syncedAt, label) => {
      await renderWithProviders(<SyncTable syncs={[sync({ syncedAt: new Date(syncedAt) })]} />)

      expect(screen.getByRole('row', { name: /SL-0042/ })).toHaveTextContent(label)
    })
  })

  it('says so when there is no sync', async () => {
    await renderWithProviders(<SyncTable syncs={[]} />)

    expect(screen.getByText('No syncs yet')).toBeVisible()
  })

  describe('sorting', () => {
    it('asks for an ascending sort on a column that is not sorted', async () => {
      const onSort = vi.fn()
      await renderWithProviders(<SyncTable syncs={[sync()]} onSort={onSort} />)

      await userEvent.click(screen.getByRole('columnheader', { name: /Device/ }))

      expect(onSort).toHaveBeenCalledWith('device', 'asc')
    })

    it('flips the column already sorted ascending to descending', async () => {
      const onSort = vi.fn()
      await renderWithProviders(
        <SyncTable
          syncs={[sync()]}
          sortConfig={{ sortBy: 'device', sortOrder: 'asc' }}
          onSort={onSort}
        />,
      )

      await userEvent.click(screen.getByRole('columnheader', { name: /Device/ }))

      expect(onSort).toHaveBeenCalledWith('device', 'desc')
    })

    it('goes back to ascending when another column is picked', async () => {
      const onSort = vi.fn()
      await renderWithProviders(
        <SyncTable
          syncs={[sync()]}
          sortConfig={{ sortBy: 'device', sortOrder: 'asc' }}
          onSort={onSort}
        />,
      )

      await userEvent.click(screen.getByRole('columnheader', { name: /Facility/ }))

      expect(onSort).toHaveBeenCalledWith('facility', 'asc')
    })

    it('marks only the sorted column, with its direction', async () => {
      await renderWithProviders(
        <SyncTable syncs={[sync()]} sortConfig={{ sortBy: 'user', sortOrder: 'desc' }} />,
      )

      expect(screen.getByRole('columnheader', { name: /User/ })).toHaveTextContent('↓')
      expect(screen.getByRole('columnheader', { name: /Device/ })).not.toHaveTextContent('↓')
    })

    it('does not sort the counter columns', async () => {
      const onSort = vi.fn()
      await renderWithProviders(<SyncTable syncs={[sync()]} onSort={onSort} />)

      await userEvent.click(screen.getByRole('columnheader', { name: /Submissions/ }))

      expect(onSort).not.toHaveBeenCalled()
    })
  })
})
