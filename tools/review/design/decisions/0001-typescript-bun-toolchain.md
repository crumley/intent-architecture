# 0001 — TypeScript, built and tested with Bun, linted with Biome, pinned by mise

> **Status:** accepted · **Date:** 2026-11-07

## Context

The tool is a small server plus a browser page, and both halves share code (the schemas, the diff,
the anchor logic). Its source needs a typed language that runs in both places, a bundler that can
inline a browser build into a server build, a fast test loop, and a formatter and linter — every one
pinned, so the bundle is reproducible enough to drift-check
([0002](0002-single-file-node-bundle.md)).

## Options considered

- **TypeScript + Bun (build, test) + Biome (format, lint) + tsc (types)** — one runtime does
  bundling and testing with no config; Biome is one fast binary for both format and lint. Bun is not
  the runtime the bundle ships for (Node is), so a test must prove the bundle under Node.
- **TypeScript + esbuild + Vitest + ESLint/Prettier on Node** — the same runtime in dev and in
  production, but four tools and their configs, and a slower test loop.
- **Plain JavaScript with JSDoc types** — no build step for the server half, but the page still
  needs inlining, so a build exists anyway, and JSDoc types are weaker at the schema edges.

## Decision

TypeScript, strict. Bun builds (`Bun.build`, one browser pass inlined into one Node pass) and tests
(`bun test`). Biome formats and lints; `tsc --noEmit` type-checks. mise pins Bun and Node; the JS
dev tools are pinned in `package.json` and `bun.lock`, installed by a `deps` task every gate task
depends on. Node is pinned at the oldest supported major (20), so the end-to-end test runs the
bundle exactly where its floor is.

## Why

The fastest write→fail→fix loop with the fewest moving parts, and the same choices the sibling
projects of this architecture already run, so a contributor meets nothing new. The one cost —
building under Bun while shipping for Node — is paid once, by the end-to-end test.

## Consequences

- The source may only use APIs both runtimes provide (`node:*` built-ins, standard web APIs);
  nothing from `bun:*` outside tests. The end-to-end test and a scan of the bundle's imports enforce
  it.
- A Bun upgrade can change the bundle's bytes; that surfaces as drift, rebuilt deliberately.
