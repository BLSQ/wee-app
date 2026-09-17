import { config } from 'dotenv'
import { migrate } from '../src/server/db/migrate.ts'
import { seed } from '../src/server/db/seed/run.ts'

config({ quiet: true })

const targets = [
  ['application', process.env.DATABASE_URL],
  ['test', process.env.TEST_DATABASE_URL],
] as const

for (const [name, url] of targets) {
  if (!url) throw new Error(`${name} database URL is not set`)
  console.log(`\n== ${name} database ==`)
  await migrate(url)
  const counts = await seed(url)
  console.log(
    `seeded ${counts.orgUnits} org units, ${counts.devices} devices, ${counts.syncs} syncs`,
  )
}
