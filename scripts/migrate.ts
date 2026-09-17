import { config } from 'dotenv'
import { migrate } from '../src/server/db/migrate.ts'

config({ quiet: true })

// TARGET_DATABASE_URL lets the same command migrate another database.
const url = process.env.TARGET_DATABASE_URL ?? process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

await migrate(url)
