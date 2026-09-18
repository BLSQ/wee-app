import { type Kysely, sql } from 'kysely'
import type { Database } from '#/server/db'

export type UserActivity = {
  userId: number
  username: string
  syncCount: number
  submissionCount: number
  deviceCount: number
  /** null when the user synced nothing inside the window. */
  lastSyncAt: Date | null
}

/**
 * One row per user, counting only the syncs at or after `since`.
 *
 * The window predicate sits in the `on` clause of the left join, not in a `where`:
 * in a `where` it would drop the users with no activity, who are the point of the page.
 * Every aggregate is cast to int because `pg` returns bigint as a string.
 */
export async function listUserActivity(
  db: Kysely<Database>,
  params: { since: Date },
): Promise<UserActivity[]> {
  return db
    .selectFrom('app_user as user')
    .leftJoin('device_sync as sync', (join) =>
      join.onRef('sync.user_id', '=', 'user.id').on('sync.synced_at', '>=', params.since),
    )
    .select([
      'user.id as userId',
      'user.username as username',
      sql<number>`count(sync.id)::int`.as('syncCount'),
      sql<number>`coalesce(sum(sync.submission_count), 0)::int`.as('submissionCount'),
      sql<number>`count(distinct sync.device_id)::int`.as('deviceCount'),
      sql<Date | null>`max(sync.synced_at)`.as('lastSyncAt'),
    ])
    .groupBy(['user.id', 'user.username'])
    .orderBy('user.username')
    .execute()
}
