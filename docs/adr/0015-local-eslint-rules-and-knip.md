# 0015. Local ESLint rules and Knip for boundaries and dead code

**Status:** Proposed
**Date:** 2026-09-18

## Context

`CLAUDE.md` already states two rules in prose: a feature's code stays inside
`src/features/<name>/`, and browser code never imports `src/server/`. Nothing enforced either
one — ADR 0010 named this gap explicitly as issue #11. Nothing caught an unused file, export or
dependency either.

## Decision

Two hand-written ESLint rules, `local/no-cross-feature-import` and `local/no-browser-server-import`
(in `eslint-rules/`), enforce the two prose rules through `eslint.config.mjs`, instead of a
third-party boundary plugin such as `eslint-plugin-boundaries`. Their semantics stay close to
`CLAUDE.md`'s wording:

- Isolation is feature-to-feature only. Code outside `src/features/` (routes, the app shell,
  tests) can still import a feature's files directly, matching what `src/routes/syncs.tsx` already
  did before this change.
- A browser-zone file may `import type` from `src/server/`, distinguished by the `importKind`/
  `exportKind` the parser already sets under `verbatimModuleSyntax`, but never import it as a
  value.

Knip reports unused files, exports and dependencies through `pnpm knip`, configured by
`knip.json`. Two categories of dependency are exempted in `ignoreDependencies` because Knip cannot
see their use: `@mantine/charts`, `maplibre-gl` and `recharts`, pre-installed for the chart and map
features other pairs build later in the workshop (ADR 0007, the starter plan); and `@types/geojson`,
which only adds the global `GeoJSON.MultiPolygon` type used in `src/server/db/types.ts` and has no
import statement for Knip to see.

## Consequences

`pnpm lint` and `pnpm knip` catch a regression of either prose rule, or real dead code,
mechanically, in every pull request. Extending a rule means writing plain code against
`context.filename` and `node.source`, not learning a plugin's element-type configuration.

A file that something loads by scanning a folder at runtime, such as a migration under
`src/server/db/migrations/`, is invisible to Knip's static analysis unless it is listed in
`knip.json`'s `entry`; the same care is needed for any future runtime-scanned file.

Revisit `ignoreDependencies` once the chart or map ticket lands: if `@mantine/charts`,
`maplibre-gl` or `recharts` are still reported unused after that work ships, the exemption is
stale and should be removed, not extended.
