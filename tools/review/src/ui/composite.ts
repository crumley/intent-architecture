// Composite text: what the page renders when one view stitches several sources
// together — a word diff (the current wording from the file, the proposed wording
// from the packet, deleted words from neither), or a file shown after an item's
// edits (the file's own text around the agent's new wording). Each piece remembers
// where its text came from, so a selection in the view maps back to exact text in
// exactly one anchor target, or says why it cannot. Pure (no DOM), so it is tested.

import { type AlignedPart, diffAligned } from '../diff.ts';
import type { AnnotationTarget } from '../schema.ts';

/** A run of rendered text: its class, and — when it can carry a note — its source. */
export type Piece = {
  text: string;
  cls?: string;
  /** The anchor target this run's text comes from, verbatim; none for text that exists nowhere (deleted words). */
  target?: AnnotationTarget;
  /** Offset of the run's first character in the target's text. */
  off?: number;
};

export type Composite = { text: string; pieces: (Piece & { start: number })[] };

export function composite(pieces: Piece[]): Composite {
  let at = 0;
  const out: (Piece & { start: number })[] = [];
  for (const p of pieces) {
    if (!p.text) continue;
    out.push({ ...p, start: at });
    at += p.text.length;
  }
  return { text: out.map((p) => p.text).join(''), pieces: out };
}

export const targetKey = (t: AnnotationTarget): string =>
  t.kind === 'file'
    ? `file:${t.path}`
    : t.kind === 'item'
      ? `item:${t.item}#${t.section}`
      : `field:${t.item}#${t.field}`;

export type Mapped =
  | { ok: true; target: AnnotationTarget; start: number; end: number }
  | { ok: false; why: 'nothing' | 'mixed'; targets?: AnnotationTarget[] };

/**
 * Map a rendered range [start, end) to a range in one target. Text with no source
 * (deleted words) inside the range is skipped; a range that touches two sources
 * cannot be anchored and says which two.
 */
export function mapRange(c: Composite, start: number, end: number): Mapped {
  const hit = c.pieces.filter((p) => p.target && p.start < end && p.start + p.text.length > start);
  if (!hit.length) return { ok: false, why: 'nothing' };
  const keys = new Set(hit.map((p) => targetKey(p.target as AnnotationTarget)));
  if (keys.size > 1) {
    const seen = new Map<string, AnnotationTarget>();
    for (const p of hit)
      seen.set(targetKey(p.target as AnnotationTarget), p.target as AnnotationTarget);
    return { ok: false, why: 'mixed', targets: [...seen.values()] };
  }
  const first = hit[0] as Piece & { start: number };
  const last = hit[hit.length - 1] as Piece & { start: number };
  const s = (first.off ?? 0) + Math.max(0, start - first.start);
  const e = (last.off ?? 0) + Math.min(last.text.length, end - last.start);
  return { ok: true, target: first.target as AnnotationTarget, start: s, end: e };
}

/** Rendered ranges showing where [start, end) of a target's text appears in the view. */
export function rangesFor(
  c: Composite,
  target: AnnotationTarget,
  start: number,
  end: number,
): { start: number; end: number }[] {
  const key = targetKey(target);
  const out: { start: number; end: number }[] = [];
  for (const p of c.pieces) {
    if (!p.target || targetKey(p.target) !== key) continue;
    const off = p.off ?? 0;
    const s = Math.max(start, off);
    const e = Math.min(end, off + p.text.length);
    if (s < e) out.push({ start: p.start + (s - off), end: p.start + (e - off) });
  }
  return out;
}

/** The distinct targets a composite draws from. */
export function targetsOf(c: Composite): AnnotationTarget[] {
  const seen = new Map<string, AnnotationTarget>();
  for (const p of c.pieces) if (p.target) seen.set(targetKey(p.target), p.target);
  return [...seen.values()];
}

export type DiffSources = {
  /** Where the current wording lives verbatim (the file, at its offset), if anywhere. */
  before?: { target: AnnotationTarget; off: number };
  /** Where the proposed wording lives verbatim (an edit's `after` field). */
  after?: { target: AnnotationTarget; off: number };
};

const tag = (src: DiffSources['before'], off: number): Partial<Piece> =>
  src ? { target: src.target, off: src.off + off } : {};

/**
 * An edit as one inline run: unchanged and inserted words from the proposed wording,
 * deleted words struck through and carrying no source (they are gone after the edit).
 */
export function inlineDiff(before: string, after: string, src: DiffSources = {}): Composite {
  return composite(
    walk(diffAligned(before, after), (p, _ia, ib) => {
      if (p.op === 'del') return [{ text: p.a, cls: 'w-del' }];
      return [{ text: p.b, cls: p.op === 'ins' ? 'w-ins' : 'w-same', ...tag(src.after, ib) }];
    }),
  );
}

/** An edit as two blocks: the current wording with what goes marked, the proposed with what comes. */
export function splitDiff(
  before: string,
  after: string,
  src: DiffSources = {},
): { before: Composite; after: Composite } {
  const parts = diffAligned(before, after);
  return {
    before: composite(
      walk(parts, (p, ia) =>
        p.op === 'ins'
          ? []
          : [{ text: p.a, cls: p.op === 'del' ? 'w-del' : 'w-same', ...tag(src.before, ia) }],
      ),
    ),
    after: composite(
      walk(parts, (p, _ia, ib) =>
        p.op === 'del'
          ? []
          : [{ text: p.b, cls: p.op === 'ins' ? 'w-ins' : 'w-same', ...tag(src.after, ib) }],
      ),
    ),
  };
}

function walk(
  parts: AlignedPart[],
  f: (p: AlignedPart, ia: number, ib: number) => Piece[],
): Piece[] {
  let ia = 0;
  let ib = 0;
  const out: Piece[] = [];
  for (const p of parts) {
    out.push(...f(p, ia, ib));
    ia += p.a.length;
    ib += p.b.length;
  }
  return out;
}

/** One edit applied to a file: the span it replaces, and where its new wording lives. */
export type Applied = { start: number; end: number; after: string; target?: AnnotationTarget };

/**
 * A file with edits applied, as rendered after the edits: the file's own text
 * between them (anchored to the file), each edit's new wording (anchored to the
 * edit), and — inline — the words it removes, struck and anchored to nothing.
 * Returns the composite and, per edit, where its new run sits in the view.
 */
export function afterEdits(
  path: string,
  text: string,
  edits: Applied[],
  mode: 'inline' | 'split',
): { view: Composite; spans: { start: number; end: number }[] } {
  const file: AnnotationTarget = { kind: 'file', path };
  const pieces: Piece[] = [];
  const marks: { from: number; to: number }[] = [];
  let pos = 0;
  let count = 0; // pieces' rendered length so far
  const add = (p: Piece) => {
    pieces.push(p);
    count += p.text.length;
  };
  for (const e of [...edits].sort((x, y) => x.start - y.start)) {
    if (e.start < pos) continue; // overlapping edits within one item: keep the first
    add({ text: text.slice(pos, e.start), target: file, off: pos });
    const from = count;
    const src: DiffSources = e.target ? { after: { target: e.target, off: 0 } } : {};
    const run =
      mode === 'inline'
        ? inlineDiff(text.slice(e.start, e.end), e.after, src)
        : splitDiff(text.slice(e.start, e.end), e.after, src).after;
    for (const p of run.pieces) add(p);
    marks.push({ from, to: count });
    pos = e.end;
  }
  add({ text: text.slice(pos), target: file, off: pos });
  return { view: composite(pieces), spans: marks.map((m) => ({ start: m.from, end: m.to })) };
}
