# Vercel API Function Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the application on Vercel with one re-export instead of a hand-written adapter.

**Spec:** `docs/superpowers/specs/2026-09-17-vercel-api-function-design.md`

## Global Constraints

- Everything in this repository is in English.
- `pnpm dev` must not change. No Nitro.

---

### Task 1: Swap the adapter for the function

- [ ] Create `api/index.mjs`: `export { default } from '../dist/server/server.js'`
- [ ] Delete `scripts/build-vercel.mjs` and `scripts/build-vercel.test.ts`.
- [ ] `vercel.json`: `"framework": null`, build command without the adapter,
      `"outputDirectory": "dist/client"`, and a rewrite of `/(.*)` to `/api`.
- [ ] `vite.config.ts`: back to a plain config object, without `ssr.noExternal`.
- [ ] Run `pnpm build`, `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm exec prettier --check .`, and
      check `pnpm dev` serves `/syncs`.

### Task 2: Document, push, verify on the preview

- [ ] Rewrite ADR 0014 in place to describe the deployed mechanism.
- [ ] Update the README deployment paragraph.
- [ ] Commit, push, open the pull request.
- [ ] The preview must serve `/syncs` and answer `/api/trpc`. If the function cannot find the
      server build, stop: the fallback is the adapter being removed.
