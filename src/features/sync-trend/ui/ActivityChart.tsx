import type { DailyActivity } from '../api/queries'

export function ActivityChart({ days }: { days: DailyActivity[] }) {
  return <div>{days.length}</div>
}
