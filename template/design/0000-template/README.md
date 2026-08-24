# 0000 — <entry title>

> <One or two sentences: what this entry builds and why it exists. A hard cap — detail belongs in
> the sections below, stated once.>
>
> **Status:** proposed | in-progress | built — awaiting review | accepted | superseded by
> `NNNN-<slug>/` · **Started:** YYYY-MM-DD

<Context: one to three short paragraphs a future reader needs before the sections — the problem as
the system experiences it, what this entry proposes, and why now, linking the prior entries that
make the work possible or necessary. The entry is a standalone document with a single authorial
voice: it argues its motivation from the system — intent slices, prior entries, observed failures —
never from who asked for it, and it quotes no one.>

Copy this directory to `NNNN-<slug>/` (next number in sequence) for each unit of build work. Every
section stays — write "none this entry" rather than deleting one. Spec-feedback lives beside this
file in [`spec-feedback.md`](spec-feedback.md); a `build-log.md` is optional (see
[`../README.md`](../README.md) for when it earns its place). The format and the rules it serves are
in [`../README.md`](../README.md).

## Serves intent

**Required.** One bullet per intent slice this entry realizes: the relative link and **one
sentence** on how this entry realizes it. Link to intent's words rather than quoting them — a quote
silently goes stale the moment intent is edited, often by this very entry's spec-feedback. An entry
that cannot name the intent it serves is not ready to build.

## Scope

The contract this entry works to, and its exit test. Fill this **first**.

- **In:** what this entry builds, stated tightly. Each fact lives here once; other sections link
  rather than restate.
- **Deferred:** what it deliberately does not build — each item with the reason deferring it is
  acceptable, in prose ("safe to defer because …"): what was weighed, and why nothing rots, breaks,
  or is silently lost in the gap.
- **Acceptance:** a numbered list of executable checks — a command, a scenario, a test — that says
  this entry is done.

## Design

The _how_: the decisions and the shape they produce.

- **Decisions:** link each ADR in [`../decisions/`](../decisions/) this entry rests on. Record
  entry-local choices too small for an ADR here, each in the full shape: the alternative considered,
  what made it attractive, the reason it lost, and the cost of the choice made.
- **Layout:** the module boundaries this entry establishes or moves, and why they are shaped that
  way — not a file inventory (the commits carry that, and file lists rot fastest).
- **Mechanisms:** the key moving parts, at the level a next builder needs to pick the work up.
