# 0002 — Markdown: dprint formats, lychee checks links

> **Status:** accepted · **Date:** 2026-07-05

Made for [`design/0001-docs-foundation/`](../0001-docs-foundation/README.md) — ships with the
template; supersede rather than edit if your project chooses differently.

## Context

In this structure the `intent/` and `design/` legs are **made of Markdown**, and the discipline
leans on two mechanical properties: a consistent form (hard-wrapped prose both humans and diffs read
well) and **live relative links** (the one-home rule works by linking, so a broken link is a broken
idea). [`CONTRIBUTING.md`](../../CONTRIBUTING.md) mandates that both be enforced by tooling, not
review. Two jobs, then: a deterministic Markdown formatter, and a link checker that verifies every
relative path resolves.

## Options considered

- **dprint (markdown plugin).** A fast single-binary formatter with a deterministic result and
  `textWrap: always` — hard-wrapping enforced, not requested. Costs: plugin-based (the Markdown
  plugin is pinned by URL in config); formats only what has a plugin, so it is a docs tool here, not
  a code tool.
- **Prettier (for Markdown).** Ubiquitous. Costs: needs a JS runtime and package management for a
  repo that may have neither; slower; its Markdown wrapping (`proseWrap`) is the same idea with a
  heavier vehicle.
- **markdownlint.** A linter, not a formatter — it reports style but does not produce the canonical
  form. Could complement dprint, but a formatter that writes the right form makes most style rules
  moot; start with the formatter and add a linter only if a real gap shows.
- **lychee.** A fast single-binary link checker with an **offline mode** that verifies relative
  paths (and `#anchor` fragments) against the filesystem — exactly the _keep links live_ rule,
  deterministic and CI-safe. Costs: external URLs go unchecked in offline mode (accepted: they are
  rare here and flaky to check in CI).
- **markdown-link-check / linkinator.** Node-based link checkers. Costs: JS runtime dependency,
  slower, weaker offline/fragment stories.

## Decision

**dprint** formats Markdown ([`dprint.json`](../../dprint.json): `textWrap: always`, line width 100)
and **lychee** checks links offline with anchor validation ([`lychee.toml`](../../lychee.toml)).
Both are pinned and wired as mise tasks ([0001](0001-mise-tasks-and-pinning.md)): `fmt` writes,
`lint` + `links` verify inside `check`.

## Why

The two rules these tools enforce are the load-bearing ones for a docs-governed repo: consistent
form keeps diffs reviewable across humans and agents, and mechanically-verified links are what let
"link, don't restate" be a rule rather than a hope. Single-binary Rust tools keep the cold start at
`mise install` with no runtime prerequisite — the whole gate works on a repo with zero code.

## Consequences

- **Easy:** `mise run fmt` produces the canonical form; a broken relative link fails `check` before
  it ships; both tools run in milliseconds on a repo this size.
- **Hard / committed:** dprint's wrapping opinions are the house style; offline mode means external
  URLs are trusted, not verified (drop `offline` in a scheduled run if that ever matters).
- **Reversible?** Config-local: both are leaf tools with no footprint in the docs themselves —
  swapping either is a config + `mise.toml` change.
