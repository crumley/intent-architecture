// The review page: vanilla TypeScript + DOM, no framework. One state object;
// discrete actions re-render, typing only updates state; every change autosaves
// the draft. Views: queue (an item beside its evidence), files (the whole
// snapshot), dashboard (every SF), and review & submit; a session drawer lists
// everything decided so far.

import { createSelector, lineOf, locate } from '../anchor.ts';
import { diffWords } from '../diff.ts';
import {
  type Annotation,
  type AnnotationKind,
  type AnnotationTarget,
  type FileChange,
  type Item,
  type LedgerRow,
  OVERALL,
  type OverallKind,
  type Packet,
  REQUIRED_WORDS,
  type Ref,
  type ReviewState,
  type ValidationError,
  type Verdict,
  type VerdictKind,
} from '../schema.ts';
import { DEFAULT_DARK, DEFAULT_LIGHT, THEMES, type Theme, themeCss } from '../themes.ts';
import { highlightLine, type Lang, langOf } from './highlight.ts';
import {
  blocks,
  findSection,
  inlineRanges,
  type Range,
  renderLines,
  type Segment,
  segment,
} from './source.ts';
import { buildIndex, entryOf, findRefs, type RefContext, type RefIndex } from './xref.ts';

type View = 'home' | 'queue' | 'files' | 'dashboard' | 'submit';
type Focus = {
  path: string;
  quote?: string;
  lines?: { start: number; end: number };
  section?: string;
};

type State = {
  packet: Packet;
  digest: string;
  draftPath: string;
  review: ReviewState;
  view: View;
  current: number;
  file: string | null;
  side: string | null;
  focus: Focus | null;
  filter: string;
  openDirs: Set<string>;
  raw: boolean;
  drawer: boolean;
  saved: 'idle' | 'saving' | 'saved' | 'error';
  banner: string | null;
  errors: ValidationError[];
  ended: string | null;
  help: boolean;
  theme: string;
  picker: boolean;
  customThemes: Theme[];
  themeDir: string | null;
  folds: Record<string, boolean>;
};

const token = new URLSearchParams(location.search).get('token') ?? '';
const root = document.getElementById('app') as HTMLElement;
let S: State;
let FILES = new Map<string, string>();
let IDX: RefIndex = buildIndex([], []);

// ---------------------------------------------------------------------------
// DOM helper

type Child = Node | string | null | undefined | false | Child[];

function h(tag: string, attrs: Record<string, unknown> = {}, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2), v as EventListener);
    } else if (k === 'class') el.className = String(v);
    else if (k === 'tip') {
      el.dataset.tip = String(v);
      el.setAttribute('aria-description', String(v));
    } else if (k === 'value') (el as HTMLInputElement).value = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  const add = (c: Child) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  };
  children.forEach(add);
  return el;
}

const icon = (name: 'chev' | 'ext' | 'list') =>
  h('span', { class: `ic ic-${name}`, 'aria-hidden': 'true' });

// ---------------------------------------------------------------------------
// API + autosave

async function api<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const init: RequestInit = {
    method,
    headers: { 'x-review-token': token, 'content-type': 'application/json' },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(path, init);
  return { status: res.status, data: (await res.json().catch(() => ({}))) as T };
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function changed(): void {
  if (S.ended) return;
  S.saved = 'saving';
  paintChrome();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      S.saved = (await api('PUT', '/api/draft', S.review)).status === 200 ? 'saved' : 'error';
    } catch {
      S.saved = 'error';
    }
    paintChrome();
  }, 400);
}

/** Update the header's live bits without a re-render (keeps focus in text fields). */
function paintChrome(): void {
  const el = document.getElementById('save-state');
  if (el) {
    el.textContent = {
      idle: 'Nothing to save yet',
      saving: 'Saving…',
      saved: 'Draft saved',
      error: 'Draft NOT saved',
    }[S.saved];
    el.className = `save ${S.saved}`;
  }
  const n = document.getElementById('session-count');
  if (n) n.textContent = String(S.review.verdicts.length + S.review.annotations.length);
}

// ---------------------------------------------------------------------------
// Review-state helpers

const items = () => S.packet.items;
const currentItem = (): Item | undefined => items()[S.current];
const fileText = (path: string) => FILES.get(path);
const verdictOf = (id: string) => S.review.verdicts.find((v) => v.item === id);
const itemById = (id: string) => items().find((i) => i.id === id);

const KIND_LABEL: Record<string, string> = {
  sf: 'Spec-feedback',
  question: 'Open question',
  'intent-change': 'Intent change',
  'design-entry': 'Design entry',
  decision: 'Decision',
  finding: 'Finding',
};
const kindLabel = (it: Item) => KIND_LABEL[it.kind] ?? it.kind;
const isChange = (it: Item) =>
  it.kind === 'intent-change' || it.kind === 'design-entry' || it.kind === 'decision';
const capitalize = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/** On a change under review, accept and decline read as approve and reject. */
function verdictLabel(it: Item, v: VerdictKind): string {
  if (isChange(it) && v === 'accept') return 'approve';
  if (isChange(it) && v === 'decline') return 'reject';
  return v;
}

function shortId(id: string): string {
  const m = /^(\d{4})-[^/]*\/(SF-\d+)$/.exec(id);
  if (m) return `${m[1]} ${m[2]}`;
  const adr = /(?:^|\/)decisions\/(\d{4})-/.exec(id);
  if (adr) return `ADR ${adr[1]}`;
  const entry = /^design\/(\d{4})-[^/]+$/.exec(id);
  if (entry) return `entry ${entry[1]}`;
  if (id.startsWith('intent-change/')) return id.split('/').pop() as string;
  return id.length > 40 ? `…${id.slice(-38)}` : id;
}

function setVerdict(id: string, verdict: VerdictKind | null): void {
  const i = S.review.verdicts.findIndex((v) => v.item === id);
  if (verdict === null) {
    if (i !== -1) S.review.verdicts.splice(i, 1);
  } else {
    const next: Verdict = { ...(i === -1 ? {} : S.review.verdicts[i]), item: id, verdict };
    if (verdict === 'amend' && !next.wording) next.wording = amendSeed(id);
    if (i === -1) S.review.verdicts.push(next);
    else S.review.verdicts[i] = next;
  }
  changed();
}

function amendSeed(id: string): string {
  const it = itemById(id);
  return (
    it?.proposal?.edits[0]?.after ?? it?.sections.find((s) => s.key === 'revision')?.text ?? ''
  );
}

function targetText(t: AnnotationTarget): string | undefined {
  if (t.kind === 'file') return fileText(t.path);
  return itemById(t.item)?.sections.find((s) => s.key === t.section)?.text;
}

const sameTarget = (a: AnnotationTarget, b: AnnotationTarget) =>
  a.kind === 'file'
    ? b.kind === 'file' && a.path === b.path
    : b.kind === 'item' && a.item === b.item && a.section === b.section;

const annotationsOn = (t: AnnotationTarget) =>
  S.review.annotations.filter((a) => sameTarget(a.target, t));
const annotationsForItem = (id: string) =>
  S.review.annotations.filter(
    (a) => (a.target.kind === 'item' && a.target.item === id) || a.item === id,
  );
const annotationsInFile = (path: string) =>
  S.review.annotations.filter((a) => a.target.kind === 'file' && a.target.path === path);

function marksFor(t: AnnotationTarget, text: string): Range[] {
  const out: Range[] = [];
  for (const a of annotationsOn(t)) {
    const at = locate(text, a.selector, a.at?.start);
    if (at.status !== 'orphaned') {
      out.push({ start: at.start, end: at.end, cls: `hl hl-${a.kind}`, id: a.id });
    }
  }
  return out;
}

function targetLabel(a: Annotation): string {
  const t = a.target;
  if (t.kind === 'file') return `${t.path}${a.at ? `:${a.at.line}` : ''}`;
  const it = itemById(t.item);
  const label = it?.sections.find((s) => s.key === t.section)?.label ?? t.section;
  return `${shortId(t.item)} · ${label}`;
}

/** Offsets of a ref's target inside its file: the quote, else the line range. */
function refRange(r: Ref | Focus, text: string): { start: number; end: number } | null {
  if (r.quote) {
    const at = text.indexOf(r.quote);
    if (at >= 0) return { start: at, end: at + r.quote.length };
  }
  if (r.lines) {
    const lines = text.split('\n');
    let start = 0;
    for (let i = 0; i < r.lines.start - 1 && i < lines.length; i++) {
      start += (lines[i] as string).length + 1;
    }
    let end = start;
    for (let i = r.lines.start - 1; i < r.lines.end && i < lines.length; i++) {
      end += (lines[i] as string).length + 1;
    }
    return { start, end: Math.max(start, end - 1) };
  }
  return null;
}

function refLabel(r: Ref): string {
  if (r.lines) {
    const span = r.lines.end !== r.lines.start ? `–${r.lines.end}` : '';
    return `${r.path}:${r.lines.start}${span}`;
  }
  const text = fileText(r.path) ?? '';
  const range = refRange(r, text);
  return range ? `${r.path}:${lineOf(text, range.start)}` : r.path;
}

// ---------------------------------------------------------------------------
// Text rendering: prose (Markdown that flows) and code (lines, highlighted).
// Every rendered span carries data-o, its offset in the source, so a selection
// maps to exact source text whatever the presentation.

type ViewOpts = {
  target?: AnnotationTarget | null;
  extra?: Range[];
  window?: { start: number; end: number };
  lines?: { start: number; end: number };
  compact?: boolean;
  ctx?: RefContext;
};

function spanFor(s: Segment): HTMLElement {
  const span = h('span', { 'data-o': s.start, class: s.cls.join(' ') || undefined }, s.text);
  const link = s.links[0];
  if (link) {
    span.dataset.link = link;
    span.tabIndex = 0;
    span.addEventListener('click', (e) => {
      if (window.getSelection()?.isCollapsed) {
        e.stopPropagation();
        followLink(link);
      }
    });
    span.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') followLink(link);
    });
    hoverPeek(span, () => linkCard(link));
  }
  if (s.ids.length) {
    span.dataset.ann = s.ids.join(' ');
    span.title = s.ids
      .map((id) => S.review.annotations.find((a) => a.id === id)?.comment ?? '')
      .filter(Boolean)
      .join('\n—\n');
    if (!link) {
      span.addEventListener('click', (e) => {
        if (window.getSelection()?.isCollapsed) {
          e.stopPropagation();
          editAnnotation(s.ids[0] as string);
        }
      });
    }
  }
  return span;
}

function viewMarks(text: string, o: ViewOpts): Range[] {
  return [
    ...(o.target ? marksFor(o.target, text) : []),
    ...(o.extra ?? []),
    ...(o.ctx ? findRefs(text, IDX, o.ctx) : []),
  ];
}

const fileCtx = (path: string): RefContext => {
  const c: RefContext = { dir: path.split('/').slice(0, -1).join('/') };
  const e = entryOf(path);
  if (e) c.entry = e;
  return c;
};

const itemCtx = (it: Item | undefined): RefContext => {
  if (!it) return {};
  const c = fileCtx(it.source.path);
  const e = entryOf(it.id) ?? c.entry;
  if (e) c.entry = e;
  return c;
};

function annotatable(el: HTMLElement, t: AnnotationTarget | null | undefined): HTMLElement {
  if (!t) return el;
  el.classList.add('anno');
  el.dataset.kind = t.kind;
  if (t.kind === 'file') el.dataset.path = t.path;
  else {
    el.dataset.item = t.item;
    el.dataset.section = t.section;
  }
  return el;
}

function proseView(text: string, o: ViewOpts = {}): HTMLElement {
  const marks = viewMarks(text, o);
  const lines = renderLines(text, 'markdown', marks);
  const view = h('div', { class: `prose${o.compact ? ' compact' : ''}` });
  for (const b of blocks(lines, text)) {
    const first = b.lines[0];
    const last = b.lines[b.lines.length - 1];
    if (!first || !last) continue;
    if (o.window && (last.end < o.window.start || first.start > o.window.end)) continue;
    const el = h('div', {
      class: `blk b-${b.kind}${b.ordered ? ' ol' : ''}`,
      'data-line': first.n,
      'data-start': first.start,
      'data-end': last.end,
      style: b.depth ? `--depth:${b.depth}` : undefined,
    });
    b.lines.forEach((line, i) => {
      for (const s of line.segments) el.append(spanFor(s));
      if (i < b.lines.length - 1) el.append(h('span', { class: 'nl', 'data-o': line.end }, '\n'));
    });
    view.append(el);
  }
  return annotatable(view, o.target);
}

function codeView(text: string, lang: Lang, o: ViewOpts = {}): HTMLElement {
  const marks = viewMarks(text, o);
  const lines = renderLines(text, lang, marks);
  const view = h('div', { class: `codeview lang-${lang}${o.compact ? ' compact' : ''}` });
  for (const line of lines) {
    if (o.lines && (line.n < o.lines.start || line.n > o.lines.end)) continue;
    const el = h('div', {
      class: `ln ${line.cls}`,
      'data-line': line.n,
      'data-start': line.start,
      'data-end': line.end,
    });
    for (const s of line.segments) el.append(spanFor(s));
    view.append(el);
  }
  return annotatable(view, o.target);
}

