import { SegmentedControl } from '@mantine/core'
import { PERIODS, PERIOD_VALUES, type Period } from '../periods'

export function PeriodSelect({
  value,
  onChange,
}: {
  value: Period
  onChange: (period: Period) => void
}) {
  return (
    <SegmentedControl
      value={value}
      onChange={(next) => onChange(next as Period)}
      data={PERIOD_VALUES.map((period) => ({ value: period, label: PERIODS[period].label }))}
    />
  )
}
