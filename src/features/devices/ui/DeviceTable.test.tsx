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
  // The table shows dates relative to now. Only Date is faked, so clicks and findBy still work.
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
    await renderWithProviders(
      <DeviceTable devices={[device({ syncCount: 0, lastSyncedAt: null })]} />,
    )

    expect(screen.getByRole('row', { name: /SL-0042/ })).toHaveTextContent('never')
  })

  it('says so when there is no device', async () => {
    await renderWithProviders(<DeviceTable devices={[]} />)

    expect(screen.getByText('No devices yet')).toBeVisible()
  })
})