/** A whole file: prose for Markdown (unless source mode), highlighted code otherwise. */
function fileView(path: string, o: ViewOpts = {}): HTMLElement {
  const text = fileText(path) ?? '';
  const lang = langOf(path);
  const target: AnnotationTarget = { kind: 'file', path };
  const ctx = fileCtx(path);
  if (lang === 'markdown' && !S.raw) return proseView(text, { ...o, target, ctx });
  return codeView(text, lang, { ...o, target, ctx });
}

/** An excerpt of a file around a ref — still annotatable against the file itself. */
function excerpt(r: Ref): HTMLElement | null {
  const text = fileText(r.path);
  if (text === undefined) return null;
  const range = refRange(r, text);
  if (!range) return null;
  const target: AnnotationTarget = { kind: 'file', path: r.path };
  const focus: Range = { ...range, cls: 'focus' };
  const lang = langOf(r.path);
  if (lang === 'markdown') {
    return h(
      'div',
      { class: 'excerpt' },
      proseView(text, {
        target,
        extra: [focus],
        window: range,
        compact: true,
        ctx: fileCtx(r.path),
      }),
    );
  }
  const a = lineOf(text, range.start);
  const b = lineOf(text, range.end);
  return h(
    'div',
    { class: 'excerpt' },
    codeView(text, lang, {
      target,
      ctx: fileCtx(r.path),
      extra: [focus],
      lines: { start: Math.max(1, a - 2), end: b + 2 },
      compact: true,
    }),
  );
}

/** Item text (an SF's friction, etc.): prose, annotatable against the item. */
function itemText(it: Item, key: string, text: string): HTMLElement {
  return proseView(text, {
    target: { kind: 'item', item: it.id, section: key },
    compact: true,
    ctx: itemCtx(it),
  });
}

/** Agent-written prose (analysis, summaries): read-only, identifiers linked. */
const plainProse = (text: string, ctx: RefContext = itemCtx(currentItem())) =>
  proseView(text, { compact: true, ctx });

/** A plain string with its identifiers linked (titles, notes, table cells). */
function linked(text: string, ctx: RefContext = itemCtx(currentItem())): HTMLElement {
  const refs = findRefs(text, IDX, ctx);
  return h(
    'span',
    {},
    segment(text, 0, text.length, refs).map((sg) => spanFor(sg)),
  );
}

/** A word diff of Markdown text: changes marked, emphasis styled, markers faint. */
function wordDiff(before: string, after: string): HTMLElement {
  const parts = diffWords(before, after);
  const ops: Range[] = [];
  let text = '';
  for (const d of parts) {
    ops.push({ start: text.length, end: text.length + d.text.length, cls: `w-${d.op}` });
    text += d.text;
  }
  const segs = segment(text, 0, text.length, [...ops, ...inlineRanges(text)]);
  return h(
    'div',
    { class: 'wdiff' },
    segs.map((sg) => h('span', { class: sg.cls.join(' ') || undefined }, sg.text)),
  );
}

/** A unified diff, highlighted by the file's language; paired -/+ runs get word diffs. */
function patchView(change: FileChange): HTMLElement {
  const lang = langOf(change.path);
  const out = h('div', { class: 'patch' });
  const lines = change.patch.split('\n');
  let oldN = 0;
  let newN = 0;
  const row = (
    sign: string,
    content: string,
    cls: string,
    words: Range[],
    o: number | '',
    n: number | '',
  ) => {
    const hl =
      lang === 'markdown' || lang === 'plain'
        ? []
        : highlightLine(lang, content, { inBlockComment: false }).ranges;
    const segs = segment(content, 0, content.length, [...hl, ...words]);
    return h(
      'div',
      { class: `pl ${cls}` },
      h('span', { class: 'gut' }, String(o)),
      h('span', { class: 'gut' }, String(n)),
      h('span', { class: 'sign' }, sign),
      h(
        'span',
        { class: 'pc' },
        segs.map((s) => h('span', { class: s.cls.join(' ') || undefined }, s.text)),
      ),
    );
  };
  let i = 0;
  while (i < lines.length) {
    const l = lines[i] as string;
    if (
      /^(diff --git|index |--- |\+\+\+ |similarity |rename |new file|deleted file|old mode|new mode)/.test(
        l,
      )
    ) {
      i++;
      continue;
    }
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(l);
    if (hunk) {
      oldN = Number(hunk[1]);
      newN = Number(hunk[2]);
      out.append(
        h(
          'div',
          { class: 'pl hunk' },
          h('span', { class: 'gut' }, '⋯'),
          h('span', { class: 'gut' }, '⋯'),
          h('span', { class: 'sign' }, ''),
          h('span', { class: 'pc' }, (hunk[3] ?? '').trim() || `line ${newN}`),
        ),
      );
      i++;
      continue;
    }
    if (l.startsWith('-')) {
      let j = i;
      while (j < lines.length && (lines[j] as string).startsWith('-')) j++;
      let k = j;
      while (k < lines.length && (lines[k] as string).startsWith('+')) k++;
      const dels = lines.slice(i, j).map((x) => x.slice(1));
      const adds = lines.slice(j, k).map((x) => x.slice(1));
      const pair = dels.length === adds.length;
      dels.forEach((d, n) => {
        out.append(
          row('−', d, 'del', pair ? wordRanges(d, adds[n] as string, 'del') : [], oldN++, ''),
        );
      });
      adds.forEach((a, n) => {
        out.append(
          row('+', a, 'add', pair ? wordRanges(dels[n] as string, a, 'ins') : [], '', newN++),
        );
      });
      i = k;
      continue;
    }
    if (l.startsWith('+')) out.append(row('+', l.slice(1), 'add', [], '', newN++));
    else if (l.startsWith('\\')) out.append(h('div', { class: 'pl meta' }, l));
    else if (l.startsWith(' ')) out.append(row('', l.slice(1), 'ctx', [], oldN++, newN++));
    i++;
  }
  return out;
}

function wordRanges(before: string, after: string, side: 'del' | 'ins'): Range[] {
  const out: Range[] = [];
  let pos = 0;
  for (const d of diffWords(before, after)) {
    if (d.op === 'same' || d.op === side) {
      if (d.op === side) out.push({ start: pos, end: pos + d.text.length, cls: 'wd' });
      pos += d.text.length;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Selection -> annotation

function offsetOf(node: Node, offset: number): number | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const span = node.parentElement?.closest('[data-o]') as HTMLElement | null;
    return span ? Number(span.dataset.o) + Math.min(offset, node.textContent?.length ?? 0) : null;
  }
  const el = node as HTMLElement;
  if (el.dataset?.o !== undefined) {
    return Number(el.dataset.o) + (offset > 0 ? (el.textContent?.length ?? 0) : 0);
  }
  const row = el.closest?.('.blk, .ln') as HTMLElement | null;
  if (row) {
    const child = row.children[offset] as HTMLElement | undefined;
    return child?.dataset.o !== undefined ? Number(child.dataset.o) : Number(row.dataset.end);
  }
  if (el.classList?.contains('anno')) {
    const child = el.children[offset] as HTMLElement | undefined;
    if (child?.dataset.start) return Number(child.dataset.start);
    const last = el.lastElementChild as HTMLElement | null;
    return last ? Number(last.dataset.end) : null;
  }
  return null;
}

type Pending = { target: AnnotationTarget; start: number; end: number; item?: string };

function selectionTarget(): Pending | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const r = sel.getRangeAt(0);
  const host = (n: Node) =>
    (n.nodeType === Node.TEXT_NODE ? n.parentElement : (n as HTMLElement))?.closest(
      '.anno',
    ) as HTMLElement | null;
  const a = host(r.startContainer);
  if (!a || a !== host(r.endContainer)) return null;
  const start = offsetOf(r.startContainer, r.startOffset);
  const end = offsetOf(r.endContainer, r.endOffset);
  if (start === null || end === null || end <= start) return null;
  const target: AnnotationTarget =
    a.dataset.kind === 'file'
      ? { kind: 'file', path: a.dataset.path as string }
      : { kind: 'item', item: a.dataset.item as string, section: a.dataset.section as string };
  const text = targetText(target) ?? '';
  let s = start;
  let e = end;
  while (s < e && /\s/.test(text[s] as string)) s++;
  while (e > s && /\s/.test(text[e - 1] as string)) e--;
  if (e <= s) return null;
  const p: Pending = { target, start: s, end: e };
  const it = currentItem();
  if (S.view === 'queue' && it && target.kind === 'file') p.item = it.id;
  return p;
}

const ANN_KEYS: [AnnotationKind, string, string][] = [
  ['comment', 'c', 'Comment'],
  ['question', 'q', 'Question'],
  ['suggestion', 's', 'Suggest edit'],
  ['intent-here', 'i', 'Intent here'],
  ['mismatch', 'x', 'Mismatch'],
];

const ANN_HINT: Record<AnnotationKind, string> = {
  comment: 'Your comment…',
  question: 'Your question — the agent answers it next iteration…',
  suggestion: 'Why (optional)…',
  'intent-here':
    'The intent this expresses is… (the agent adds it to intent/, or strengthens the passage that owns it)',
  mismatch: 'How this diverges from the intent… (the agent reconciles the code or the intent)',
};

/** What each note asks of the agent — shown on hover and focus. */
const ANN_TIP: Record<AnnotationKind, string> = {
  comment:
    'Comment — a remark for the agent to weigh. It may act on it or simply take note; no reply is owed. Use a question when you want an answer.',
  question:
    'Question — something you want answered. The agent replies (in its report, or as a new item next pass) before acting on it.',
  suggestion:
    'Suggest edit — replace the selected text with your own wording. The agent applies it through the normal review path.',
  'intent-here':
    'Intent here — say, in your words, what this passage is for: the purpose behind it that is written nowhere else (often code). The agent records it in intent/, or strengthens the slice that should already say it.',
  mismatch:
    'Mismatch — this does not do what the intent says. The agent works out whether the code or the intent should change, and brings that choice back to you.',
};

const VERDICT_TIP: Record<VerdictKind, string> = {
  accept:
    'Accept — the proposal is right. The agent makes the intent edit as proposed, in its own change for review.',
  amend:
    'Amend — right direction, your words. You write the wording; the agent makes the intent edit with it.',
  decline:
    'Decline — no change to the intent. Give a one-line why; it is recorded on the item as its disposition.',
  defer:
    'Defer — not now. Optionally record your ruling to apply later; otherwise the item simply stays open.',
  revise:
    'Revise — send it back. The agent reworks the proposal or analysis as you ask and shows it again next pass.',
};

const CHANGE_TIP: Record<VerdictKind, string> = {
  accept: 'Approve — this change is right as it stands.',
  amend: 'Amend — keep the change, in your wording. The agent applies it on the branch.',
  decline:
    'Reject — this change should not go in. Say why; the agent reverts or reworks it on the branch.',
  defer: 'Defer — no ruling on this change yet.',
  revise: 'Revise — the agent reworks this change as you ask and brings it back for another look.',
};

const VIEW_TIP: Record<View, string> = {
  home: 'Home — what this review is, what you are asked to do, how to work through it, and the keys.',
  queue:
    'Queue — the items needing your ruling, one at a time, with the intent they touch beside them.',
  files: 'Files — every file in the snapshot (intent, design, code), to read and to note anywhere.',
  dashboard:
    'Dashboard — every spec-feedback item in the repository, by status and by the intent slice it questions.',
  submit:
    'Review & submit — look over every ruling and note from this session, then hand them back to the agent.',
};

let editor: { annotation: Annotation; isNew: boolean } | null = null;

function openEditor(kind: AnnotationKind): void {
  const p = selectionTarget();
  if (!p) {
    toast('Select some text first — in an item, an intent passage, or any file.');
    return;
  }
  const text = targetText(p.target) ?? '';
  const selector = createSelector(text, p.start, p.end);
  const annotation: Annotation = {
    id: nextAnnotationId(),
    target: p.target,
    selector,
    at: { start: p.start, end: p.end, line: lineOf(text, p.start) },
    kind,
    comment: '',
    createdAt: new Date().toISOString(),
  };
  if (p.item) annotation.item = p.item;
  if (kind === 'suggestion') annotation.suggestion = selector.exact;
  editor = { annotation, isNew: true };
  window.getSelection()?.removeAllRanges();
  hideToolbar();
  render();
}

function editAnnotation(id: string): void {
  const a = S.review.annotations.find((x) => x.id === id);
  if (!a) return;
  editor = { annotation: structuredClone(a), isNew: false };
  render();
}

function nextAnnotationId(): string {
  let n = S.review.annotations.length + 1;
  while (S.review.annotations.some((a) => a.id === `a${n}`)) n++;
  return `a${n}`;
}

function saveEditor(): void {
  if (!editor) return;
  const a = editor.annotation;
  if (a.kind !== 'suggestion' && !a.comment.trim()) {
    toast('Write the note first, or press Esc to cancel.');
    return;
  }
  if (a.kind === 'suggestion' && a.suggestion === undefined) a.suggestion = a.selector.exact;
  if (a.kind !== 'suggestion') delete a.suggestion;
  const i = S.review.annotations.findIndex((x) => x.id === a.id);
  if (i === -1) S.review.annotations.push(a);
  else S.review.annotations[i] = a;
  editor = null;
  changed();
  render();
}

function deleteAnnotation(id: string): void {
  S.review.annotations = S.review.annotations.filter((a) => a.id !== id);
  editor = null;
  changed();
  render();
}

