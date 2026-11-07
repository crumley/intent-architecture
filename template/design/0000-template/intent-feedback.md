# 0000 — Intent feedback

> Intent frictions found while building `<entry title>`.

**Intent feedback** is the build pushing back on the intent: each item is an **IF** (an
intent-feedback item), raised where building shows a slice of `intent/` says too little or the wrong
thing. Create this file only when the build raises at least one IF — an entry with no frictions has
no intent-feedback file, and the absence says so. This file is the entry's adjudication surface and
is read on its own — an adjudication session loads it without the entry's README, so each IF carries
enough context to be ruled on directly.

Each IF: a stable id (`IF-NNN`, unique within this entry), the intent slice + section, the friction,
the **assumption** made to keep moving, and a concrete **proposed revision** for human review.
`intent/` is never silently rewritten. An IF is `pending` until settled (no line needed); once
settled, **append** a disposition line — `adjudicated — <link to the intent change that
settled it>`
or `declined — <one-line why>` — never rewriting the original text.

## IF-001 — <the friction, in one line>

- **Slice:** <relative link to the intent slice>, <section>.
- **Friction:** <what building showed the slice does not say, or says wrongly>.
- **Assumption made to keep moving:** <what the build did meanwhile>.
- **Proposed revision:** <the concrete intent edit, for human review>.
