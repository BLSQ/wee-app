# 0014. A Vercel Build Output adapter, written here

**Status:** Accepted
**Date:** 2026-09-17

## Context

Deployments failed with `No Output Directory named "public" found after the Build completed`. The
build itself succeeded — the production database was even migrated — but nothing told Vercel what
to serve. `pnpm build` leaves `dist/client` and `dist/server/server.js`, and that file exports
`{ async fetch(request) }`: a handler, not a server.

Nitro used to emit Vercel's output format, and it is ruled out (ADR 0004). Setting
`outputDirectory: dist/client` would have turned the deployment green while serving a client with
no server: server rendering and `/api/trpc` would answer 404. A green deployment of a broken
application is worse than a visible failure.

## Decision

`scripts/build-vercel.mjs` writes Vercel's Build Output API v3 tree, and the build command ends
with it:

```
pnpm db:migrate && pnpm build && node scripts/build-vercel.mjs
```

- `.vercel/output/static/` — the contents of `dist/client`.
- `.vercel/output/functions/index.func/` — the contents of `dist/server`, plus an entry that turns
  Node's request into a `Request`, calls the exported handler, and writes the `Response` back.
- `.vercel/output/config.json` — version 3, serving real files first and falling back to the
  function.

Vercel detects that directory on its own: no framework preset, no `outputDirectory`, nothing set
through the console.

## Two things the format demands

The function directory is isolated on Vercel, and both of these cost a failed deployment to learn:

- **It needs its own `package.json` with `"type": "module"`.** Otherwise Node reads the bundled
  `server.js` as CommonJS and throws `Cannot use import statement outside a module`. The repository
  `package.json` does not reach `/var/task`.
- **The server build must carry its dependencies** — `ssr: { noExternal: true }` in
  `vite.config.ts`. The function ships without `node_modules`, so anything left external (React and
  the router were) cannot resolve. The bundle grows from 220 kB to 860 kB, which is the price.

## Consequences

Production and every preview are served by the same output, with no per-environment configuration.

`ssr.noExternal` applies to the build only: switching it on in development breaks Vite's module
runner, so `vite.config.ts` conditions it on `command === 'build'`.

We own about sixty lines of adapter, including a Node ↔ fetch conversion. `scripts/build-vercel.test.ts`
pins the emitted tree, and the entry is exercised by copying the emitted function outside any
`node_modules` and any `type: module` package — Vercel's conditions — then serving it under plain
Node: `/syncs` returns 200 with the rendered shell, and `/api/trpc` returns real rows. Checking it
from inside the repository instead is what hid both defects above.

Request bodies are passed with `duplex: 'half'`, but nothing in the application reads one yet — it
is read-only. The first mutation should exercise that path deliberately.

If TanStack Start ever ships its own Vercel target, delete this script and use it.
