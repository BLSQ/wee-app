import { describe, expect, it } from 'vitest'
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
})
