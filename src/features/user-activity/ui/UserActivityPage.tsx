import { Alert, Group, Loader, Stack, Title } from '@mantine/core'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { trpc } from '#/lib/trpc'
import { PeriodSelect } from './PeriodSelect'
import { UserActivityTable } from './UserActivityTable'

// The URL holds the window and nothing else does, so the switch reads the route
// and writes the route: no useState, no useEffect (ADR 0015). getRouteApi reads
// the route's typed search parameters without importing the route file, which
// would be a circular import.
const route = getRouteApi('/users')

export function UserActivityPage() {
  const { period } = route.useSearch()
  const navigate = route.useNavigate()
  // placeholderData keeps the current rows on screen while the next window loads.
  // Without it the table unmounts on every switch and the column the user was
  // sorting by is lost.
  const { data, isPending, error } = useQuery(
    trpc.userActivity.list.queryOptions({ period }, { placeholderData: keepPreviousData }),
  )

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Users</Title>
        <PeriodSelect
          value={period}
          // replace, so switching windows does not fill the back button.
          onChange={(next) => navigate({ search: { period: next }, replace: true })}
        />
      </Group>
      {isPending && <Loader />}
      {error && <Alert color="red">{error.message}</Alert>}
      {data && <UserActivityTable rows={data} />}
    </Stack>
  )
}
