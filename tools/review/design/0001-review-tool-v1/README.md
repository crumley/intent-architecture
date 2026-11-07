# 0001 — Review tool v1

> The first build: a versioned packet and decisions contract open to every producer, a scanner that
> drafts packets for the first two producers (open items on the main line; a branch against its
> base), and a loopback page — shipped as one Node file inside the skill — that explains the
> repository, links everything in it, and carries a human through ruling, annotating, and
> submitting.
>
> **Status:** built — awaiting review · **Started:** 2026-11-07

An intent-architecture repository's open intent feedback is a grep away
([`structure.md`](../../../../.agents/skills/intent-architecture/references/structure.md#the-build-record-lives-in-design-there-is-no-separate-plan-leg)),
and a branch's intent change is a `git diff` away, but judging either means reading raw files side
by side and writing outcomes by hand — slow enough that the backlog grows and merges wait. This
entry builds the surface the [review loop](../../intent/01-concepts/00-review-loop.md) needs and the
first two [producers](../../intent/01-concepts/01-producers.md)' mechanical half; the agent writes
the analysis, the page collects the rulings, the agent executes.

Use on a real repository reshaped the page before this entry closed (the [build log](build-log.md)
has the detail): a reader could not hold the web of numbered, cross-referenced pieces in their head,
could not tell what each control asked of the agent, and met the review as a wall of text. So the
page grew into the explorer and companion the [vision](../../intent/00-foundation/00-vision.md) now
describes — a home page that teaches it, identifiers linked everywhere, controls that explain
themselves, supporting detail folded, the ruling and its consequences given the weight of a call to
action, and themes.

It is the first entry; it establishes the toolchain
([0001](../decisions/0001-typescript-bun-toolchain.md),
[0002](../decisions/0002-single-file-node-bundle.md)) as well as the tool.

## Serves intent

- [`00-vision.md`](../../intent/00-foundation/00-vision.md) — the explorer and companion: a home
  page that orients, a files view of the whole snapshot, the queue triaged with the evidence beside
  the item, the proposal as a diff, the analysis summary-first.
- [`01-principles.md`](../../intent/00-foundation/01-principles.md) — no model calls (the tool has
  no network client), plain Node from the skill, loopback only with a token, drafts autosaved,
  quote-anchored notes on any file, a readable and themeable page driven from the keyboard, every
  control explained on hover or focus, every identifier linked.
- [`00-review-loop.md`](../../intent/01-concepts/00-review-loop.md) — both modes, the five verdicts
  with their required words, five note intents, the overall verdict on a change, one submission.
- [`01-producers.md`](../../intent/01-concepts/01-producers.md) — the open-items and branch-review
  producers' scanning is built; the contract already carries what the other four need.
- [`00-agent-tool-contract.md`](../../intent/02-subsystems/00-agent-tool-contract.md) — the two
  schemas below (version 1), validated at both edges; exit codes and an atomic write make completion
  unambiguous; the draft lives beside, never as, the decisions.

## Scope

- **In:**
  - The **packet** and **decisions** schemas, version 1, with one set of validators shared by the
    server, the page, and a `validate` command.
  - **`scan`**, drafting a packet in either mode. _Main_ (the open-items producer): every pending
    and ruled-but-pending IF, the cross-cutting open questions, and ADRs still `proposed`. _Branch_
    (base...head): every changed intent file, every IF the branch raises, re-statuses, or rewrites,
    every changed ADR, and every changed design entry, each with its diff. Both snapshot the
    repository's tracked text files and build the IF ledger. The agent then adds what only it can
    write: exact quotes, proposed edits, analysis, recommendations, triage.
  - **`serve`**: the page on `127.0.0.1` behind a per-run token, a draft autosaved beside the
    decisions file, submit-then-exit, abandon-then-exit.
  - **`locate`**, re-finding each submitted note in the repository's current files.
  - The page: a **home** page (what the review is, what is asked with counts, how to work it, every
    view, ruling, note kind, and key), the **queue** (item, evidence excerpts, and the cited files
    beside it; supporting detail folded; the ruling dock with the consequences pinned at its foot),
    the **files** browser (the whole snapshot, prose or highlighted code), the **dashboard** (every
    IF by status and by slice), **review & submit**, and a **session drawer** listing every ruling
    and note made this sitting, each jumping back to where it was made, editable and removable.
  - **Linked identifiers** in every rendered surface — IF ids, design entry numbers, ADRs,
    repository paths, Markdown links — each with a peek (title, status, one-line summary) on hover
    or focus, and followed on click.
  - **Delayed tooltips** on every view, ruling, note kind, and header control, shown on keyboard
    focus too.
  - **Themes**: six built-in (four from the Gyokuro family, a neutral pair), custom themes as JSON
    files, a picker, and the choice remembered outside the repository.
  - The bundle, its drift check, the subproject gate, and CI for both.
- **Deferred:**
  - **The other four producers** — intent improvement, intent extraction, drift audit,
    contradictions ([`01-producers.md`](../../intent/01-concepts/01-producers.md)). Safe to defer
    because each is an agent procedure that writes a packet, and the contract already carries what
    they need: open item kinds (`finding` with a `category`), evidence by quote or line range in any
    file, the `intent-here` and `mismatch` note intents, and a whole-repository snapshot. Each lands
    as its own skill section and, if it needs one, its own scan mode — no schema change.
  - **More than one reviewer** — safe to defer because a decisions file names its reviewer, so an
    agent can already merge several; a shared live review is an
    [open question](../../intent/00-foundation/open-questions.md), not a missing feature.
  - **Per-slice open questions in `scan`** — only the cross-cutting list is scanned. Safe because an
    agent can add any question as an item by hand, and every slice's inline questions would flood a
    mature repository's queue.
  - **Fuzzy anchoring beyond surroundings** — re-location tries the exact quote, then its
    surroundings, then reports the note orphaned with its quote and words intact. Safe because an
    orphaned note still carries everything the agent needs to act on it by reading.
  - **Linking the repository's own numbering schemes** — principle numbers (`§16`), walkthrough
    steps, and other conventions a particular repository invents. Safe to defer because the
    architecture's own identifiers (IFs, entries, ADRs, paths) are linked, and a repository-specific
    scheme needs a declared convention to resolve rather than a guess.
  - **A theme editor in the page** — themes are written as JSON files. Safe because a theme is a
    dozen lines a person writes once, and the picker shows where to put it and links the format.
  - **A review timeout, live reload of a changed packet, full-text search, forge state** — each a
    convenience the loop works without: the agent can stop a stale server, a changed packet is a new
    iteration, the file filter and the browser's find cover search, and an item's Status already
    says what it awaits.
- **Acceptance:**
  1. `mise run check` in `tools/review/` is green: Biome, `tsc`, every test, and the bundle drift
     check.
  2. `mise run check` and `mise run template-check` at the repository root stay green.
  3. The end-to-end tests run the committed bundle under the pinned Node 20: serve a fixture packet
     in each mode, submit over HTTP, see exit 0 and valid decisions; abandon and a signal exit 3.
  4. A packet from a real repository — its pending IFs across two design entries and a proposed ADR
     — is served by the bundle in each mode; the page, the packet, and a draft round-trip answer
     over HTTP; an invalid submission is refused with each error named and the review stays open; a
     valid one, with notes on intent, on an item's text, and on source code, writes decisions that
     `validate` accepts and `locate` re-finds.
  5. Rendered in a headless browser in light and dark themes at two widths, every view reads
     cleanly; a selection at the right edge of the side pane keeps its toolbar inside the viewport;
     a tooltip and an identifier peek appear and stay inside it; the ruling dock is fully visible.
  6. Every built-in theme holds its text and syntax colours at 4.5:1 or more on every background (a
     test).

## Design

### Decisions

- Toolchain: [0001 — TypeScript, Bun, Biome, mise](../decisions/0001-typescript-bun-toolchain.md).
  Packaging: [0002 — one committed Node file](../decisions/0002-single-file-node-bundle.md).
- **The skill ships the tool; the template does not.** The repository's sync rule binds the skill's
  "start a new repository" section and its skeletons to `template/`. The review tool is neither: it
  is a capability of the skill, run against any repository, and a scaffolded repository gets it by
  having the skill installed. _Alternative:_ vendor the bundle into `template/`. _Attractive_
  because it travels with the repository. _Lost_ because every scaffolded repository would carry a
  frozen copy that never gets fixes. _Cost:_ reviewing a repository on a machine without the skill
  means installing the skill first.
- **Prose that keeps its offsets.** Markdown renders as flowing prose — hard wraps joined, markers
  hidden, headings, lists, and emphasis styled, at a 70-character measure — while every rendered
  span carries its offset in the source, so a selection maps to exact source text. _Alternatives:_
  render Markdown to HTML, or show styled source. _HTML lost_ because a selection in rendered HTML
  does not map back to source (`**x**` renders as `x`), breaking quote anchors, and a renderer is
  the largest dependency the page would otherwise need. _Styled source lost_ in use: hard-wrapped
  source in a narrower column double-wraps into a wall of text. _Cost:_ the renderer is deliberately
  partial (no nested blocks inside list items, tables shown as source); `v` toggles any file to
  source.
- **A small built-in highlighter.** Code and diffs are highlighted by a per-line lexer (keywords,
  strings, comments, numbers, calls, types, keys) for the common languages. _Alternative:_ bundle a
  highlighting library. _Attractive_ for accuracy. _Lost_ on weight — the bundle would grow several
  times over for a review surface that needs legibility, not fidelity. _Cost:_ it is a lexer, not a
  parser; multi-line strings and some edge syntax render plain.
- **The scanner is in the tool.** _Alternative:_ the agent assembles packets by reading files.
  _Attractive_ because it keeps the tool to rendering. _Lost_ because the mechanical half — finding
  IFs, reading their fields and Status, diffing a branch, snapshotting files, building the ledger —
  is deterministic, and doing it in code makes every packet consistent and frees the agent for the
  half that is judgment. The scanner never writes analysis. _Cost:_ it follows the IF convention's
  text shape; an unusual IF degrades to a one-section item rather than failing.
- **The snapshot is the repository's tracked text.** `scan` reads `git ls-files` (cached plus
  untracked-not-ignored) for a working tree, or the tree of a ref, so `.gitignore` is honoured;
  binaries and files over 1 MiB are listed as omitted, never inlined. `--files intent` narrows it.
  _Alternative:_ intent only. _Lost_ because notes on code (extraction, drift) are first-class.
  _Cost:_ packets of a few megabytes for a mid-sized repository — local, so acceptable.
- **Themes are token sets; custom themes are JSON; the choice lives beside them.** The built-ins are
  data in the source (so a test can hold their contrast), injected as CSS custom properties; the
  stylesheet uses only tokens. A custom theme is a JSON file naming a built-in base and the tokens
  it changes, validated (known tokens, colour-shaped values) and loaded from the user's config
  directory or `--theme`. _Alternative:_ a user CSS file. _Attractive_ because it could restyle
  anything. _Lost_ because it couples users to the stylesheet's internals and admits arbitrary CSS
  into the page; tokens are a stable, checkable surface. The last choice is saved in `prefs.json` in
  the same config directory. _Alternative:_ the browser's `localStorage`. _Lost_ because each run
  listens on a new port, and a new port is a new origin with empty storage — the choice would not
  survive one review. _Cost:_ the tool writes one small file outside the repository, only when the
  reader picks a theme.
- **Identifiers resolve against the packet, by pattern and context.** `IF-NNN` (or the legacy
  `SF-NNN`, an alias) resolves within the design entry of the text it appears in (an IF's own text,
  a file under `design/NNNN-…/`), or with an explicit entry (`0051 IF-001`, `0031/IF-005`), or —
  with no context — when the number is unique among the items under review; `NNNN` resolves to a
  design entry or ADR that exists; paths and Markdown links resolve relative to the text's own file,
  then from the root. Anything that does not resolve stays plain text. _Alternative:_ require
  producers to mark links in the packet. _Attractive_ because it is exact. _Lost_ because the text
  that matters most — intent and design files — is written by people, not producers. _Cost:_ a false
  link is possible where a four-digit number happens to match an entry; it is visibly a link and its
  peek says what it is.
- **Tooltips are the page's own, delayed.** Every view, ruling, note kind, and header control
  carries a description, shown after ~700 ms of hover or at once on keyboard focus, placed inside
  the viewport. _Alternative:_ the native `title` attribute. _Lost_ because it cannot be styled, its
  delay is the browser's, and keyboard focus never shows it. _Cost:_ one small global listener.
- **The consequences ride with the ruling.** "If accepted / if declined" sit in the pinned dock,
  above the five rulings (folded on request, remembered), so the choice and its effect are read
  together; the chosen side is outlined. _Alternative:_ keep them in the item body. _Lost_ because
  they scroll away exactly when the reader reaches for a ruling. _Cost:_ the dock is taller; on
  short screens the consequences clamp to two lines until clicked.
- **A per-run token and a Host check.** Every request must carry a random token from the printed
  URL, and the `Host` header must be the loopback address. _Alternative:_ trust loopback alone.
  _Lost_ because any page in the reviewer's browser can post to a loopback port, and a DNS-rebinding
  page can read one; decisions must come only from the review page. _Cost:_ the URL must be opened
  as printed.

### Layout

The source splits along the contract, so each part can be read and tested alone: **`schema`** (types
and validators — the one module both sides of the wire import), **`scan`** (repository → skeleton
packet; the only module that reads a repository or runs git), **`anchor`** (quote selectors),
**`diff`** (word-level diff), **`server`** (HTTP, draft, atomic writes; knows nothing of the page
but the HTML string it is handed), **`cli`** (arguments and exit codes), and **`ui/`** (the page:
`source` and `highlight` are pure and tested; `main` is the DOM). The build composes `ui/` into one
HTML string and inlines it into `cli`.

### The packet (version 1)

One JSON document. Fields not listed are ignored, so additions old readers may skip do not bump the
version; a change to a listed field's meaning does.

```ts
type Packet = {
  kind: 'intent-review-packet';
  version: 1;
  mode: 'main' | 'branch';
  producer?: string; // "open-items", "branch-review", … — the lens that prepared it
  title: string;
  createdAt: string; // ISO 8601
  iteration?: number; // 1 for a first pass; the next packet increments it
  repo: { name: string; root?: string; ref?: string }; // ref: what the snapshot is of
  change?: {
    // required in branch mode
    base: { ref: string; sha: string }; // the merge base
    head: { ref: string; sha: string };
    summary?: string; // the agent's overall read: what needs judgment, what is routine
    recommendation?: { verdict: 'approve' | 'request-changes' | 'comment'; why: string };
  };
  reviewer?: string; // pre-fills the reviewer field
  intro?: string; // the agent's overview of this pass (Markdown)
  items: Item[];
  files: { path: string; text: string }[]; // the snapshot, repo-relative paths
  omitted?: { path: string; reason: string }[]; // tracked files left out (binary, too large)
  ledger?: LedgerRow[]; // every IF in the repository, for the dashboard
};

type Item = {
  id: string; // stable: "<entry-dir>/IF-NNN", "OQ/<slug>", a path, …
  kind: string; // open: if (legacy alias sf), question, decision, intent-change, design-entry, finding, …
  category?: string; // a producer's sub-kind, e.g. "drift", "hidden-intent"
  title: string;
  status?: 'pending' | 'ruled' | 'adjudicated' | 'declined'; // required for kind "if"
  statusLine?: string; // the Status text as written
  baseStatusLine?: string; // branch mode: the Status at the base, when the branch changed it
  attention?: 'judgment' | 'routine'; // triage; branch mode orders the queue by it
  source: { path: string; line: number }; // where the item is written
  evidence: Ref[]; // what the item is about: intent passages and/or code locations
  context?: Ref[]; // further reading beside the item
  sections: { key: string; label: string; text: string }[]; // friction, assumption, revision, …
  changes?: { path: string; status: 'added' | 'modified' | 'deleted' | 'renamed'; oldPath?: string; patch: string }[];
  proposal?: { summary?: string; edits: { path: string; before: string; after: string }[] };
  analysis?: {
    summary?: string;
    ifAccepted?: string;
    ifDeclined?: string;
    relations?: { item: string; note: string }[];
    recommendation?: { verdict: Verdict['verdict']; why: string };
  };
};

type Ref = { path: string; section?: string; quote?: string; lines?: { start: number; end: number }; note?: string };

type LedgerRow = {
  id: string;
  entry: string;
  title: string;
  status: 'pending' | 'ruled' | 'adjudicated' | 'declined';
  slices: string[];
  source: { path: string; line: number };
  statusLine?: string;
};
```

Refused before serving, every error named by its JSON path: the kind and version; the mode, and the
change refs in branch mode; required strings non-empty; item ids unique; an `if` item's status;
every `evidence`, `context`, and `edits` path present in `files`; line ranges forward; every
`relations[].item` an item id. A `before` or `quote` not found in its file is **not** an error — the
page flags it on the item — because a packet built from a moving repository can lag it.

### The decisions (version 1)

```ts
type Decisions = {
  kind: 'intent-review-decisions';
  version: 1;
  packet: { title: string; createdAt: string; mode: 'main' | 'branch'; iteration?: number; digest: string }; // sha256:<hex>
  reviewer: string;
  submittedAt: string;
  comment?: string;
  overall?: { verdict: 'approve' | 'request-changes' | 'comment'; note?: string }; // required in branch mode
  verdicts: Verdict[]; // only items ruled on; an absent item is unreviewed
  annotations: Annotation[];
};

type Verdict =
  | { item: string; verdict: 'accept'; note?: string }
  | { item: string; verdict: 'amend'; wording: string; note?: string }
  | { item: string; verdict: 'decline'; why: string; note?: string }
  | { item: string; verdict: 'defer'; ruling?: string; note?: string }
  | { item: string; verdict: 'revise'; request: string; note?: string };

type Annotation = {
  id: string;
  target: { kind: 'file'; path: string } | { kind: 'item'; item: string; section: string };
  item?: string; // the item under review when a file note was made
  selector: { exact: string; prefix: string; suffix: string }; // W3C TextQuoteSelector shape
  at?: { start: number; end: number; line: number }; // a hint into the snapshot, never truth
  kind: 'comment' | 'question' | 'suggestion' | 'intent-here' | 'mismatch';
  comment: string; // may be empty only for a suggestion
  suggestion?: string; // required for kind "suggestion": the replacement for `exact`
  createdAt: string;
};
```

Refused at submit (the page shows the errors; the review stays open): an unknown or repeated item; a
verdict without its required words; a branch review without its overall verdict; a note on a file or
section the packet does not carry, or naming an unknown item; an empty quote; a suggestion without
its replacement. The tool writes only the contract's fields, so a verdict carries only its own
kind's words. The draft has the same shape with `kind: 'intent-review-draft'` and no `submittedAt`,
validated for shape only, so a half-written verdict survives a reload. The `digest` is the SHA-256
of the packet file's bytes, so the agent can confirm which packet was answered.

### The handshake

```sh
node <skill>/scripts/review.mjs scan     --repo <dir> [--ref <ref>] [--no-questions] [--files repo|intent] [--out <packet.json>]
node <skill>/scripts/review.mjs scan     --repo <dir> --base <ref> [--head <ref>] [--files repo|intent] [--out <packet.json>]
node <skill>/scripts/review.mjs validate (--packet <file> | --decisions <file>)
node <skill>/scripts/review.mjs serve    --packet <file> --out <decisions.json> [--port <n>] [--open] [--theme <id|file.json>]
node <skill>/scripts/review.mjs locate   --decisions <file> --repo <dir> [--packet <file>]
```

- `serve` validates the packet, listens on `127.0.0.1` (a free port unless `--port`), and prints
  `review: open http://127.0.0.1:<port>/?token=<token>`, then the draft path. `--open` also asks the
  platform to open the URL; a failure is ignored. The agent runs it in the background, gives the URL
  to the human, and waits for the process. The page opens on its home page; deep links go elsewhere:
  `#item=<id>`, `#file=<path>`, `#view=home|queue|files|dashboard|submit`, `#drawer`, `#theme=<id>`.
- Custom themes are `*.json` files in `<config>/themes/`, where `<config>` is
  `$INTENT_REVIEW_CONFIG`, else `$XDG_CONFIG_HOME/intent-review`, else `~/.config/intent-review`;
  `--theme` takes a built-in id or a file. A theme that does not validate is reported and skipped.
  The format and tokens:
  [`review-themes.md`](../../../../.agents/skills/intent-architecture/references/review-themes.md).
- The draft is `<out without .json>.draft.json`, loaded on start and saved on every change; submit
  deletes it, abandon keeps it. The directory of `--out` is created if it is missing.
- **Exit codes:** `0` decisions written · `2` usage error or invalid input (each error printed) ·
  `3` review abandoned from the page or the process signalled — no decisions, draft kept · `1`
  anything unexpected. `validate`, `scan`, and `locate` exit `0` or `2`.
- Decisions are written to a temporary file in the same directory and renamed into place, so the
  file is whole or absent; the response to the page goes out before the server closes.
- `locate` prints, per note,
  `{ id, path, status: 'exact' | 'context' | 'orphaned', line, start,
  end, text? }` against the
  current files (`context`: the quoted text itself changed and was found by its surroundings; `text`
  is what is there now). With `--packet`, notes on an item's text are located in the item's source
  file.

**HTTP** (every request needs the token — `?token=` on the page, the `X-Review-Token` header on the
API — and a loopback `Host`): `GET /` the page · `GET /api/packet` · `GET`/`PUT /api/draft` ·
`POST /api/submit` → `200 { out }` or `400 { errors }` · `POST /api/abandon` · `GET /api/themes`
(custom themes, the starting theme, the themes directory, saved preferences) · `PUT /api/prefs`
(`{ theme }`).

### Mechanisms

- **Scanning, main mode.** Every `design/*/intent-feedback.md` — and every legacy
  `design/*/spec-feedback.md`, from before the vocabulary became _intent feedback_ — is split at
  `## IF-NNN — <title>` (or `## SF-NNN`; ids normalize to IF, the source keeps its spelling); each
  `- **<Label>:** <text>` bullet becomes a section, the **Slice** bullet also yielding its links
  into `intent/` (resolved from the entry's directory), its italic section name, and — matched
  across hard wraps and emphasis markers — the source text of its quoted words as evidence. The
  Status bullet classifies the IF: absent or `pending` → pending; `pending — ruled …` → ruled;
  `adjudicated …` and `declined …` → settled, ledger only. The cross-cutting bullets before
  `open-questions.md`'s index become question items; ADRs whose Status is `proposed` become decision
  items.
- **Scanning, branch mode.** `git diff --name-status -M <merge-base> <head> -- intent design` lists
  the changes; each carries its own `git diff`. Intent changes are `judgment`; an IF the branch
  raised, re-statused (with `baseStatusLine`), or rewrote is `judgment` with an "on this branch"
  note; ADRs and design entries (one item per entry directory, with the intent its README links as
  context) are left for the agent to triage. The snapshot and ledger are read at head.
- **Anchors.** A selector keeps up to 32 characters each side of the quote. Re-location takes every
  occurrence of `exact`, scores each by agreement with `prefix` and `suffix`, breaks ties by
  nearness to the `at` hint; with none, it looks for the prefix followed closely by the suffix and
  reports what now sits between as `context`; else `orphaned`.
- **Rendering.** `renderLines` styles a file once — Markdown inline spans found over the whole text
  (they may cross a hard wrap, never a blank line or a fence), or code highlighted line by line with
  block-comment state carried — and clips styles and highlights to each line as segments that know
  their source offsets. Prose groups lines into blocks (paragraph, list item, heading, quote, fence,
  table) whose line breaks render as spaces. An excerpt is the same view windowed to the quote, so a
  note made in an item's excerpt is a note on the file itself.
- **The page.** Vanilla TypeScript and DOM, no framework: one state object; discrete actions
  re-render (scroll positions kept), typing updates state only; every change saves the draft,
  debounced. A selection inside any annotatable view raises a toolbar of the five note intents; a
  reference hovered shows a peek of the passage, clicked shows it beside the item. Toolbar, peeks,
  and tooltips share one placement rule: above or below the anchor, flipped when there is no room,
  clamped inside the viewport. The queue orders branch reviews judgment first, routine last. An item
  opens with the recommendation and summary, then the proposal and related items; the evidence
  follows, and an IF's own fields are folded beneath "the intent feedback as written"; any fold's
  state is kept for the session by section, across items. The ruling dock is pinned to the foot of
  the item. Branch changes show modified files as highlighted, word-diffed patches and added
  Markdown files as prose.
- **Links.** `xref` finds identifiers in text against an index built from the packet (files, design
  entries, ADRs, the ledger's IF ids, the items under review) and emits ranges that the renderer
  carries like any style, so a link keeps its source offsets and can sit inside an annotation. A
  peek shows the target's title, status, and first sentence (an IF's friction, a document's
  opening); a click opens an item, or shows a file beside the item, or in the files view.
- **Keys.** `j`/`k` next/previous (item, or file) · `n` next unreviewed · `a m d f r` the five
  verdicts · `u` clear · `c q s i x` the five note intents on the selection · `1`–`5` home, queue,
  files, dashboard, review & submit · `p` the session drawer · `v` prose/source · `/` filter files ·
  `t` themes · `?` keys. A key typed in a field is text; `⌘`/`Ctrl`+`Enter` confirms, `Esc` leaves.
- **The bundle and the drift check.** `scripts/build.ts` builds `src/ui/main.ts` for the browser,
  inlines it and the stylesheet into the page template, builds `src/main.ts` for Node with the page
  defined as a constant, and refuses any import that is not `node:`. `mise run build` writes the
  skill's `scripts/review.mjs`; `mise run bundle-check` rebuilds in memory and fails, naming the
  remedy, when the committed file differs. CI runs the subproject's `mise run check`, which includes
  it.
