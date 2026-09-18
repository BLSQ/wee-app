import { Alert, Group, Loader, Stack, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { trpc } from '#/lib/trpc'
import type { Period } from '../periods'
import { PeriodSelect } from './PeriodSelect'
import { UserActivityTable } from './UserActivityTable'

export function UserActivityPage() {
  const [period, setPeriod] = useState<Period>('7d')
  const { data, isPending, error } = useQuery(trpc.userActivity.list.queryOptions({ period }))

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={3}>Users</Title>
        <PeriodSelect value={period} onChange={setPeriod} />
      </Group>
      {isPending && <Loader />}
      {error && <Alert color="red">{error.message}</Alert>}
      {data && <UserActivityTable rows={data} />}
    </Stack>
  )
}
