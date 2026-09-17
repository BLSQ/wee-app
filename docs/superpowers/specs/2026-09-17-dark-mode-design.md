# Dark mode — Design

**Date:** 2026-09-17
**Status:** Approved
**Issue:** #21

## Purpose

Let users switch the dashboard between light and dark. The first visit follows the operating
system; a click overrides it and is remembered in that browser.

## Shape

This is shell work, not a feature: it has no router, page or nav entry, so it lives in `src/ui/`
and touches neither `src/features/router.ts` nor `src/features/nav.ts`.

- **`src/ui/ColorSchemeToggle.tsx`** (new) — a Mantine `ActionIcon` labelled
  `Toggle color scheme`. On click it calls `setColorScheme` with the opposite of
  `useComputedColorScheme('light')`. It renders both icons from `@tabler/icons-react`: `IconMoon`
  with `darkHidden`, `IconSun` with `lightHidden`. Mantine's CSS picks the visible one, so the
  server-rendered markup does not depend on the scheme and cannot mismatch on hydration.
- **`src/ui/AppShell.tsx`** — the header `Group` gets `justify="space-between"`: title left, toggle
  at the right edge.
- **`src/routes/__root.tsx`** — `defaultColorScheme="auto"` on `<ColorSchemeScript>` and
  `<MantineProvider>`. Persistence is Mantine's default localStorage manager; the script applies the
  stored or system scheme before first paint.
- **`package.json`** — add `@tabler/icons-react`.

## Acceptance criteria

- [ ] A sun/moon button sits at the right edge of the header on every page, including on narrow
      screens where the navbar collapses.
- [ ] With no stored choice, the page renders in the OS color scheme without a light flash.
- [ ] Clicking the button switches the scheme; reloading keeps the choice.
- [ ] The dev server logs no hydration warning in either scheme.
- [ ] `ColorSchemeToggle.test.tsx` renders the toggle with `react-dom/server` inside a
      `MantineProvider` and asserts the labelled button and both icons with their scheme-hiding
      attributes. It fails before the component exists.
- [ ] `pnpm test`, `pnpm exec tsc --noEmit` and `pnpm format` stay green, including
      `AppShell.test.ts`.

## Testing

The render test covers the markup the server sends. Clicking and persistence are Mantine's code and
need a DOM; they are checked by hand in `pnpm dev`. Browser-level tests belong to issue #9.

## Out of scope

- Storing the choice server-side or per user (no authentication, ADR 0008).
- A three-state light/dark/auto control.
- A custom dark palette or theme changes beyond the default.
- Map styles: there is no map yet.
