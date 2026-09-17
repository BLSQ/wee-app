import { AppShell as MantineAppShell, Group, NavLink, Title } from '@mantine/core'
import { Link, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { navItems } from '#/features/nav'
import { ColorSchemeToggle } from './ColorSchemeToggle'

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <MantineAppShell header={{ height: 56 }} navbar={{ width: 200, breakpoint: 'sm' }} padding="md">
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={4}>Device Sync Dashboard</Title>
          <ColorSchemeToggle />
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p="xs">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            component={Link}
            to={item.to}
            label={item.label}
            active={pathname === item.to}
          />
        ))}
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>{children}</MantineAppShell.Main>
    </MantineAppShell>
  )
}
