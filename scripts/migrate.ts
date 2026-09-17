import { config } from 'dotenv'
import { createDb } from '../src/server/db/index.ts'
import { migrate } from '../src/server/db/migrate.ts'

config({ quiet: true })

// TARGET_DATABASE_URL lets the same command migrate another database.
const url = process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

const db = createDb(url)
try {
  await migrate(db)
} finally {
  await db.destroy()
}
