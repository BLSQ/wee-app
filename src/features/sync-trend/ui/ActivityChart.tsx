import { CompositeChart } from '@mantine/charts'
import type { DailyActivity } from '../api/queries'
import { formatDay } from './format-day'

// Not tested: jsdom computes no layout, so a chart draws nothing there. What is testable
// about this component is the data it receives, which api/queries.test.ts covers, and how
// it looks, which the preview deployment shows. See CLAUDE.md.
//
// Two y-axes, against the usual advice: the two series are about fifteen times apart, so
// where the line sits against the bars is set by the scales rather than by the data. The
// alternative was two stacked plots. Density won, because this page is read at a glance.
// See docs/superpowers/specs/2026-09-18-sync-trend-design.md.
export function ActivityChart({ days }: { days: DailyActivity[] }) {
  // Recharts labels the x axis with a string. toISOString is UTC, like the day bucketing.
  // The data carries the whole date: the axis shortens it back down, because thirty written
  // dates do not fit, and the tooltip spells it out.
  const data = days.map((day) => ({
    day: day.day.toISOString().slice(0, 10),
    syncCount: day.syncCount,
    resourceCount: day.resourceCount,
  }))

  return (
    <CompositeChart
      h={320}
      data={data}
      dataKey="day"
      withLegend
      withRightYAxis
      yAxisLabel="Syncs"
      rightYAxisLabel="Resources created"
      curveType="linear"
      xAxisProps={{ tickFormatter: (day: string) => day.slice(5) }}
      // Recharts types the tooltip label as a ReactNode; here it is always the day string.
      tooltipProps={{ labelFormatter: (day) => formatDay(String(day), new Date()) }}
      series={[
        { name: 'syncCount', label: 'Syncs', color: '#2a78d6', type: 'bar' },
        {
          name: 'resourceCount',
          label: 'Resources created',
          color: '#eb6834',
          type: 'line',
          yAxisId: 'right',
        },
      ]}
    />
  )
}
