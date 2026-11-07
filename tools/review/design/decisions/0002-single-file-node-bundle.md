# 0002 — Ship one committed, drift-checked file that runs under plain Node

> **Status:** accepted · **Date:** 2026-11-07

## Context

The tool must run wherever the skill is installed, with nothing else installed
([principle 4](../../intent/00-foundation/01-principles.md)). Skill installers copy a directory;
they do not run a build. So what the skill ships must already be runnable, and what is committed
must be provably what the source builds.

## Options considered

- **One committed ES module, Node built-ins only, page inlined** (`scripts/review.mjs` in the
  skill). Runs with `node` anywhere Node 20+ exists; no install step. Cost: a generated file in
  version control, which needs a drift check to stay honest.
- **Publish to a package registry and run with `npx`** — no generated file in the repository, but a
  network fetch and a registry account on every first run, and the skill would depend on a second
  distribution channel staying in step with it.
- **Ship the TypeScript source and require Bun or a TS runner** — no generated file, but violates
  principle 4 on every machine without that runtime.
- **A single-executable binary** — no runtime needed at all, but per-platform binaries of tens of
  megabytes, committed or downloaded, for a tool whose whole logic is a few thousand lines.

## Decision

The build writes one unminified ES module to
`.agents/skills/intent-architecture/scripts/review.mjs`, headed by a generated-file banner. It
imports only `node:` built-ins; the page's HTML, CSS, and script are inlined as one string. The gate
rebuilds it in memory and fails if the committed file differs.

## Why

It is the only option that runs from a plain skill install with no network and no toolchain.
Unminified keeps the committed file reviewable in a diff and debuggable on a user's machine, and the
size stays modest because the page is dependency-free.

## Consequences

- Every source change commits a rebuilt bundle beside it; forgetting is a red gate, not a stale
  install.
- The bundle is reproducible only under the pinned Bun; the drift check runs under that pin.
