# Linting, dead-code detection and module boundary rules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task-by-task. This repository's `CLAUDE.md` rules out `subagent-driven-development` —
> implement directly, task by task, in this session.

**Goal:** Enforce the two module-boundary rules `CLAUDE.md` already states in prose, and add
dead-code detection for unused files, exports and dependencies — issue #11.

**Architecture:** Two hand-written ESLint rules (`local/no-cross-feature-import`,
`local/no-browser-server-import`) living in `eslint-rules/`, wired into a flat `eslint.config.mjs`
alongside `typescript-eslint`'s non-type-checked recommended rules. Knip, configured by
`knip.json`, reports unused files, exports and dependencies separately via `pnpm knip`.

**Tech Stack:** ESLint 10 (flat config), `typescript-eslint` 8, `@eslint/js`, `globals`, Knip 6.
All plain Node/ESM (`.mjs`), no TypeScript config loader needed.

**Spec:** `docs/superpowers/specs/2026-09-18-lint-dead-code-boundaries-design.md`

## Global Constraints

- Everything in English: code, comments, commit messages.
- `pnpm lint` and `pnpm knip` are each a single `pnpm` command and exit non-zero on a real
  violation.
- Feature isolation is feature-to-feature only: code outside `src/features/` (routes, the app
  shell, tests) may still import a feature's files directly.
- A browser-zone file (`src/ui/**`, `src/lib/**`, `src/features/*/ui/**`, or a route outside
  `src/routes/api/**`) may `import type` from `src/server/**` but never value-import it.
- No general style/formatting rules, no CI wiring, no `react-hooks`/import-ordering rules — out of
  scope per the spec.
- `pnpm exec tsc --noEmit`, `pnpm test` and `pnpm exec prettier --check .` must stay green after
  every task.

---

### Task 1: `no-cross-feature-import` rule and the lint command

**Files:**

