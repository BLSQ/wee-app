import { type Kysely, sql } from 'kysely'
import type { Database } from '#/server/db'

export type DailyActivity = { day: Date; syncCount: number; resourceCount: number }

/**
 * One row per day for the last `days` days, ending today.
 *
 * The calendar comes from `generate_series` and the syncs are joined onto it, so a
 * day with no sync is a row of zeros rather than a missing row: the chart must draw
 * a silent day, not jump over it.
 *
 * `count` and `sum` are `bigint` in Postgres, which the pg driver hands back as a
 * string, hence the `::int` casts.
 */
export async function listDailyActivity(
  db: Kysely<Database>,
  params: { now: Date; days: number },
): Promise<DailyActivity[]> {
  const today = sql`date_trunc('day', ${params.now}::timestamptz)`
  const { rows } = await sql<DailyActivity>`
    select
      day,
      count(sync.id)::int as "syncCount",
      coalesce(
        sum(sync.submission_count + sync.org_unit_count + sync.entity_count), 0
      )::int as "resourceCount"
    from generate_series(
      ${today} - make_interval(days => ${params.days - 1}),
      ${today},
      interval '1 day'
    ) as day
    left join device_sync as sync
      on sync.synced_at >= day and sync.synced_at < day + interval '1 day'
    group by day
    order by day
  `.execute(db)
  return rows
}
