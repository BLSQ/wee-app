/**
 * Turns the Vite build into Vercel's Build Output API v3 tree, which Vercel
 * detects on its own — no framework preset, no outputDirectory, no console
 * clicking. Runs after `vite build`, with no dependency of its own.
 *
 * See docs/adr/0014-vercel-build-output-adapter.md
 */
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The function entry. `dist/server/server.js` exports `{ async fetch(request) }`,
 * so all this does is convert Node's request into a `Request` and write the
 * `Response` back out.
 */
const ENTRY = `import handler from './server.js'

function toRequest(req) {
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    for (const one of Array.isArray(value) ? value : [value]) headers.append(name, one)
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  return new Request(new URL(req.url, \`https://\${req.headers.host}\`), {
    method: req.method,
    headers,
    body: hasBody ? req : undefined,
    duplex: hasBody ? 'half' : undefined,
  })
}

export default async function (req, res) {
  const response = await handler.fetch(toRequest(req))

  const headers = Object.fromEntries(response.headers)
  const cookies = response.headers.getSetCookie?.() ?? []
  if (cookies.length > 0) {
    delete headers['set-cookie']
    res.setHeader('set-cookie', cookies)
  }
  res.writeHead(response.status, headers)

  if (!response.body) {
    res.end()
    return
  }
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
  // Without this, Node reads the bundled server.js as CommonJS and its import
  // statements throw. The function directory is isolated on Vercel: the
  // repository package.json does not reach it.
  writeFileSync(
    join(functionDir, 'package.json'),
    JSON.stringify({ type: 'module' }, null, 2) + '\n',
  )
  writeFileSync(
    join(functionDir, '.vc-config.json'),
    JSON.stringify(
      { runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs' },
      null,
      2,
    ) + '\n',
  )

  // Serve real files first; everything else is the application.
  writeFileSync(
    join(output, 'config.json'),
    JSON.stringify(
      { version: 3, routes: [{ handle: 'filesystem' }, { src: '/(.*)', dest: '/index' }] },
      null,
      2,
    ) + '\n',
  )

  const staticFiles = readdirSync(staticDir, { recursive: true, withFileTypes: true }).filter(
    (entry) => entry.isFile(),
  ).length

  return { staticFiles, staticDir, functionDir }
}

if (import.meta.filename === process.argv[1]) {
  const { staticFiles } = buildVercelOutput()
  console.log(`wrote .vercel/output: ${staticFiles} static files and one function`)
}
