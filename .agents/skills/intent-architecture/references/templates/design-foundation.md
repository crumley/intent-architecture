# 0001 — Foundation: global architecture & development flow

> <One line: the toolchain, layout, and dev flow this entry stands up — the base later entries build
> on.>
>
> **Status:** proposed | in-progress | accepted · **Started:** YYYY-MM-DD

The recommended **first design entry** (`design/0001-foundation/` or similar): the cross-cutting
architecture and the development/CI flow that later entries build on. It carries the same common
format as any entry (`design/0000-template/`) — this file is just a worked example of it for the
foundation.

## Serves intent

- [`../../intent/00-foundation/`](../../intent/00-foundation/) (vision + principles) — the global
  what & why this architecture realizes; and any human-facing surface slice for the entry-point
  shape.

## Scope

- **In:** the toolchain, the module/layout skeleton, and just enough of an entry point to run and be
  tested. **No domain behavior.**
- **Deferred:** every system-specific feature (later entries). _Why safe:_ each rides on the
  foundation this entry proves, behind a seam it does not move.
- **Acceptance:** the check gate is green and the entry point runs (show the commands).

## Design

- **Decisions:** the stack ADRs in [`../decisions/`](../decisions/) — the implementation language
  and runtime (and how types/validation are handled); the task runner and how tool versions are
  pinned, identically local and in CI; the opinionated formatter, linter, and test runner wired into
  one gate.
- **Layout:** `intent` / `design` / `src` / `test`, and how `src/` is laid out (typically mirroring
  the build's module boundaries).
- **Mechanisms:** the cross-cutting conventions — naming, error handling, configuration, the single
  check gate.

## Build log

### <YYYY-MM-DD> — stand up the foundation

**Goal.** The check gate green and a trivial entry point running before any domain work. **What was
done.** <Wired the toolchain and a trivial entry point.>

**What works now — with the commands that prove it:**

- <the exact `check` command + its green output; the entry point running>.

**Decisions.** The stack ADRs in [`../decisions/`](../decisions/). **Next.** The first domain entry.

## Spec-feedback

**None this entry** (or record any friction as `SF-NNN` per the entry template).
