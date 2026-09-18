import { Alert, Loader, Stack, Title } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { trpc } from '#/lib/trpc'
import { ActivityChart } from './ActivityChart'
import { ActivitySummary } from './ActivitySummary'

export function TrendPage() {
  const days = useQuery(trpc.syncTrend.daily.queryOptions())
  const totals = useQuery(trpc.syncTrend.totals.queryOptions())
  const error = days.error ?? totals.error

  return (
    <Stack>
      <Title order={3}>Last 30 days</Title>
      {(days.isPending || totals.isPending) && <Loader />}
      {error && <Alert color="red">{error.message}</Alert>}
      {totals.data && <ActivitySummary totals={totals.data} />}
      {days.data && <ActivityChart days={days.data} />}
    </Stack>
  )
}
