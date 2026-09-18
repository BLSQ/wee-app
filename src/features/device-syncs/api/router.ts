import { z } from 'zod'
import { publicProcedure, router } from '#/server/trpc/base'
import { districtSyncHealth, listRecentSyncs } from './queries'

/** The window the map colours districts by. */
const HEALTH_WINDOW_DAYS = 7

export const deviceSyncsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).default(50),
        districtId: z.number().int().optional(),
      }),
    )
    .query(({ ctx, input }) =>
      listRecentSyncs(ctx.db, { limit: input.limit, districtId: input.districtId }),
    ),

  districtHealth: publicProcedure.query(({ ctx }) =>
    districtSyncHealth(ctx.db, { now: new Date(), days: HEALTH_WINDOW_DAYS }),
  ),
})
