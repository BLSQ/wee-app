---
name: writing-adrs
description: Use before brainstorming, to read the architecture decision records, and after implementing a plan, to propose adding or updating one
---

# Writing ADRs

Decisions live in `docs/adr/`, numbered `NNNN-kebab-title.md`. Start from
`docs/adr/0000-template.md`.

## Before brainstorming

Read every ADR. A design that contradicts an accepted ADR must say so
explicitly and propose superseding it; it must not quietly ignore it.

## When to write one

- A choice a future reader would otherwise have to reverse-engineer.
- A choice that rules out an obvious alternative.
- A choice a later ticket is expected to revisit.

Do not write one for a decision the code already states plainly.

## After implementing a plan

Check `docs/adr/` and ask:

1. Did this work contradict an accepted ADR? Propose a new ADR and set the old
   one's status to `Superseded by NNNN`. Never rewrite the decision of an
   accepted ADR in place.
2. Did this work make a decision no ADR covers? Propose a new one.
3. Did this work confirm a `Proposed` ADR? Propose moving it to `Accepted`.

Propose; the human decides. If nothing qualifies, say so in one sentence.

## Format

Keep an ADR under a page. If it needs more, it is a spec, not an ADR.

    # NNNN. Title

    **Status:** Proposed | Accepted | Superseded by NNNN
    **Date:** YYYY-MM-DD

    ## Context
    What forced a decision.

    ## Decision
    What we chose, in the active voice.

    ## Consequences
    What this makes easy, what it makes hard, and what would make us revisit it.
