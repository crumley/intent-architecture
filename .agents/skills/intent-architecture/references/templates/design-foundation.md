# Foundation — global architecture & development flow

> **Layer:** design — entry. The _how_ + the record of building it. **Status:** <proposed |
> in-progress | accepted>

The recommended **first design entry** (`design/0001-foundation/` or similar): the cross-cutting
architecture and the development/CI flow that later entries build on. It carries the same common
format as any entry — this file is just a worked example of it for the foundation.

## Serves intent

[`../../intent/00-foundation/`](../../intent/00-foundation/) (vision + principles) — the global what
& why this architecture realizes; and any human-facing surface slice for the entry-point shape.

## Scope

- **In** — the toolchain, the module/layout skeleton, and just enough of an entry point to run and
  be tested. **No domain behavior.**
- **Deferred** — every system-specific feature (later entries).
- **Acceptance** — the check gate is green and the entry point runs (show the commands).

## Design

- **Language & runtime** — <the implementation language + runtime, and how types/validation are
  handled> (ADR: [`../decisions/NNNN-<slug>.md`](../decisions/NNNN-<slug>.md)).
- **Task runner / provisioning** — <how tasks are run and tool versions pinned, identically local
  and in CI> (ADR).
- **Format / lint / test** — <the opinionated formatter, linter, and test runner wired into one
  gate> (ADRs).
- **Repo/module layout** — `intent` / `design` / `src` / `test`, and how `src/` is laid out
  (typically mirroring the build's module boundaries).
- **Cross-cutting conventions** — naming, error handling, configuration, the single check gate.

## Build log

### 1 — stand up the foundation

- **Did** — wired the toolchain and a trivial entry point.
- **Works now** — <the exact `check` command + its green output; the entry point running>.
- **Decisions** — the stack ADRs in [`../decisions/`](../decisions/).
- **Next** — the first domain entry.

## Spec-feedback

None this entry (or record any friction as `SF-NNN`).
