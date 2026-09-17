import { Button, Menu } from '@mantine/core'
import { describe, expect, it } from 'vitest'
import { renderWithProviders, screen, userEvent } from './test-helpers'

describe('renderWithProviders', () => {
  // Mantine menus, selects and modals use portals and transitions, which jsdom cannot show.
  it('lets a test open a Mantine menu and see its items', async () => {
    renderWithProviders(
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
