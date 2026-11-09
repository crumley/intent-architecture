# 0002 — Build log

> What building the question-first format forced or revealed; the commits carry what was done.

## Iteration 1 — 2026-11-08

**Forced by the first real review.** A 14-item open-items packet for a mature repository, served
with the v1 page, was hard to orient in: the recommendation came before the question, the facts were
folded, and the side pane showed whole files from the top with no reason given. That reading — and
the contract gaps the same packet exposed — are this entry's Scope.

**Revealed while building it:**

- **`--files` was documented but never accepted.** The design and the help text named
  `scan --files repo|intent`; the argument parser refused it as unknown. Wired, with a test of the
  narrowed snapshot it already supported.
- **The v1 page hid the side pane at 1180 px and below** — fine when the pane was supplementary,
  wrong once it carries the passages an item is about. At 1000 px the pane rendered at zero width;
  the list now yields instead.
- **Circled digits (①) render as unreadable glyphs** in common UI fonts at small sizes. Passage
  numbers are drawn as small number badges instead.
- **Hard-wrapped source makes a choppy word diff.** Diffing the raw text kept every line break, so a
  reflowed sentence read as fragments. Diffs now flow single line breaks as spaces, keeping
  paragraph breaks and the breaks before list items and headings.
- **A file's first passage is not its first-numbered one.** Opening a tab scrolled to the earliest
  passage in the file, which could be ③ above ①; tabs now open on the lowest number.
- **The inline legacy shape is irregular.** Across 33 inline items in one repository, labels were
  italic or bold, "Assumption to keep moving" or "Assumption made", one settled item used
  `_Adjudicated:_` instead of `_Disposition:_`, and one recorded its ruling as a Resolution
  paragraph. The parser accepts each; where nothing says the status, the ledger says it inferred it.
- **The structure's own lifecycle contradicted its grep.** `structure.md` said a pending item needs
  no Status line, while the design README finds open items by grepping for one. The repositories
  that use the tool write the line explicitly; the structure now says so too.

**Measured.** Bundle: 271 KiB (v1: 218 KiB). The rewritten real packet: 21 items (the 14 of the
first pass, less one backlog placeholder, plus eight from the 33 inline items now visible, grouped),
259 files, 63 ledger rows; it validates with no advice.

**Proven:**

```sh
cd tools/review && mise run check          # Biome, tsc, 236 tests, bundle drift
mise run check && mise run template-check  # repository root
```

plus headless screenshots (Chrome over the DevTools protocol) of the real packet at 1440 and 1000 px
in light and dark themes: a routine item, a judgment item, a ruled item, a related file in the side
pane, the after-the-edits view, a reference clicked and flashed, and the home page.

**What followed.** The first full pass with this page, and the first application of its rulings to
the repository, are the next entry: [0003](../0003-rulings-that-lock-in/README.md).
