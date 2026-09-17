import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ensureEnvFile } from './postinstall.mjs'

const workspace = (files: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'wee-app-'))
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content)
  return dir
}

describe('ensureEnvFile', () => {
  it('creates .env from .env.example when it is missing', () => {
    const cwd = workspace({ '.env.example': 'DATABASE_URL=postgres://local\n' })
    expect(ensureEnvFile({ cwd, env: {} })).toBe('created')
    expect(readFileSync(join(cwd, '.env'), 'utf8')).toBe('DATABASE_URL=postgres://local\n')
  })

  it('never overwrites an existing .env', () => {
    const cwd = workspace({
      '.env.example': 'DATABASE_URL=example\n',
      '.env': 'DATABASE_URL=mine\n',
    })
    expect(ensureEnvFile({ cwd, env: {} })).toBe('exists')
    expect(readFileSync(join(cwd, '.env'), 'utf8')).toBe('DATABASE_URL=mine\n')
  })

  it('does nothing in a build', () => {
    const cwd = workspace({ '.env.example': 'DATABASE_URL=example\n' })
    expect(ensureEnvFile({ cwd, env: { VERCEL: '1' } })).toBe('skipped')
    expect(ensureEnvFile({ cwd, env: { CI: '1' } })).toBe('skipped')
  })
})
