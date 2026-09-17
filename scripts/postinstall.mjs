import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Copies .env.example to .env unless .env already exists.
 * Returns what it did, so the behaviour is testable.
 */
export function ensureEnvFile({ cwd = process.cwd(), env = process.env } = {}) {
  if (env.CI || env.VERCEL) return 'skipped'
  const target = join(cwd, '.env')
  if (existsSync(target)) return 'exists'
  copyFileSync(join(cwd, '.env.example'), target)
  return 'created'
}

if (import.meta.filename === process.argv[1]) {
  if (ensureEnvFile() === 'created') {
    console.log('Created .env from .env.example. Next: docker compose up -d && pnpm db:reset')
  }
}
