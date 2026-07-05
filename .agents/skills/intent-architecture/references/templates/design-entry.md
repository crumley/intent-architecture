# <Entry name>

> **Layer:** design — entry. The _how_ + the record of building it. **Status:** <proposed |
> in-progress | accepted | superseded by NNNN>

<One line: what unit of build work this entry is. An entry is grouped however the build naturally
clusters — a foundation, a milestone, a component, a feature area, a phase. Copy this directory to
`design/NNNN-<slug>/` and fill the sections below; keep them all, even if a section is "none".>

## Serves intent

<Pointer(s) to the intent slice(s) this entry realizes — **required**. An entry may serve several
(design groups by build, so one entry can span multiple concepts/seams). If you cannot name the
intent this serves, it is not ready to build.>

- [`../../intent/02-subsystems/NN-<name>.md`](../../intent/02-subsystems/NN-<name>.md) — <the
  contract / constraints this entry satisfies>.

## Scope

<The boundary this entry works to.>

- **In** — what this entry builds.
- **Deferred** — what it intentionally leaves out, and **why** (each deferral keeps a real invariant
  and drops only work that is safe to defer behind a seam).
- **Acceptance** — the exit test: the concrete check that says this entry is done.

## Design

<The concrete _how_: the decisions (link the ADRs in [`../decisions/`](../decisions/)), the module
layout `src/` mirrors, the key mechanisms. Name things specifically — that is this tree's job. Where
this entry settles a decision the intent left open, record the choice and its _why_ and link back to
the slice that deferred it.>

- **<Choice>** — <what it is, and how it satisfies the intent it serves> (ADR:
  [`../decisions/NNNN-<slug>.md`](../decisions/NNNN-<slug>.md)).

## Build log

<Append-only. One entry per iteration, newest at the bottom. No "works" claim without the exact
command that proves it — this is the cold-start memory that lets the work resume.>

### <n> — <goal>

- **Did** — what was done.
- **Works now** — what is provably working, **with the exact command** (and its output) that proves
  it.
- **Decisions** — anything settled (link a new ADR if it is a stack/tooling choice).
- **Next** — the next step.

## Spec-feedback

<Intent frictions found while building — recorded here, **not** silently applied to `intent/`. Or
"none this entry.">

### SF-NNN — <short title>

- **Slice / section** — the intent file + heading (e.g. `intent/01-concepts/00-<name>.md` → "…").
- **Kind** — ambiguity | gap | contradiction | over-specification | hard-to-implement |
  doesn't-serve-purpose.
- **Friction** — what building surfaced, concretely.
- **Assumption** — what this entry does in the meantime, to keep moving.
- **Proposed revision** — the specific change to the slice.
- **Status** — open | proposed | resolved-in-build.
