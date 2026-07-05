# 0001 — Task runner + toolchain pinning: mise, direnv optional

> **Status:** accepted · **Date:** 2026-07-05

Made for [`design/0001-docs-foundation/`](../0001-docs-foundation/README.md) — this decision **ships
with the template**; a project that chooses differently should supersede it with its own ADR rather
than editing this one.

## Context

[`CONTRIBUTING.md`](../../CONTRIBUTING.md) demands one opinionated gate, identical locally and in
CI. A task list alone (Makefile, package scripts) defines the commands but **not the tool versions**
— "install" means "whatever the machine ships today", CI installs tools its own way, and two
machines can disagree about what "green" means. We need one file that pins the toolchain **and**
names the commands, so "provision" and "run the gate" are the same two commands everywhere.

## Options considered

- **mise.** One `mise.toml` holds `[tools]` (exact versions — installed by `mise install`,
  identically on macOS, Linux, and CI) and `[tasks]` (with dependencies, so `check` is one DAG).
  First-class GitHub Action (`jdx/mise-action`). Handles any language's tools, so the file grows
  with the project instead of being replaced. Honest costs: a **meta-tool bootstrap** — something
  still has to install mise itself (Homebrew locally, the action in CI), it just moves the unpinned
  edge one level up; younger and faster-moving than make; per-directory config requires a one-time
  `mise trust`.
- **Makefile + system packages.** Ubiquitous, zero new concepts. Costs: pins nothing — version skew
  between laptop and CI is structural, exactly the disease; make's strengths (file-level incremental
  builds) are wasted on a docs-first repo; portability warts (BSD vs GNU).
- **just.** A cleaner make for tasks. Costs: tasks only — solves none of the version-pinning
  problem, so we would still need mise (or asdf, or brew-pinning) beside it; two tools where one
  covers both jobs.
- **asdf (+ any task runner).** Pins versions well. Costs: no task story at all, so it is always
  half the solution; slower shims; mise is its spiritual successor with both halves built in.

## Decision

**mise, via [`mise.toml`](../../mise.toml).** `[tools]` pins `dprint` and `lychee`. `[tasks]`
defines `fmt`, `lint`, `links`, and the aggregate no-writes gate **`check`**, so
`mise install && mise run check` is a complete cold start. CI
([`.github/workflows/check.yml`](../../.github/workflows/check.yml)) runs `jdx/mise-action` then
**the same `mise run check`**. **direnv is adopted as optional sugar:** [`.envrc`](../../.envrc)
evals plain `mise env`, putting the pinned toolchain on PATH on `cd`. mise's docs discourage their
(deprecated) deep direnv integration, so we deliberately use only the stable `mise env` output —
nothing anywhere depends on direnv; CI and all documented commands go through mise directly.

## Why

The gate only means something if both sides run the same bits: pinning versions and defining tasks
in one file removes the "works on my machine, not in CI" class of drift by construction. The
bootstrap tradeoff is acceptable because mise is the _only_ thing left to install by hand, and its
own version matters far less than the versions it pins. direnv earns its place by making the pinned
toolchain ambient (no `mise run` prefix for ad-hoc `dprint`/`lychee` calls) without becoming a
dependency.

## Consequences

- **Easy:** cold start is `mise install` (+ `direnv allow` if you use direnv); the gate is
  `mise run check`, byte-for-byte what CI runs; bumping a tool is a one-line, reviewable diff; the
  first code-introducing entry extends the same file rather than adding a second system.
- **Hard / committed:** contributors install mise (and are told to — the README/CONTRIBUTING say
  so).
- **Reversible?** Cheaply — the tasks are plain shell one-liners; porting them back to make (or
  just) is transcription, and the pins would just be lost, not broken.
