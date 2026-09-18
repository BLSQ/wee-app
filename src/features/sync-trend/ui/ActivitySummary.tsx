import { Group, Paper, Text } from '@mantine/core'
import type { ActivityTotals } from '../api/queries'

/** Null when there is nothing to divide by, and so no honest number to show. */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <Paper withBorder p="md" flex={1}>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="xl" fw={600}>
        {value}
      </Text>
    </Paper>
  )
}

export function ActivitySummary({ totals }: { totals: ActivityTotals }) {
  // The change is over syncs: whether devices are reporting is the question the page answers.
  const change = percentChange(totals.syncCount, totals.previousSyncCount)

  return (
    <Group align="stretch">
      <Figure label="Syncs" value={String(totals.syncCount)} />
      <Figure label="Resources created" value={String(totals.resourceCount)} />
      <Figure
        label="Syncs vs previous 30 days"
        value={change === null ? 'no comparison' : `${change > 0 ? '+' : ''}${change}%`}
      />
    </Group>
  )
}
