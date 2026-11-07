# Vision & Purpose

> **Layer:** intent · foundation (global). The what & why; applies to every slice. **Status:**
> draft.

## Purpose

An intent-architecture repository is a web: intent slices that govern design entries, design entries
that raise intent feedback against the slices, decisions the entries rest on, code that realizes all
of it — every piece linked to others by number and by path. Making sense of it from raw files means
holding that web in your head; keeping it healthy means noticing, again and again, the few things in
it that need a human — an IF to rule on, an open question, a change to the intent about to merge, an
intent that lives only in code. This tool exists to be **the way a person points at such a
repository and understands it**: a friendly, consistent place to get familiar with everything in it
and how it connects, and to do the important acts that keep the architecture healthy — with an agent
beside them doing the rest.

## What this tool is

- **What it is** — an **explorer and companion** for one intent-architecture repository. It opens on
  a home page that says what is there and what needs you, lets you browse every file with its
  identifiers linked to what they name, and carries you through the acts that need a human. The
  repository arrives as a **packet** an agent prepared; what the human decides goes back as a
  **decisions** document the agent carries out.
- **Review is one activity in it.** The review queue — rule on each item, note anything, submit — is
  the act the tool was first built for and the one that changes the repository. Orientation (what is
  this repository, how is it linked) and stewardship (what is open, what is drifting) sit beside it
  on the same surface. The loop is in
  [`../01-concepts/00-review-loop.md`](../01-concepts/00-review-loop.md).
- **One surface, many producers** — different agent workflows feed the same tool, on different
  cadences, across the intent's lifecycle: the open items on the main line; a branch's change before
  it merges; a critique of the existing intent; intent extraction from code that has none; a drift
  audit of code against intent; contradictions within either. Each producer differs only in what it
  puts in the packet; the human always works the same way. The family is in
  [`../01-concepts/01-producers.md`](../01-concepts/01-producers.md).
- **The problem** — the human's attention is the scarce resource. Everything the tool shows serves
  understanding or a judgment: what needs you first, the passage in question beside it, the proposed
  change as a diff, the agent's analysis and recommendation — summary first, detail on demand, every
  identifier one hover away from what it means.
- **The organizing lens** — **humans stay on what needs human attention; agents keep it all
  together.** The human understands, rules, and notes; the agent prepares, executes, and keeps the
  web consistent; the tool only renders, links, explains, and collects. When a choice is unclear, it
  resolves toward keeping judgment with the human and work with the agent, and keeping the tool a
  dumb, trustworthy pipe between them.
- **The setting** — runs on the reviewer's own machine, against a packet file, served to their own
  browser. It ships inside the intent-architecture skill, so any agent that installs the skill can
  run it with nothing else installed.

## Baseline assumptions

- The repository follows the intent architecture — an `intent/` tree, design entries, and their
  intent-feedback convention — or is being brought into it (extraction).
- An agent is in the loop on both sides: before (preparing the packet) and after (executing). The
  human never hand-assembles a packet or hand-applies a decision.

## Non-goals

- **Not a model client.** The tool never calls a model (see [`01-principles.md`](01-principles.md)).
- **Not a collaboration server.** One person, one machine, one sitting at a time; sharing happens
  through the changes and pull requests the agent opens afterwards.
- **Not an editor of the repository.** It never writes to the repository it shows; every change is
  the agent's, through the repository's normal review path.
- **Not tied to one workspace manager, forge, or harness.**

## Canonical home for

- The tool's purpose as the explorer and companion for an intent-architecture repository; its
  organizing lens (humans stay on what needs human attention; agents keep it all together; the tool
  renders, links, explains, and collects); review as one activity within it; the
  one-surface-many-producers stance.

## Open questions

- None specific to vision; cross-cutting tensions live in [`open-questions.md`](open-questions.md).
