# 0015. Features link to each other by route path

**Status:** Proposed
**Date:** 2026-09-18

## Context

Until the device detail page (issue #6) no feature had ever pointed at another. That page had to be
reachable from the serials in `device-syncs`' sync table, which meant one feature naming another for
the first time. Four to six pairs build features in parallel, so whatever the first one does becomes
the pattern everyone copies.

ADR 0010 says how a feature reaches the shell — one line in `src/features/router.ts`, one in
`src/features/nav.ts` — and says nothing about how a feature reaches a sibling.

A shared `src/features/links.ts` registry was the symmetric answer: features import it, never each
other. It adds a third shared file for parallel work to collide in, and it re-states by hand what
the router already knows. Passing the link in as a render prop was the other candidate; it decouples
the component while leaving the feature just as coupled, because the page supplying the prop lives
in the same feature.

## Decision

**A feature may name another feature's route path. It may never import another feature's
components, queries or types.**

In practice that is a TanStack Router `Link`:

```tsx
<Link to="/devices/$deviceId" params={{ deviceId: String(sync.deviceId) }}>
  {sync.deviceSerial}
</Link>
```

This is not a string typed on trust. TanStack Router types `to` against the generated
`src/routeTree.gen.ts`, so a link to a route that does not exist fails `pnpm exec tsc --noEmit`:

```
Type '"/devices/$deviceId"' is not assignable to type '"." | "/syncs" | "/" | "/api/trpc/$" | ".."'
```

The generated route tree is the registry a hand-written one would try to be, and it is checked.

Whatever the link needs to carry — here the device id — is added to the linking feature's own
query, not borrowed from the other feature.

## Consequences

Two features can point at each other while sharing no code, so a pair can delete or rewrite a
feature's internals without touching its callers. The route path is the whole contract.

Renaming or deleting a route breaks the build of every feature that links to it. That is the point:
the failure arrives at compile time with the file and line, rather than as a dead link in a preview.

The contract is only as strong as the type: it is checked by `tsc`, not enforced by tooling. Nothing
yet stops a feature from importing a sibling's component instead. Issue #11, module boundary rules,
is where that would be enforced.

Features stay free to add a field to their own queries for a link's sake. `RecentSync` carries a
`deviceId` that only the link uses.

Revisit if a link ever needs more than a route path and its parameters — shared formatting, a label,
a permission check. That is the point at which a registry earns its third file.
