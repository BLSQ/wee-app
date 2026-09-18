# 0015. Page state lives in the URL

**Status:** Proposed
**Date:** 2026-09-18

## Context

The stale devices page has a threshold the supervisor changes: the number of days without a sync.
It could have lived in React state inside the page, which is the shortest thing to write.

Nearly every feature still to come has the same shape — a filter by user (issue #17), a better sync
table (#19), a chart range (#5), a selected district on the map (#3). Whatever the first one does,
the others will copy, so the choice is worth making once rather than five times.

## Decision

A page's state lives in the URL.

- The route declares it: `validateSearch` with a zod schema, and `.catch(<default>)` so a
  hand-edited or missing value falls back instead of throwing.
- The page reads it with `getRouteApi('/path').useSearch()` and writes it with
  `navigate({ search, replace: true })`. `getRouteApi` rather than importing the route file, which
  would be a circular import: the route already imports the page.
- No `useState` holding a copy, and no `useEffect` keeping the copy and the URL in step.

State nobody would want to share stays in the component. `NeverSyncedSection` keeps whether it is
folded in its own `useDisclosure`, because a folded section is not worth a URL.

## Consequences

A view can be bookmarked, reloaded and pasted into a chat. A junk URL cannot break the page, and the
fallback is written where the parameter is declared.

`replace: true` means a change of the control does not stack up in history: the back button leaves
the page rather than stepping back through every threshold typed. That is the intent — a half-typed
"1" on the way to "14" is not a view anyone wants to return to.

There is one source of truth, so the class of bug where a control and the data disagree cannot
happen.

Every change of the control costs a query: typing "14" queries for 1 and then 14. At 200 devices on
a local Postgres that is not worth a debounce. Revisit when a page fetches something expensive —
the fix is to debounce the value before it reaches the URL, and it is local to the page.

The state a page can hold is limited to what serialises into a query string.
