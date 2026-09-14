import { describe, expect, it, vi } from 'vitest'

// The shell runs in the browser. If anything it imports reaches the database
// driver, the client bundle breaks with Node-only globals such as Buffer.
vi.mock('pg', () => {
  throw new Error('client code imported the pg database driver')
})

describe('AppShell', () => {
  it('can be loaded without reaching server code', async () => {
    await expect(import('./AppShell')).resolves.toHaveProperty('AppShell')
  })
})
