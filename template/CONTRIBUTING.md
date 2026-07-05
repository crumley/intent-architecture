# Contributing

How we build **in this repository** — the engineering qualities every contribution honors. These are
about _working on the system well_; they are distinct from [`intent/`](intent/) (what the system
_is_) and from [`AGENTS.md`](AGENTS.md) (the four-leg discipline). Where a rule can be **enforced by
a tool**, it is — fast automated feedback is the whole point.

## Opinionated, automated formatting and linting — on everything

The more fast, automated checks tell a contributor (human or agent) that an artifact is in the right
form, the faster artifacts _reach_ the right form and stay aligned, consistent, and high-quality
over time. So this repo is **deliberately opinionated** and pushes every check into tooling:

- **Markdown** — the primary artifact of the `intent/` and `design/` legs — is formatted by
  **dprint** and link-checked by **lychee** ([`dprint.json`](dprint.json),
  [`lychee.toml`](lychee.toml)).
- **Code is held to the same bar, from its first line.** Languages that do not enforce formatting
  out of the box get an **opinionated formatter and a strong linter** wired into the gate
  deliberately, _before significant code is written_. Record the choice as an ADR in
  [`design/decisions/`](design/decisions/) and grow the task DAG in [`mise.toml`](mise.toml)
  (format/lint/typecheck/test feeding `check`).
- **One command each way** ([`mise.toml`](mise.toml)): run `mise run fmt` as you write (fixes
  artifacts in place) and `mise run check` before you push — the no-writes gate. CI runs the
  **same** `mise run check`, nothing else.
- **The toolchain is pinned.** `mise.toml` pins the tools; `mise install` provisions them,
  identically on a laptop and in CI. Optional sugar: with **direnv**, [`.envrc`](.envrc) puts the
  pinned toolchain on PATH the moment you enter the directory (`direnv allow` once).

**Why so strict:** an automated check is feedback an agent gets in seconds, on every iteration; a
convention enforced only by review is feedback it gets late, inconsistently, or never. Strong
tooling is how quality compounds instead of eroding.

## Fast iteration, fast feedback

The test setup must make the **write → fail fast → fix → pass fast** loop tight, for both unit and
integration tests. A contributor should be able to write a test, watch it fail in seconds, change
the code, and watch it pass — without a slow build or a heavy harness in the way. This is a
**quality of the setup**, stated independently of any framework: whatever runner a build chooses,
rapid feedback is a selection criterion, not an afterthought.

## Tests: high assertion density, setup at the bottom

A test should be **readable top-down** — its first lines say _what_ is being verified, not _how_ it
is wired up:

- **Lead with the assertions / the cases.** Open the file with the dense statement of what is
  covered. Push fixtures, mocks, builders, and other boilerplate **below** the cases (or into
  helpers), so a reader grasps the _what_ before deciding whether they care about the _how_.
- **Prefer table-driven tests.** A table of `(input → expected)` cases is information-dense and
  cheap to extend — a new case is a new row, not a new function.

**Why:** you read a test to learn what it guarantees; dense-first, boilerplate-last makes that fast,
and table tests keep the density while staying easy to grow.

## Markdown conventions (recap)

Hard-wrapped prose, relative cross-links kept live, numbered files for reading order — all enforced
by dprint + lychee. See [`AGENTS.md`](AGENTS.md) → Conventions for the four-leg rules these sit
under.
