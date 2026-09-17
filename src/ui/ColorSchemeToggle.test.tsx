import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ColorSchemeToggle } from './ColorSchemeToggle'

describe('ColorSchemeToggle', () => {
  const html = renderToStaticMarkup(
    <MantineProvider>
      <ColorSchemeToggle />
    </MantineProvider>,
  )

  it('renders a labelled button', () => {
    expect(html).toMatch(/<button[^>]*aria-label="Toggle color scheme"/)
  })

  it('renders both icons and lets CSS hide the one that does not apply', () => {
    expect(html).toMatch(/<svg[^>]*class="[^"]*tabler-icon-moon[^"]*mantine-dark-hidden/)
    expect(html).toMatch(/<svg[^>]*class="[^"]*tabler-icon-sun[^"]*mantine-light-hidden/)
  })
})
