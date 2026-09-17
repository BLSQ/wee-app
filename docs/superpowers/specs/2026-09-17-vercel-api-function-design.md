# Replace the Build Output adapter with a one-line function — Design

**Date:** 2026-09-17
**Status:** Approved

## Purpose

The adapter from ADR 0014 works, but it costs 164 lines of script and test, a Node ↔ fetch
conversion, and an `ssr.noExternal` workaround. Dropping Nitro was meant to simplify; this gives the
simplification back.

## Decision

Vercel Functions accept the web-standard `export default { fetch(request) }`, which is exactly what
`dist/server/server.js` exports. So:

- `api/index.mjs` re-exports that handler. One line.
- `vercel.json` serves `dist/client` as static output and rewrites everything else to the function.
  `"framework": null` pins the behaviour, whatever preset the dashboard holds.
- Vercel's own file tracing ships the function's dependencies, so `ssr.noExternal` goes away, and
  with it the conditional `vite.config.ts`.

`scripts/build-vercel.mjs` and its test are deleted.

## Acceptance criteria

- [ ] The preview deployment of the pull request serves `/syncs` and answers `/api/trpc`.
- [ ] `pnpm dev`, the suite, `tsc` and Prettier stay green.
- [ ] ADR 0014 describes the mechanism that is actually deployed.

## Testing

A one-line re-export has no meaningful unit test. The preview deployment is the oracle — the only
one that caught the real defects last time.

## Risk

Vercel must run the build command before it bundles `api/index.mjs`, since the import target is a
build product. If the preview fails on that, the fallback is the adapter this replaces.
