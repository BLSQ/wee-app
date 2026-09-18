import { z } from 'zod'
import { publicProcedure, router } from '#/server/trpc/base'
import { listRecentSyncs } from './queries'

export const deviceSyncsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(200).default(50),
        page: z.number().int().min(1).default(1),
        search: z.string().optional(),
        sortBy: z.enum(['device', 'user', 'facility', 'district']).optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
      }),
    )
    .query(({ ctx, input }) => {
      const offset = (input.page - 1) * input.limit
      return listRecentSyncs(ctx.db, {
        limit: input.limit,
        offset,
        search: input.search,
        sortBy: input.sortBy,
        sortOrder: input.sortOrder,
      })
    }),
})
