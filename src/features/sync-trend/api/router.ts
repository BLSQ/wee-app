import { publicProcedure, router } from '#/server/trpc/base'
import { getActivityTotals, listDailyActivity } from './queries'

const WINDOW_DAYS = 30

// `now` is set here and never sent by the client, so the window cannot be moved from
// the browser and a query test can still choose its own date.
export const syncTrendRouter = router({
  daily: publicProcedure.query(({ ctx }) =>
    listDailyActivity(ctx.db, { now: new Date(), days: WINDOW_DAYS }),
  ),
  totals: publicProcedure.query(({ ctx }) =>
    getActivityTotals(ctx.db, { now: new Date(), days: WINDOW_DAYS }),
  ),
})
