# Review tool

A local web page for reviewing a repository's intent: work through its open spec-feedback and open
questions one ruling at a time, annotate any passage of any intent file, and submit — the agent that
prepared the review then carries the rulings out. Purpose:
[`intent/00-foundation/00-vision.md`](intent/00-foundation/00-vision.md).

It ships inside the intent-architecture skill as one file,
[`scripts/review.mjs`](../../.agents/skills/intent-architecture/scripts/review.mjs), that runs under
plain Node (20 or later) with nothing installed. How an agent drives it is in the skill's
[`references/review.md`](../../.agents/skills/intent-architecture/references/review.md).

## The four legs

| Leg                  | What it is                                                              |
| -------------------- | ----------------------------------------------------------------------- |
| [`intent/`](intent/) | What the tool is for, the review loop, and the agent ↔ tool contract.   |
| [`design/`](design/) | How it is built — design entries and the toolchain ADRs.                |
| [`src/`](src/)       | The TypeScript source: schemas, scanner, anchors, server, and the page. |
| [`test/`](test/)     | The tests, including an end-to-end run of the built bundle under Node.  |

## Working on it

```sh
mise install        # bun, node, and the pinned JS dev tools (via bun install)
mise run fmt        # format code in place (Biome)
mise run check      # lint + typecheck + test + bundle drift check — what CI runs
mise run build      # rebuild the bundle into the skill; commit it with your change
```

[`AGENTS.md`](AGENTS.md) holds the rules for working here.
