import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, within } from '#/ui/test-helpers'
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
  it('shows a row for each sync, with its values', () => {
    renderWithProviders(
      <SyncTable syncs={[sync(), sync({ id: 2, deviceSerial: 'SL-0007', username: 'fatu' })]} />,
    )

    const cells = within(screen.getByRole('row', { name: /SL-0042/ }))
      .getAllByRole('cell')
      .map((cell) => cell.textContent)
    expect(cells[0]).toBe('SL-0042')
    expect(cells[1]).toBe('amara')
    expect(cells[2]).toBe('Bo Government Hospital')
    expect(cells[3]).toBe('Bo')
    expect(cells.slice(5)).toEqual(['12', '3', '5'])
    expect(screen.getByRole('row', { name: /SL-0007/ })).toHaveTextContent('fatu')
  })

  describe('the sync date', () => {
    // Only Date is faked, so nothing that waits on a timer is affected.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-09-10T12:00:00Z'))
    })
    afterEach(() => vi.useRealTimers())

    it.each([
      ['2026-09-10T08:00:00Z', 'today'],
      ['2026-09-09T08:00:00Z', 'yesterday'],
      ['2026-09-05T08:00:00Z', '5 days ago'],
    ])('reads a sync from %s as "%s"', (syncedAt, label) => {
      renderWithProviders(<SyncTable syncs={[sync({ syncedAt: new Date(syncedAt) })]} />)

      expect(screen.getByRole('row', { name: /SL-0042/ })).toHaveTextContent(label)
    })
  })

  it('says so when there is no sync', () => {
    renderWithProviders(<SyncTable syncs={[]} />)

    expect(screen.getByText('No syncs yet')).toBeVisible()
  })
})
