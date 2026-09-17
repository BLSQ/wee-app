# Vercel Build Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `pnpm build` produce something Vercel can serve, without Nitro.

**Architecture:** A build script converts `dist/` into `.vercel/output/` in Build Output API v3 format: static files, one Node function wrapping the fetch handler the server bundle exports, and a routing config.

**Tech Stack:** Node 22 (plain `.mjs`, no dependency), Vite build output, Vercel Build Output API v3, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-17-vercel-build-output-design.md`

## Global Constraints

- Everything in this repository is in English.
- The script takes no dependency: it runs after the build, on Vercel, with nothing installed beyond what `pnpm install` already gave us.
- `pnpm dev` must not change.
- No linter, no e2e framework, no CI. Still backlog tickets.
- The existing suite must stay green: 33 tests across 8 files.

---

### Task 1: Emit the Build Output tree

**Files:**
- Create: `scripts/build-vercel.mjs`, `scripts/build-vercel.test.ts`
- Modify: `vercel.json`, `.gitignore`

**Interfaces:**
- Consumes: `dist/client/**` and `dist/server/**` from `pnpm build`.
- Produces: `buildVercelOutput({ cwd }): { staticFiles: number; functionDir: string }` from `scripts/build-vercel.mjs`, and the `.vercel/output` tree.

- [ ] **Step 1: Write the failing test**

`scripts/build-vercel.test.ts` runs the real build output against a temporary copy of `dist`:

```ts
import { cpSync, mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildVercelOutput } from './build-vercel.mjs'

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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test scripts/build-vercel.test.ts`
Expected: FAIL — `Cannot find module './build-vercel.mjs'`.

- [ ] **Step 3: Write the script**

`scripts/build-vercel.mjs`, plain Node, exporting the function so the test can drive it:

```js
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ENTRY = `import handler from './server.js'

const readBody = (req) => (req.method === 'GET' || req.method === 'HEAD' ? undefined : req)

export default async function (req, res) {
  const url = new URL(req.url, \`https://\${req.headers.host}\`)
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: readBody(req),
    duplex: 'half',
  })

  const response = await handler.fetch(request)
  res.writeHead(response.status, Object.fromEntries(response.headers))

  if (!response.body) return res.end()
  for await (const chunk of response.body) res.write(chunk)
  res.end()
}
`

export function buildVercelOutput({ cwd = process.cwd() } = {}) {
  const output = join(cwd, '.vercel/output')
  rmSync(output, { recursive: true, force: true })

  const staticDir = join(output, 'static')
  mkdirSync(staticDir, { recursive: true })
  cpSync(join(cwd, 'dist/client'), staticDir, { recursive: true })

  const functionDir = join(output, 'functions/index.func')
  mkdirSync(functionDir, { recursive: true })
  cpSync(join(cwd, 'dist/server'), functionDir, { recursive: true })
  writeFileSync(join(functionDir, 'index.mjs'), ENTRY)
  writeFileSync(
    join(functionDir, '.vc-config.json'),
    JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs' }, null, 2),
  )

  writeFileSync(
    join(output, 'config.json'),
    JSON.stringify(
      { version: 3, routes: [{ handle: 'filesystem' }, { src: '/(.*)', dest: '/index' }] },
      null,
      2,
    ),
  )

  return { staticFiles: 0, functionDir }
}

if (import.meta.filename === process.argv[1]) {
  const { functionDir } = buildVercelOutput()
  console.log(`wrote .vercel/output (function: ${functionDir})`)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test scripts/build-vercel.test.ts`
Expected: PASS, four tests.

- [ ] **Step 5: Wire it into the build command**

`vercel.json`:

```json
"buildCommand": "pnpm db:migrate && pnpm build && node scripts/build-vercel.mjs"
```

Add `.worktrees/` to `.gitignore`, so worktrees created under the repository do not show as untracked.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-vercel.mjs scripts/build-vercel.test.ts vercel.json .gitignore
git commit -m "Emit Vercel Build Output from the Vite build"
```

---

### Task 2: Prove the emitted function actually serves

**Files:**
- Create: none
- Uses: `.vercel/output/functions/index.func/index.mjs` from Task 1

- [ ] **Step 1: Produce a real build**

```bash
pnpm build && node scripts/build-vercel.mjs
```

Expected: `wrote .vercel/output (function: …)`.

- [ ] **Step 2: Boot the emitted entry behind plain Node**

Write `$TMPDIR/serve-func.mjs` (throwaway, not committed):

```js
import { createServer } from 'node:http'
import handler from './.vercel/output/functions/index.func/index.mjs'

createServer((req, res) => {
  handler(req, res).catch((error) => {
    console.error(error)
    res.writeHead(500).end(String(error))
  })
}).listen(3020)
```

Run it with `node --experimental-default-type=module` from the repository root, or place it in the
repository root as a `.mjs` file and delete it afterwards.

- [ ] **Step 3: Request the pages**

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3020/syncs
curl -s 'http://localhost:3020/api/trpc/deviceSyncs.list?input=%7B%22json%22%3A%7B%22limit%22%3A1%7D%7D'
```

Expected: `200`, and JSON containing a device serial. If the body hangs or truncates, the streaming
loop is at fault: buffer with `Buffer.from(await response.arrayBuffer())` and write once.

- [ ] **Step 4: Stop the server and remove the throwaway file**

---

### Task 3: Record and document

**Files:**
- Create: `docs/adr/0014-vercel-build-output-adapter.md`
- Modify: `README.md`, `BACKLOG.md`

- [ ] **Step 1: Write ADR 0014**

Status `Accepted`, date `2026-09-17`.

Context: deployments failed with `No Output Directory named "public" found`; the build succeeds but
Vercel has nothing to serve; Nitro, which used to emit that output, is ruled out (ADR 0004).

Decision: a committed script, `scripts/build-vercel.mjs`, emits Build Output API v3 — static files
from `dist/client`, one Node function wrapping the `{ fetch }` handler the server bundle exports,
and a `config.json` that serves files first and falls back to the function.

Consequences: deployment needs no console configuration and no framework preset, and previews work
the same way. We own about sixty lines of adapter, including a Node ↔ fetch conversion, which is
pinned by a test and by a local smoke run. If TanStack Start ever ships a Vercel target, drop this.

- [ ] **Step 2: Update the README deployment section**

Replace the "Serving the application" paragraph: the build command now ends with
`node scripts/build-vercel.mjs`, which emits `.vercel/output`; Vercel detects it with no further
configuration. Keep the Neon integration, the migrate-on-build sentence and the one-off production
seed.

- [ ] **Step 3: Remove ticket 12 from `BACKLOG.md`**

It is done. Leave tickets 1 to 11 untouched.

- [ ] **Step 4: Verify the whole repository**

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm exec prettier --check .
```

Expected: 37 tests across 9 files, no type errors, formatting clean.

- [ ] **Step 5: Commit, push, open the pull request**

```bash
git add docs README.md BACKLOG.md
git commit -m "Record the Vercel build output adapter"
git push -u origin feat/vercel-build-output
gh pr create --fill
```

The deployment that the pull request triggers is the final verification: its preview URL must serve
`/syncs`.
