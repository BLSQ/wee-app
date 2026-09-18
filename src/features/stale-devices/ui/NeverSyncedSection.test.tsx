import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, userEvent } from '#/ui/test-helpers'
import type { StaleDevice } from '../api/queries'
import { NeverSyncedSection } from './NeverSyncedSection'

const device = (values: Partial<StaleDevice> = {}): StaleDevice => ({
  id: 1,
  serial: 'SL-0201',
  facilityName: 'Masumana MCHP',
  districtName: 'Port Loko',
  lastSyncedAt: null,
  lastUsername: null,
  ...values,
})

describe('NeverSyncedSection', () => {
  it('starts folded, showing only how many devices there are', async () => {
    await renderWithProviders(
      <NeverSyncedSection devices={[device(), device({ id: 2, serial: 'SL-0203' })]} />,
    )

    const toggle = screen.getByRole('button', { name: /Never synced \(2\)/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('SL-0201')).not.toBeInTheDocument()
  })

  it('shows the devices once unfolded', async () => {
    await renderWithProviders(<NeverSyncedSection devices={[device()]} />)

    await userEvent.click(screen.getByRole('button', { name: /Never synced/ }))

    expect(await screen.findByText('SL-0201')).toBeVisible()
    expect(screen.getByRole('row', { name: /SL-0201/ })).toHaveTextContent('Masumana MCHP')
  })

  it('folds again when the button is clicked twice', async () => {
    await renderWithProviders(<NeverSyncedSection devices={[device()]} />)
    const toggle = screen.getByRole('button', { name: /Never synced/ })

    await userEvent.click(toggle)
    await userEvent.click(toggle)

    // The rows leave with the fold animation, which jsdom does not run; the
    // button's own state is what says the section is closed.
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
