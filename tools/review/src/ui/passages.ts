// The passages an item puts in front of the reviewer, and the files that hold them.
// Pure (no DOM), so the numbering the middle pane and the right pane share is tested
// once: edits are numbered first, in the order the item proposes them; then every
// quoted passage under What that no edit already covers; context passages are shown
// but never numbered. A file is either one this decision would edit (or, with no
// edit, the one holding the passage in question) or related context — never both.

import type { ContextRef, Edit, Item, Ref } from '../schema.ts';

export type Role = 'edit' | 'evidence' | 'context';

export type Passage = {
  /** 1-based number shown as ①, ②… — 0 for an unnumbered context passage. */
  n: number;
  path: string;
  start: number;
  end: number;
  role: Role;
  /** Index into nowWhat.edits, for an edit passage. */
  edit?: number;
  /** Indexes into evidence that quote (part of) this passage. */
  evidence: number[];
  /** Index into context, for a context passage. */
  context?: number;
  /** Other items whose edits rewrite overlapping text. */
  also: { item: string; edit: number }[];
};

/** `edit`: this decision would edit it · `question`: holds the passage in question, no edit
 * proposed · `change`: changed on the branch · `related`: shown for context, not edited. */
export type Group = 'edit' | 'question' | 'change' | 'related';

export type PaneFile = { path: string; group: Group; why?: string; passages: Passage[] };

export type ItemPassages = {
  passages: Passage[];
  files: PaneFile[];
  /** The numbered passages, in number order: what the navigator steps through. */
  numbered: Passage[];
};

/** Where a ref points inside its file: the quote, else the line range; null if neither. */
export function rangeOf(r: Ref, text: string): { start: number; end: number } | null {
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

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) =>
  a.start < b.end && b.start < a.end;

export function itemPassages(
  it: Item,
  files: Map<string, string>,
  all: readonly Item[] = [],
): ItemPassages {
  const passages: Passage[] = [];
  const edits: Edit[] = it.nowWhat?.edits ?? [];
  let n = 0;

  edits.forEach((e, i) => {
    const text = files.get(e.path);
    if (text === undefined) return;
    const at = text.indexOf(e.before);
    if (at < 0) return;
    const span = { start: at, end: at + e.before.length };
    const also: Passage['also'] = [];
    for (const other of all) {
      if (other.id === it.id) continue;
      (other.nowWhat?.edits ?? []).forEach((f, j) => {
        if (f.path !== e.path) return;
        const k = text.indexOf(f.before);
        if (k >= 0 && overlaps(span, { start: k, end: k + f.before.length })) {
          also.push({ item: other.id, edit: j });
        }
      });
    }
    passages.push({ n: ++n, path: e.path, ...span, role: 'edit', edit: i, evidence: [], also });
  });

  it.evidence.forEach((r, i) => {
    const text = files.get(r.path);
    if (text === undefined) return;
    const span = rangeOf(r, text);
    if (!span) return;
    const hit = passages.find((p) => p.path === r.path && overlaps(p, span));
    if (hit) hit.evidence.push(i);
    else {
      passages.push({ n: ++n, path: r.path, ...span, role: 'evidence', evidence: [i], also: [] });
    }
  });

  (it.context ?? []).forEach((r: ContextRef, i) => {
    const text = files.get(r.path);
    if (text === undefined) return;
    const span = rangeOf(r, text);
    if (!span) return;
    if (passages.some((p) => p.path === r.path && overlaps(p, span))) return;
    passages.push({
      n: 0,
      path: r.path,
      ...span,
      role: 'context',
      context: i,
      evidence: [],
      also: [],
    });
  });

  // The files, first group first: what the decision edits (or changes, or is about).
  const order: PaneFile[] = [];
  const add = (path: string, group: Group, why?: string) => {
    if (files.get(path) === undefined || order.some((f) => f.path === path)) return;
    const f: PaneFile = { path, group, passages: [] };
    if (why) f.why = why;
    order.push(f);
  };
  if (edits.length) {
    for (const e of edits) add(e.path, 'edit');
  } else if (it.changes?.length) {
    for (const c of it.changes) add(c.path, 'change');
  }
  const primary = order.length > 0;
  for (const r of it.evidence) {
    if (primary) {
      add(r.path, 'related', r.note ?? 'Quoted under What — this decision does not edit it.');
    } else add(r.path, 'question');
  }
  for (const r of it.context ?? []) add(r.path, 'related', r.why);
  for (const p of passages) {
    order.find((f) => f.path === p.path)?.passages.push(p);
  }
  for (const f of order) f.passages.sort((a, b) => a.start - b.start);

  return {
    passages,
    files: order,
    numbered: passages.filter((p) => p.n > 0).sort((a, b) => a.n - b.n),
  };
}

/** The numbered passage a ref lands in, if any: same file, overlapping text. */
export function passageFor(
  ip: ItemPassages,
  r: { path: string; quote?: string; lines?: { start: number; end: number } },
  text: string,
): Passage | undefined {
  const span = rangeOf(r, text);
  const inFile = ip.passages.filter((p) => p.path === r.path);
  if (!span) return undefined;
  return inFile.find((p) => p.n > 0 && overlaps(p, span)) ?? inFile.find((p) => overlaps(p, span));
}
