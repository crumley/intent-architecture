# Contributing to <system>

How we build **in this repository** — the engineering qualities every contribution honors. These are
about _working on the system well_; they are distinct from `intent/` (what the system _is_) and from
`AGENTS.md` (the four-leg discipline). Where a rule can be **enforced by a tool**, it is — fast
automated feedback is the whole point.

## Opinionated, automated formatting and linting — on everything

The more fast, automated checks tell a contributor (human or agent) that an artifact is in the right
form, the faster artifacts _reach_ the right form and stay consistent and high-quality over time. So
be **deliberately opinionated** and push every check into tooling:

- **Docs** — a deterministic formatter and a link checker, wired into `make format` / `make check`
  (or the equivalent) and CI.
- **Code** — the same bar. Languages that do not enforce formatting out of the box get an
  **opinionated formatter and a strong linter** wired in deliberately, before significant code is
  written.

**Why so strict:** an automated check is feedback in seconds, on every iteration; a convention
enforced only by review is feedback that comes late, inconsistently, or never. Strong tooling is how
quality compounds instead of eroding.

## Fast iteration, fast feedback

The test setup must make the **write → fail fast → fix → pass fast** loop tight, for both unit and
integration tests. This is a **quality of the setup**, stated independently of any framework:
whatever runner you choose, rapid feedback is a selection criterion.

## Tests: high assertion density, setup at the bottom

A test should be **readable top-down** — its first lines say _what_ is verified, not _how_ it is
wired:

- **Lead with the assertions / the cases.** Push fixtures, mocks, and boilerplate **below** (or into
  helpers), so a reader grasps the _what_ before the _how_.
- **Prefer table-driven tests.** A table of `(input → expected)` rows is information-dense and cheap
  to extend — a new case is a new row.

**Why:** you read a test to learn what it guarantees; dense-first, boilerplate-last makes that fast.
