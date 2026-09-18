import type { ActivityTotals } from '../api/queries'

export function ActivitySummary({ totals }: { totals: ActivityTotals }) {
  return <div>{totals.syncCount}</div>
}
