import { Alert, Group, Loader, NumberInput, Stack, Text, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { trpc } from '#/lib/trpc'
import { NeverSyncedSection } from './NeverSyncedSection'
import { StaleDeviceTable } from './StaleDeviceTable'

// The URL holds the threshold and nothing else does, so the box reads the route
// and writes the route: no useState, no useEffect. getRouteApi reads the route's
// typed search parameters without importing the route file, which would be a
// circular import.
const route = getRouteApi('/stale-devices')

export function StaleDevicesPage() {
  const { days } = route.useSearch()
  const navigate = route.useNavigate()
  // placeholderData keeps the rows of the previous threshold on screen while the
  // next ones load. Without it every keystroke swaps in an empty cache entry, the
  // block below unmounts, and the never-synced section springs back folded.
  const { data, isPending, error } = useQuery(
    trpc.staleDevices.list.queryOptions({ days }, { placeholderData: (previous) => previous }),
  )
  const silent = data?.filter((device) => device.lastSyncedAt !== null) ?? []
  const neverSynced = data?.filter((device) => device.lastSyncedAt === null) ?? []

  return (
    <Stack>
      <Title order={3}>Stale devices</Title>
      <Group gap="xs">
        <Text size="sm">Silent for more than</Text>
        <NumberInput
          aria-label="Days without a sync"
          value={days}
          // replace, so stepping through values does not fill the back button.
          onChange={(value) =>
            typeof value === 'number' && navigate({ search: { days: value }, replace: true })
          }
          min={1}
          max={365}
          // An integer, because validateSearch rejects anything else and would snap
          // the box back to 7 as soon as a "." was typed.
          allowDecimal={false}
          clampBehavior="strict"
          w={90}
        />
        <Text size="sm">{days === 1 ? 'day' : 'days'}</Text>
      </Group>
      {isPending && <Loader />}
      {error && <Alert color="red">{error.message}</Alert>}
      {data && (
        <>
          <Title order={4}>
            Silent for more than {days} {days === 1 ? 'day' : 'days'} ({silent.length})
          </Title>
          <StaleDeviceTable devices={silent} emptyMessage="No device has been silent that long" />
          <NeverSyncedSection devices={neverSynced} />
        </>
      )}
    </Stack>
  )
}
