# The review loop

> **Layer:** intent · concept. The what & why. **Status:** draft.

## Purpose

The review loop is the activity in the tool that changes the repository (the tool's wider purpose —
exploring and keeping a repository healthy — is in
[`../00-foundation/00-vision.md`](../00-foundation/00-vision.md)): a set of things needing the
human's judgment goes in, rulings and notes come out, the agent carries them out, and whatever is
left comes back as a smaller set. Each pass is one **iteration**. What goes in is decided by a
**producer** ([`01-producers.md`](01-producers.md)); the loop is the same for all of them.

## The loop

1. **Prepare.** The agent gathers the items and writes a **packet**: per item, the **evidence** —
   the intent passages and code locations it is about, quoted with where they live — the item's own
   text, any proposed change rendered as an edit, and the agent's **analysis**: what accepting and
   declining each lead to, how the item relates to others, and a recommendation. The packet also
   carries a snapshot of the repository's files, so the reviewer can read beyond the items. _Why the
   agent and not the tool:_ the analysis is judgment, and judgment needs an accountable author.
2. **Review.** The human works the queue — what needs judgment first, the routine after — reading
   each item beside its evidence, ruling on it, and annotating any passage of any file. _Why the
   whole repository is open:_ the goal is better intent, not an empty queue.
3. **Submit.** The human reviews everything decided this session in one place, then submits once;
   the tool writes the **decisions** and stops. _Why one submission:_ the agent acts on a coherent
   set of rulings, and rulings on related items often only make sense together.
4. **Execute.** The agent carries the decisions out through the repository's normal review path:
   intent edits in their own change, apart from any design or build change; each item's status
   recorded; every note turned into an edit, an answer, or a new item; whatever was sent back for
   rework gathered into the next packet. _Why the agent:_ execution is mechanical given a ruling,
   and keeping it out of the tool keeps the tool from ever writing to the repository it reviews.

The loop ends when an iteration's packet is empty — or when the human stops; nothing is lost either
way, because every ruling not yet carried out is either in a decisions file or still pending in the
repository.

## Two modes: what stands, and what changes

A review looks either at the repository **as it stands** on its main line — what is open and needs
settling — or at a **change** to it: a branch against its base, before it merges. _Why both:_ intent
moves forward through merges, and a merge is fastest when the human has already seen exactly what
the change does to the intent; and what has already merged still accumulates open items that no
change will surface. A change review shows **diffs, not just final text**, separates what needs the
human's **judgment** (new or changed intent, new intent feedback, contested decisions) from what is
**routine**, and ends with an **overall verdict** on the change — approve, request changes, or
comment only — that the agent can act on.

## Items and verdicts

An **item** is one thing a ruling is asked for: an intent-feedback item, an open question, an
undecided decision, a change to an intent file or a design entry, or a finding a producer made. The
kinds are an open vocabulary — a new producer may bring a new kind — because what the human does
with an item does not depend on where it came from. A **verdict** is the ruling, one of five, each a
distinct act with a distinct outcome so the agent never has to guess which was meant:

| Verdict     | The human means                                    | What must follow                                                        |
| ----------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| **accept**  | "The proposal (or the change) is right; make it."  | The change, as proposed, through review.                                |
| **amend**   | "Yes, but with my wording."                        | The change, in the reviewer's wording, through review.                  |
| **decline** | "No; here is why."                                 | The item settled as declined (or the change rejected), with the why.    |
| **defer**   | "Not now" — optionally with the ruling to apply.   | The item stays open; a ruling, if given, is recorded on it as awaiting. |
| **revise**  | "Rework the proposal or the analysis and show me." | A reworked item in the next iteration's packet; nothing settled.        |

_Why five and not three:_ accept/decline alone forces a reviewer who agrees with the direction but
not the words into a false choice; and "rework this" is different from "decide later" — one comes
back next iteration, the other waits. An item left without a verdict is simply unreviewed: it stays
as it is and is offered again.

**Adjudication is still the merge.** A verdict is a ruling, not the settlement: in the intent
architecture an IF is settled when the intent change carrying it merges. So accept and amend produce
a change for review and record the item as ruled-and-awaiting; only the merge settles it. _Why:_ the
tool must not move the moment of adjudication out of history and into a local file.

## Notes

A **note** (an annotation) is the reviewer's words anchored to a quoted passage — in any file the
packet carries, or in an item's own text — with one of five intents:

- **comment** — consider this;
- **question** — answer this;
- **suggestion** — replace the quoted text with this;
- **intent here** — "the intent this passage (often code) expresses is…": the agent adds it to
  `intent/`, or strengthens the passage that already owns it;
- **mismatch** — "this does not match the intent": the agent reconciles the code or the intent.

Every note is acted on — an edit, an answer, or a new item next iteration — never silently dropped.
_Why name the intents:_ the agent's action differs for each, and the last two are the bridge between
code and intent that extraction and drift review run on.

## Canonical home for

- The loop and its iteration; the two modes and the overall verdict on a change; what an item is and
  that item kinds are open; the five verdicts and what each must lead to; the ruled-is-not-settled
  rule; what a note is, its five intents, and that every one is acted on.

## Left to implementation

- How the packet's analysis is laid out on screen, how items are ordered, and which keys do what.
- How the agent groups accepted edits into changes, beyond keeping intent apart from design.

## Open questions

- Whether a review should support more than one reviewer's rulings on one packet (see
  [`../00-foundation/open-questions.md`](../00-foundation/open-questions.md)).
