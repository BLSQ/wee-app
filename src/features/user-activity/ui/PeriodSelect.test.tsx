import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders, screen, userEvent } from '#/ui/test-helpers'
import { PeriodSelect } from './PeriodSelect'

describe('PeriodSelect', () => {
  it('offers the three windows and marks the current one', async () => {
    await renderWithProviders(<PeriodSelect value="7d" onChange={vi.fn()} />)

    expect(screen.getByRole('radio', { name: '7 days' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '30 days' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: '3 months' })).toBeVisible()
  })

  it('reports the window the user picks', async () => {
    const onChange = vi.fn()
    await renderWithProviders(<PeriodSelect value="7d" onChange={onChange} />)

    await userEvent.click(screen.getByRole('radio', { name: '3 months' }))

    expect(onChange).toHaveBeenCalledWith('90d')
  })
})
