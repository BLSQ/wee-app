# 0008. No authentication yet

**Status:** Accepted
**Date:** 2026-09-13

## Context

Authentication for Bluesquare accounts is a real requirement. It also touches the root route, the
request context, the database schema and the deployment secrets, which would collide with every
feature being built in parallel during the workshop.

## Decision

The starter has no authentication. Every tRPC procedure is public.

This is a deferral, not a decision against authentication. The work is backlog ticket 6.

## Consequences

The application must not be deployed with real data until ticket 6 is done.

Adding authentication introduces writes (users, sessions), which invalidates the read-only
assumption behind the testing strategy in ADR 0006. Ticket 6 must address both.
