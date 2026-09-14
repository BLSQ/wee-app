import { QueryClient } from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import superjson from 'superjson'
import type { AppRouter } from '#/features'

export const queryClient = new QueryClient()

const client = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: '/api/trpc', transformer: superjson })],
})

export const trpc = createTRPCOptionsProxy<AppRouter>({ client, queryClient })