- Create: `eslint-rules/resolve-specifier.mjs`
- Create: `eslint-rules/no-cross-feature-import.mjs`
- Create: `eslint-rules/no-cross-feature-import.test.ts`
- Create: `eslint-rules/index.mjs`
- Create: `eslint.config.mjs`
- Modify: `vitest.config.ts` (add `eslint-rules/**/*.test.ts` to the `node` project's `include`)
- Modify: `package.json` (add devDependencies and the `lint` script)

**Interfaces:**

- Produces: `resolveSpecifier(fromFile: string, specifier: string): string | undefined` and
  `SRC_ROOT: string`, exported from `eslint-rules/resolve-specifier.mjs`. Task 2 imports both.
- Produces: `localRules: { rules: Record<string, Rule.RuleModule> }`, exported from
  `eslint-rules/index.mjs`. Task 2 adds a second entry to its `rules` object.
- Produces: `pnpm lint` (runs `eslint .`).

- [ ] **Step 1: Install the ESLint tooling**

Run:

```bash
pnpm add -D eslint typescript-eslint @eslint/js globals
```

- [ ] **Step 2: Let Vitest pick up rule tests**

Modify `vitest.config.ts`'s `node` project `include` array:

```ts
          include: [
            'src/**/*.test.ts',
            'data/**/*.test.ts',
            'scripts/**/*.test.ts',
            'eslint-rules/**/*.test.ts',
          ],
```

- [ ] **Step 3: Add the path-resolution helper**

Create `eslint-rules/resolve-specifier.mjs`:

```js
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src')

/**
 * Resolves an import specifier written with the '#/' alias or a relative path to an
 * absolute filesystem path, without an extension. Returns undefined for a package
 * import, since nothing in this codebase reaches into src/ through one.
 */
export function resolveSpecifier(fromFile, specifier) {
  if (specifier.startsWith('#/')) return join(SRC_ROOT, specifier.slice(2))
  if (specifier.startsWith('.')) return resolve(dirname(fromFile), specifier)
  return undefined
}
```

This file has no dedicated test: it is exercised through the rule tests in the next step.

- [ ] **Step 4: Write the failing rule test**

Create `eslint-rules/no-cross-feature-import.test.ts`:

```ts
import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import { noCrossFeatureImport } from './no-cross-feature-import.mjs'
import { SRC_ROOT } from './resolve-specifier.mjs'

RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
})
const file = (relativePath: string) => `${SRC_ROOT}/${relativePath}`

ruleTester.run('no-cross-feature-import', noCrossFeatureImport, {
  valid: [
    {
      filename: file('features/device-syncs/ui/SyncsPage.tsx'),
      code: "import { SyncTable } from './SyncTable'",
    },
    {
      filename: file('features/router.ts'),
      code: "import { deviceSyncsRouter } from './device-syncs/api/router'",
    },
    {
      filename: file('routes/syncs.tsx'),
      code: "import { SyncsPage } from '#/features/device-syncs/ui/SyncsPage'",
    },
  ],
  invalid: [
    {
      filename: file('features/other-feature/ui/Bad.tsx'),
      code: "import { SyncTable } from '../../device-syncs/ui/SyncTable'",
      errors: [{ messageId: 'crossFeature' }],
    },
    {
      filename: file('features/other-feature/ui/Bad.tsx'),
      code: "import { SyncTable } from '#/features/device-syncs/ui/SyncTable'",
      errors: [{ messageId: 'crossFeature' }],
    },
  ],
})
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm exec vitest run eslint-rules/no-cross-feature-import.test.ts`
Expected: FAIL — `./no-cross-feature-import.mjs` does not exist yet (module not found).

- [ ] **Step 6: Implement the rule**

Create `eslint-rules/no-cross-feature-import.mjs`:

```js
import { relative, sep } from 'node:path'
import { resolveSpecifier, SRC_ROOT } from './resolve-specifier.mjs'

// Returns the feature name for a path under src/features/<name>/..., or undefined for
// a path outside src/features/ or directly in it (router.ts, nav.ts: not inside a
// feature folder, so outside this rule's reach without a special case).
function featureNameOf(absolutePath) {
  const rel = relative(SRC_ROOT, absolutePath)
  if (rel.startsWith('..')) return undefined
  const segments = rel.split(sep)
  if (segments[0] !== 'features' || segments.length <= 2) return undefined
  return segments[1]
}

/** @type {import('eslint').Rule.RuleModule} */
export const noCrossFeatureImport = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow importing across features, except through the feature registry',
    },
    schema: [],
    messages: {
      crossFeature:
        "Feature '{{from}}' imports from feature '{{target}}'. A feature's files stay inside its own folder; wire it up through router.ts or nav.ts instead.",
    },
  },
  create(context) {
    const ownFeature = featureNameOf(context.filename)
    if (!ownFeature) return {}

    function check(node) {
      const source = node.source?.value
      if (typeof source !== 'string') return
      const resolved = resolveSpecifier(context.filename, source)
      if (!resolved) return
      const targetFeature = featureNameOf(resolved)
      if (targetFeature && targetFeature !== ownFeature) {
        context.report({
          node,
          messageId: 'crossFeature',
          data: { from: ownFeature, target: targetFeature },
        })
      }
    }

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
    }
  },
}
```

The `@type` JSDoc comment matters: without it, `tsc --noEmit` widens `meta.type` to `string` and
rejects the object where `RuleTester.run` expects the literal `'problem'`.

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm exec vitest run eslint-rules/no-cross-feature-import.test.ts`
Expected: PASS — 5 tests (3 valid, 2 invalid).

- [ ] **Step 8: Wire the rule into a plugin and a config**

Create `eslint-rules/index.mjs`:

```js
import { noCrossFeatureImport } from './no-cross-feature-import.mjs'

export const localRules = {
  rules: {
    'no-cross-feature-import': noCrossFeatureImport,
  },
}
```

Create `eslint.config.mjs`:

```js
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { localRules } from './eslint-rules/index.mjs'

export default tseslint.config(
  { ignores: ['dist', '.output', '.vercel', '.tanstack', '.claude', 'src/routeTree.gen.ts'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { local: localRules },
    rules: {
      'local/no-cross-feature-import': 'error',
    },
  },
)
```

The `.claude` ignore excludes the vendored Superpowers skills (their own scripts are not this
repository's code). `src/routeTree.gen.ts` is generated and already carries its own
`/* eslint-disable */`. The Node-globals block is needed because `js.configs.recommended` enables
`no-undef` for every file, and `typescript-eslint`'s recommended config only turns it back off for
`.ts`/`.tsx` (TypeScript's own checker already covers that there); `.mjs` files such as
`scripts/postinstall.mjs` still need `process`, `console`, etc. declared.

- [ ] **Step 9: Add the `lint` script**

Modify `package.json`'s `scripts`, right after `"test:watch": "vitest",`:

```json
    "lint": "eslint .",
```

- [ ] **Step 10: Run the linter and the rest of the checks against the whole repository**

Run: `pnpm lint`
Expected: no output, exit code 0 — nothing in the repository crosses a feature boundary today.

Run: `pnpm exec tsc --noEmit && pnpm test`
Expected: both clean/green — the vitest config change and the new rule test have not broken
anything else.

- [ ] **Step 11: Commit**

```bash
git add eslint-rules eslint.config.mjs package.json pnpm-lock.yaml vitest.config.ts
git commit -m "Add the no-cross-feature-import ESLint rule and pnpm lint"
```

---

### Task 2: `no-browser-server-import` rule

**Files:**

- Create: `eslint-rules/no-browser-server-import.mjs`
- Create: `eslint-rules/no-browser-server-import.test.ts`
- Modify: `eslint-rules/index.mjs`
- Modify: `eslint.config.mjs`

**Interfaces:**

- Consumes: `resolveSpecifier`, `SRC_ROOT` from `eslint-rules/resolve-specifier.mjs` (Task 1).
- Consumes: `localRules` shape from `eslint-rules/index.mjs` (Task 1) — adds one entry to its
  `rules` object.

- [ ] **Step 1: Write the failing rule test**

Create `eslint-rules/no-browser-server-import.test.ts`:

```ts
import { RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, it } from 'vitest'
import { noBrowserServerImport } from './no-browser-server-import.mjs'
import { SRC_ROOT } from './resolve-specifier.mjs'

RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parser: tseslint.parser },
})
const file = (relativePath: string) => `${SRC_ROOT}/${relativePath}`

