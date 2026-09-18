const DAY_MS = 86_400_000

/** How long ago, in whole days, in the words the tables use. `null` means it never happened. */
export function relativeDays(date: Date | null): string {
  if (!date) return 'never'
  const days = Math.floor((Date.now() - date.getTime()) / DAY_MS)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}
