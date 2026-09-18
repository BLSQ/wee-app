import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PERIOD_VALUES } from '#/features/user-activity/periods'
import { UserActivityPage } from '#/features/user-activity/ui/UserActivityPage'

// catch('7d'): a hand-edited or missing ?period= falls back instead of erroring.
const searchSchema = z.object({
  period: z.enum(PERIOD_VALUES).catch('7d'),
})

export const Route = createFileRoute('/users')({
  validateSearch: searchSchema,
  component: UserActivityPage,
})
