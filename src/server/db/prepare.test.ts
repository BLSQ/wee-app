import pg from 'pg'
import { afterAll, describe, expect, it } from 'vitest'
import { ensureDatabase } from './prepare.ts'

const testUrl = process.env.TEST_DATABASE_URL as string
const scratchName = `wee_app_scratch_${process.pid}`
const scratchUrl = (() => {
  const url = new URL(testUrl)
  url.pathname = `/${scratchName}`
  return url.toString()
})()

afterAll(async () => {
  const client = new pg.Client({ connectionString: testUrl })
  await client.connect()
  await client.query(`drop database if exists ${scratchName}`)
  await client.end()
})

describe('ensureDatabase', () => {
  it('leaves an existing database alone', async () => {
    expect(await ensureDatabase(testUrl)).toBe('exists')
  })

  it('creates a missing database, once', async () => {
    expect(await ensureDatabase(scratchUrl)).toBe('created')
    expect(await ensureDatabase(scratchUrl)).toBe('exists')
  })

  it('gives up when no server answers before the timeout', async () => {
    await expect(
      ensureDatabase('postgres://postgres@127.0.0.1:1/wee_app', { timeoutMs: 300 }),
    ).rejects.toThrow(/not reachable/)
  })
})
