# 0000 — Spec-feedback

> Intent frictions found while building `<entry title>` — or **"None this entry."**

This file is the entry's adjudication surface and is read on its own — an adjudication session loads
it without the entry's README, so each SF carries enough context to be ruled on directly.

Each SF: a stable id (`SF-NNN`, unique within this entry), a **`**Status:**` line**, the intent
slice + section, the friction, the **assumption** made to keep moving, and a concrete **proposed
revision** for human review. `intent/` is never silently rewritten.

**The Status line is the SF's one mutable line.** It is written `pending` from the start — never
omitted — and edited **in place** when the SF settles:

```markdown
## SF-001 — <one-line title>

- **Status:** pending
- **Slice:** [`intent/...`](../../intent/...) — <section>
- **Friction:** ...
- **Assumption made to keep moving:** ...
- **Proposed revision:** ...
```

settles to `- **Status:** adjudicated — <link to the intent change that settled it>` or
`- **Status:** declined — <one-line why>`.

Everything below the Status line is append-only and never rewritten — the SF's original reasoning is
the record. Only Status moves, which is what lets `pending` be found mechanically:

```sh
grep -rn '\*\*Status:\*\* *pending' design/*/
```

**Why `pending` is written rather than implied.** Earlier revisions made pending the _absence_ of a
disposition line. An absent state cannot be grepped, counted, or checked — which is why repos using
this structure grew hand-maintained indexes of open SFs, and why those indexes drifted. A state you
want to find has to be a positive fact on the page.

None this entry.
