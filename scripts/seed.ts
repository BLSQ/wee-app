import { config } from 'dotenv'
import { createDb } from '../src/server/db/index.ts'
import { seed } from '../src/server/db/seed/run.ts'

config({ quiet: true })

// TARGET_DATABASE_URL lets the same command seed another database.
const url = process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

const db = createDb(url)
try {
  const counts = await seed(db)
  console.log(
    `seeded ${counts.orgUnits} org units, ${counts.devices} devices, ${counts.syncs} syncs`,
  )
} finally {
  await db.destroy()
}
