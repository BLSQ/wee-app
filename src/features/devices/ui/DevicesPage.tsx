import { Alert, Loader, Stack, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '#/lib/trpc'
import { DeviceTable } from './DeviceTable'

export function DevicesPage() {
  const { data, isPending, error } = useQuery(trpc.devices.list.queryOptions())

  return (
    <Stack>
      <Title order={3}>Devices</Title>
      {isPending && <Loader />}
      {error && <Alert color="red">{error.message}</Alert>}
      {data && <DeviceTable devices={data} />}
    </Stack>
  )
}
