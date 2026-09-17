# 0015. Color scheme is a browser setting; features support both

**Status:** Proposed
**Date:** 2026-09-17

## Context

Issue #21 adds a light/dark switch to the shell. Pairs build features in parallel, and each one draws
its own components. Without a shared rule, one hardcoded colour makes a page unreadable in the other
mode.

## Decision

- The color scheme is chosen in the browser: it follows the OS by default, and a choice is stored in
  localStorage by Mantine's default manager. It is not stored per user and nothing is sent to the
  server.
- Every feature must look right in both modes. Use Mantine theme colors (`c="dimmed"`, `color="red"`,
  CSS variables), never literal colors.
- What the server renders must not depend on the mode. Anything that differs by mode uses
  `lightHidden`/`darkHidden` or CSS, so the page doesn't flash the wrong look or throw hydration
  warnings.
- `@tabler/icons-react` is the project's icon set.

## Consequences

No schema, server or auth change, and features get dark mode for free when they use theme colors.

The choice doesn't follow a user across browsers. Revisit with issue #8 (authentication).

The first MapLibre map needs a basemap style for each mode, which is its own decision.

No test enforces "no literal colours". Review catches it until a linter exists.
