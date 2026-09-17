# 0011. Target Claude Code only

**Status:** Accepted
**Date:** 2026-09-17

## Context

The repository carried a portability layer: `AGENTS.md` held the instructions, `CLAUDE.md` and
`GEMINI.md` pointed at it, and the Superpowers skills sat in `skills/` at the root so that any
agent could be told to read them.

That arrangement served every tool badly except the ones we do not use. Claude Code discovers
skills only in `~/.claude/skills/` and `<project>/.claude/skills/`, so skills in `skills/` were
never loaded as skills: they worked only because an instruction file told the agent to read the
files. Claude Code therefore lost skill invocation and the session-start injection, while Codex
and Gemini gained nothing the workshop needs.

Everyone at the workshop uses Claude Code.

## Decision

The repository targets Claude Code only.

- Skills live in `.claude/skills/`, where Claude Code loads them automatically.
- `CLAUDE.md` is the single instruction file. `AGENTS.md` and `GEMINI.md` are gone.
- The project ADR skill is `.claude/skills/writing-adrs/`, one level deep, because Claude Code
  does not scan nested skill directories.

## Consequences

Skills are invocable rather than merely readable, and `using-superpowers` is loaded without an
instruction telling the agent to go and read it.

Anyone who runs Codex, Cursor or Gemini on this repository gets no instructions at all. Restoring
them means an `AGENTS.md` again; nothing else in the repository depends on the split.

A contributor who also has the Superpowers plugin installed will see each skill twice, once from
the plugin and once from the repository. The vendored copy is the pinned one.
