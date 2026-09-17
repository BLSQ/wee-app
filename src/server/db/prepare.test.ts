import { describe, expect, it } from 'vitest'
import { ensureDatabase } from './prepare.ts'

// The paths that need a running server are not tested here: `pnpm db:reset` exercises them.
describe('ensureDatabase', () => {
  it('gives up when no server answers before the timeout', async () => {
    await expect(
      ensureDatabase('postgres://postgres@127.0.0.1:1/wee_app', { timeoutMs: 300 }),
    ).rejects.toThrow(/not reachable/)
  })
})
