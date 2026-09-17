import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildVercelOutput } from './build-vercel.mjs'

/** A minimal stand-in for what `vite build` leaves in dist/. */
function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'wee-vercel-'))
  mkdirSync(join(cwd, 'dist/client/assets'), { recursive: true })
  mkdirSync(join(cwd, 'dist/server/assets'), { recursive: true })
  writeFileSync(join(cwd, 'dist/client/index.html'), '<html></html>')
  writeFileSync(join(cwd, 'dist/client/assets/app.js'), 'console.log(1)')
  writeFileSync(join(cwd, 'dist/server/server.js'), 'export default { async fetch() {} }')
  return cwd
}

describe('buildVercelOutput', () => {
  it('copies the client build into static/', () => {
    const cwd = fixture()
    buildVercelOutput({ cwd })
    expect(existsSync(join(cwd, '.vercel/output/static/index.html'))).toBe(true)
    expect(existsSync(join(cwd, '.vercel/output/static/assets/app.js'))).toBe(true)
  })

  it('puts the server bundle and an entry in the function directory', () => {
    const cwd = fixture()
    buildVercelOutput({ cwd })
    const fn = join(cwd, '.vercel/output/functions/index.func')
    expect(existsSync(join(fn, 'server.js'))).toBe(true)
    expect(existsSync(join(fn, 'index.mjs'))).toBe(true)
    const config = JSON.parse(readFileSync(join(fn, '.vc-config.json'), 'utf8'))
    expect(config).toMatchObject({ handler: 'index.mjs', launcherType: 'Nodejs' })
    expect(config.runtime).toMatch(/^nodejs22/)
  })

  it('writes a version 3 config that serves files first, then the function', () => {
    const cwd = fixture()
    buildVercelOutput({ cwd })
    const config = JSON.parse(readFileSync(join(cwd, '.vercel/output/config.json'), 'utf8'))
    expect(config.version).toBe(3)
    expect(config.routes[0]).toEqual({ handle: 'filesystem' })
    expect(config.routes.at(-1)).toEqual({ src: '/(.*)', dest: '/index' })
  })

  it('starts from a clean output directory', () => {
    const cwd = fixture()
    mkdirSync(join(cwd, '.vercel/output/static'), { recursive: true })
    writeFileSync(join(cwd, '.vercel/output/static/stale.txt'), 'old')
    buildVercelOutput({ cwd })
    expect(existsSync(join(cwd, '.vercel/output/static/stale.txt'))).toBe(false)
  })
})
