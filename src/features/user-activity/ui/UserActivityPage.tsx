import { Alert, Group, Loader, Stack, Title } from '@mantine/core'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { trpc } from '#/lib/trpc'
import type { Period } from '../periods'
import { PeriodSelect } from './PeriodSelect'
import { UserActivityTable } from './UserActivityTable'

export function UserActivityPage() {
  const [period, setPeriod] = useState<Period>('7d')
  // keepPreviousData holds the old rows on screen while the new window loads. Without it the
  // table unmounts on every switch, which throws away the column the user was sorting by.
  const { data, isPending, error } = useQuery({
    ...trpc.userActivity.list.queryOptions({ period }),
    placeholderData: keepPreviousData,
  })

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
