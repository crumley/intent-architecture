# 0001 — Documentation foundation

> The pinned Markdown toolchain and single check gate that the four-leg structure is written inside
> — format, link-check, and CI, identical locally and remote. Nothing domain-specific: this entry
> **ships with the template**.
>
> **Status:** accepted · **Started:** 2026-07-05

## Serves intent

- The tooling ethos in [`CONTRIBUTING.md`](../../CONTRIBUTING.md): opinionated, automated formatting
  and linting on every artifact, from the first artifact. Markdown is the first artifact of this
  structure — the `intent/` and `design/` legs are made of it — so it gets its formatter and link
  checker before anything else exists.
- [`intent/00-foundation/`](../../intent/00-foundation/) is still a placeholder skeleton, so this
  entry deliberately serves no domain intent. When the vision and principles are written, revisit
  this section: if these choices rub against them, **supersede** this entry (and its ADRs) with your
  own rather than editing them — the record of why the template chose what it chose stays useful.

## Scope

- **In:** the pinned toolchain and task runner (mise: dprint, lychee — with `fmt`, `lint`, `links`,
  `check` tasks); Markdown formatting (dprint) and offline link checking (lychee); CI running **the
  same** `mise run check`; direnv as optional environment sugar.
- **Deferred:** **everything with a language in it** — the code toolchain (runtime, formatter,
  linter, test runner) and the domain module layout. _Why safe:_
  [`CONTRIBUTING.md`](../../CONTRIBUTING.md) already binds the first code-introducing entry to wire
  an opinionated formatter and linter into this same gate before significant code, so nothing rots
  in the gap; deciding the stack belongs to the entry that knows the domain.
- **Acceptance:** from a cold copy, `mise install` + `mise run check` is green (Markdown format +
  links).

## Design

- **Decisions** (the _why_ lives in the ADRs):
  [0001 — mise tasks + pinning, direnv optional](../decisions/0001-mise-tasks-and-pinning.md) ·
  [0002 — dprint formats Markdown, lychee checks links](../decisions/0002-dprint-markdown-lychee-links.md).
- **Layout:** configuration at the root — [`mise.toml`](../../mise.toml) (tools + tasks),
  [`dprint.json`](../../dprint.json), [`lychee.toml`](../../lychee.toml), [`.envrc`](../../.envrc)
  (direnv, optional), [`.github/workflows/check.yml`](../../.github/workflows/check.yml).
- **Mechanisms:**
  - _The gate is a task DAG:_ `check` = `lint` (dprint `check`) + `links` (lychee, offline), and it
    **never writes** to tracked files; `fmt` is the write-side twin. CI is `mise install` +
    `mise run check`, byte-for-byte the local commands. The DAG is built to grow: the first
    code-introducing entry adds its format/lint/typecheck/test tasks as further dependencies of
    `check`.
  - _Offline links:_ the links that matter in this structure are internal relative paths (the _keep
    links live_ rule), so lychee runs offline — deterministic and CI-safe; external URLs are skipped
    by design.

## Build log

### 2026-07-05 — Template foundation stood up

**Goal.** A cold copy of the template passes its full gate before any domain work begins. **What was
done.** Wrote ADRs [0001](../decisions/0001-mise-tasks-and-pinning.md) and
[0002](../decisions/0002-dprint-markdown-lychee-links.md); added `mise.toml` (tools + task DAG),
`dprint.json`, `lychee.toml`, `.envrc` (direnv, optional), `.github/workflows/check.yml`, and the
four-leg skeleton (READMEs, `AGENTS.md`, `CONTRIBUTING.md`, `intent/` placeholders, this entry).

**What works now — with the commands that prove it** (dprint 0.54.0, lychee 0.24.2, mise 2026.5.16):

- `mise run check` → green end to end: `dprint check` (all Markdown formatted) and `lychee .`
  (offline, 0 broken links).

**Decisions.** Both recorded as ADRs 0001–0002.

**Next.** The adopting project's first entries: write the vision and principles, then a
code-foundation entry that picks the language toolchain (as ADRs) and grows the gate.

## Spec-feedback

**None this entry.** Expected: the foundation deliberately touches no domain concept, so there was
no intent surface to rub against.