ruleTester.run('no-browser-server-import', noBrowserServerImport, {
  valid: [
    // import type is allowed
    {
      filename: file('ui/AppShell.tsx'),
      code: "import type { Database } from '#/server/db'",
    },
    // a server-side file is not a browser file, so it may import server code as a value
    {
      filename: file('features/device-syncs/api/router.ts'),
      code: "import { publicProcedure } from '#/server/trpc/base'",
    },
    // a route under routes/api/ is server-side
    {
      filename: file('routes/api/trpc/$.ts'),
      code: "import { createContext } from '#/server/trpc/base'",
    },
    // importing another browser-zone file is fine
    {
      filename: file('ui/AppShell.tsx'),
      code: "import { navItems } from '#/features/nav'",
    },
  ],
  invalid: [
    {
      filename: file('ui/AppShell.tsx'),
      code: "import { createDb } from '#/server/db'",
      errors: [{ messageId: 'browserImportsServer' }],
    },
    {
      filename: file('features/device-syncs/ui/SyncsPage.tsx'),
      code: "import { createDb } from '../../../server/db'",
      errors: [{ messageId: 'browserImportsServer' }],
    },
    {
      filename: file('routes/syncs.tsx'),
      code: "import { createDb } from '#/server/db'",
      errors: [{ messageId: 'browserImportsServer' }],
    },
  ],
})
```

The TS parser (`tseslint.parser`) is required here, unlike Task 1's test: the default `espree`
parser does not understand `import type`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run eslint-rules/no-browser-server-import.test.ts`
Expected: FAIL — `./no-browser-server-import.mjs` does not exist yet.

- [ ] **Step 3: Implement the rule**

Create `eslint-rules/no-browser-server-import.mjs`:

