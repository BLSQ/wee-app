import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { StaleDevicesPage } from '#/features/stale-devices/ui/StaleDevicesPage'

// catch(7): a hand-edited or missing ?days= falls back instead of erroring.
const searchSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).catch(7),
})

export const Route = createFileRoute('/stale-devices')({
  validateSearch: searchSchema,
  component: StaleDevicesPage,
})
