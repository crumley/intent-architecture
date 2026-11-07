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
