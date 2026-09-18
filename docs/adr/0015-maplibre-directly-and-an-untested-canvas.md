# 0015. MapLibre directly, and an untested canvas

**Status:** Proposed
**Date:** 2026-09-18

## Context

The district sync health map is the first map in the repository. Two questions had to be settled
to build it, and a later reader would otherwise have to reverse-engineer both.

`maplibre-gl` was already a dependency, unused. `react-map-gl`, the declarative React wrapper the
ecosystem usually reaches for, was the obvious alternative.

The second question is harder. `pnpm test` runs no browser: query tests run on PGlite in the test
process and component tests run in jsdom (ADR 0003). jsdom has no WebGL, so a MapLibre canvas
cannot render in a test at all.

## Decision

**We use `maplibre-gl` directly.** The map is built in a `useEffect`, from a dynamic `import()`
because MapLibre touches `window` and TanStack Start renders the page on the server first. The
dynamic import also keeps MapLibre's megabyte out of the main client bundle: it is fetched by the
page that draws a map, and by no other.

**The map component has no test, and the logic worth testing is moved out of it.**
`ui/health.ts` holds the percentage, the colour buckets and the GeoJSON `FeatureCollection` — no
React, no MapLibre, tested in Node. The legend takes props and is tested in jsdom.
`DistrictMap.tsx` keeps only what needs a canvas: the layers, the event handlers and the popup.

The preview deployment of the pull request is what checks that the map draws, exactly as it is
what checks layout and CSS.

## Consequences

MapLibre's own concepts — sources, layers, data-driven paint expressions — are visible in the
code, which is what the next map ticket needs. There is no wrapper API to learn alongside them,
and no second dependency to keep in step with MapLibre's releases.

The cost is imperative code in a React file: refs, an effect with an empty dependency list, and a
`ready` flag, because the map object outlives any single render.

A defect that lives only in the canvas — a layer never added, a handler never bound — reaches the
preview deployment before anyone sees it. The split limits the blast radius, since anything that
can be decided without a canvas is decided in `health.ts`, but it does not remove it.

Revisit if the repository gains a browser-based test runner (issue #9), or if a second map feature
makes the imperative code worth wrapping.
