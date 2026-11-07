# Vision & Purpose

> **Layer:** intent · foundation (global). The what & why; applies to every slice. **Status:**
> draft.

## Purpose

A repository built on the intent architecture asks a human for judgment again and again: rule on the
spec-feedback a build raised, settle an open question, decide whether a branch's change to the
intent is right before it merges, say what the intent of an undocumented corner really is. Each act
is small; done in raw files — an SF in one, the slice it cites in another, the diff in a third —
each is slow, and the slowness is what lets the backlog grow and the merges wait. The review tool
exists to make **every such judgment a fast, focused act on one screen**, whose outcome an agent
then carries out precisely, so the repository's intent keeps moving forward and keeps improving.

## What this tool is

- **What it is** — the single human-review surface for a repository's intent: it renders a **review
  packet** an agent prepared, lets the human rule on each item and annotate any passage of any file,
  and hands the result back as a **decisions** document. The agent acts on the decisions and may
  prepare the next, smaller packet. The loop is in
  [`../01-concepts/00-review-loop.md`](../01-concepts/00-review-loop.md).
- **One surface, many producers** — different agent workflows feed the same tool, on different
  cadences, across the intent's lifecycle: the open items on the main line; a branch's change before
  it merges; a critique of the existing intent; intent extraction from code that has none; a drift
  audit of code against intent; contradictions within either. Each producer differs only in what it
  puts in the packet; the human always reviews the same way. The family is in
  [`../01-concepts/01-producers.md`](../01-concepts/01-producers.md).
- **The problem** — the human's attention is the scarce resource. Everything the tool shows serves a
  judgment: what needs a ruling first, the passage in question beside it, the proposed change as a
  diff, the agent's analysis and recommendation — summary first, detail on demand.
- **The organizing lens** — **the human rules; the agent prepares and executes; the tool only
  renders and collects.** When a choice is unclear, it resolves toward keeping judgment with the
  human and work with the agent, and keeping the tool a dumb, trustworthy pipe between them.
- **The setting** — runs on the reviewer's own machine, against a packet file, served to their own
  browser. It ships inside the intent-architecture skill, so any agent that installs the skill can
  run it with nothing else installed.

## Baseline assumptions

- The repository follows the intent architecture — an `intent/` tree, design entries, and their
  spec-feedback convention — or is being brought into it (extraction).
- An agent is in the loop on both sides of a review: before (preparing) and after (executing). The
  human never hand-assembles a packet or hand-applies a decision.

## Non-goals

- **Not a model client.** The tool never calls a model (see [`01-principles.md`](01-principles.md)).
- **Not a collaboration server.** One reviewer, one machine, one sitting at a time; sharing a review
  happens through the changes and pull requests the agent opens afterwards.
- **Not an editor of the repository.** It never writes to the repository it reviews; every change is
  the agent's, through the repository's normal review path.
- **Not tied to one workspace manager, forge, or harness.**

## Canonical home for

- The tool's purpose, its organizing lens (the human rules; the agent prepares and executes; the
  tool renders and collects), and the one-surface-many-producers stance.

## Open questions

- None specific to vision; cross-cutting tensions live in [`open-questions.md`](open-questions.md).
