import { router } from '#/server/trpc/base'
import { deviceSyncsRouter } from './device-syncs/api/router'

/**
 * The only file a feature touches outside its own folder.
 * Adding a feature means adding one router entry and one nav item here.
 *
 * Features are listed explicitly rather than discovered: composing a tRPC router
 * from a dynamic list erases its end-to-end type inference. See docs/adr/0005.
 */
export const appRouter = router({
  deviceSyncs: deviceSyncsRouter,
})

export type AppRouter = typeof appRouter

export const navItems: { label: string; to: string }[] = [{ label: 'Syncs', to: '/syncs' }]
