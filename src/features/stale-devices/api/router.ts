import { z } from 'zod'
import { publicProcedure, router } from '#/server/trpc/base'
import { listStaleDevices } from './queries'

export const staleDevicesRouter = router({
  list: publicProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(7) }))
    .query(({ ctx, input }) => listStaleDevices(ctx.db, { now: new Date(), days: input.days })),
})
