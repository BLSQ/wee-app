# 0004. Neon and Vercel

**Status:** Accepted
**Date:** 2026-09-13

## Context

The workshop loop ends with a pull request that is reviewed and merged. A reviewer who can open
the change running, not only read it, reviews better.

Options considered: deploying as an OpenHEXA web app, the organisation's usual hosting, or a
managed platform.

## Decision

We deploy on Vercel with a Neon Postgres database, because together they give **a preview
environment per pull request**. That criterion is what set the OpenHEXA web app option aside.

## Consequences

Every pull request can get a running preview, and Neon branches can give each preview its own
database copy.

Vercel is not the organisation's default hosting choice; it is accepted here for the workshop. It
adds two external accounts and their secrets.

Migrations are run by hand (`pnpm db:migrate`), never during the build. Revisit when an internal
platform offers preview environments.
