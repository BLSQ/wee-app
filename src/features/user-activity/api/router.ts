import { z } from 'zod'
import { publicProcedure, router } from '#/server/trpc/base'
import { PERIODS } from '../periods'
import { listUserActivity } from './queries'

const DAY_MS = 86_400_000

export const userActivityRouter = router({
  list: publicProcedure
    .input(z.object({ period: z.enum(['7d', '30d', '90d']).default('7d') }))
    .query(({ ctx, input }) =>
      listUserActivity(ctx.db, {
        since: new Date(Date.now() - PERIODS[input.period].days * DAY_MS),
      }),
    ),
})
