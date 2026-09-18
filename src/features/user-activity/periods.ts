/** The windows the Users page offers. Imported by the browser and by the server: keep it free of imports. */
export const PERIODS = {
  '7d': { label: '7 days', days: 7 },
  '30d': { label: '30 days', days: 30 },
  '90d': { label: '3 months', days: 90 },
} as const

export type Period = keyof typeof PERIODS

export const PERIOD_VALUES = Object.keys(PERIODS) as Period[]
