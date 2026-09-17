# 0014. Serve the application through a one-line Vercel function

**Status:** Accepted
**Date:** 2026-09-17

## Context

Deployments failed with `No Output Directory named "public" found after the Build completed`. The
build succeeded, but nothing told Vercel what to serve: `pnpm build` leaves `dist/client` and
`dist/server/server.js`, and that file exports `{ async fetch(request) }` — a handler, not a server.

Nitro used to bridge that gap, and it is ruled out (ADR 0004). Setting only
`outputDirectory: dist/client` would have turned the deployment green while serving a client with no
server behind it: a green deployment of a broken application is worse than a visible failure.

## Decision

Vercel Functions accept the web-standard `export default { fetch(request) }` signature, which is
exactly what the server build exports. So the adapter is one line, in `api/index.mjs`:

```js
export { default } from '../dist/server/server.js'
```

`vercel.json` does the rest: `dist/client` is the static output, and everything that is not a real
file is rewritten to the function. `"framework": null` pins this behaviour whatever preset the
dashboard holds. Vercel's file tracing ships the function's dependencies.

A hand-written Build Output API adapter was considered and rejected: it worked, but it cost 164
lines of script and test, a Node ↔ fetch conversion to maintain, and an `ssr.noExternal` workaround
in `vite.config.ts` — all to reproduce what the platform already does.

## Consequences

Production and every preview are served the same way, with no console configuration. `pnpm dev` is
untouched, and `vite.config.ts` stays a plain object.

The function imports a build product, so it depends on Vercel running the build command before it
bundles functions. There is no unit test for a one-line re-export: the preview deployment of each
pull request is the check, and it is the only one that ever caught a real defect here.

If TanStack Start ships its own Vercel target, delete `api/index.mjs` and use it.
