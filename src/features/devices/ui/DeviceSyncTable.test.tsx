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
