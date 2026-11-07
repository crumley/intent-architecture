# 0001 — Build log

> What building the review tool forced or revealed; the commits carry what was done.

## Iteration 1 — 2026-11-07

**Forced by use: styled source is a wall of text.** The first page showed Markdown as monospaced
source with markers dimmed. Rendered against a real repository's intent (hard-wrapped at 100
columns), a 45%-wide column double-wrapped every line — ragged, dense, tiring. The design moved to
_prose that keeps its offsets_ (the entry's Design): blocks flow, markers hide, every span still
carries its source offset, so anchors were unaffected.

**Revealed: inline Markdown crosses hard wraps.** Emphasis such as `_Why that is\n  admissible:_`
spans a line break in hard-wrapped source; per-line tokenizing left raw underscores and asterisks.
Inline spans are now found over the whole text, bounded by blank lines and fences, then clipped per
line.

**Revealed: a class name collision.** The inline-code token class and the code view's container
class were both `code`; inline code inside a link inherited the container's metrics and overlapped
its neighbours. The container is `codeview`.

**Revealed: `git ls-tree … -- ''` is an error** (an empty pathspec), so listing a whole tree at a
ref omits the pathspec instead.

**Measured.** Bundle: 167 KiB, one file, `node:` imports only. A real repository (259 tracked text
files, 22 intent files, 30 SFs): its packet is about 3.2 MB and is served and rendered without
delay; the scan takes under a second.

**Proven** (the acceptance checks; the pull request carries the runs):

```sh
cd tools/review && mise run check          # Biome, tsc, 163 tests, bundle drift
mise run check && mise run template-check  # repository root
```

**Next:** the remaining producers (improvement, extraction, drift, contradictions) as skill
procedures over this contract.

## Iteration 2 — 2026-11-07

**Forced by first use on a real repository.** A reviewer working a real packet hit six problems, and
each changed the design (the entry's Scope and Design now say what was built):

- **The selection toolbar ran off the page** in the right-hand pane — it was placed at the
  selection's left edge with a fixed width guess. Toolbar, peeks, and tooltips now share one
  measured placement: above or below, flipped, clamped.
- **Controls did not say what they asked of the agent** — "intent here" in particular, and the
  difference between a comment and a question. Every view, ruling, and note kind now explains itself
  in a delayed tooltip, also on keyboard focus, and the home page teaches them all.
- **There was no place to start.** A collapsible "about this review" block in the queue became a
  home page: what is asked (with counts), how to work it, the views, the rulings, the note kinds,
  the keys.
- **The ruling did not read as the call to action**, and its consequences scrolled away. The dock
  now carries the consequences above five coloured rulings with a clear selected state.
- **The item was busy.** An SF's own fields now start folded; the summary, the proposal, the
  analysis, and the ruling stay open; fold states persist for the session.
- **Identifiers were opaque.** "SF-005", "0031", "ADR 0006", and paths are now links with peeks.
- **More colour.** Six themes — four drawn from the Gyokuro family's base palettes, syntax colours,
  and neon accents — with headings, identifiers, code, diffs, and rulings coloured by the theme, and
  custom themes as JSON.

The vision moved with it: the tool is the explorer and companion for an intent-architecture
repository, and review is one activity in it.

**Revealed while building it:**

- **A flex item with `overflow: auto` shrinks to nothing.** The taller dock collapsed to 26 px
  inside the column's flex layout until it was given `flex: none` — caught only by measuring it in a
  real browser.
- **A browser's storage does not survive a review run.** Each run listens on a free port; a new port
  is a new origin, so a theme saved in `localStorage` was lost next time. Preferences moved to a
  file in the user's config directory.
- **`serve` printed its URL before installing its signal handlers**, so an agent that signalled the
  process on seeing the URL could kill it without the abandon path (exit 3). Handlers now come
  first; a test signals immediately after the URL.
- **Paths inside a Markdown link's hidden target were linked twice**; link targets are now reserved
  when the link text is linked.

**Measured.** Bundle: 217 KiB. Every built-in theme holds every text and syntax colour at 4.5:1 or
more on every background (a test).

**Proven:**

```sh
cd tools/review && mise run check          # Biome, tsc, 196 tests, bundle drift
mise run check && mise run template-check  # repository root
```

plus a scripted headless-browser pass (light and dark, 1440 and 1000 px wide) over the home page,
the queue, the files view, the dashboard, a right-edge selection, a tooltip, an identifier peek, and
the theme picker.
