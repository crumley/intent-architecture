# AGENTS.md — the review tool

A subproject of this repository with its own four legs and its own gate; read the repository's
[`../../AGENTS.md`](../../AGENTS.md) first — its rules apply here too.

- [`intent/`](intent/README.md) governs [`design/`](design/README.md), [`src/`](src/README.md), and
  [`test/`](test/README.md), exactly as the intent architecture describes. A friction with this
  tool's intent goes to the building entry's `spec-feedback.md`, never a silent intent edit.
- The tool ships as **one built file inside the skill**,
  [`scripts/review.mjs`](../../.agents/skills/intent-architecture/scripts/review.mjs). Change the
  source here, then `mise run build` and commit the rebuilt bundle with the change; the gate fails
  when the committed bundle differs from a fresh build.
- `mise run fmt` as you write; `mise run check` before you push (from this directory, or
  `mise run review-check` from the repository root). Markdown here is formatted and link-checked by
  the root gate.
- The tool never calls a model and assumes no particular agent, harness, or workspace manager; keep
  it that way.
