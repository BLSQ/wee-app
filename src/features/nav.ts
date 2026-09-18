/**
 * Feature registry, client side. It runs in the browser: never import server
 * code from here. See docs/adr/0010.
 */
export const navItems: { label: string; to: string }[] = [
  { label: 'Syncs', to: '/syncs' },
  { label: 'Devices', to: '/devices' },
]
