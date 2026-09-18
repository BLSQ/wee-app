const DAY_MS = 86_400_000

/** Midnight UTC of the day a moment falls on, as a number. */
function utcMidnight(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

/**
 * A day of the chart, written out for the tooltip: "17 September 2026 (yesterday)".
 *
 * `day` is the `YYYY-MM-DD` the chart carries. The distance is counted between the two
 * midnights rather than between timestamps, so a day does not become "yesterday" at
 * lunchtime. Days are UTC, as they are in the query that produced them.
 */
export function formatDay(day: string, now: Date): string {
  const date = new Date(`${day}T00:00:00Z`)
  const days = Math.round((utcMidnight(now) - date.getTime()) / DAY_MS)
  const ago = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
  const written = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return `${written} (${ago})`
}
