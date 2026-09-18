# Linting, dead-code detection and module boundary rules — Design

**Date:** 2026-09-18
**Status:** Approved

## Purpose

`CLAUDE.md` already states two rules in prose: a feature's code stays inside
`src/features/<name>/`, and browser code never imports `src/server/`. Nothing enforces either one.
`src/ui/AppShell.test.ts` guards the second rule, but only for the shell — ADR 0010 names this gap
as issue #11. Nothing at all catches an unused file, export or dependency. Issue #11 asks for both.

## Approaches considered

1. **ESLint (typescript-eslint) with two small custom local rules, plus Knip for dead code
   (chosen).** Matches the two prose rules exactly and stays inside the tools already implied by
   the stack (TypeScript, ESLint's own resolution of the `#/` alias needs no extra dependency).
2. `eslint-plugin-boundaries` instead of custom rules. A purpose-built third-party plugin, less
   code for us to own — but it introduces its own "element type" configuration to learn, and its
   handling of the `import type` exception would need verifying against its docs rather than being
   visible in a rule we wrote ourselves.
3. `eslint-plugin-import`'s `no-restricted-paths`, with one zone per feature. Rejected: it cannot
   express "a feature may import itself but not another feature" without one explicit zone per
   feature pair, which does not scale past the one feature that exists today.
4. Biome as a combined linter and formatter. Rejected: it would replace Prettier, which
   `pnpm format` already owns, and has no equivalent to Knip's unused-file/export/dependency
   report.

## Decision

- Dev dependencies: `eslint`, `typescript-eslint`, `@eslint/js`, `knip`.
- `eslint.config.ts` (flat config): `typescript-eslint`'s non-type-checked recommended rules, plus
  a local rules plugin defined in the same repo with two rules:
  - **`no-cross-feature-import`** — a file under `src/features/<X>/**` may not import a specifier
    that resolves under `src/features/<Y>/**` for any `Y !== X`. `router.ts` and `nav.ts` live
    directly in `src/features/`, one level above any `<name>/` folder, so they are outside the
    rule's reach without a special case.
  - **`no-browser-server-import`** — a file under `src/routes/**` (except `src/routes/api/**`),
    `src/ui/**`, `src/lib/**` or `src/features/*/ui/**` may not have a *value* import that resolves
    under `src/server/**`. An `import type` (already distinct under `verbatimModuleSyntax`) is
    allowed.
  - Both rules resolve an import specifier to an absolute path themselves: the `#/` alias maps to
    `src/`, and a relative specifier resolves against the importing file's own directory. No
    dependency on a resolver plugin, since every import in this codebase is one of those two
    forms.
  - `src/routeTree.gen.ts` is excluded (it already carries `/* eslint-disable */` and is
    regenerated, not hand-edited).
- `knip.json`: entries are the route files under `src/routes/`, `scripts/*.ts`, and the root config
  files (`vite.config.ts`, `vitest.config.ts`); project files are `src/**` and `scripts/**`,
  excluding `src/routeTree.gen.ts`. Knip's own Vitest plugin already treats `*.test.ts(x)` files as
  usage, so a helper used only by tests is not reported as dead.
- `package.json` scripts: `"lint": "eslint ."` and `"knip": "knip"`.
- `CLAUDE.md`'s Commands line gains `pnpm lint` and `pnpm knip`.
- `src/smoke.test.ts` loses its "has no linter dependency, because linting is a backlog ticket"
  case — this ticket is what makes that assertion false.

Isolation is feature-to-feature, not "everything outside a feature." Code outside
`src/features/` (routes, the app shell, tests) can still import a feature's files directly, which
is what `src/routes/syncs.tsx` already does today. The rule only fires when a file inside one
feature folder reaches into a different one.

## Acceptance criteria

- [ ] `pnpm lint` fails when a file in `src/features/device-syncs/` imports from a second, added
      feature folder (and vice versa), and passes on the codebase as it stands today.
- [ ] `pnpm lint` fails when a file under `src/ui/`, `src/lib/`, `src/features/*/ui/`, or a route
      outside `src/routes/api/` has a value import resolving under `src/server/`, and passes when
      the same import is `import type`.
- [ ] `pnpm knip` fails if it finds an unused file, export or dependency; anything it finds in
      today's codebase is cleaned up as part of this change.
- [ ] `pnpm exec tsc --noEmit`, `pnpm test` and `pnpm format` stay green.

## Testing

Each custom rule gets its own small fixture-based test (a file that should pass, one that should
fail per rule) run through ESLint's `RuleTester`. `pnpm lint` and `pnpm knip` themselves are not
unit-tested further: running them against this repository is the check.

## Out of scope

General style or formatting rules (Prettier already owns formatting), `react-hooks` or
import-ordering rules, CI wiring, and everything else already named on `CLAUDE.md`'s "no linter,
e2e framework, auth or CI yet" line.
