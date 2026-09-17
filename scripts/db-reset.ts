import { config } from 'dotenv'
import { migrate } from '../src/server/db/migrate.ts'
import { ensureDatabase } from '../src/server/db/prepare.ts'
import { seed } from '../src/server/db/seed/run.ts'

config({ quiet: true })

const targets = [
  ['application', process.env.DATABASE_URL],
  ['test', process.env.TEST_DATABASE_URL],
] as const

for (const [name, url] of targets) {
  if (!url) throw new Error(`${name} database URL is not set`)
  console.log(`\n== ${name} database ==`)
  // Waits for a container that is still starting, and creates the database on first use.
  await ensureDatabase(url)
  await migrate(url)
  const counts = await seed(url)
  console.log(
    `seeded ${counts.orgUnits} org units, ${counts.devices} devices, ${counts.syncs} syncs`,
  )
}
