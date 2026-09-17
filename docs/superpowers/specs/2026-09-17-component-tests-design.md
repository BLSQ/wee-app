# Component tests with jsdom and Testing Library — Design

**Date:** 2026-09-17
**Status:** Approved

## Purpose

Almost every workshop issue has a user interface, and `CLAUDE.md` says nothing about testing it. In
the dark-mode rehearsal the agent ruled out new dependencies, rendered the component with
`renderToStaticMarkup` and matched Mantine class names with regular expressions. That test breaks
when a class changes and cannot click the button. Left alone, each pair would add a DOM environment
in its own way, in `package.json`, the lockfile and `vitest.config.ts` at the same time.

## Approaches considered

1. **Two Vitest projects split by file extension (chosen).** `*.test.ts` runs in Node and
   `*.test.tsx` in jsdom. Nothing to remember in a test file, and the query tests stay in Node.
2. A `// @vitest-environment jsdom` comment per file. Simpler configuration, but easy to forget, and
   the failure then reads `document is not defined`.
3. Vitest browser mode with Playwright. A real browser, but it downloads browsers on workshop Wi-Fi
   and overlaps issue #9, the end-to-end smoke test.

## Decision

- Dev dependencies: `jsdom`, `@testing-library/react`, `@testing-library/dom`,
  `@testing-library/user-event`, `@testing-library/jest-dom`.
- `vitest.config.ts`: projects `node` and `dom`, split as above.
- `src/ui/test-setup.ts`, the `dom` project's setup file: jest-dom matchers, `cleanup` after each
  test, and the three things Mantine reads that jsdom lacks (`matchMedia`, `ResizeObserver`,
  `scrollIntoView`).
- `src/ui/test-helpers.tsx`: `renderWithProviders(ui)` renders inside `MantineProvider` with the
  application theme. The file re-exports `screen`, `within` and `userEvent`, so a test has one import.
- `src/features/device-syncs/ui/SyncTable.test.tsx` is the pattern to copy: one row per sync with
  its values; "today", "yesterday" and "N days ago" with the clock set by `vi.setSystemTime`; and an
  empty list. `SyncTable` gains a "No syncs yet" row for the empty list, written test first.
- Rules in `CLAUDE.md`: a component that takes props has a `*.test.tsx` next to it. A page that only
  fetches and passes data has none, and tRPC is never mocked. Query by role and text. No snapshots,
  no assertions on CSS classes, no `renderToStaticMarkup`. A MapLibre map is not rendered in a
  component test, because jsdom has no WebGL: test the data the map receives.

## Acceptance criteria

- [ ] `pnpm test` passes, and `SyncTable.test.tsx` runs in jsdom while `queries.test.ts` runs in Node.
- [ ] The empty-state test was seen failing before `SyncTable` changed.
- [ ] `pnpm exec tsc --noEmit`, Prettier and `pnpm build` are clean, and no testing library is in
      `dist/`.
- [ ] `CLAUDE.md`, `README.md` and ADR 0003 describe component tests. ADR 0003 is edited in place:
      the repository is still being scaffolded.

## Out of scope

Tests of pages, of routes or of the tRPC layer. Rendering maps or charts. Rewriting the test on the
dark-mode rehearsal branch. Accessibility audits.

## Risk

jsdom is not a browser: layout, CSS and media queries are not computed. A component test says what
is in the document, not how it looks. The preview deployment and "try the feature" stay the check
for that.
