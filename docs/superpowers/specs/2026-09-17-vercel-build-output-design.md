# Serving the application on Vercel — Design

**Date:** 2026-09-17
**Status:** Approved
**Closes:** issue #14

## Purpose

Deployments fail with `No Output Directory named "public" found after the Build completed`. The
build itself succeeds — the production database is even migrated — but nothing tells Vercel what to
serve. Nitro, the adapter that used to produce that output, is ruled out (ADR 0004).

## Decision

A committed script turns the Vite build into Vercel's Build Output API v3 tree, which Vercel
detects automatically. No `outputDirectory`, no framework preset, no console clicking.

The build command becomes:

```
pnpm db:migrate && pnpm build && node scripts/build-vercel.mjs
```

`scripts/build-vercel.mjs` writes:

| Path | Content |
| --- | --- |
| `.vercel/output/static/` | everything from `dist/client` |
| `.vercel/output/functions/index.func/` | everything from `dist/server`, plus `index.mjs` and `.vc-config.json` |
| `.vercel/output/config.json` | `version: 3`, routes: `filesystem` first, then a catch-all to `/index` |

`index.mjs` is the only real logic. `dist/server/server.js` exports `default` as
`{ async fetch(request) }`, so the entry converts Node's `IncomingMessage` into a `Request`, calls
that handler, and writes the `Response` back: status, headers, then the body streamed through.

## Shape of the entry

```js
import handler from './server.js'

export default async function (req, res) {
  const request = new Request(url, { method, headers, body, duplex: 'half' })
  const response = await handler.fetch(request)
  res.writeHead(response.status, headers)
  // stream response.body into res
}
```

## Acceptance criteria

- [ ] `node scripts/build-vercel.mjs` emits the tree above, and `config.json` is valid version 3.
- [ ] The emitted function, run under plain Node, serves `/syncs` and `/api/trpc` locally.
- [ ] A deployed production URL serves `/syncs` with real data.
- [ ] `pnpm dev` is untouched.
- [ ] ADR 0014 records the decision, and issue #14 is closed.

## Testing

`scripts/build-vercel.test.ts` asserts the emitted tree and the parsed `config.json` — the cheap,
fast check that runs in the suite.

The adapter's real behaviour is checked by a local smoke run: boot the emitted entry behind a plain
`node:http` server and request `/syncs` and `/api/trpc`. That catches the one genuinely risky part,
the Node ↔ fetch conversion with a streamed SSR body, without needing a deployment.

Deployment remains the final verification, and it is not automatable from here.

## Risks

| Risk | Mitigation |
| --- | --- |
| Streaming the SSR body through `ServerResponse` misbehaves | The local smoke run catches it; fall back to buffering the body |
| Request bodies (tRPC mutations) need `duplex: 'half'` on Node's `Request` | Set it; the smoke run exercises a POST |
| Hand-rolled adapter drifts from Vercel's format | `config.json` is `version: 3`, documented and stable; the test pins the shape |
| The function bundles the whole `dist/server` directory | That is what Nitro did too; size is ~230 kB |

## Out of scope

Deployment protection (already disabled), seeding production, and moving to another host. Preview
deployments need no extra work: the same output serves them.
