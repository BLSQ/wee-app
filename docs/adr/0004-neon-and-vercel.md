# 0004. Neon and Vercel, without Nitro

**Status:** Accepted
**Date:** 2026-09-13

## Context

The workshop loop ends with a pull request that is reviewed and merged. A reviewer who can open the
change running, not only read it, reviews better.

Options considered for hosting: deploying as an OpenHEXA web app, the organisation's usual hosting,
or a managed platform.

A TanStack Start application also needs something to serve its server build. Nitro is the adapter
that both TanStack's and Vercel's documentation point to, so it was evaluated first.

## Decision

We deploy on Vercel with a Neon Postgres database, because together they give **a preview
environment per pull request**. That criterion is what set the OpenHEXA web app option aside.

**We do not use Nitro.** Its Vite dev worker never reaches Vite's module runner: every request
fails with `500 Vite environment "ssr" is unavailable`, and the underlying error is
`transport invoke timed out after 60000ms` on `vite:invoke → getBuiltins`. Two releases three
months apart behave identically, with the plugin order Vercel documents, with empty caches, with a
single dev server, and under two Node versions. A local dev server that cannot serve a page is
disqualifying for a repository whose purpose is test-driven development.

`@tanstack/react-start` does not depend on Nitro — it is a hosting adapter, nothing more — so
leaving it out costs nothing at development time.

## Consequences

Every pull request can get a running preview, and Neon branches can give each preview its own
database copy.

Vercel is not the organisation's default hosting choice; it is accepted here for the workshop. It
adds two external accounts and their secrets.

Migrations run during the deploy build, against the database that deployment will serve
(ADR 0012).

**How the server build is served in production is not settled.** Without an adapter, `pnpm build`
emits `dist/client` and `dist/server/server.js`, and that file exports a fetch handler rather than
starting a server: `node dist/server/server.js` listens on nothing. Closing this gap is backlog
ticket 12. Revisit the whole decision when an internal platform offers preview environments.
