import { z } from 'zod'
import { publicProcedure, router } from '#/server/trpc/base'
import { districtSyncHealth, listRecentSyncs } from './queries'

/** The window the map colours districts by. */
const HEALTH_WINDOW_DAYS = 7

/** `org_unit.id` is an int4. A bigger number would reach Postgres as an error. */
const MAX_INT4 = 2_147_483_647

export const deviceSyncsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).default(50),
        districtId: z.number().int().positive().max(MAX_INT4).optional(),
      }),
    )
    .query(({ ctx, input }) =>
      listRecentSyncs(ctx.db, { limit: input.limit, districtId: input.districtId }),
    ),

  districtHealth: publicProcedure.query(({ ctx }) =>
    districtSyncHealth(ctx.db, { now: new Date(), days: HEALTH_WINDOW_DAYS }),
  ),
})
