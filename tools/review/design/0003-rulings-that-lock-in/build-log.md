# 0003 — Build log

> What building rulings that lock in and notes anywhere forced or revealed; the commits carry what
> was done.

## Iteration 1 — 2026-11-08

**Forced by the first full pass with 0002.** The page was read with pleasure and ruled with doubt:
the reviewer could not tell whether a ruling was recorded, had no verdict for "yes, reworded by
you", and met "select text" on most of what the agent wrote. The change list from that pass, and the
first application of its rulings to the repository, are this entry's Scope.

**Revealed while building it:**

- **Most "select text" refusals were not about the selection.** The agent's prose was rendered with
  no anchor target at all, and the pane's proposed wording sat inside a non-selectable decoration.
  The fix is a target for every rendered text, not a smarter message — though the message now says
  why when there is a real reason (deleted words, two sources, the page's own labels).
- **A diff cannot be anchored after it has been reflowed.** 0002 rewrote line breaks before diffing
  so prose read well; the rewritten text matches nothing a note could anchor to. The diff now keeps
  each side's raw text and lets CSS collapse the soft breaks, which reads the same and maps exactly.
- **A sticky element at the foot of a scroller grows upward for free** — but only if what grows is
  above what must stay. The 0002 dock put the input under the buttons; the order alone moved them.
- **The default dark theme was not the one in use.** The reviewer's saved theme was the orange
  variant, where accent, headings, and the passage rule were one colour — so the token went into
  every built-in, each checked by a test to stand apart from the accent and both heading colours.
- **The parser shaped the prose.** A Status line re-confirming an earlier ruling had to be squeezed
  inside the parenthesis because the pattern allowed nothing else between the date and "awaiting".
  The pattern now keeps whatever sits there as where it was ruled.
- **Edits promised in prose are invisible to the ruling.** One such promise in the pass-2 packet was
  wrong and was never shown. `validate` now flags prose that reads like a promised edit; it fires on
  exactly that item.

**Measured.** Bundle: 330 KiB (0002: 271 KiB). The pass-3 packet: 21 items (8 open, 13 decided), 259
files; it validates with no advice.

**Proven:**

```sh
cd tools/review && mise run check          # Biome, tsc, the tests, bundle drift
mise run check && mise run template-check  # repository root
```

plus headless screenshots of the pass-3 packet at 1440 and 1000 px in light and dark themes: a
passage marker's tooltip, the legend overlay, before/after and inline diffs (middle, pane, after the
edits), an open and a recorded ruling, notes on the agent's text and on a proposed wording, the
reason a deleted word cannot take a note, and a decided item.
