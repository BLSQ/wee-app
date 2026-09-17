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
})
