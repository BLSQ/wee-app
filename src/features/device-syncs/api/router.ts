import { z } from 'zod'
import { publicProcedure, router } from '#/server/trpc/base'
import { listRecentSyncs } from './queries'

export const deviceSyncsRouter = router({
  list: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }))
    .query(({ ctx, input }) => listRecentSyncs(ctx.db, { limit: input.limit })),
})
