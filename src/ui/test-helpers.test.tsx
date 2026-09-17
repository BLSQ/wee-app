import { Button, Menu } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, userEvent } from './test-helpers'

describe('renderWithProviders', () => {
  // A table that links each row to a detail page must stay testable.
  it('gives components a router, so a Link renders with its href', async () => {
    await renderWithProviders(<Link to="/syncs">Recent syncs</Link>)

    expect(screen.getByRole('link', { name: 'Recent syncs' })).toHaveAttribute('href', '/syncs')
  })

  // Mantine menus, selects and modals use portals and transitions, which jsdom cannot show.
  it('lets a test open a Mantine menu and see its items', async () => {
    await renderWithProviders(
      <Menu>
        <Menu.Target>
          <Button>Filters</Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item>Silent devices</Menu.Item>
        </Menu.Dropdown>
      </Menu>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Filters' }))

    expect(await screen.findByRole('menuitem', { name: 'Silent devices' })).toBeVisible()
  })
})
