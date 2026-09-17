# 0001. Record architecture decisions

**Status:** Accepted
**Date:** 2026-09-13

## Context

Several pairs work on this repository at once, with coding agents. A decision made in one
conversation is invisible to the next one, human or agent, unless it is written down where both
will look.

## Decision

We record significant decisions as short ADRs in `docs/adr/`, using `0000-template.md`.

Agents read every ADR before brainstorming and propose additions or updates after implementing a
plan (the `writing-adrs` skill in `.claude/skills/`). Humans accept or reject the proposal in review.

## Consequences

Decisions have a date, a reason and a place. Reviewing a pull request includes reviewing whether
it should have changed an ADR.

An accepted ADR is never rewritten; it is superseded. The directory therefore grows, and reading
it has a cost that is paid at every brainstorm.