```js
import { relative, sep } from 'node:path'
import { resolveSpecifier, SRC_ROOT } from './resolve-specifier.mjs'

const BROWSER_ZONES = [
  (segments) => segments[0] === 'ui',
  (segments) => segments[0] === 'lib',
  (segments) => segments[0] === 'features' && segments[2] === 'ui',
  (segments) => segments[0] === 'routes' && segments[1] !== 'api',
]

function segmentsOf(absolutePath) {
  const rel = relative(SRC_ROOT, absolutePath)
  if (rel.startsWith('..')) return undefined
  return rel.split(sep)
}

function isBrowserFile(absolutePath) {
  const segments = segmentsOf(absolutePath)
  return segments !== undefined && BROWSER_ZONES.some((matches) => matches(segments))
}

function isServerTarget(absolutePath) {
  const segments = segmentsOf(absolutePath)
  return segments !== undefined && segments[0] === 'server'
}

/** @type {import('eslint').Rule.RuleModule} */
export const noBrowserServerImport = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow browser code from value-importing server code',
    },
    schema: [],
    messages: {
      browserImportsServer:
        "Browser code imports '{{source}}' from src/server/. Import only types from server code here.",
    },
  },
  create(context) {
    if (!isBrowserFile(context.filename)) return {}

    function check(node) {
      const source = node.source?.value
      if (typeof source !== 'string') return
      const importKind = node.importKind ?? node.exportKind
      if (importKind === 'type') return
      const resolved = resolveSpecifier(context.filename, source)
      if (!resolved) return
      if (isServerTarget(resolved)) {
        context.report({ node, messageId: 'browserImportsServer', data: { source } })
      }
    }

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
    }
  },
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run eslint-rules/no-browser-server-import.test.ts`
Expected: PASS — 7 tests (4 valid, 3 invalid).

- [ ] **Step 5: Add the rule to the plugin and the config**

Modify `eslint-rules/index.mjs`:

```js
import { noBrowserServerImport } from './no-browser-server-import.mjs'
import { noCrossFeatureImport } from './no-cross-feature-import.mjs'

export const localRules = {
  rules: {
    'no-cross-feature-import': noCrossFeatureImport,
    'no-browser-server-import': noBrowserServerImport,
  },
}
```

Modify `eslint.config.mjs`'s last block:

```js
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { local: localRules },
    rules: {
      'local/no-cross-feature-import': 'error',
      'local/no-browser-server-import': 'error',
    },
  },
```

- [ ] **Step 6: Run the full check set**

Run: `pnpm lint && pnpm exec tsc --noEmit && pnpm test`
Expected: all three clean/green. Nothing in the repository today value-imports `src/server/` from
a browser-zone file.

- [ ] **Step 7: Commit**

```bash
git add eslint-rules eslint.config.mjs
git commit -m "Add the no-browser-server-import ESLint rule"
```

---

### Task 3: Dead-code detection with Knip

**Files:**

- Create: `knip.json`
- Modify: `src/server/db/types.ts` (drop `export` from four interfaces that Knip finds unused)
- Modify: `package.json` (add the `knip` devDependency and script)

**Interfaces:**

- Produces: `pnpm knip` (runs `knip`).

- [ ] **Step 1: Install Knip**

Run:

```bash
pnpm add -D knip
```

- [ ] **Step 2: Add the Knip configuration**

Create `knip.json`:

```json
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": [
    "src/routes/**/*.{ts,tsx}",
    "src/server/db/migrations/*.ts",
    "scripts/*.{ts,mjs}",
    "api/index.mjs"
  ],
  "project": ["src/**/*.{ts,tsx}", "scripts/**/*.{ts,mjs}", "eslint-rules/**/*.mjs", "api/*.mjs"],
  "ignoreDependencies": ["@mantine/charts", "maplibre-gl", "recharts", "@types/geojson"]
}
```

Notes on choices that are not obvious from the file alone:

- `src/router.tsx`, `vite.config.ts`, `vitest.config.ts` and `eslint.config.mjs` are **not**
  listed as entries: Knip's own Vite, Vitest and ESLint plugins already recognise them, and
  listing them anyway produces a "remove redundant entry pattern" hint.
- `src/server/db/migrations/*.ts` is an entry because `src/server/db/migrate.ts` loads migration
  files with Kysely's `FileMigrationProvider`, which scans a folder at runtime — nothing statically
  imports a migration file by name, so without this entry Knip reports every migration as an
  unused file.
- `@mantine/charts`, `maplibre-gl` and `recharts` are pre-installed for the chart and map features
  other pairs build during the workshop (see `docs/superpowers/plans/2026-09-13-wee-app-starter.md`
  and ADR 0007) — real dependencies for work not yet started, not dead ones.
