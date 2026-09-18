import { router } from '#/server/trpc/base'
import { deviceSyncsRouter } from './device-syncs/api/router'
import { devicesRouter } from './devices/api/router'

/**
 * Feature registry, server side. Adding a feature adds one router entry here and
 * one nav item in ./nav.ts. Client code imports only the AppRouter type from here.
 *
 * Features are listed explicitly rather than discovered: composing a tRPC router
 * from a dynamic list erases its end-to-end type inference. See docs/adr/0010.
 */
export const appRouter = router({
  deviceSyncs: deviceSyncsRouter,
  devices: devicesRouter,
})

export type AppRouter = typeof appRouter
