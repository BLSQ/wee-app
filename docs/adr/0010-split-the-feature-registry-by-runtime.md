# 0010. Split the feature registry by runtime

**Status:** Accepted
**Date:** 2026-09-14

## Context

ADR 0005 put the whole feature registry in one file, `src/features/index.ts`: the tRPC router and
the navigation items.

Those two exports run in different places. The router is server code and imports the database
driver. The navigation items are read by the application shell, in the browser. Importing the nav
items from that file pulled the router, Kysely and `pg` into the client bundle, and the page stopped
at a spinner with `ReferenceError: Can't find variable: Buffer`.

No test caught it: Vitest runs in Node and never builds the client bundle.

## Decision

The registry stays explicit (ADR 0005's reasoning about tRPC type inference still holds), but is
split by where the code runs:

- `src/features/router.ts` — server: `appRouter` and the `AppRouter` type.
- `src/features/nav.ts` — client: `navItems`.

A feature adds one line to each. Client code imports only `AppRouter` as a type from `router.ts`.

`src/ui/AppShell.test.ts` fails if the shell can reach `pg`.

## Consequences

The file name says which side of the wire it belongs to, and the boundary has a test.

A feature now touches two shared files instead of one, so concurrent features conflict in two
places. Both conflicts stay one line and mechanical.

The test guards only the shell. Enforcing the client/server boundary everywhere belongs to issue
#11 (module boundaries), and catching a broken client bundle belongs to issue #9 (end-to-end smoke
test).
