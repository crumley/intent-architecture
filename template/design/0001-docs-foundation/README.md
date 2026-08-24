# 0001 — Documentation foundation

> The pinned Markdown toolchain and single check gate that the four-leg structure is written inside
> — format, link-check, and CI, identical locally and remote.
>
> **Status:** accepted · **Started:** 2026-07-05

Nothing domain-specific happens here: this entry **ships with the template**, so an adopting
repository starts with its documentation legs already under a green gate. The four legs are made of
Markdown before they are made of anything else, which is why the first entry pins the Markdown
toolchain — the first code-introducing entry grows the same gate rather than starting a second one.

## Serves intent

- The tooling ethos in [`CONTRIBUTING.md`](../../CONTRIBUTING.md): opinionated, automated formatting
  and linting on every artifact, from the first artifact — Markdown is the first artifact of this
  structure, so it gets its formatter and link checker before anything else exists.
- [`intent/00-foundation/`](../../intent/00-foundation/) is still a placeholder skeleton, so this
  entry deliberately serves no domain intent. When the vision and principles are written, revisit
  this section: if these choices rub against them, **supersede** this entry (and its ADRs) with your
  own rather than editing them — the record of why the template chose what it chose stays useful.

## Scope

- **In:** the pinned toolchain and task runner (mise: dprint, lychee — with `fmt`, `lint`, `links`,
  `check` tasks); Markdown formatting (dprint) and offline link checking (lychee); CI running **the
  same** `mise run check`; direnv as optional environment sugar.
- **Deferred:** **everything with a language in it** — the code toolchain (runtime, formatter,
  linter, test runner) and the domain module layout. Safe to defer because
  [`CONTRIBUTING.md`](../../CONTRIBUTING.md) already binds the first code-introducing entry to wire
  an opinionated formatter and linter into this same gate before significant code, so nothing rots
  in the gap; deciding the stack belongs to the entry that knows the domain.
- **Acceptance:**
  1. From a cold copy, `mise install` + `mise run check` is green (Markdown format + links).

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
