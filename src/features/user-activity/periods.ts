/** The windows the Users page offers. Imported by the browser and by the server: keep it free of imports. */
export const PERIOD_VALUES = ['7d', '30d', '90d'] as const

export type Period = (typeof PERIOD_VALUES)[number]

export const PERIODS: Record<Period, { label: string; days: number }> = {
  '7d': { label: '7 days', days: 7 },
  '30d': { label: '30 days', days: 30 },
  '90d': { label: '3 months', days: 90 },
}