function closeEditor(): void {
  editor = null;
  render();
}

function fieldKeys(confirm: () => void, cancel: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      confirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };
}

function editorModal(): HTMLElement | null {
  if (!editor) return null;
  const a = editor.annotation;
  const keys = fieldKeys(saveEditor, closeEditor);
  const comment = h('textarea', {
    class: 'field',
    rows: 4,
    placeholder: ANN_HINT[a.kind],
    oninput: (e: Event) => {
      a.comment = (e.target as HTMLTextAreaElement).value;
    },
    onkeydown: keys,
  }) as HTMLTextAreaElement;
  comment.value = a.comment;
  let suggestion: HTMLTextAreaElement | null = null;
  if (a.kind === 'suggestion') {
    suggestion = h('textarea', {
      class: 'field mono',
      rows: Math.min(12, Math.max(3, (a.suggestion ?? '').split('\n').length + 1)),
      oninput: (e: Event) => {
        a.suggestion = (e.target as HTMLTextAreaElement).value;
      },
      onkeydown: keys,
    }) as HTMLTextAreaElement;
    suggestion.value = a.suggestion ?? '';
  }
  const focusEl = suggestion ?? comment;
  setTimeout(() => focusEl.focus(), 0);
  const quote = a.selector.exact;
  return h(
    'div',
    {
      class: 'modal',
      onmousedown: (e: Event) => {
        if (e.target === e.currentTarget) closeEditor();
      },
    },
    h(
      'div',
      { class: 'modal-box', role: 'dialog', 'aria-label': 'Note' },
      h(
        'div',
        { class: 'modal-head' },
        h('strong', {}, editor.isNew ? 'New note' : `Note ${a.id}`),
        h('span', { class: 'muted mono small' }, targetLabel(a)),
      ),
      h('blockquote', { class: 'quote' }, quote.length > 600 ? `${quote.slice(0, 600)}…` : quote),
      h(
        'div',
        { class: 'seg' },
        ANN_KEYS.map(([k, , label]) =>
          h(
            'button',
            {
              class: `pill k-${k} ${a.kind === k ? 'on' : ''}`,
              tip: ANN_TIP[k],
              onclick: () => {
                a.kind = k;
                if (k === 'suggestion' && a.suggestion === undefined) a.suggestion = quote;
                render();
              },
            },
            label,
          ),
        ),
      ),
      suggestion
        ? [h('label', { class: 'lbl' }, 'Replace the quoted text with'), suggestion]
        : null,
      h('label', { class: 'lbl' }, a.kind === 'suggestion' ? 'Note' : 'Note to the agent'),
      comment,
      h(
        'div',
        { class: 'row' },
        editor.isNew
          ? null
          : h(
              'button',
              { class: 'btn ghost danger', onclick: () => deleteAnnotation(a.id) },
              'Delete',
            ),
        h('span', { class: 'grow' }),
        h('button', { class: 'btn ghost', onclick: closeEditor }, 'Cancel', h('kbd', {}, 'Esc')),
        h('button', { class: 'btn primary', onclick: saveEditor }, 'Save note', h('kbd', {}, '⌘↵')),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Popovers: the selection toolbar, peeks, and tooltips all stay inside the
// viewport — placed above or below their anchor, flipped when there is no
// room, and clamped to the edges.

function placeNear(el: HTMLElement, anchor: DOMRect, prefer: 'above' | 'below'): void {
  el.style.visibility = 'hidden';
  el.style.top = '0px';
  el.style.left = '0px';
  document.body.append(el);
  const w = el.offsetWidth;
  const ht = el.offsetHeight;
  const m = 8;
  const above = anchor.top - ht - 6;
  const below = anchor.bottom + 6;
  let top = prefer === 'above' ? above : below;
  if (prefer === 'above' && above < m) top = below;
  if (prefer === 'below' && below + ht > window.innerHeight - m) top = above >= m ? above : below;
  top = Math.max(m, Math.min(top, window.innerHeight - ht - m));
  const left = Math.max(m, Math.min(anchor.left, window.innerWidth - w - m));
  el.style.top = `${top}px`;
  el.style.left = `${left}px`;
  el.style.visibility = '';
}

let toolbarEl: HTMLElement | null = null;
function hideToolbar(): void {
  toolbarEl?.remove();
  toolbarEl = null;
}
function showToolbar(): void {
  hideToolbar();
  if (editor || S.ended) return;
  const p = selectionTarget();
  const sel = window.getSelection();
  if (!p || !sel || sel.rangeCount === 0) return;
  const rects = sel.getRangeAt(0).getClientRects();
  const rect = rects[0] ?? sel.getRangeAt(0).getBoundingClientRect();
  toolbarEl = h(
    'div',
    { class: 'toolbar', role: 'toolbar', 'aria-label': 'Add a note' },
    ANN_KEYS.map(([k, key, label]) =>
      h(
        'button',
        {
          class: `tb k-${k}`,
          tip: ANN_TIP[k],
          onmousedown: (e: Event) => e.preventDefault(),
          onclick: () => openEditor(k),
        },
        label,
        h('kbd', {}, key),
      ),
    ),
  );
  placeNear(toolbarEl, rect, 'above');
}

// Hover peeks: a quick look at a passage or an identifier without navigating away.

let peekEl: HTMLElement | null = null;
let peekTimer: ReturnType<typeof setTimeout> | undefined;

function hoverPeek(el: HTMLElement, build: () => HTMLElement | null): void {
  const show = (delay: number) => {
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => {
      const body = build();
      if (!body) return;
      hidePeek();
      peekEl = body;
      peekEl.addEventListener('mouseenter', () => clearTimeout(peekTimer));
      peekEl.addEventListener('mouseleave', hidePeek);
      placeNear(peekEl, el.getBoundingClientRect(), 'below');
    }, delay);
  };
  const hide = () => {
    clearTimeout(peekTimer);
    peekTimer = setTimeout(hidePeek, 200);
  };
  el.addEventListener('mouseenter', () => show(350));
  el.addEventListener('mouseleave', hide);
  el.addEventListener('focus', () => show(150));
  el.addEventListener('blur', hide);
}

function refLink(r: Ref | Focus, label: string, cls = ''): HTMLElement {
  const el = h('button', { class: `ref ${cls}`, onclick: () => showBeside(r) }, label, icon('ext'));
  hoverPeek(el, () => filePeek(r));
  return el;
}

function hidePeek(): void {
  peekEl?.remove();
  peekEl = null;
}

function filePeek(r: Ref | Focus): HTMLElement | null {
  const text = fileText(r.path);
  if (text === undefined) return null;
  const range = refRange(r, text);
  const at = range ? lineOf(text, range.start) : 1;
  const to = range ? lineOf(text, range.end) : 14;
  const body = codeView(text, langOf(r.path), {
    extra: range ? [{ ...range, cls: 'focus' }] : [],
    lines: { start: Math.max(1, at - 3), end: Math.min(to + 3, at + 30) },
    compact: true,
  });
  return h('div', { class: 'peek' }, h('div', { class: 'peek-head mono' }, r.path), body);
}

/** Title, status, and first sentence of a Markdown document (or of one SF block). */
function mdSummary(text: string): { title?: string; status?: string; summary?: string } {
  const out: { title?: string; status?: string; summary?: string } = {};
  const h1 = /^#{1,3}\s+(.+)$/m.exec(text);
  if (h1) out.title = clean(h1[1] as string);
  const st = /\*\*Status:\*\*\s*`?([^·\n`*]+)/.exec(text);
  if (st) out.status = (st[1] as string).trim().replace(/[.,]$/, '');
  for (const para of text.split(/\n\s*\n/)) {
    const t = para.trim();
    if (!t || /^#|^\||^```|^\s*>?\s*\*\*Status/.test(t)) continue;
    const plain = clean(t.replace(/^>\s?/gm, '').replace(/^-\s+\*\*[^*]+:\*\*\s*/, ''));
    if (plain.length < 12) continue;
    const sentence = /^(.{20,}?[.!?])(\s|$)/.exec(plain)?.[1] ?? plain;
    out.summary = sentence.length > 240 ? `${sentence.slice(0, 237)}…` : sentence;
    break;
  }
  return out;
}

function clean(t: string): string {
  return t
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sfBlock(path: string, sfId: string): string {
  const text = fileText(path) ?? '';
  const at = text.search(new RegExp(`^#{2,3}\\s+${sfId}\\b`, 'm'));
  if (at < 0) return '';
  const rest = text.slice(at);
  const next = rest.slice(3).search(/^#{1,3}\s/m);
  return next < 0 ? rest : rest.slice(0, next + 3);
}

type LinkTarget = {
  label: string;
  title?: string;
  status?: string;
  summary?: string;
  focus?: Focus;
  item?: number;
};

function resolveLink(link: string): LinkTarget | null {
  const [kind, rest = ''] = [link.slice(0, link.indexOf(':')), link.slice(link.indexOf(':') + 1)];
  if (kind === 'sf') {
    const row = (S.packet.ledger ?? []).find((r) => r.id === rest);
    const i = items().findIndex((x) => x.id === rest);
    const it = items()[i];
    const sfId = rest.split('/').pop() as string;
    const path = row?.source.path ?? it?.source.path;
    const friction = it?.sections.find((x) => x.key === 'friction')?.text;
    const block = path ? sfBlock(path, sfId) : '';
    const t: LinkTarget = { label: shortId(rest), title: row?.title ?? it?.title ?? sfId };
    const status = row?.status ?? it?.status;
    if (status) t.status = status;
    const sum = mdSummary(friction ?? block.replace(/^#.*\n/, ''));
    if (sum.summary) t.summary = sum.summary;
    if (i >= 0) t.item = i;
    if (path)
      t.focus = {
        path,
        lines: {
          start: row?.source.line ?? it?.source.line ?? 1,
          end: row?.source.line ?? it?.source.line ?? 1,
        },
      };
    return t;
  }
  const path =
    kind === 'entry'
      ? `${IDX.entries.get(rest)}/README.md`
      : kind === 'adr'
        ? IDX.adrs.get(rest)
        : kind === 'file'
          ? rest
          : undefined;
  if (!path || fileText(path) === undefined) return null;
  const sum = mdSummary(fileText(path) ?? '');
  const t: LinkTarget = {
    label: kind === 'adr' ? `ADR ${rest}` : kind === 'entry' ? `Design entry ${rest}` : path,
    focus: { path },
  };
  if (sum.title) t.title = sum.title;
  if (sum.status) t.status = sum.status;
  if (sum.summary) t.summary = sum.summary;
  return t;
}

function linkCard(link: string): HTMLElement | null {
  const t = resolveLink(link);
  if (!t) return null;
  return h(
    'div',
    { class: 'peek card-peek' },
    h(
      'div',
      { class: 'cp-head' },
      h('span', { class: 'mono' }, t.label),
      t.status ? h('span', { class: `tag st-${t.status.split(' ')[0]}` }, t.status) : null,
    ),
    t.title ? h('div', { class: 'cp-title' }, t.title) : null,
    t.summary ? h('div', { class: 'cp-sum' }, t.summary) : null,
    h(
      'div',
      { class: 'cp-hint' },
      t.item !== undefined ? 'Click to open this item' : 'Click to open',
    ),
  );
}

function followLink(link: string): void {
  const t = resolveLink(link);
  if (!t) return;
  hidePeek();
  if (t.item !== undefined) select(t.item);
  else if (t.focus) showBeside(t.focus);
}

// Tooltips: every control explains itself after a pause (or at once on keyboard
// focus) — not the native title, which is slow, unstyled, and unreachable by keyboard.

let tipEl: HTMLElement | null = null;
let tipTimer: ReturnType<typeof setTimeout> | undefined;
let tipFor: HTMLElement | null = null;
function hideTip(): void {
  clearTimeout(tipTimer);
  tipEl?.remove();
  tipEl = null;
  tipFor = null;
}
function initTips(): void {
  const showFor = (el: HTMLElement, delay: number) => {
    if (tipFor === el) return;
    hideTip();
    tipFor = el;
    tipTimer = setTimeout(() => {
      if (!el.isConnected) return;
      tipEl = h('div', { class: 'tip', role: 'tooltip', id: 'tip' }, el.dataset.tip ?? '');
      el.setAttribute('aria-describedby', 'tip');
      placeNear(tipEl, el.getBoundingClientRect(), 'below');
    }, delay);
  };
  document.addEventListener('mouseover', (e) => {
    const el = (e.target as HTMLElement).closest?.('[data-tip]') as HTMLElement | null;
    if (el) showFor(el, 700);
  });
  document.addEventListener('mouseout', (e) => {
    const el = (e.target as HTMLElement).closest?.('[data-tip]');
    if (el && !el.contains(e.relatedTarget as Node)) hideTip();
  });
  document.addEventListener('focusin', (e) => {
    const el = (e.target as HTMLElement).closest?.('[data-tip]') as HTMLElement | null;
    if (el?.matches(':focus-visible')) showFor(el, 150);
  });
  for (const ev of ['focusout', 'mousedown', 'keydown', 'scroll'] as const) {
    document.addEventListener(ev, hideTip, true);
  }
}

function showBeside(r: Ref | Focus): void {
  hidePeek();
  if (S.view === 'queue') {
    S.side = r.path;
    S.focus = r;
  } else {
    S.view = 'files';
    S.file = r.path;
    S.focus = r;
    revealDir(r.path);
  }
  scrollWanted = true;
  render();
}

// ---------------------------------------------------------------------------
// Header + session drawer

const TABS: [View, string, string][] = [
  ['home', 'Home', '1'],
  ['queue', 'Queue', '2'],
  ['files', 'Files', '3'],
  ['dashboard', 'Dashboard', '4'],
  ['submit', 'Review & submit', '5'],
];

function header(): HTMLElement {
  const p = S.packet;
  const ruled = S.review.verdicts.length;
  const total = items().length;
  const sub =
    p.mode === 'branch' && p.change
      ? `${p.change.head.ref} → ${p.change.base.ref} · ${p.change.head.sha.slice(0, 7)}`
      : (p.repo.ref ?? p.repo.name);
  const theme = allThemes().find((t) => t.id === S.theme);
  return h(
    'header',
    { class: 'top' },
    h(
      'button',
      { class: 'brand', onclick: () => go('home'), tip: 'Back to the home page (1)' },
      h('div', { class: 'title' }, p.title),
      h(
        'div',
        { class: 'sub' },
        h('span', { class: `mode m-${p.mode}` }, p.mode === 'branch' ? 'Branch review' : 'Main'),
        ' ',
        sub,
        p.iteration && p.iteration > 1 ? ` · iteration ${p.iteration}` : '',
      ),
    ),
    h(
      'nav',
      { class: 'tabs', 'aria-label': 'Views' },
      TABS.map(([v, label, key]) =>
        h(
          'button',
          { class: `tab ${S.view === v ? 'on' : ''}`, onclick: () => go(v), tip: VIEW_TIP[v] },
          label,
          h('kbd', {}, key),
        ),
      ),
    ),
    h(
      'div',
      { class: 'status' },
      h(
        'div',
        { class: 'meter', tip: `${ruled} of ${total} items have your ruling` },
        h(
          'div',
          { class: 'track' },
          h('div', { class: 'bar', style: `width:${total ? (100 * ruled) / total : 0}%` }),
        ),
        h('span', {}, `${ruled}/${total}`),
      ),
      h('span', { id: 'save-state', class: `save ${S.saved}` }),
      h(
        'button',
        {
          class: `btn ghost sm ${S.drawer ? 'on' : ''}`,
          tip: 'This session — every ruling and note so far; jump back to any of them, edit or remove them (p)',
          onclick: toggleDrawer,
        },
        'Session',
        h('span', { id: 'session-count', class: 'count' }, '0'),
      ),
      h(
        'button',
        {
          class: `btn ghost sm theme-btn ${S.picker ? 'on' : ''}`,
          tip: 'Theme — choose the colours, or add your own (t)',
          onclick: () => {
            S.picker = !S.picker;
            render();
          },
        },
        h('span', { class: 'swatch', style: theme ? swatchStyle(theme) : '' }),
        theme?.name ?? 'Theme',
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Themes

const THEME_DOCS =
  'https://github.com/crumley/intent-architecture/blob/main/.agents/skills/intent-architecture/references/review-themes.md';

const allThemes = (): Theme[] => [...THEMES, ...(S?.customThemes ?? [])];

function swatchStyle(t: Theme): string {
  const c = t.colors;
  return `background:conic-gradient(${c.accent} 0 25%, ${c.heading} 0 50%, ${c.xref} 0 75%, ${c.surface} 0)`;
}

function injectThemes(list: Theme[]): void {
  let el = document.getElementById('theme-css');
  if (!el) {
    el = document.createElement('style');
    el.id = 'theme-css';
    document.head.append(el);
  }
  el.textContent = list.map(themeCss).join('\n');
}

function applyTheme(id: string, save = true): void {
  document.documentElement.dataset.theme = id;
  if (S) S.theme = id;
  if (save) api('PUT', '/api/prefs', { theme: id }).catch(() => undefined);
}

function themePicker(): HTMLElement | null {
  if (!S.picker) return null;
  const option = (t: Theme) =>
    h(
      'button',
      {
        class: `theme-opt ${t.id === S.theme ? 'on' : ''}`,
        role: 'menuitemradio',
        'aria-checked': t.id === S.theme ? 'true' : 'false',
        onclick: () => {
          applyTheme(t.id);
          render();
        },
      },
      h('span', { class: 'swatch big', style: swatchStyle(t) }),
      h('span', { class: 'theme-name' }, t.name),
      h('span', { class: 'muted small' }, t.dark ? 'dark' : 'light'),
    );
  return h(
    'div',
    { class: 'picker', role: 'menu', 'aria-label': 'Themes' },
    h('div', { class: 'eyebrow' }, 'Themes'),
    THEMES.map(option),
    S.customThemes.length
      ? [h('div', { class: 'eyebrow' }, 'Yours'), S.customThemes.map(option)]
      : null,
    h(
      'div',
      { class: 'picker-foot small' },
      'Make your own: a small JSON file naming a base theme and the colours to change, placed in ',
      h('span', { class: 'mono' }, S.themeDir ?? '~/.config/intent-review/themes'),
      ' or passed with ',
      h('span', { class: 'mono' }, '--theme'),
      '. ',
      h(
        'a',
        { href: THEME_DOCS, target: '_blank', rel: 'noopener noreferrer' },
        'How to write a theme ↗',
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Session-scoped fold state: a section opened or closed stays that way for the
// rest of the sitting, across items.

function loadFolds(): Record<string, boolean> {
  try {
    return JSON.parse(sessionStorage.getItem('intent-review-folds') ?? '{}') as Record<
      string,
      boolean
    >;
  } catch {
    return {};
  }
}

function saveFolds(): void {
  try {
    sessionStorage.setItem('intent-review-folds', JSON.stringify(S.folds));
  } catch {
    // no session storage: folds still hold for this page
  }
}

// ---------------------------------------------------------------------------
// Home: where a review starts — what it is, what is asked, how to work it.

function homeView(): HTMLElement {
  const p = S.packet;
  const its = items();
  const count = (f: (i: Item) => boolean) => its.filter(f).length;
  const firstOf = (f: (i: Item) => boolean) => {
    const order = displayOrder();
    const i =
      order.find((n) => f(its[n] as Item) && !verdictOf((its[n] as Item).id)) ??
      order.find((n) => f(its[n] as Item));
    return i;
  };
  const asks: [string, string, (i: Item) => boolean][] = [
    [
      'Spec-feedback to rule on',
      'Frictions a build found in the intent, each with a proposed revision.',
      (i) => i.kind === 'sf' && i.status !== 'ruled',
    ],
    [
      'Rulings awaiting their wording',
      'Already ruled; confirm the words that land the ruling in the intent.',
      (i) => i.kind === 'sf' && i.status === 'ruled',
    ],
    [
      'Open questions',
      'Cross-cutting questions the intent tracks as unresolved.',
      (i) => i.kind === 'question',
    ],
    [
      'Decisions still proposed',
      'Design decisions (ADRs) nobody has taken yet.',
      (i) => i.kind === 'decision',
    ],
    [
      'Intent changes',
      'Edits this branch makes to the intent itself.',
      (i) => i.kind === 'intent-change',
    ],
    [
      'Design entries',
      'Design entries this branch adds or changes.',
      (i) => i.kind === 'design-entry',
    ],
    [
      'Findings',
      'Things an agent noticed that need your judgment.',
      (i) => !['sf', 'question', 'decision', 'intent-change', 'design-entry'].includes(i.kind),
    ],
  ];
  const ruled = S.review.verdicts.length;
  const next = displayOrder().find((n) => !verdictOf((its[n] as Item).id));
  const intro = p.mode === 'branch' && p.change ? p.change.summary : p.intro;
  return h(
    'main',
    { class: 'page home', 'data-scroll': 'home' },
    h(
      'div',
      { class: 'page-inner narrow' },
      h(
        'div',
        { class: 'eyebrow' },
        p.mode === 'branch' ? 'Branch review' : 'Review of the main line',
      ),
      h('h1', { class: 'home-title' }, p.title),
      h(
        'p',
        { class: 'lead' },
        p.mode === 'branch' && p.change
          ? `What ${p.change.head.ref} does to the intent and design, measured against ${p.change.base.ref} — so you can decide before it merges. Rule on each change, then give the branch an overall verdict.`
          : 'Everything in this repository that is waiting on a human decision: rule on each item, note anything you see along the way, then hand it back. An agent prepared this and carries out what you decide.',
      ),
      intro || p.change?.recommendation
        ? h(
            'div',
            { class: 'rec-card' },
            h(
              'div',
              { class: 'rec-head' },
              h('span', { class: 'eyebrow' }, 'The agent’s overview'),
              p.change?.recommendation
                ? h(
                    'span',
                    { class: `vchip big o-${p.change.recommendation.verdict}` },
                    p.change.recommendation.verdict,
                  )
                : null,
            ),
            intro ? plainProse(intro, {}) : null,
            p.change?.recommendation
              ? h('p', { class: 'rec-why' }, p.change.recommendation.why)
              : null,
          )
        : null,
      h('h2', {}, 'What you are asked to do'),
      h(
        'div',
        { class: 'asks' },
        asks
          .filter(([, , f]) => count(f) > 0)
          .map(([label, desc, f]) => {
            const n = count(f);
            const done = its.filter((i) => f(i) && verdictOf(i.id)).length;
            const first = firstOf(f);
            return h(
              'button',
              { class: 'ask', onclick: () => first !== undefined && select(first) },
              h('span', { class: 'ask-n' }, String(n)),
              h(
                'span',
                { class: 'ask-body' },
                h('strong', {}, label),
                h('span', { class: 'muted small' }, desc),
              ),
              h('span', { class: 'ask-done small muted' }, done ? `${done} ruled` : ''),
            );
          }),
        p.mode === 'branch'
          ? h(
              'button',
              { class: 'ask', onclick: () => go('submit') },
              h('span', { class: 'ask-n' }, '1'),
              h(
                'span',
                { class: 'ask-body' },
                h('strong', {}, 'Overall verdict'),
                h(
                  'span',
                  { class: 'muted small' },
                  'Approve, request changes, or comment — given on Review & submit.',
                ),
              ),
              h(
                'span',
                { class: 'ask-done small muted' },
                S.review.overall ? S.review.overall.verdict : '',
              ),
            )
          : null,
      ),
      h(
        'div',
        { class: 'row cta' },
        h(
          'button',
          {
            class: 'btn primary big',
            onclick: () => (next !== undefined ? select(next) : go('submit')),
          },
          ruled === 0
            ? 'Start reviewing →'
            : next !== undefined
              ? 'Continue reviewing →'
              : 'Review & submit →',
        ),
        h(
          'span',
          { class: 'muted small' },
          `${ruled} of ${its.length} ruled · ${S.review.annotations.length} notes · your work saves as you go`,
        ),
      ),
      h('h2', {}, 'How to go through it'),
      h(
        'ol',
        { class: 'steps' },
        h(
          'li',
          {},
          h('strong', {}, 'Work the queue. '),
          'Each item opens with the agent’s recommendation and summary, then the proposed change. Supporting detail — the friction, the assumption, the slice — is folded away until you want it. The intent the item touches is shown beside it.',
        ),
        h(
          'li',
          {},
          h('strong', {}, 'Rule at the foot of the item. '),
          'The consequences of each choice sit above the five rulings. Hover any ruling to see exactly what it asks of the agent.',
        ),
        h(
          'li',
          {},
          h('strong', {}, 'Note anything, anywhere. '),
          'Select text — in an item, in the intent, in code — and a small toolbar offers five kinds of note.',
        ),
        h(
          'li',
          {},
          h('strong', {}, 'Follow the identifiers. '),
          'SF numbers, entry numbers like 0031, ADRs, and file paths are links: hover to peek, click to go.',
        ),
        h(
          'li',
          {},
          h('strong', {}, 'Hand it back. '),
          'On Review & submit, check the list and submit. The agent carries everything out and may come back with a smaller packet.',
        ),
      ),
      h('h2', {}, 'The views'),
      h(
        'div',
        { class: 'cards3' },
        TABS.filter(([v]) => v !== 'home').map(([v, label, key]) =>
          h(
            'button',
            { class: 'card view-card', onclick: () => go(v) },
            h('div', { class: 'row' }, h('strong', {}, label), h('kbd', {}, key)),
            h('p', { class: 'small muted' }, VIEW_TIP[v].replace(/^[^—]+— /, '')),
          ),
        ),
      ),
      h('h2', {}, 'Your rulings'),
      h(
        'dl',
        { class: 'defs' },
        VERDICT_KEYS.map(([k, key]) => [
          h('dt', {}, h('span', { class: `vchip v-${k}` }, k), h('kbd', {}, key)),
          h('dd', {}, VERDICT_TIP[k].replace(/^[^—]+— /, '')),
        ]),
      ),
      h('h2', {}, 'Kinds of note'),
      h(
        'dl',
        { class: 'defs' },
        ANN_KEYS.map(([k, key, label]) => [
          h('dt', {}, h('span', { class: `pill k-${k}` }, label), h('kbd', {}, key)),
          h('dd', {}, ANN_TIP[k].replace(/^[^—]+— /, '')),
        ]),
      ),
      h('h2', {}, 'Keyboard'),
      keysTable(),
    ),
  );
}

function keysTable(): HTMLElement {
  const rows: [string, string][] = [
    ['1 2 3 4 5', 'Home · queue · files · dashboard · review & submit'],
    ['j k', 'Next / previous item (or file)'],
    ['n', 'Next unreviewed item'],
    ['a m d f r', 'Accept · amend · decline · defer · revise'],
    ['u', 'Clear the ruling'],
    ['c q s i x', 'Comment · question · suggest · intent here · mismatch — on selected text'],
    ['p', 'This session: every ruling and note'],
    ['v', 'Markdown as prose / as source'],
    ['/', 'Filter files'],
    ['t', 'Themes'],
    ['?', 'This list'],
    ['⌘↵ Esc', 'Confirm / leave a text field'],
  ];
  return h(
    'table',
    { class: 'keys' },
    h(
      'tbody',
      {},
      rows.map(([k, d]) =>
        h(
          'tr',
          {},
          h(
            'td',
            {},
            k.split(' ').map((x) => h('kbd', {}, x)),
          ),
          h('td', {}, d),
        ),
      ),
    ),
  );
}

function toggleDrawer(): void {
  S.drawer = !S.drawer;
  render();
}

function drawer(): HTMLElement | null {
  if (!S.drawer) return null;
  const rulings = S.review.verdicts;
  const groups = new Map<string, Annotation[]>();
  for (const a of S.review.annotations) {
    const key = a.target.kind === 'file' ? a.target.path : `item:${a.target.item}`;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
  return h(
    'aside',
    { class: 'drawer', 'aria-label': 'This session' },
    h(
      'div',
      { class: 'drawer-head' },
      h(
        'div',
        {},
        h('div', { class: 'title' }, 'This session'),
        h(
          'div',
          { class: 'sub' },
          `${rulings.length} rulings · ${S.review.annotations.length} notes`,
        ),
      ),
      h('button', { class: 'icon-btn', title: 'Close (p)', onclick: toggleDrawer }, '×'),
    ),
    h(
      'div',
      { class: 'drawer-body', 'data-scroll': 'drawer' },
      h('h3', {}, 'Rulings'),
      rulings.length === 0
        ? h('p', { class: 'muted small' }, 'None yet. Rule on an item with a, m, d, f, or r.')
        : null,
      rulings.map((v) => {
        const it = itemById(v.item);
        const words = v.wording ?? v.why ?? v.ruling ?? v.request ?? '';
        return h(
          'div',
          { class: 'entry' },
          h(
            'button',
            {
              class: 'entry-main',
              onclick: () => select(items().findIndex((x) => x.id === v.item)),
            },
            h(
              'span',
              { class: `vchip v-${v.verdict}` },
              it ? verdictLabel(it, v.verdict) : v.verdict,
            ),
            h('span', { class: 'entry-title' }, it?.title ?? v.item),
            words ? h('span', { class: 'entry-words' }, clip(words, 120)) : null,
          ),
          h(
            'button',
            {
              class: 'icon-btn sm',
              title: 'Remove this ruling',
              onclick: () => {
                setVerdict(v.item, null);
                render();
              },
            },
            '×',
          ),
        );
      }),
      h('h3', {}, 'Notes'),
      S.review.annotations.length === 0
        ? h('p', { class: 'muted small' }, 'Select text anywhere and press c, q, s, i, or x.')
        : null,
      [...groups.entries()].map(([key, list]) =>
        h(
          'div',
          { class: 'group' },
          h(
            'div',
            { class: 'group-head mono' },
            key.startsWith('item:') ? shortId(key.slice(5)) : key,
          ),
          list.map((a) =>
            h(
              'div',
              { class: 'entry' },
              h(
                'button',
                { class: 'entry-main', onclick: () => jumpTo(a) },
                h('span', { class: `pill k-${a.kind}` }, a.kind),
                h('span', { class: 'entry-quote' }, clip(a.selector.exact, 90)),
                a.comment ? h('span', { class: 'entry-words' }, a.comment) : null,
              ),
              h(
                'button',
                { class: 'icon-btn sm', title: 'Edit', onclick: () => editAnnotation(a.id) },
                '✎',
              ),
              h(
                'button',
                { class: 'icon-btn sm', title: 'Delete', onclick: () => deleteAnnotation(a.id) },
                '×',
              ),
            ),
          ),
        ),
      ),
    ),
    h(
      'div',
      { class: 'drawer-foot' },
      h('button', { class: 'btn primary block', onclick: () => go('submit') }, 'Review & submit →'),
    ),
  );
}

function jumpTo(a: Annotation): void {
  if (a.target.kind === 'file') {
    const path = a.target.path;
    if (a.item && itemById(a.item)) {
      S.view = 'queue';
      S.current = items().findIndex((i) => i.id === a.item);
      S.side = path;
    } else {
      S.view = 'files';
      S.file = path;
      revealDir(path);
    }
    S.focus = { path, quote: a.selector.exact };
  } else {
    const target = a.target;
    S.view = 'queue';
    S.current = Math.max(
      0,
      items().findIndex((i) => i.id === target.item),
    );
  }
  scrollWanted = true;
  render();
}

// ---------------------------------------------------------------------------
// Queue

const GROUPS: [string, string][] = [
  ['judgment', 'Needs your judgment'],
  ['none', 'To review'],
  ['routine', 'Routine'],
];

function displayOrder(): number[] {
  const idx = items().map((_, i) => i);
  if (S.packet.mode !== 'branch') return idx;
  return GROUPS.flatMap(([g]) => idx.filter((i) => (items()[i]?.attention ?? 'none') === g));
}

function step(d: number): void {
  const order = displayOrder();
  const next = order[Math.min(Math.max(order.indexOf(S.current) + d, 0), order.length - 1)];
  if (next !== undefined) select(next);
}

function queueRow(it: Item, i: number): HTMLElement {
  const v = verdictOf(it.id);
  const notes = annotationsForItem(it.id).length;
  return h(
    'button',
    { class: `qi ${i === S.current ? 'on' : ''} ${v ? 'done' : ''}`, onclick: () => select(i) },
    h('span', { class: `dot v-${v?.verdict ?? 'none'}` }),
    h(
      'span',
      { class: 'qbody' },
      h(
        'span',
        { class: 'qmeta' },
        h('span', { class: 'mono' }, shortId(it.id)),
        it.status === 'ruled' ? h('span', { class: 'tag ruled' }, 'ruled') : null,
        it.kind !== 'sf' ? h('span', { class: 'tag' }, kindLabel(it)) : null,
      ),
      h('span', { class: 'qt' }, it.title),
    ),
    h(
      'span',
      { class: 'qside' },
      v ? h('span', { class: `vchip v-${v.verdict}` }, verdictLabel(it, v.verdict)) : null,
      notes ? h('span', { class: 'badge', title: `${notes} notes` }, String(notes)) : null,
    ),
  );
}

function queueNav(): HTMLElement {
  const order = displayOrder();
  const list =
    S.packet.mode === 'branch'
      ? GROUPS.map(([g, label]) => {
          const m = order.filter((i) => (items()[i]?.attention ?? 'none') === g);
          if (!m.length) return null;
          return [
            h(
              'div',
              { class: 'nav-group' },
              label,
              h('span', { class: 'muted' }, ` · ${m.length}`),
            ),
            m.map((i) => queueRow(items()[i] as Item, i)),
          ];
        })
      : order.map((i) => queueRow(items()[i] as Item, i));
  return h(
    'aside',
    { class: 'nav', 'data-scroll': 'nav', 'aria-label': 'Items' },
    h(
      'button',
      { class: 'nav-home small', onclick: () => go('home'), tip: VIEW_TIP.home },
      '← What this review is about',
    ),
    items().length === 0
      ? h('p', { class: 'muted pad' }, 'Nothing to review in this packet.')
      : null,
    list,
  );
}

function queueView(): HTMLElement {
  const it = currentItem();
  return h(
    'div',
    { class: 'layout queue' },
    queueNav(),
    it
      ? itemDetail(it)
      : h('main', { class: 'center' }, h('div', { class: 'doc muted' }, 'No item selected.')),
    it ? sidePane(it) : null,
  );
}

/**
 * Progressive disclosure: the summary, the proposal, the analysis, and the
 * ruling are open; an SF's supporting fields start folded. Any fold the
 * reviewer opens or closes stays that way for the session (by section key).
 */
const FOLDED_BY_DEFAULT = new Set([
  'slice',
  'friction',
  'assumption',
  'revision',
  'entry-context',
  'notes',
]);

function itemDetail(it: Item): HTMLElement {
  const v = verdictOf(it.id);
  const a = it.analysis;
  const rec = a?.recommendation;
  const sections = it.sections.filter((s) => s.key !== 'on-branch');
  const onBranch = it.sections.find((s) => s.key === 'on-branch');
  const notes = annotationsForItem(it.id);
  const ctx = itemCtx(it);
  const sourceRef = { path: it.source.path, lines: { start: it.source.line, end: it.source.line } };
  const doc = h(
    'div',
    { class: 'doc' },
    h(
      'div',
      { class: 'eyebrow-row' },
      h('span', { class: 'tag strong' }, kindLabel(it)),
      it.category ? h('span', { class: 'tag' }, it.category) : null,
      it.status ? h('span', { class: `tag st-${it.status}` }, it.status) : null,
      it.attention
        ? h(
            'span',
            { class: `tag at-${it.attention}` },
            it.attention === 'judgment' ? 'needs judgment' : 'routine',
          )
        : null,
      h('span', { class: 'grow' }),
      fileText(it.source.path) !== undefined
        ? refLink(sourceRef, `${it.source.path}:${it.source.line}`, 'quiet')
        : h('span', { class: 'mono small muted' }, `${it.source.path}:${it.source.line}`),
    ),
    h('h1', { class: 'item-title' }, linked(it.title, ctx)),
    onBranch ? h('div', { class: 'callout info' }, linked(onBranch.text, ctx)) : null,
    it.statusLine && (it.status === 'ruled' || it.baseStatusLine !== undefined)
      ? h('div', { class: 'callout warn' }, h('strong', {}, 'Status '), linked(it.statusLine, ctx))
      : null,
    it.baseStatusLine
      ? h('div', { class: 'callout' }, h('strong', {}, 'At base '), linked(it.baseStatusLine, ctx))
      : null,
    rec || a?.summary
      ? h(
          'div',
          { class: `rec-card ${rec ? `r-${rec.verdict}` : ''}` },
          h(
            'div',
            { class: 'rec-head' },
            h('span', { class: 'eyebrow' }, rec ? 'Agent recommends' : 'Agent’s summary'),
            rec
              ? h(
                  'span',
                  {
                    class: `vchip big v-${rec.verdict}`,
                    tip: (isChange(it) ? CHANGE_TIP : VERDICT_TIP)[rec.verdict],
                  },
                  capitalize(verdictLabel(it, rec.verdict)),
                )
              : null,
          ),
          rec ? h('p', { class: 'rec-why' }, linked(rec.why, ctx)) : null,
          a?.summary ? plainProse(a.summary, ctx) : null,
        )
      : null,
    it.proposal ? proposalSection(it) : null,
    it.changes?.length
      ? h(
          'section',
          { class: 'sec' },
          h('h2', {}, 'Changes on this branch'),
          it.changes.map((c) =>
            collapsible(
              h(
                'span',
                { class: 'row' },
                h('span', { class: `tag ch-${c.status}` }, c.status),
                h('span', { class: 'mono small' }, c.oldPath ? `${c.oldPath} → ${c.path}` : c.path),
              ),
              // A new Markdown file reads best as prose at head (and stays annotatable);
              // anything else, or any modification, as its diff.
              c.status === 'added' &&
                langOf(c.path) === 'markdown' &&
                fileText(c.path) !== undefined
                ? h('div', { class: 'added-doc' }, fileView(c.path))
                : patchView(c),
              c.patch.split('\n').length < 160,
              0,
              `change:${c.path}`,
            ),
          ),
        )
      : null,
    a?.relations?.length
      ? h(
          'section',
          { class: 'sec' },
          h('h2', {}, 'Related items'),
          h(
            'ul',
            { class: 'rel' },
            a.relations.map((r) =>
              h(
                'li',
                {},
                h(
                  'button',
                  {
                    class: 'ref',
                    onclick: () => select(items().findIndex((x) => x.id === r.item)),
                  },
                  shortId(r.item),
                ),
                h('span', {}, linked(r.note, ctx)),
              ),
            ),
          ),
        )
      : null,
    !a && !isChange(it)
      ? h('p', { class: 'muted small sec' }, 'The packet carries no analysis for this item.')
      : null,
    it.evidence.length
      ? collapsible(
          it.kind === 'sf' || it.kind === 'question' ? 'The intent in question' : 'Evidence',
          h(
            'div',
            {},
            it.evidence.map((r) => {
              const text = fileText(r.path);
              const missing = r.quote && text !== undefined && !text.includes(r.quote);
              return h(
                'div',
                { class: 'evidence' },
                h(
                  'div',
                  { class: 'ev-head' },
                  refLink(r, refLabel(r)),
                  r.section ? h('span', { class: 'muted small' }, `§ ${r.section}`) : null,
                  missing
                    ? h('span', { class: 'warn small' }, 'quote not found in the snapshot')
                    : null,
                ),
                r.note ? h('p', { class: 'small muted' }, linked(r.note, ctx)) : null,
                excerpt(r),
              );
            }),
          ),
          true,
          0,
          'evidence',
        )
      : null,
    sections.length
      ? h(
          'div',
          { class: 'supporting' },
          h(
            'div',
            { class: 'eyebrow' },
            it.kind === 'sf' ? 'The spec-feedback as written' : 'Detail',
          ),
          sections.map((s) =>
            collapsible(
              s.label,
              itemText(it, s.key, s.text),
              !FOLDED_BY_DEFAULT.has(s.key),
              annotationsOn({ kind: 'item', item: it.id, section: s.key }).length,
              `sec:${s.key}`,
            ),
          ),
        )
      : null,
    notes.length
      ? collapsible(
          `Your notes on this item · ${notes.length}`,
          noteList(notes),
          true,
          0,
          'item-notes',
        )
      : h(
          'p',
          { class: 'hint' },
          'Select any text — here, in an excerpt, or in the file beside — to leave a note. Hover a note kind to see what it asks of the agent.',
        ),
  );
  return h('main', { class: 'center', 'data-scroll': `detail:${it.id}` }, doc, rulingBar(it, v));
}

function proposalSection(it: Item): HTMLElement {
  const pr = it.proposal as NonNullable<Item['proposal']>;
  const ctx = itemCtx(it);
  return h(
    'section',
    { class: 'sec' },
    h('h2', {}, 'Proposed edit'),
    pr.summary ? h('p', { class: 'lead' }, linked(pr.summary, ctx)) : null,
    pr.edits.map((e) => {
      const text = fileText(e.path) ?? '';
      const at = text.indexOf(e.before);
      return h(
        'div',
        { class: 'edit' },
        h(
          'div',
          { class: 'ev-head' },
          refLink(
            { path: e.path, quote: e.before },
            at >= 0 ? `${e.path}:${lineOf(text, at)}` : e.path,
          ),
          at < 0
            ? h('span', { class: 'warn small' }, 'the “before” text is not in the snapshot')
            : null,
        ),
        wordDiff(e.before, e.after),
      );
    }),
  );
}

function collapsible(
  title: string | HTMLElement,
  body: HTMLElement,
  open: boolean,
  count = 0,
  key?: string,
): HTMLElement {
  const isOpen = key !== undefined && key in S.folds ? (S.folds[key] as boolean) : open;
  const el = h(
    'details',
    { class: 'sec fold', open: isOpen ? true : undefined },
    h(
      'summary',
      {},
      icon('chev'),
      typeof title === 'string' ? h('span', { class: 'h2' }, title) : title,
      count ? h('span', { class: 'badge' }, String(count)) : null,
    ),
    body,
  );
  if (key !== undefined) {
    el.addEventListener('toggle', () => {
      S.folds[key] = (el as HTMLDetailsElement).open;
      saveFolds();
    });
  }
  return el;
}

function noteList(list: Annotation[]): HTMLElement {
  return h(
    'div',
    { class: 'notes' },
    list.map((a) => {
      const q = a.selector.exact;
      return h(
        'div',
        { class: `note k-${a.kind}` },
        h(
          'div',
          { class: 'row' },
          h('span', { class: `pill k-${a.kind}` }, a.kind),
          h('button', { class: 'ref quiet', onclick: () => jumpTo(a) }, targetLabel(a)),
          h('span', { class: 'grow' }),
          h('button', { class: 'btn ghost sm', onclick: () => editAnnotation(a.id) }, 'Edit'),
        ),
        h('div', { class: 'note-quote' }, q.length > 280 ? `${q.slice(0, 280)}…` : q),
        a.kind === 'suggestion' ? wordDiff(q, a.suggestion ?? '') : null,
        a.comment ? h('p', {}, a.comment) : null,
      );
    }),
  );
}

// The ruling bar: sticky at the foot of the item.

const VERDICT_KEYS: [VerdictKind, string][] = [
  ['accept', 'a'],
  ['amend', 'm'],
  ['decline', 'd'],
  ['defer', 'f'],
  ['revise', 'r'],
];

function fieldCopy(it: Item, field: string): { label: string; placeholder: string } {
  const change = isChange(it);
  switch (field) {
    case 'wording':
      return {
        label: change
          ? 'Your wording — the agent applies it on the branch'
          : 'Your wording for the intent edit',
        placeholder: 'What the text should say…',
      };
    case 'why':
      return {
        label: change
          ? 'Why reject — the agent reverts or reworks it'
          : 'Why — one line; it becomes the declined disposition',
        placeholder: change ? 'What is wrong with this change…' : 'Why no intent change…',
      };
    case 'ruling':
      return {
        label: 'Ruling to record now (optional — leave empty to simply wait)',
        placeholder: 'The ruling, applied by a later intent edit…',
      };
    default:
      return {
        label: 'What should change in the proposal or analysis',
        placeholder: 'Rework it so that…',
      };
  }
}

/**
 * The ruling dock, pinned to the foot of the item: the consequences of each
 * choice, then the five rulings — the page's call to action.
 */
function rulingBar(it: Item, v: Verdict | undefined): HTMLElement {
  const field = v ? (v.verdict === 'defer' ? 'ruling' : REQUIRED_WORDS[v.verdict]) : null;
  const blur = () => (document.activeElement as HTMLElement | null)?.blur();
  const a = it.analysis;
  const ctx = itemCtx(it);
  const tips = isChange(it) ? CHANGE_TIP : VERDICT_TIP;
  let words: HTMLTextAreaElement | null = null;
  if (v && field) {
    const copy = fieldCopy(it, field);
    words = h('textarea', {
      id: 'verdict-words',
      class: `field ${field === 'wording' ? 'mono' : ''}`,
      rows:
        field === 'wording' ? Math.min(8, Math.max(3, (v[field] ?? '').split('\n').length + 1)) : 2,
      placeholder: copy.placeholder,
      'aria-label': copy.label,
      oninput: (e: Event) => {
        v[field] = (e.target as HTMLTextAreaElement).value;
        changed();
      },
      onkeydown: fieldKeys(blur, blur),
    }) as HTMLTextAreaElement;
    words.value = v[field] ?? '';
  }
  const side =
    v?.verdict === 'accept' || v?.verdict === 'amend'
      ? 'yes'
      : v?.verdict === 'decline'
        ? 'no'
        : '';
  const consequence = (which: 'yes' | 'no', text: string) =>
    h(
      'button',
      {
        class: `conseq c-${which} ${side === which ? 'picked' : ''}`,
        tip: 'Click to read it in full',
        onclick: (e: Event) => (e.currentTarget as HTMLElement).classList.toggle('full'),
      },
      h(
        'span',
        { class: 'eyebrow' },
        which === 'yes'
          ? isChange(it)
            ? 'If approved'
            : 'If accepted'
          : isChange(it)
            ? 'If rejected'
            : 'If declined',
      ),
      h('span', { class: 'conseq-text' }, linked(text, ctx)),
    );
  const hasConseq = Boolean(a?.ifAccepted || a?.ifDeclined);
  return h(
    'div',
    {
      class: `ruling ${v ? `ruled v-${v.verdict}` : 'unruled'}`,
      role: 'region',
      'aria-label': 'Your ruling',
    },
    hasConseq
      ? collapsible(
          'Consequences',
          h(
            'div',
            { class: 'conseqs' },
            a?.ifAccepted ? consequence('yes', a.ifAccepted) : null,
            a?.ifDeclined ? consequence('no', a.ifDeclined) : null,
          ),
          true,
          0,
          'dock-consequences',
        )
      : null,
    h(
      'div',
      { class: 'ruling-head' },
      h('span', { class: 'ruling-title' }, 'Your ruling'),
      v
        ? h('span', { class: `vchip v-${v.verdict}` }, `✓ ${verdictLabel(it, v.verdict)}`)
        : h('span', { class: 'muted small' }, 'not ruled yet'),
      a?.recommendation && !v
        ? h(
            'span',
            { class: 'muted small' },
            `· agent recommends ${verdictLabel(it, a.recommendation.verdict)}`,
          )
        : null,
      h('span', { class: 'grow' }),
      v
        ? h(
            'button',
            {
              class: 'btn ghost sm',
              tip: 'Clear this ruling (u)',
              onclick: () => {
                setVerdict(it.id, null);
                render();
              },
            },
            'Clear',
            h('kbd', {}, 'u'),
          )
        : null,
      h(
        'button',
        {
          class: 'btn ghost sm',
          tip: 'Go to the next item without a ruling (n)',
          onclick: nextUnreviewed,
        },
        'Next',
        h('kbd', {}, 'n'),
      ),
    ),
    h(
      'div',
      { class: 'verdicts' },
      VERDICT_KEYS.map(([k, key]) =>
        h(
          'button',
          {
            class: `vbtn v-${k} ${v?.verdict === k ? 'on' : ''} ${a?.recommendation?.verdict === k ? 'rec' : ''}`,
            'aria-pressed': v?.verdict === k ? 'true' : 'false',
            tip: tips[k],
            onclick: () => pickVerdict(it, k),
          },
          h('span', { class: 'vb-mark' }, v?.verdict === k ? '✓' : ''),
          h('span', { class: 'vb-label' }, capitalize(verdictLabel(it, k))),
          h('kbd', {}, key),
        ),
      ),
    ),
    words && field
      ? [h('label', { class: 'lbl', for: 'verdict-words' }, fieldCopy(it, field).label), words]
      : null,
    v
      ? h('input', {
          class: 'field note-field',
          placeholder: 'Note to the agent (optional)',
          value: v.note ?? '',
          oninput: (e: Event) => {
            v.note = (e.target as HTMLInputElement).value;
            changed();
          },
          onkeydown: fieldKeys(blur, blur),
        })
      : null,
  );
}

function pickVerdict(it: Item, k: VerdictKind): void {
  setVerdict(it.id, k);
  render();
  if (k !== 'accept') setTimeout(() => document.getElementById('verdict-words')?.focus(), 0);
}

function nextUnreviewed(): void {
  const order = displayOrder();
  const pos = Math.max(0, order.indexOf(S.current));
  for (let d = 1; d <= order.length; d++) {
    const i = order[(pos + d) % order.length] as number;
    if (!verdictOf((items()[i] as Item).id)) {
      select(i);
      return;
    }
  }
  toast('Every item has a ruling. Press 4 to review and submit.');
}

// The side pane: evidence and context beside the item.

function sideRefs(it: Item): (Ref | Focus)[] {
  const seen = new Set<string>();
  const out: (Ref | Focus)[] = [];
  const all: (Ref | Focus)[] = [
    ...it.evidence,
    ...(it.context ?? []),
    ...(it.proposal?.edits.map((e) => ({ path: e.path, quote: e.before })) ?? []),
    ...(it.changes?.map((c) => ({ path: c.path })) ?? []),
  ];
  for (const r of all) {
    if (seen.has(r.path) || fileText(r.path) === undefined) continue;
    seen.add(r.path);
    out.push(r);
  }
  return out;
}

function sidePane(it: Item): HTMLElement {
  const refs = sideRefs(it);
  if (S.side && fileText(S.side) === undefined) S.side = null;
  if (!S.side) {
    S.side = refs[0]?.path ?? null;
    S.focus = refs[0] ?? null;
  }
  const path = S.side;
  const tabs: (Ref | Focus)[] =
    !path || refs.some((r) => r.path === path) ? refs : [...refs, { path }];
  return h(
    'aside',
    { class: 'side' },
    h(
      'div',
      { class: 'side-tabs' },
      tabs.length === 0
        ? h('span', { class: 'muted small pad' }, 'Nothing to show beside this item.')
        : null,
      tabs.map((r) =>
        h(
          'button',
          {
            class: `stab ${r.path === path ? 'on' : ''}`,
            title: r.path,
            onclick: () => showBeside(r),
          },
          r.path.split('/').pop() as string,
        ),
      ),
    ),
    path
      ? h(
          'div',
          { class: 'side-path' },
          h('span', { class: 'mono small' }, path),
          h('span', { class: 'grow' }),
          langOf(path) === 'markdown'
            ? h(
                'button',
                { class: 'btn ghost sm', onclick: toggleRaw },
                S.raw ? 'Prose' : 'Source',
                h('kbd', {}, 'v'),
              )
            : null,
          h('button', { class: 'btn ghost sm', onclick: () => openFile(path) }, 'Open in Files'),
        )
      : null,
    path
      ? h(
          'div',
          { class: 'side-body', 'data-scroll': `side:${path}` },
          fileView(path, { extra: focusMarks(path) }),
        )
      : null,
  );
}

function focusMarks(path: string): Range[] {
  if (S.focus?.path !== path) return [];
  const r = refRange(S.focus, fileText(path) ?? '');
  return r ? [{ ...r, cls: 'focus' }] : [];
}

function toggleRaw(): void {
  S.raw = !S.raw;
  scrollWanted = true;
  render();
}

// ---------------------------------------------------------------------------
// Files: the whole snapshot, browsable and annotatable.

type TreeNode = { name: string; path: string; dirs: Map<string, TreeNode>; files: string[] };

function buildTree(paths: string[]): TreeNode {
  const top: TreeNode = { name: '', path: '', dirs: new Map(), files: [] };
  for (const p of paths) {
    const parts = p.split('/');
    let node = top;
    for (let i = 0; i < parts.length - 1; i++) {
      const name = parts[i] as string;
      let next = node.dirs.get(name);
      if (!next) {
        next = { name, path: parts.slice(0, i + 1).join('/'), dirs: new Map(), files: [] };
        node.dirs.set(name, next);
      }
      node = next;
    }
    node.files.push(p);
  }
  return top;
}

function revealDir(path: string): void {
  const parts = path.split('/');
  for (let i = 1; i < parts.length; i++) S.openDirs.add(parts.slice(0, i).join('/'));
}

function filteredPaths(): string[] {
  const q = S.filter.trim().toLowerCase();
  return [...FILES.keys()].filter((p) => !q || p.toLowerCase().includes(q));
}

function filesNav(): HTMLElement {
  const q = S.filter.trim();
  const paths = filteredPaths();
  const counts = new Map<string, number>();
  for (const a of S.review.annotations) {
    if (a.target.kind !== 'file') continue;
    const parts = a.target.path.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const k = parts.slice(0, i).join('/');
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const cited = new Set(items().flatMap((it) => sideRefs(it).map((r) => r.path)));
  const walk = (node: TreeNode, depth: number): HTMLElement[] => {
    const out: HTMLElement[] = [];
    for (const d of [...node.dirs.values()].sort((a, b) => a.name.localeCompare(b.name))) {
      const open = q !== '' || S.openDirs.has(d.path);
      out.push(
        h(
          'button',
          {
            class: `tn dir ${open ? 'open' : ''}`,
            style: `--d:${depth}`,
            onclick: () => {
              if (S.openDirs.has(d.path)) S.openDirs.delete(d.path);
              else S.openDirs.add(d.path);
              render();
            },
          },
          icon('chev'),
          h('span', { class: 'tn-name' }, d.name),
          counts.get(d.path) ? h('span', { class: 'badge' }, String(counts.get(d.path))) : null,
        ),
      );
      if (open) out.push(...walk(d, depth + 1));
    }
    for (const f of node.files) {
      out.push(
        h(
          'button',
          {
            class: `tn file ${f === S.file ? 'on' : ''}`,
            style: `--d:${depth}`,
            title: f,
            onclick: () => openFile(f),
          },
          h('span', { class: `lang-dot l-${langOf(f)}` }),
          h('span', { class: 'tn-name' }, f.split('/').pop() as string),
          cited.has(f) ? h('span', { class: 'cite', title: 'Cited by an item' }) : null,
          counts.get(f) ? h('span', { class: 'badge' }, String(counts.get(f))) : null,
        ),
      );
    }
    return out;
  };
  const filter = h('input', {
    id: 'file-filter',
    class: 'field filter',
    placeholder: 'Filter files   /',
    value: S.filter,
    oninput: (e: Event) => {
      const input = e.target as HTMLInputElement;
      S.filter = input.value;
      const pos = input.selectionStart;
      render();
      const el = document.getElementById('file-filter') as HTMLInputElement | null;
      el?.focus();
      if (el && pos !== null) el.setSelectionRange(pos, pos);
    },
    onkeydown: (e: KeyboardEvent) => {
      if (e.key === 'Escape') (e.target as HTMLElement).blur();
      if (e.key === 'Enter' && paths[0]) openFile(paths[0]);
    },
  });
  const omitted = S.packet.omitted ?? [];
  return h(
    'aside',
    { class: 'nav files-nav', 'data-scroll': 'files-nav' },
    h(
      'div',
      { class: 'filter-wrap' },
      filter,
      h('div', { class: 'small muted' }, `${paths.length} of ${FILES.size} files`),
    ),
    h('div', { class: 'tree' }, walk(buildTree(paths), 0)),
    omitted.length
      ? h(
          'details',
          { class: 'omitted' },
          h('summary', { class: 'small muted' }, `${omitted.length} not in the snapshot`),
          omitted.map((o) => h('div', { class: 'small muted mono' }, `${o.path} — ${o.reason}`)),
        )
      : null,
  );
}

function filesView(): HTMLElement {
  if (!S.file || !FILES.has(S.file)) {
    const keys = [...FILES.keys()];
    S.file = keys.find((p) => p.startsWith('intent/')) ?? keys[0] ?? null;
    if (S.file) revealDir(S.file);
  }
  const path = S.file;
  const notes = path ? annotationsInFile(path) : [];
  const citing = path ? items().filter((it) => sideRefs(it).some((r) => r.path === path)) : [];
  const prose = path !== null && langOf(path) === 'markdown' && !S.raw;
  return h(
    'div',
    { class: 'layout files' },
    filesNav(),
    h(
      'main',
      { class: 'center file-center', 'data-scroll': `file:${path}` },
      path
        ? h(
            'div',
            { class: 'file-head' },
            h('span', { class: 'mono' }, path),
            h('span', { class: 'grow' }),
            langOf(path) === 'markdown'
              ? h(
                  'button',
                  { class: 'btn ghost sm', onclick: toggleRaw },
                  S.raw ? 'Show as prose' : 'Show source',
                  h('kbd', {}, 'v'),
                )
              : h('span', { class: 'tag' }, langOf(path)),
          )
        : null,
      path
        ? h(
            'div',
            { class: prose ? 'doc file-doc' : 'file-code' },
            fileView(path, { extra: focusMarks(path) }),
          )
        : h('p', { class: 'muted pad' }, 'The packet carries no files.'),
    ),
    h(
      'aside',
      { class: 'side side-notes' },
      h('div', { class: 'side-path' }, h('span', { class: 'h2' }, 'In this file')),
      h(
        'div',
        { class: 'side-body pad' },
        notes.length
          ? noteList(notes)
          : h(
              'p',
              { class: 'muted small' },
              'No notes yet. Select text and press c, q, s, i (intent here), or x (mismatch).',
            ),
        citing.length
          ? [
              h('h3', {}, 'Items citing this file'),
              h(
                'ul',
                { class: 'rel' },
                citing.map((it) =>
                  h(
                    'li',
                    {},
                    h(
                      'button',
                      { class: 'ref', onclick: () => select(items().indexOf(it)) },
                      shortId(it.id),
                    ),
                    h('span', {}, it.title),
                  ),
                ),
              ),
            ]
          : null,
      ),
    ),
  );
}

function openFile(path: string): void {
  S.view = 'files';
  S.file = path;
  if (S.focus?.path !== path) S.focus = null;
  revealDir(path);
  scrollWanted = true;
  render();
}

// ---------------------------------------------------------------------------
// Dashboard

const STATUSES: LedgerRow['status'][] = ['pending', 'ruled', 'adjudicated', 'declined'];

function dashboardView(): HTMLElement {
  const ledger = S.packet.ledger ?? [];
  const by = (s: LedgerRow['status']) => ledger.filter((r) => r.status === s);
  const idCell = (r: LedgerRow) => {
    const i = items().findIndex((x) => x.id === r.id);
    const v = i >= 0 ? verdictOf(r.id) : undefined;
    return i >= 0
      ? h(
          'button',
          { class: 'ref', onclick: () => select(i) },
          shortId(r.id),
          v ? h('span', { class: `vchip v-${v.verdict}` }, v.verdict) : null,
        )
      : h('span', { class: 'mono small' }, shortId(r.id));
  };
  const slices = new Map<string, LedgerRow[]>();
  for (const r of ledger) {
    for (const s of r.slices.length ? r.slices : ['(no slice cited)']) {
      slices.set(s, [...(slices.get(s) ?? []), r]);
    }
  }
  const matrix = h(
    'table',
    { class: 'matrix' },
    h(
      'thead',
      {},
      h(
        'tr',
        {},
        h('th', {}, 'Intent slice'),
        STATUSES.map((s) => h('th', {}, s)),
      ),
    ),
    h(
      'tbody',
      {},
      [...slices.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([slice, rows]) =>
          h(
            'tr',
            {},
            h(
              'td',
              {},
              FILES.has(slice)
                ? h(
                    'button',
                    { class: 'ref', onclick: () => openFile(slice) },
                    slice.replace(/^intent\//, ''),
                  )
                : h('span', { class: 'muted small' }, slice),
            ),
            STATUSES.map((s) => {
              const rs = rows.filter((r) => r.status === s);
              if (!rs.length) return h('td', { class: 'num muted' }, '·');
              return h(
                'td',
                { class: `num st-${s}` },
                h(
                  'span',
                  { title: rs.map((r) => `${shortId(r.id)} — ${r.title}`).join('\n') },
                  String(rs.length),
                ),
              );
            }),
          ),
        ),
    ),
  );
  return h(
    'main',
    { class: 'page', 'data-scroll': 'dash' },
    h(
      'div',
      { class: 'page-inner' },
      h('h1', {}, 'Spec-feedback across the repository'),
      h(
        'p',
        { class: 'lead' },
        'Every SF in every design entry, by where it stands and by the intent slice it questions.',
      ),
      ledger.length === 0 ? h('p', { class: 'muted' }, 'The packet carries no ledger.') : null,
      h(
        'div',
        { class: 'cards' },
        STATUSES.map((s) =>
          h(
            'div',
            { class: `stat st-${s}` },
            h('div', { class: 'n' }, String(by(s).length)),
            h('div', { class: 'l' }, s),
          ),
        ),
      ),
      ledger.length ? [h('h2', {}, 'By intent slice'), matrix, h('h2', {}, 'By status')] : null,
      STATUSES.filter((s) => by(s).length).map((s) =>
        collapsible(
          `${capitalize(s)} · ${by(s).length}`,
          h(
            'table',
            { class: 'list' },
            h(
              'tbody',
              {},
              by(s).map((r) =>
                h(
                  'tr',
                  {},
                  h('td', { class: 'nowrap' }, idCell(r)),
                  h('td', {}, linked(r.title, { entry: r.entry, dir: `design/${r.entry}` })),
                  h(
                    'td',
                    { class: 'mono small muted' },
                    r.slices.map((x) => x.replace(/^intent\//, '')).join(', '),
                  ),
                ),
              ),
            ),
          ),
          s === 'pending' || s === 'ruled',
        ),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Review & submit

const OVERALL_COPY: Record<OverallKind, [string, string]> = {
  approve: ['Approve', 'Ready to merge as far as intent and design go.'],
  'request-changes': ['Request changes', 'The agent fixes the branch before it merges.'],
  comment: ['Comment only', 'Notes, no merge verdict.'],
};

function textArea(
  value: string,
  rows: number,
  placeholder: string,
  onInput: (v: string) => void,
): HTMLTextAreaElement {
  const t = h('textarea', {
    class: 'field',
    rows,
    placeholder,
    oninput: (e: Event) => onInput((e.target as HTMLTextAreaElement).value),
  }) as HTMLTextAreaElement;
  t.value = value;
  return t;
}

function submitView(): HTMLElement {
  const unreviewed = items().filter((it) => !verdictOf(it.id));
  const counts = new Map<string, number>();
  for (const v of S.review.verdicts) counts.set(v.verdict, (counts.get(v.verdict) ?? 0) + 1);
  return h(
    'main',
    { class: 'page', 'data-scroll': 'submit' },
    h(
      'div',
      { class: 'page-inner narrow' },
      h('h1', {}, 'Review & submit'),
      h(
        'p',
        { class: 'lead' },
        `${S.review.verdicts.length} of ${items().length} items ruled · ${S.review.annotations.length} notes. Submitting hands everything to the agent, which carries it out and may come back with a smaller packet.`,
      ),
      counts.size
        ? h(
            'div',
            { class: 'cards' },
            [...counts.entries()].map(([k, n]) =>
              h(
                'div',
                { class: `stat v-${k}` },
                h('div', { class: 'n' }, String(n)),
                h('div', { class: 'l' }, k),
              ),
            ),
          )
        : null,
      h('h2', {}, 'Rulings'),
      h(
        'div',
        { class: 'rows' },
        items().map((it, i) => {
          const v = verdictOf(it.id);
          const words = v ? (v.wording ?? v.why ?? v.ruling ?? v.request ?? '') : '';
          return h(
            'button',
            { class: `srow ${v ? '' : 'todo'}`, onclick: () => select(i) },
            v
              ? h('span', { class: `vchip v-${v.verdict}` }, verdictLabel(it, v.verdict))
              : h('span', { class: 'vchip' }, 'unreviewed'),
            h(
              'span',
              { class: 'srow-title' },
              h('span', { class: 'mono small muted' }, shortId(it.id)),
              ' ',
              it.title,
            ),
            words
              ? h(
                  'span',
                  { class: 'srow-words' },
                  words.length > 200 ? `${words.slice(0, 200)}…` : words,
                )
              : null,
          );
        }),
      ),
      unreviewed.length
        ? h(
            'p',
            { class: 'muted small' },
            `${unreviewed.length} unreviewed — they stay as they are and come back next time.`,
          )
        : null,
      h('h2', {}, `Notes · ${S.review.annotations.length}`),
      S.review.annotations.length
        ? noteList(S.review.annotations)
        : h('p', { class: 'muted small' }, 'None.'),
      S.packet.mode === 'branch' ? overallPanel() : null,
      h('h2', {}, 'Hand it back'),
      h('label', { class: 'lbl' }, 'Reviewer — recorded on rulings'),
      h('input', {
        class: 'field',
        value: S.review.reviewer,
        placeholder: 'Your name',
        oninput: (e: Event) => {
          S.review.reviewer = (e.target as HTMLInputElement).value;
          changed();
        },
      }),
      h('label', { class: 'lbl' }, 'Anything else for the agent (optional)'),
      textArea(S.review.comment ?? '', 3, '', (v) => {
        S.review.comment = v;
        changed();
      }),
      S.errors.length
        ? h(
            'div',
            { class: 'errors' },
            h('strong', {}, 'Not submitted yet — fix these first:'),
            h(
              'ul',
              {},
              S.errors.map((e) =>
                h('li', {}, h('span', { class: 'mono' }, describePath(e.path)), ' — ', e.message),
              ),
            ),
          )
        : null,
      h(
        'div',
        { class: 'row submit-row' },
        h(
          'button',
          { class: 'btn primary big', onclick: submit },
          'Submit — give this back to the agent',
        ),
        h('span', { class: 'grow' }),
        h('button', { class: 'btn ghost danger', onclick: abandon }, 'Abandon (keep draft)'),
      ),
      h('p', { class: 'small muted' }, `Draft autosaves to ${S.draftPath}`),
    ),
  );
}

function overallPanel(): HTMLElement {
  const c = S.packet.change;
  const cur = S.review.overall;
  return h(
    'section',
    {},
    h('h2', {}, 'Overall verdict on the branch'),
    c?.recommendation
      ? h(
          'p',
          { class: 'small' },
          h(
            'span',
            { class: `vchip o-${c.recommendation.verdict}` },
            `agent: ${c.recommendation.verdict}`,
          ),
          ' ',
          c.recommendation.why,
        )
      : null,
    h(
      'div',
      { class: 'choices' },
      OVERALL.map((o) =>
        h(
          'button',
          {
            class: `choice o-${o} ${cur?.verdict === o ? 'on' : ''}`,
            onclick: () => {
              S.review.overall = { ...(S.review.overall ?? {}), verdict: o };
              changed();
              render();
            },
          },
          h('strong', {}, OVERALL_COPY[o][0]),
          h('span', { class: 'small muted' }, OVERALL_COPY[o][1]),
        ),
      ),
    ),
    cur
      ? textArea(
          cur.note ?? '',
          3,
          'Notes for the branch — what to fix, what to say on the review…',
          (v) => {
            if (S.review.overall) S.review.overall.note = v;
            changed();
          },
        )
      : null,
  );
}

function describePath(path: string): string {
  const v = /^verdicts\[(\d+)\]/.exec(path);
  if (v) {
    const x = S.review.verdicts[Number(v[1])];
    if (x) return `${shortId(x.item)} (${x.verdict})`;
  }
  const a = /^annotations\[(\d+)\]/.exec(path);
  if (a) {
    const x = S.review.annotations[Number(a[1])];
    if (x) return `note ${x.id}`;
  }
  return path;
}

async function submit(): Promise<void> {
  clearTimeout(saveTimer);
  const r = await api<{ out?: string; errors?: ValidationError[] }>(
    'POST',
    '/api/submit',
    S.review,
  );
  if (r.status === 200) {
    S.ended = `Submitted. Decisions are in ${r.data.out}; the agent takes it from here. You can close this tab.`;
  } else {
    S.errors = r.data.errors ?? [{ path: '$', message: `submit failed (${r.status})` }];
  }
  render();
}

async function abandon(): Promise<void> {
  if (!confirm('Abandon this review? Nothing is submitted; your draft is kept for next time.'))
    return;
  clearTimeout(saveTimer);
  await api('PUT', '/api/draft', S.review).catch(() => undefined);
  await api('POST', '/api/abandon');
  S.ended = `Abandoned. Nothing was submitted; the draft is kept at ${S.draftPath}.`;
  render();
}

function helpModal(): HTMLElement | null {
  if (!S.help) return null;
  return h(
    'div',
    {
      class: 'modal',
      onclick: () => {
        S.help = false;
        render();
      },
    },
    h(
      'div',
      { class: 'modal-box' },
      h(
        'div',
        { class: 'modal-head' },
        h('strong', {}, 'Keyboard'),
        h('span', { class: 'muted small' }, 'More on the home page (1)'),
      ),
      keysTable(),
    ),
  );
}

// ---------------------------------------------------------------------------
// Navigation, rendering, keys

function go(v: View): void {
  S.view = v;
  if (v !== 'submit') S.errors = [];
  scrollWanted = true;
  render();
}

function select(i: number): void {
  if (i < 0 || i >= items().length) return;
  S.view = 'queue';
  S.current = i;
  S.side = null;
  scrollWanted = true;
  render();
  document.querySelector('.qi.on')?.scrollIntoView({ block: 'nearest' });
  document.querySelector<HTMLElement>('main.center')?.scrollTo(0, 0);
}

let scrollWanted = true;
const scrollMemo = new Map<string, number>();

function render(): void {
  hidePeek();
  hideToolbar();
  for (const el of root.querySelectorAll<HTMLElement>('[data-scroll]')) {
    scrollMemo.set(el.dataset.scroll as string, el.scrollTop);
  }
  if (S.ended) {
    root.replaceChildren(
      h(
        'div',
        { class: 'ended' },
        h('div', { class: 'ended-mark' }, '✓'),
        h('h1', {}, 'Review ended'),
        h('p', {}, S.ended),
      ),
    );
    return;
  }
  const body =
    S.view === 'home'
      ? homeView()
      : S.view === 'queue'
        ? queueView()
        : S.view === 'files'
          ? filesView()
          : S.view === 'dashboard'
            ? dashboardView()
            : submitView();
  const banner = S.banner
    ? h(
        'div',
        { class: 'banner' },
        h('span', {}, S.banner),
        h(
          'button',
          {
            class: 'btn ghost sm',
            onclick: () => {
              S.banner = null;
              render();
            },
          },
          'Dismiss',
        ),
      )
    : '';
  root.replaceChildren(
    header(),
    banner,
    h('div', { class: `main ${S.drawer ? 'with-drawer' : ''}` }, body, drawer() ?? ''),
    themePicker() ?? '',
    editorModal() ?? '',
    helpModal() ?? '',
  );
  paintChrome();
  for (const el of root.querySelectorAll<HTMLElement>('[data-scroll]')) {
    const top = scrollMemo.get(el.dataset.scroll as string);
    if (top !== undefined) el.scrollTop = top;
  }
  if (scrollWanted) {
    scrollWanted = false;
    scrollToFocus();
  }
}

function scrollToFocus(): void {
  const pane = document.querySelector<HTMLElement>(
    S.view === 'files' ? '.file-center' : '.side-body',
  );
  if (!pane) return;
  const hit = pane.querySelector<HTMLElement>('.focus');
  if (hit) {
    hit.scrollIntoView({ block: 'center' });
    return;
  }
  const f = S.focus;
  if (f?.section) {
    const off = findSection(fileText(f.path) ?? '', f.section);
    if (off !== null) {
      pane.querySelector<HTMLElement>(`[data-start="${off}"]`)?.scrollIntoView({ block: 'start' });
      return;
    }
  }
  pane.scrollTop = 0;
}

function toast(msg: string): void {
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 2800);
}

function stepFile(d: number): void {
  const paths = filteredPaths();
  const next = paths[Math.min(Math.max(paths.indexOf(S.file ?? '') + d, 0), paths.length - 1)];
  if (next) openFile(next);
}

function onKey(e: KeyboardEvent): void {
  if (S.ended) return;
  const t = e.target as HTMLElement;
  if (t.closest('input, textarea, [contenteditable]')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (editor) {
    if (e.key === 'Escape') closeEditor();
    return;
  }
  if (e.key === 'Escape') {
    if (S.help || S.drawer || S.picker) {
      S.help = false;
      S.drawer = false;
      S.picker = false;
      render();
    }
    hideToolbar();
    return;
  }
  const it = currentItem();
  const verdict = VERDICT_KEYS.find(([, k]) => k === e.key);
  if (verdict && S.view === 'queue' && it) {
    e.preventDefault();
    pickVerdict(it, verdict[0]);
    return;
  }
  const ann = ANN_KEYS.find(([, k]) => k === e.key);
  if (ann) {
    e.preventDefault();
    openEditor(ann[0]);
    return;
  }
  const actions: Record<string, () => void> = {
    j: () => (S.view === 'files' ? stepFile(1) : step(1)),
    k: () => (S.view === 'files' ? stepFile(-1) : step(-1)),
    n: nextUnreviewed,
    u: () => {
      if (it && S.view === 'queue') {
        setVerdict(it.id, null);
        render();
      }
    },
    '1': () => go('home'),
    '2': () => go('queue'),
    '3': () => go('files'),
    '4': () => go('dashboard'),
    '5': () => go('submit'),
    p: toggleDrawer,
    v: toggleRaw,
    '/': () => {
      if (S.view !== 'files') go('files');
      document.getElementById('file-filter')?.focus();
    },
    t: () => {
      S.picker = !S.picker;
      render();
    },
    '?': () => {
      S.help = !S.help;
      render();
    },
  };
  const act = actions[e.key];
  if (act) {
    e.preventDefault();
    act();
  }
}

// ---------------------------------------------------------------------------
// Boot

async function boot(): Promise<void> {
  injectThemes(THEMES);
  const systemDark = matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(systemDark ? DEFAULT_DARK : DEFAULT_LIGHT, false);
  const p = await api<{ packet: Packet; digest: string; draftPath: string }>('GET', '/api/packet');
  if (p.status !== 200) {
    root.replaceChildren(
      h(
        'div',
        { class: 'ended' },
        h('h1', {}, 'Cannot load the review'),
        h('p', {}, 'Open the exact URL the review tool printed — it carries the access token.'),
      ),
    );
    return;
  }
  const d = await api<{
    draft: (ReviewState & { packet: { digest: string } }) | null;
    stale: boolean;
    error?: string;
  }>('GET', '/api/draft');
  const th = await api<{
    themes: Theme[];
    initial: string | null;
    dir: string | null;
    prefs: { theme?: string };
  }>('GET', '/api/themes');
  const draft = d.data.draft;
  const packet = p.data.packet;
  FILES = new Map(packet.files.map((f) => [f.path, f.text]));
  IDX = buildIndex(
    packet.files.map((f) => f.path),
    [...(packet.ledger ?? []).map((r) => r.id), ...packet.items.map((i) => i.id)],
    packet.items.map((i) => i.id),
  );
  injectThemes([...THEMES, ...(th.data.themes ?? [])]);
  const known = (id: string | null | undefined) =>
    !!id && [...THEMES, ...(th.data.themes ?? [])].some((t) => t.id === id);
  const startTheme = known(th.data.initial)
    ? th.data.initial
    : known(th.data.prefs?.theme)
      ? th.data.prefs.theme
      : null;
  if (startTheme) applyTheme(startTheme, false);
  const restored = draft
    ? d.data.stale
      ? 'Restored a draft made against a different version of this packet. Rulings and notes were kept — check them against the current items.'
      : 'Welcome back — your draft is restored.'
    : null;
  S = {
    packet,
    digest: p.data.digest,
    draftPath: p.data.draftPath,
    review: {
      reviewer: draft?.reviewer || packet.reviewer || '',
      verdicts: (draft?.verdicts ?? []).filter((v) => packet.items.some((i) => i.id === v.item)),
      annotations: draft?.annotations ?? [],
    },
    view: 'home',
    current: 0,
    file: null,
    side: null,
    focus: null,
    filter: '',
    openDirs: new Set(['intent']),
    raw: false,
    drawer: false,
    saved: draft ? 'saved' : 'idle',
    banner: d.data.error ?? restored,
    errors: [],
    ended: null,
    help: false,
    theme: document.documentElement.dataset.theme ?? DEFAULT_LIGHT,
    picker: false,
    customThemes: th.data.themes ?? [],
    themeDir: th.data.dir ?? null,
    folds: loadFolds(),
  };
  if (draft?.comment) S.review.comment = draft.comment;
  if (draft?.overall) S.review.overall = draft.overall;
  S.current = displayOrder()[0] ?? 0;
  applyHash();
  document.title = packet.title;
  document.addEventListener('keydown', onKey);
  initTips();
  document.addEventListener('mousedown', (e) => {
    if (S.picker && !(e.target as HTMLElement).closest('.picker, .theme-btn')) {
      S.picker = false;
      render();
    }
  });
  document.addEventListener('mouseup', () => setTimeout(showToolbar, 0));
  document.addEventListener('keyup', (e) => {
    if (e.shiftKey) setTimeout(showToolbar, 0);
  });
  document.addEventListener('selectionchange', () => {
    if (window.getSelection()?.isCollapsed) hideToolbar();
  });
  render();
}

/**
 * Deep links: `#item=<id>`, `#file=<path>`, `#view=home|queue|files|dashboard|submit`,
 * `#drawer`, `#theme=<id>` — so an agent can point at a specific spot.
 */
function applyHash(): void {
  const q = new URLSearchParams(location.hash.slice(1));
  const item = q.get('item');
  const file = q.get('file');
  const view = q.get('view');
  const theme = q.get('theme');
  if (item) {
    const i = items().findIndex((x) => x.id === item);
    if (i >= 0) {
      S.current = i;
      S.view = 'queue';
    }
  }
  if (file && FILES.has(file)) {
    S.view = 'files';
    S.file = file;
    revealDir(file);
  }
  if (TABS.some(([v]) => v === view)) S.view = view as View;
  if (q.has('drawer')) S.drawer = true;
  if (theme && allThemes().some((t) => t.id === theme)) applyTheme(theme, false);
}

boot().catch((e: unknown) => {
  root.textContent = `The review page failed to start: ${e instanceof Error ? e.message : String(e)}`;
});
