import { z } from 'zod'
import { publicProcedure, router } from '#/server/trpc/base'
import { PERIOD_VALUES, PERIODS } from '../periods'
import { listUserActivity } from './queries'

const DAY_MS = 86_400_000

export const userActivityRouter = router({
  list: publicProcedure
    // The windows come from periods.ts, so a fourth one is added in a single place.
    .input(z.object({ period: z.enum(PERIOD_VALUES).default('7d') }))
    .query(({ ctx, input }) =>
      listUserActivity(ctx.db, {
        since: new Date(Date.now() - PERIODS[input.period].days * DAY_MS),
      }),
    ),
})
