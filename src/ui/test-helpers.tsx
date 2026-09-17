// Helpers for component tests. Imported by *.test.tsx files only, which run in jsdom.
//
// What to test: a component that takes props. `await renderWithProviders(<It />)`, then find
// elements by role and text, as a user would. Do not assert on CSS classes, and do not use
// renderToStaticMarkup.
// Clicks: `await userEvent.click(...)`. After a click that opens something (a menu, a select),
// wait for it: `await screen.findByRole(...)`.
// A callback prop can be a `vi.fn()`. When a page needs state (a filter, a selected row), put the
// control in a component that takes `value` and `onChange`, and test that component.
// A test of a hook also goes in a .tsx file: the extension is what selects jsdom.
// Not rendered here: a MapLibre map (needs WebGL) and a chart (jsdom computes no size, so it draws
// nothing). Test the data they receive.
import { MantineProvider } from '@mantine/core'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { theme } from './theme'

export { screen, within } from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'

/**
 * Renders `ui` as the application does: inside Mantine and inside a router, so a `Link` works.
 * `env="test"` turns off portals and transitions, which jsdom cannot show: without it a menu, a
 * select or a modal never appears. Await it: the router loads before it renders.
 */
export async function renderWithProviders(ui: ReactNode) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory(),
  })
  await router.load()
  return render(
    <MantineProvider theme={theme} env="test">
      {/* The test router has one route; the application's route types do not apply to it. */}
      <RouterProvider router={router as never} />
    </MantineProvider>,
  )
}