- `@types/geojson` backs the global `GeoJSON.MultiPolygon` type used in
  `src/server/db/types.ts:17`. `@types/*` packages that only add global ambient types have no
  import statement for Knip to see, so it always reports them as unused; `ignoreDependencies` is
  the standard way to tell it not to.

- [ ] **Step 3: Run Knip and read its findings**

Run: `pnpm exec knip`
Expected:

```
Unused exported types (4)
OrgUnitTable     interface  src/server/db/types.ts:6:18
AppUserTable     interface  src/server/db/types.ts:20:18
DeviceTable      interface  src/server/db/types.ts:25:18
DeviceSyncTable  interface  src/server/db/types.ts:32:18
```

These four interfaces are exported but only ever used inside `src/server/db/types.ts` itself (as
the value types of `Database`'s fields) — the `export` keyword on each is unnecessary. Confirm
with `grep -rn "OrgUnitTable\|AppUserTable\|DeviceTable\|DeviceSyncTable" src` that no other file
references them by name before removing it.

- [ ] **Step 4: Fix the real finding**

Modify `src/server/db/types.ts`: remove `export ` from the four interface declarations
(`OrgUnitTable`, `AppUserTable`, `DeviceTable`, `DeviceSyncTable`), leaving `export interface
Database` as the only export in the file.

- [ ] **Step 5: Run Knip again to verify it is clean**

Run: `pnpm exec knip`
Expected: no output, exit code 0.

- [ ] **Step 6: Add the `knip` script**

Modify `package.json`'s `scripts`, right after `"lint": "eslint .",`:

```json
    "knip": "knip",
```

- [ ] **Step 7: Run the full check set**

Run: `pnpm knip && pnpm exec tsc --noEmit && pnpm test && pnpm lint`
Expected: all four clean/green.

- [ ] **Step 8: Commit**

```bash
git add knip.json package.json pnpm-lock.yaml src/server/db/types.ts
git commit -m "Add Knip for dead-code detection and pnpm knip"
```

---

### Task 4: Retire the obsolete smoke test and document the commands

**Files:**

- Modify: `src/smoke.test.ts` (drop the assertion that no linter dependency exists)
- Modify: `CLAUDE.md` (add `pnpm lint` and `pnpm knip` to the Commands line)

**Interfaces:** none — this task only removes a now-false assertion and documents what Tasks 1-3
already built.

- [ ] **Step 1: Remove the obsolete assertion**

Modify `src/smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import pkg from '../package.json' with { type: 'json' }

describe('project scaffold', () => {
  it('is named wee-app', () => {
    expect(pkg.name).toBe('wee-app')
  })
})
```

(This deletes the `'has no linter dependency, because linting is a backlog ticket'` test — this
change is exactly what makes that assertion false.)

- [ ] **Step 2: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS — all test files green, `src/smoke.test.ts` now has one test instead of two.

- [ ] **Step 3: Document the two new commands**

Modify `CLAUDE.md` line 63-64, from:

```
`pnpm dev` · `pnpm test` · `pnpm exec tsc --noEmit` · `pnpm db:reset` · `pnpm db:migrate` ·
`pnpm db:seed` · `pnpm format`
```

to:

```
`pnpm dev` · `pnpm test` · `pnpm lint` · `pnpm knip` · `pnpm exec tsc --noEmit` · `pnpm db:reset` ·
`pnpm db:migrate` · `pnpm db:seed` · `pnpm format`
```

- [ ] **Step 4: Run every check together**

Run: `pnpm exec tsc --noEmit && pnpm test && pnpm exec prettier --check . && pnpm lint && pnpm knip`
Expected: all five clean/green.

- [ ] **Step 5: Commit**

```bash
git add src/smoke.test.ts CLAUDE.md
git commit -m "Drop the obsolete no-linter smoke test and document pnpm lint/knip"
```

---

## After Task 4

Push the branch and open the pull request (per `CLAUDE.md`: never merge into `main` locally, and
skip the finishing-a-development-branch menu). After the PR is up, use the `writing-adrs` skill to
propose additions or updates — at minimum, ADR 0010's "Enforcing the client/server boundary
everywhere belongs to issue #11" line is now resolved and worth a new or amended ADR entry.
