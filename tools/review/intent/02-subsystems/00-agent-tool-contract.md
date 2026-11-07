# Subsystem: the agent ↔ tool contract

> **Layer:** intent · subsystem (seam). The contract; design plans the how. **Status:** draft.

## Responsibility

The seam between the agent and the tool: what the agent hands the tool to start a review, what the
tool hands back when the review is done, and how each side knows where the other stands. Either side
may be replaced — any agent may drive the tool, and a different tool could serve the same agent — as
long as this contract holds.

## Constraints any design must honor

- **Files in, file out.** A review starts from one packet file and ends by writing one decisions
  file; nothing else is required of either side. _Why:_ principle 2 — a file is the one interface
  every agent and harness shares.
- **Both documents are versioned and self-describing.** Each names its kind and its schema version,
  and a reader refuses a version it does not know rather than guessing. _Why:_ a packet written by
  one release of the skill may be read by another; a silent misread of a ruling is worse than a
  refusal.
- **The packet is a self-contained snapshot.** Everything shown to the reviewer — items, analysis,
  and the text of every file the reviewer may read or annotate — is in the packet; the tool reads
  nothing else from the repository. _Why:_ the reviewer rules on exactly what the agent prepared, at
  one known state of the repository, and the review can be replayed from the packet alone.
- **Open to new producers without a new version.** Item kinds are an open vocabulary, and evidence
  points at any file in the snapshot — intent or code, by quote or by line range — so a new producer
  ([`../01-concepts/01-producers.md`](../01-concepts/01-producers.md)) fits the contract as it
  stands. _Why:_ a contract that must change for every new producer stops being a contract.
- **A change review says what changed.** A packet reviewing a change names its base and head and
  carries each changed file's diff; its decisions carry the overall verdict. _Why:_ a merge decision
  made from final text alone misses what the change removed.
- **The decisions name the packet they answer.** _Why:_ the agent must be able to tell a decisions
  file from this iteration apart from a stale one.
- **Validation at both edges.** The tool refuses an invalid packet before serving it, and refuses to
  write decisions that do not satisfy the schema — a verdict missing its required words (an amend
  without wording, a decline without a why) never reaches the agent. _Why:_ an error caught at the
  edge is cheap and named; one caught by the agent mid-execution is neither.
- **Completion is unambiguous.** The agent learns that a review finished — and how — from the tool's
  exit, and the decisions file is either wholly written or absent, never partial. _Why:_ the agent
  waits on the review unattended; it must not act on half a file or wait forever on a review that
  was abandoned.
- **Work in progress survives, apart from the result.** An unsubmitted review is kept as a draft
  beside the decisions file and is never mistaken for decisions. _Why:_ principle 6, without
  weakening the previous constraint.
- **Annotations carry their anchor in full.** Each annotation records the file (or item) it is on,
  the exact text quoted, and enough surrounding text to find it again. _Why:_ principle 7.

## What this is NOT

- **Not a channel for the tool to act.** The decisions describe what the human ruled; carrying them
  out is entirely the agent's.
- **Not a schema for the repository's own files.** How IFs and Status lines are written is the
  intent architecture's convention; the packet carries their text, it does not redefine it.

## Canonical home for

- The two-document contract: files in and out, versioning, self-containment, openness to new
  producers, change reviews carrying their diffs, edge validation, unambiguous completion, drafts
  kept apart, full anchors.

## Left to implementation

- The concrete schemas, the invocation, the exit codes, and where the draft lives — planned in
  [`../../design/0001-review-tool-v1/`](../../design/0001-review-tool-v1/README.md).

## Open questions

- None yet.
