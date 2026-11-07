# Principles & Constraints

> **Layer:** intent · foundation (global). The cross-cutting invariants every slice honors (the what
> & why). **Status:** draft.

## Purpose

The invariants that apply everywhere and outrank local convenience. Each carries its _why_. Slices
honor these; they do not restate them.

## Principles

1. **The tool never calls a model.** It renders what an agent wrote and collects what a human
   decided — nothing in it generates, summarizes, or infers. _Why:_ the analysis a human rules on
   must have one accountable author (the agent that wrote the packet); a tool that also "helps"
   would blur who said what, and would tie the tool to a vendor, a key, and a network.
2. **Two documents are the whole contract.** The packet (agent → tool) and the decisions (tool →
   agent) are versioned files; nothing else passes between the two sides. _Why:_ any agent, in any
   harness, can produce and consume a file; a contract that is files can be validated, archived,
   replayed, and diffed. The contract is
   [`../02-subsystems/00-agent-tool-contract.md`](../02-subsystems/00-agent-tool-contract.md).
3. **Agent-, model-, and workspace-agnostic.** No harness, vendor, model, forge, or workspace
   manager is assumed. _Why:_ the intent architecture is general-purpose, and the tool ships inside
   its skill; whatever the skill may not assume, the tool may not either.
4. **Runs anywhere the skill is installed, with nothing else installed.** _Why:_ the skill is copied
   into repositories and machines by people who never build it; a tool that needs a toolchain to run
   is a tool most installs cannot use.
5. **Local and private.** The tool listens only on the loopback interface, serves only the reviewer,
   and sends nothing anywhere. _Why:_ intent is often unpublished and a review is a draft of
   judgment; neither should leave the machine because a tool was opened.
6. **The human's work is never lost.** A ruling or annotation, once made, survives a reload, a
   crash, or an abandoned sitting until the human submits or discards it. _Why:_ a review of a large
   pile spans an hour or more; losing it once teaches the reviewer not to trust the tool.
7. **Annotations quote, they do not point.** A note on a passage is anchored by the text it quotes
   and that text's surroundings, not by a line number or offset. _Why:_ the agent acts on the
   decisions after the repository has moved — often after its own edits from the same review — and a
   quote can still be found where a position has gone stale.
8. **Anything can be annotated.** The reviewer may note any passage of any file the packet carries —
   intent, design, or code — not only the items under review. _Why:_ the queue is a symptom and the
   goal is better intent; the next problem, or the intent that lives only in code, is usually two
   paragraphs or one package away from the item that brought the reviewer there.
9. **Readable first, then fast.** The page must never feel like a wall of text: summary before
   detail, prose at a readable measure, the passage in question visible beside the item without
   navigating away, code and diffs highlighted, and every routine act (next item, rule, annotate,
   submit) on a key, in light or dark. _Why:_ the tool earns its place only if judging through it is
   faster and less tiring than judging in an editor; a review surface people avoid is a backlog that
   grows.

## Canonical home for

- The never-calls-a-model rule; the two-document contract as a principle; the runs-with-nothing-
  installed rule; the local-only rule; the never-lose-work rule; the quote-anchoring rule; the
  annotate-anything rule; the readable-first rule.

## Open questions

- See [`open-questions.md`](open-questions.md).
