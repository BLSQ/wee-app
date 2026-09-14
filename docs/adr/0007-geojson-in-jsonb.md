# 0007. GeoJSON in jsonb instead of PostGIS

**Status:** Accepted
**Date:** 2026-09-13

## Context

The dashboard draws districts and chiefdoms on a MapLibre map. IASO stores geometry with PostGIS.

## Decision

We store simplified GeoJSON `MultiPolygon`s in a `jsonb` column, `org_unit.geometry`, for levels 2
and 3 only. Facilities carry `latitude` and `longitude`. There is no PostGIS extension.

## Consequences

MapLibre consumes the column as it is. The database needs no extension, and the whole hierarchy
with its polygons weighs under half a megabyte.

There are no spatial queries: no `ST_Contains`, no distance, no clustering in SQL. Anything spatial
happens in the browser or in TypeScript.

Revisit if a ticket needs a spatial query.
