# Glossary

> **Layer:** intent · foundation (global). A reference index — read out of order.

| Term                | One-line meaning                                                                           | Defining slice                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| **Packet**          | The agent-written snapshot a review renders: items, analysis, and the intent.              | [`02-subsystems/00-agent-tool-contract.md`](../02-subsystems/00-agent-tool-contract.md) |
| **Decisions**       | The tool-written result of a review: verdicts and annotations.                             | [`02-subsystems/00-agent-tool-contract.md`](../02-subsystems/00-agent-tool-contract.md) |
| **Draft**           | An unsubmitted review, kept beside the decisions file and never mistaken for it.           | [`02-subsystems/00-agent-tool-contract.md`](../02-subsystems/00-agent-tool-contract.md) |
| **Item**            | One thing a ruling is asked for: an intent-feedback item or an open question.              | [`01-concepts/00-review-loop.md`](../01-concepts/00-review-loop.md)                     |
| **Verdict**         | A ruling on an item: accept, accept with changes, amend, revise, decline, or defer.        | [`01-concepts/00-review-loop.md`](../01-concepts/00-review-loop.md)                     |
| **Annotation**      | A note anchored to a quoted passage: comment, question, suggestion, intent here, mismatch. | [`01-concepts/00-review-loop.md`](../01-concepts/00-review-loop.md)                     |
| **Iteration**       | One pass of the loop: prepare, review, submit, execute.                                    | [`01-concepts/00-review-loop.md`](../01-concepts/00-review-loop.md)                     |
| **Analysis**        | The agent's account of an item: consequences, relations, a recommendation.                 | [`01-concepts/00-review-loop.md`](../01-concepts/00-review-loop.md)                     |
| **Producer**        | An agent workflow that prepares packets: open items, branch review, extraction, …          | [`01-concepts/01-producers.md`](../01-concepts/01-producers.md)                         |
| **Mode**            | What a review looks at: the repository as it stands, or a change to it.                    | [`01-concepts/00-review-loop.md`](../01-concepts/00-review-loop.md)                     |
| **Evidence**        | The quoted, located passages (intent or code) an item is about.                            | [`01-concepts/00-review-loop.md`](../01-concepts/00-review-loop.md)                     |
| **Overall verdict** | A change review's closing ruling: approve, request changes, or comment.                    | [`01-concepts/00-review-loop.md`](../01-concepts/00-review-loop.md)                     |
