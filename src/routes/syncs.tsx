import maplibreCss from 'maplibre-gl/dist/maplibre-gl.css?url'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { SyncsPage } from '#/features/device-syncs/ui/SyncsPage'

/** `org_unit.id` is an int4, and a bigger number reaches Postgres as an error. */
const MAX_INT4 = 2_147_483_647

/**
 * The district the map has selected, carried in the URL so the page can be
 * linked to. `catch` turns a hand-typed `?district=banana`, or one too large
 * for the column, into no selection rather than an error page.
 */
const searchSchema = z.object({
  district: z.coerce.number().int().positive().max(MAX_INT4).optional().catch(undefined),
})

export const Route = createFileRoute('/syncs')({
  validateSearch: searchSchema,
  component: SyncsPage,
  head: () => ({
    // MapLibre's styles, for the popup and the zoom control. On this route
    // rather than the root: 83 KB of CSS for the one page that draws a map.
    links: [{ rel: 'stylesheet', href: maplibreCss }],
  }),
})
