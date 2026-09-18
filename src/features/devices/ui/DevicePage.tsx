import { Alert, Card, Grid, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '#/lib/trpc'
import { DeviceSyncTable } from './DeviceSyncTable'
import { DeviceUserTable } from './DeviceUserTable'

export function DevicePage({ deviceId }: { deviceId: string }) {
  // Digits only: Number() would also accept '0x1A' and '1e3', which no device id looks like.
  const isValidId = /^\d+$/.test(deviceId)
  const id = Number(deviceId)
  // An id that is not a device id can never match, so do not ask the server about it.
  const { data, isPending, error } = useQuery(
    trpc.devices.detail.queryOptions({ deviceId: id }, { enabled: isValidId }),
  )

  if (!isValidId || data === null) {
    return (
      <Stack>
        <Title order={3}>Device</Title>
        <Text c="dimmed">Device not found</Text>
      </Stack>
    )
  }

  return (
    <Stack>
      {isPending && <Loader />}
      {error && <Alert color="red">{error.message}</Alert>}
      {data && (
        <>
          <Title order={3}>Device {data.device.serial}</Title>
          <Grid>
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Stack gap="xs">
                <Title order={5}>Sync history</Title>
                <DeviceSyncTable syncs={data.syncs} />
                {data.syncCount > data.syncs.length && (
                  <Text size="sm" c="dimmed">
                    Showing the latest {data.syncs.length} of {data.syncCount} syncs
                  </Text>
                )}
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Stack>
                <Card withBorder padding="sm">
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed" tt="uppercase">
                        Facility
                      </Text>
                      <Text size="sm" fw={600}>
                        {data.device.facilityName}
                      </Text>
                    </Group>
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed" tt="uppercase">
                        District
                      </Text>
                      <Text size="sm" fw={600}>
                        {data.device.districtName}
                      </Text>
                    </Group>
                  </Stack>
                </Card>
                <Card withBorder padding="sm">
                  <Stack gap="xs">
                    <Title order={5}>Users</Title>
                    <DeviceUserTable users={data.users} />
                  </Stack>
                </Card>
              </Stack>
            </Grid.Col>
          </Grid>
        </>
      )}
    </Stack>
  )
}
