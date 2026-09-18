import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen } from '#/ui/test-helpers'
import type { ActivityTotals } from '../api/queries'
import { ActivitySummary } from './ActivitySummary'

const totals = (values: Partial<ActivityTotals> = {}): ActivityTotals => ({
  syncCount: 250,
  resourceCount: 4800,
  previousSyncCount: 200,
  previousResourceCount: 4000,
  ...values,
})

describe('ActivitySummary', () => {
  it('shows the totals for the window', async () => {
    await renderWithProviders(<ActivitySummary totals={totals()} />)

    expect(screen.getByText('250')).toBeVisible()
    expect(screen.getByText('4800')).toBeVisible()
  })

  it('shows a rise against the previous window with its sign', async () => {
    await renderWithProviders(<ActivitySummary totals={totals()} />)

    expect(screen.getByText('+25%')).toBeVisible()
  })

  it('shows a fall against the previous window', async () => {
    await renderWithProviders(<ActivitySummary totals={totals({ previousSyncCount: 500 })} />)

    expect(screen.getByText('-50%')).toBeVisible()
  })

  it('says there is nothing to compare when the previous window is empty', async () => {
    await renderWithProviders(<ActivitySummary totals={totals({ previousSyncCount: 0 })} />)

    expect(screen.getByText('no comparison')).toBeVisible()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })
})
