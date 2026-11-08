# Review tool — Design

The **how**, and the **chronological record of building it**. Where [`../intent/`](../intent/) is
the living tip, this tree is the ledger: numbered **design entries**, superseded by appending, never
overwritten, plus stack ADRs in [`decisions/`](decisions/). The entry format and the rules that keep
it honest are the intent architecture's own —
[`structure.md`](../../../.agents/skills/intent-architecture/references/structure.md#3-file-section-schemas)
in the skill — and new entries start from the skill's
[`design-entry.md`](../../../.agents/skills/intent-architecture/references/templates/design-entry.md)
skeleton rather than a local copy, so this subproject carries no second template to keep in sync.

## Entries

- [`0001-review-tool-v1/`](0001-review-tool-v1/README.md) — the first build: the two schemas, the
  open-items and branch-review scans, the handshake, the single-file bundle, and the review page.
- [`0002-review-format-v2/`](0002-review-format-v2/README.md) — the question-first item (what, so
  what, now what), packet version 2, edits told apart from context in the side pane, inline intent
  feedback in the scan, and the page's typography and rhythm.

## Decisions

- [`0001-typescript-bun-toolchain.md`](decisions/0001-typescript-bun-toolchain.md) — TypeScript, Bun
  for build and test, Biome, all pinned through mise.
- [`0002-single-file-node-bundle.md`](decisions/0002-single-file-node-bundle.md) — ship one
  committed, drift-checked file that runs under plain Node.

## Finding open intent feedback

As in any intent-architecture repository, the entries are the queue (the grep reads
`intent-feedback.md` and the legacy `spec-feedback.md` alike):

```sh
grep -rn -e '\*\*Status:\*\* *`\?pending' -e '`pending`\.' design/*/
```
