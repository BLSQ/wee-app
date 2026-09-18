import { Alert, Button, Group, Loader, Stack, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { trpc } from '#/lib/trpc'
import { DistrictLegend } from './DistrictLegend'
import { DistrictMap } from './DistrictMap'
import { SyncTable } from './SyncTable'

// getRouteApi rather than importing the route: the route already imports this
// page, and importing it back would be a cycle.
const route = getRouteApi('/syncs')

export function SyncsPage() {
  const { district } = route.useSearch()
  const navigate = route.useNavigate()

  const health = useQuery(trpc.deviceSyncs.districtHealth.queryOptions())
  const syncs = useQuery(trpc.deviceSyncs.list.queryOptions({ limit: 50, districtId: district }))

  // The selection lives in the URL, so selecting is a navigation.
  const select = (districtId: number | null) =>
    navigate({ search: { district: districtId ?? undefined } })

  const selectedName = health.data?.find((candidate) => candidate.id === district)?.name

  return (
    <Stack>
      <Title order={3}>Sync health by district</Title>
      {health.isPending && <Loader />}
      {health.error && <Alert color="red">{health.error.message}</Alert>}
      {health.data && (
        <Stack gap="xs">
          <DistrictMap
            districts={health.data}
            selectedDistrictId={district ?? null}
            onSelect={select}
          />
          <DistrictLegend />
        </Stack>
      )}

      <Group justify="space-between" align="baseline">
        <Title order={3}>{selectedName ? `Recent syncs in ${selectedName}` : 'Recent syncs'}</Title>
        {district !== undefined && (
          <Button variant="subtle" size="compact-sm" onClick={() => select(null)}>
            Show all districts
          </Button>
        )}
      </Group>
      {syncs.isPending && <Loader />}
      {syncs.error && <Alert color="red">{syncs.error.message}</Alert>}
      {syncs.data && <SyncTable syncs={syncs.data} />}
    </Stack>
  )
}
