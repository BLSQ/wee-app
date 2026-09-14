# 0002. Full-stack TypeScript with TanStack Start

**Status:** Accepted
**Date:** 2026-09-13

## Context

The team works mostly in Python (Django for IASO, OpenHEXA pipelines) and React. A React front
end with a Python API was the familiar option, and building on an existing IASO or OpenHEXA
backend was considered too.

The application exists to support a three-hour workshop on spec-driven development. What matters
is that a pair can go from ticket to merged pull request within the session.

## Decision

We build one TypeScript application with TanStack Start, serving both the React UI and the API.

## Consequences

One language, one dependency tree, one deployment, and types that flow from the database to the
component without a generated client.

The team's Python experience is not used, and some participants start on unfamiliar ground.

TanStack Start is young and its APIs still move. Revisit if the application outlives the workshop
and needs to live next to IASO or OpenHEXA code.
