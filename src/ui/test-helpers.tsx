// Imported by *.test.tsx files only.
import { MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { theme } from './theme'

export { screen, within } from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'

/** Renders `ui` as the application does: inside Mantine, with the application theme. */
export function renderWithProviders(ui: ReactNode) {
  return render(<MantineProvider theme={theme}>{ui}</MantineProvider>)
}
