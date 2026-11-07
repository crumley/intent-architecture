// Quote anchors (TextQuoteSelector-style): an annotation is anchored by the text
// it quotes plus up to CONTEXT characters on each side, never by position alone,
// so it can be re-found after the file is edited (intent principle 7).

import type { Selector } from './schema.ts';

export const CONTEXT = 32;

export type Located =
  | { status: 'exact'; start: number; end: number; line: number }
  | { status: 'context'; start: number; end: number; line: number; text: string }
  | { status: 'orphaned' };

/** Build a selector for text[start, end). */
export function createSelector(text: string, start: number, end: number): Selector {
  return {
    exact: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT), start),
    suffix: text.slice(end, end + CONTEXT),
  };
}

/** 1-based line number of an offset. */
export function lineOf(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** Length of the common suffix of a and b. */
function commonSuffix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}

/** Length of the common prefix of a and b. */
function commonPrefix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

function occurrences(text: string, needle: string): number[] {
  const out: number[] = [];
  if (needle === '') return out;
  for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + 1)) out.push(i);
  return out;
}

/**
 * Re-find a selector in (possibly edited) text. Tries every occurrence of the
 * exact quote, scored by agreement with its recorded surroundings (ties broken
 * by nearness to `hint`); failing that, finds the surroundings themselves and
 * reports what now sits between them; failing that, the anchor is orphaned.
 */
export function locate(text: string, sel: Selector, hint?: number): Located {
  const hits = occurrences(text, sel.exact);
  if (hits.length > 0) {
    let best = hits[0] as number;
    let bestScore = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const at of hits) {
      const before = text.slice(Math.max(0, at - sel.prefix.length), at);
      const after = text.slice(at + sel.exact.length, at + sel.exact.length + sel.suffix.length);
      const score = commonSuffix(before, sel.prefix) + commonPrefix(after, sel.suffix);
      const dist = hint === undefined ? 0 : Math.abs(at - hint);
      if (score > bestScore || (score === bestScore && dist < bestDist)) {
        best = at;
        bestScore = score;
        bestDist = dist;
      }
    }
    return { status: 'exact', start: best, end: best + sel.exact.length, line: lineOf(text, best) };
  }

  // The quote itself changed: look for its surroundings, close together.
  if (sel.prefix.length >= 8 && sel.suffix.length >= 8) {
    const window = Math.max(sel.exact.length * 4, sel.exact.length + 200);
    let best: { start: number; end: number; dist: number } | null = null;
    for (const p of occurrences(text, sel.prefix)) {
      const start = p + sel.prefix.length;
      const s = text.indexOf(sel.suffix, start);
      if (s === -1 || s - start > window) continue;
      const dist = hint === undefined ? 0 : Math.abs(start - hint);
      if (!best || dist < best.dist) best = { start, end: s, dist };
    }
    if (best) {
      return {
        status: 'context',
        start: best.start,
        end: best.end,
        line: lineOf(text, best.start),
        text: text.slice(best.start, best.end),
      };
    }
  }
  return { status: 'orphaned' };
}
