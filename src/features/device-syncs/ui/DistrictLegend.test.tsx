import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, within } from '#/ui/test-helpers'
import { DistrictLegend } from './DistrictLegend'
import { BUCKETS } from './health'

describe('DistrictLegend', () => {
  it('shows every bucket, in order', async () => {
    await renderWithProviders(<DistrictLegend />)

    const items = within(screen.getByRole('list', { name: 'Legend' })).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(BUCKETS.map((bucket) => bucket.label))
  })

  it('says what the colours measure', async () => {
    await renderWithProviders(<DistrictLegend />)

    expect(screen.getByText('Devices synced in the last 7 days')).toBeVisible()
  })
})
