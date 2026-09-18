import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { SyncsPage } from '#/features/device-syncs/ui/SyncsPage'

/**
 * The district the map has selected, carried in the URL so the page can be
 * linked to. `catch` turns a hand-typed `?district=banana` into no selection
 * rather than an error page, and it never reaches the API.
 */
const searchSchema = z.object({
  district: z.coerce.number().int().positive().optional().catch(undefined),
})

export const Route = createFileRoute('/syncs')({
  validateSearch: searchSchema,
  component: SyncsPage,
})
