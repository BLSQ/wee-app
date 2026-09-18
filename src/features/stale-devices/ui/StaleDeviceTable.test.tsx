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
