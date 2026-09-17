# 0009. A workshop pace budget for agents

**Status:** Accepted
**Date:** 2026-09-13

## Context

Superpowers is deliberately unhurried. That is right for normal work and wrong for a three-hour
workshop, where a pair must see the whole loop close at least once: brainstorm, spec, plan, failing
test, implementation, pull request, ADR.

The obvious shortcut, making the spec or the brainstorm optional, would remove what participants
came to see.

## Decision

`CLAUDE.md` carries a `## Pace` section that shortens every step without skipping any: clarifying
questions in at most two batches of at most three, a one-page spec, a one-page plan, no
subagent-driven development, one round of review.

The first budget was tighter: a single batch of questions and a half-page spec. Brainstorming then
ended before the agent had understood the need, and the spec had no room for the approaches that
were set aside. The brainstorm is the step participants came to see, so it gets the extra time.

**The budget must never make a step optional.** The brainstorm, the spec, the failing test and the
ADR proposal always happen.

## Consequences

Pairs reach a merged pull request within the session and still see why each step exists.

Specs and plans are thinner than they would be in normal work.

This is temporary: delete the `## Pace` section, and supersede this ADR, when the repository
outlives the workshop.
