# Open Questions — cross-cutting

> **Layer:** intent · foundation (global). A reference index — read out of order. **Status:**
> living.

## Cross-cutting items

- **More than one reviewer.** The loop assumes one reviewer per packet. A repository with several
  owners may want each to rule on the slices they own, or to see each other's rulings before
  submitting. Touches the loop
  ([`../01-concepts/00-review-loop.md`](../01-concepts/00-review-loop.md)) and the contract
  ([`../02-subsystems/00-agent-tool-contract.md`](../02-subsystems/00-agent-tool-contract.md)).
- **One packet per producer, or composed packets.** Producers are defined separately; whether one
  sitting should carry items from several (an open-items review that also surfaces a drift finding)
  touches the loop and the producers slice
  ([`../01-concepts/01-producers.md`](../01-concepts/01-producers.md)).
- **Boundary drift watch.** As `design/` fills in, watch for build choices (the schema field names,
  the keys, the bundle) creeping into `intent/`, and for durable constraints stranded in `design/`.

- **The tool's own home and name.** The tool is becoming a general surface for reviewing a change
  with an agent, with the intent architecture as one producer; it is to be named Markup and move to
  its own repository. What stays in this skill, and what the contract owes producers other than the
  intent architecture, is open — the current line between the two is drawn in
  [`../../design/0002-review-format-v2/`](../../design/0002-review-format-v2/README.md).

## Index of per-slice open questions

- [`01-concepts/00-review-loop.md`](../01-concepts/00-review-loop.md) — more than one reviewer
  (above).
- [`01-concepts/01-producers.md`](../01-concepts/01-producers.md) — composed packets (above).
- [`02-subsystems/00-agent-tool-contract.md`](../02-subsystems/00-agent-tool-contract.md) — none
  yet.
