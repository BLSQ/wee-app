import { config } from 'dotenv'
import { createDb } from '../src/server/db/index.ts'
import { migrate } from '../src/server/db/migrate.ts'
import { ensureDatabase } from '../src/server/db/prepare.ts'
import { seed } from '../src/server/db/seed/run.ts'

config({ quiet: true })

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

// Waits for a container that is still starting, and creates the database on first use.
await ensureDatabase(url)

const db = createDb(url)
try {
  await migrate(db)
  const counts = await seed(db)
  console.log(
    `seeded ${counts.orgUnits} org units, ${counts.devices} devices, ${counts.syncs} syncs`,
  )
} finally {
  await db.destroy()
}
