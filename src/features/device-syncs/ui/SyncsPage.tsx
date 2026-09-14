import { Alert, Loader, Stack, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '#/lib/trpc'
import { SyncTable } from './SyncTable'

export function SyncsPage() {
  const { data, isPending, error } = useQuery(trpc.deviceSyncs.list.queryOptions({ limit: 50 }))

  return (
    <Stack>
      <Title order={3}>Recent syncs</Title>
      {isPending && <Loader />}
      {error && <Alert color="red">{error.message}</Alert>}
      {data && <SyncTable syncs={data} />}
    </Stack>
  )
}
