// Helpers for component tests. Imported by *.test.tsx files only, which run in jsdom.
//
// What to test: a component that takes props. Render it, then find elements by role and text,
// as a user would. Do not assert on CSS classes, and do not use renderToStaticMarkup.
// Clicks: `await userEvent.click(...)`. After a click that opens something (a menu, a select),
// wait for it: `await screen.findByRole(...)`.
// A callback prop can be a `vi.fn()`. When a page needs state (a filter, a selected row), put the
// control in a component that takes `value` and `onChange`, and test that component.
// Not rendered here: a component that uses the router (`Link`, router hooks), so keep the `Link` in
// the page or pass the target as a prop; and a MapLibre map, which needs WebGL, so test the data
// the map receives.
import { MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { theme } from './theme'

export { screen, within } from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'

/**
 * Renders `ui` inside Mantine, with the application theme. `env="test"` turns off portals and
 * transitions, which jsdom cannot show: without it a menu, a select or a modal never appears.
 */
export function renderWithProviders(ui: ReactNode) {
  return render(
    <MantineProvider theme={theme} env="test">
      {ui}
    </MantineProvider>,
  )
}
