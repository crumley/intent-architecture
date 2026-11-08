# Review tool — Source

The **code** leg. Implements [`../design/`](../design/) under [`../intent/`](../intent/). The module
boundaries and why they are drawn where they are live in the design entry that established them,
[`../design/0001-review-tool-v1/`](../design/0001-review-tool-v1/README.md#layout) (the passage
model, `ui/passages.ts`, and the line between the generic review surface and the intent-specific
producer, in [`../design/0002-review-format-v2/`](../design/0002-review-format-v2/README.md)); the
toolchain is in [`../design/decisions/`](../design/decisions/).

The built artifact is **not** here: `mise run build` bundles this tree into one file inside the
skill, [`scripts/review.mjs`](../../../.agents/skills/intent-architecture/scripts/review.mjs), which
is committed and drift-checked. Never edit the bundle by hand.

`src` moves with `design` and `test`; all three reconcile back to `intent` when they diverge.
