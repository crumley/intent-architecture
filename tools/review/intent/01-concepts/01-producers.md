# Producers

> **Layer:** intent · concept. The what & why. **Status:** draft.

## Purpose

A **producer** is an agent workflow that prepares a packet for the review loop
([`00-review-loop.md`](00-review-loop.md)): it decides which items need a human's judgment and
writes the evidence and analysis for each. Producers differ in what they look for and when they run;
the reviewer's experience — and the decisions they hand back — is the same for all. _Why one
surface:_ a human who learns one way to judge intent can judge any of it, and every producer
inherits every improvement to the surface.

## The family

Each producer serves a moment in the intent's lifecycle:

| Producer               | Asks                                                                     | Mode   | Cadence                          |
| ---------------------- | ------------------------------------------------------------------------ | ------ | -------------------------------- |
| **Open items**         | What outstanding feedback and open decisions do we need to settle?       | main   | when the pile grows; on request  |
| **Branch review**      | What does this change do to the intent, and is it ready to merge?        | change | per pull request                 |
| **Intent improvement** | Where is the existing intent weak — vague, missing its why, owned twice? | main   | occasionally                     |
| **Intent extraction**  | What intent is encoded only in the code, so it can be made explicit?     | main   | onboarding an existing codebase  |
| **Drift audit**        | Where does the code no longer match the intent?                          | main   | periodically, to watch the trend |
| **Contradictions**     | Where does the intent contradict itself, or the code contradict itself?  | main   | occasionally                     |

_Why name the family now, before most of it exists:_ the contract must already carry what all of
them need — open item kinds, and evidence that points at code as readily as at intent — or each new
producer would reopen it.

## What every producer owes the reviewer

- **A question.** Every item names the decision it asks for, as a question to the human. _Why:_ a
  reviewer who knows what is being decided reads everything else as bearing on it, rather than as
  text to make sense of first.
- **Evidence, quoted and located.** Every item points at the passages it is about — intent, code, or
  both — exactly enough that the tool can show them beside it. _Why:_ a ruling made without the text
  in view is a ruling on the agent's summary, not on the repository.
- **A fair analysis.** The facts kept apart from the advice; what accepting and declining each lead
  to, the strongest case for the option not recommended, and the item's relations to others —
  including where two items would change the same text. _Why:_ the human rules; an analysis that
  argues only one side, or mixes its opinion into the facts, quietly moves the ruling to the agent.
- **Triage.** What needs judgment is marked apart from what is routine, so attention goes where it
  matters first. _Why:_ the scarce resource is attention (see
  [`../00-foundation/00-vision.md`](../00-foundation/00-vision.md)).

## Canonical home for

- What a producer is; the producer family and the question each asks; what every producer owes the
  reviewer.

## Left to implementation

- Each producer's own procedure — how it finds its items and writes its analysis — lives with the
  skill that runs it, not in this tool.

## Open questions

- Whether producers should be composable in one packet (an open-items review that also carries a
  drift finding), or one packet per producer.
