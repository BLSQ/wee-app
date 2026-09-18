import { z } from 'zod'
import { publicProcedure, router } from '#/server/trpc/base'
import { DEVICE_SYNC_LIMIT, getDeviceDetail, listDevices } from './queries'

export const devicesRouter = router({
  list: publicProcedure.query(({ ctx }) => listDevices(ctx.db)),
  detail: publicProcedure
    .input(z.object({ deviceId: z.number().int() }))
    .query(({ ctx, input }) =>
      getDeviceDetail(ctx.db, { deviceId: input.deviceId, syncLimit: DEVICE_SYNC_LIMIT }),
    ),
})
