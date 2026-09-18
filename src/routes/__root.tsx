import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from '@mantine/core'
import mantineCss from '@mantine/core/styles.css?url'
import maplibreCss from 'maplibre-gl/dist/maplibre-gl.css?url'
import { QueryClientProvider } from '@tanstack/react-query'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { queryClient } from '#/lib/trpc'
import { AppShell } from '#/ui/AppShell'
import { theme } from '#/ui/theme'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'wee-app' },
    ],
    links: [
      { rel: 'stylesheet', href: mantineCss },
      // MapLibre's own styles, for the popup and the zoom control.
      { rel: 'stylesheet', href: maplibreCss },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <MantineProvider theme={theme}>
            <AppShell>{children}</AppShell>
          </MantineProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  )
}
