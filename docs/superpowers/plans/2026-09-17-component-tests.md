# Component tests — Implementation Plan

**Goal:** a `*.test.tsx` file runs in jsdom with Testing Library, `SyncTable` has the example test,
and `CLAUDE.md` tells agents what to test in the user interface.

**Spec:** `docs/superpowers/specs/2026-09-17-component-tests-design.md`

**Constraints:** one page (ADR 0009). Implemented directly, test first. Commit after each task.

## Task 1: the jsdom project and the render helper

Files: `package.json`, `vitest.config.ts`; create `src/ui/test-setup.ts`, `src/ui/test-helpers.tsx`
and `src/features/device-syncs/ui/SyncTable.test.tsx`.

- [x] `pnpm add -D jsdom @testing-library/react @testing-library/dom @testing-library/user-event
    @testing-library/jest-dom`.
- [x] Write the first test in `SyncTable.test.tsx`: given one sync, the row named after its serial
      shows the user, the facility, the district and the three counters. It imports
      `renderWithProviders`, `screen` and `within` from `#/ui/test-helpers`. Run it and watch it
      fail because the helper does not exist.
- [x] `vitest.config.ts`: projects `node` (`src/**/*.test.ts`, `data/**/*.test.ts`,
      `scripts/**/*.test.ts`, environment `node`) and `dom` (`src/**/*.test.tsx`, environment
      `jsdom`, `setupFiles: ['./src/ui/test-setup.ts']`), both with `extends: true`.
- [x] `test-setup.ts`: `@testing-library/jest-dom/vitest`, `afterEach(cleanup)`, and the
      `matchMedia`, `ResizeObserver` and `scrollIntoView` stand-ins.
- [x] `test-helpers.tsx`: `renderWithProviders(ui: ReactNode)` renders inside
      `<MantineProvider theme={theme}>`; re-export `screen`, `within` and `userEvent`.
- [x] The test passes. Break `SyncTable` (swap two columns' values) to see it fail, restore. Commit.

## Task 2: relative dates and the empty state

Files: `SyncTable.test.tsx`, `src/features/device-syncs/ui/SyncTable.tsx`.

- [x] Add the date tests with `vi.useFakeTimers({ toFake: ['Date'] })` and `vi.setSystemTime`:
      a sync from the same day reads "today", from the day before "yesterday", from five days before
      "5 days ago". They describe existing code: check each by breaking `relativeDays`, then restore.
- [x] Write the empty-list test: `renderWithProviders(<SyncTable syncs={[]} />)` shows
      "No syncs yet". Watch it fail.
- [x] `SyncTable`: when `syncs` is empty, one row with a cell spanning the eight columns and the
      text "No syncs yet". The test passes. Commit.

## Task 3: rules and documents

Files: `CLAUDE.md`, `README.md`, `docs/adr/0003-trpc-and-kysely-over-an-orm.md`.

- [x] `CLAUDE.md`, under the test rules: what gets a component test, what does not, how to query,
      what is banned, and the map exception, as in the spec.
- [x] `README.md`: the tree mentions the `*.test.tsx` files; one sentence on component tests.
- [x] ADR 0003: a short part on component tests, with the two approaches set aside.
- [x] `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm format`, `pnpm build`, then
      `grep -rli "testing-library\|jsdom" dist/` prints nothing. Commit.
- [x] One round of review, fixes, push, pull request. Then the deck on `gh-pages`: the Vitest row,
      the repository tree and the matching notes.
