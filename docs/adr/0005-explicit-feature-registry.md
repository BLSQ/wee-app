# 0005. Explicit feature registry

**Status:** Accepted
**Date:** 2026-09-13

## Context

Four to six pairs work on this repository at the same time, each building a feature under
`src/features/<name>/`. Every feature publishes two things to the application shell: a tRPC router
and a navigation entry. Whatever mechanism does this is the one place where parallel work collides.

Collecting features automatically with `import.meta.glob` would remove the collision: a pair
creates a folder and its page appears.

## Decision

We list features explicitly in `src/features/index.ts`. Adding a feature means adding one router
entry and one nav item to that file.

The deciding argument is not taste. Composing a tRPC router from a dynamically built list loses its
precise type, which destroys the end-to-end inference that is the reason for choosing tRPC.
Automatic discovery would buy conflict-free merges at the cost of the property the stack was picked
for.

## Consequences

Every pull request that adds a feature touches `src/features/index.ts`, so concurrent features
conflict there. The conflict is two adjacent lines and resolving it is mechanical.

Reading one file tells you every feature the application has.

Revisit if type-safe dynamic composition becomes possible.
