// Cross-references: find the identifiers a reader cannot hold in their head —
// intent-feedback ids (IF-NNN, and the legacy SF-NNN), design entry numbers, ADR numbers, repository paths, Markdown links —
// and resolve each against the packet, so every rendered surface can link them.
// Pure: the index is built from the packet; the page renders and follows links.

import type { Range } from './source.ts';

export type RefIndex = {
  files: Set<string>;
  /** "0031" -> "design/0031-detached-session-hosting" */
  entries: Map<string, string>;
  /** "0006" -> "design/decisions/0006-tmux-detached-host.md" */
  adrs: Map<string, string>;
  /** "0031-detached-session-hosting/IF-005" ids known to the ledger or the items */
  sfs: Set<string>;
  /** basename -> paths, for `file.md` mentions without a directory */
  basenames: Map<string, string[]>;
  /** the items under review: an unqualified intent-feedback id with no entry context resolves if unique here */
  preferred: string[];
};

/** Where a text lives: its directory (for relative links) and its design entry, if any. */
export type RefContext = { dir?: string; entry?: string };

export function buildIndex(paths: string[], sfIds: string[], preferred: string[] = []): RefIndex {
  const files = new Set(paths);
  const entries = new Map<string, string>();
  const adrs = new Map<string, string>();
  const basenames = new Map<string, string[]>();
  for (const p of paths) {
    const e = /^design\/((\d{4})-[^/]+)\//.exec(p);
    if (e && !entries.has(e[2] as string)) entries.set(e[2] as string, `design/${e[1]}`);
    const a = /^design\/decisions\/(\d{4})-[^/]+\.md$/.exec(p);
    if (a) adrs.set(a[1] as string, p);
    const b = p.split('/').pop() as string;
    basenames.set(b, [...(basenames.get(b) ?? []), p]);
  }
  return { files, entries, adrs, sfs: new Set(sfIds), basenames, preferred };
}

/** The design entry a path or item id belongs to, e.g. "0031-detached-session-hosting". */
export function entryOf(pathOrId: string): string | undefined {
  return /(?:^|\/)(\d{4}-[a-z0-9-]+)(?:\/|$)/.exec(pathOrId)?.[1];
}

function normalize(dir: string | undefined, target: string): string {
  const parts = (target.startsWith('/') || !dir ? [] : dir.split('/')).filter(Boolean);
  for (const seg of target.replace(/^\//, '').split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.' && seg !== '') parts.push(seg);
  }
  return parts.join('/');
}

/** Resolve a path mention: relative to the text's directory, then from the root. */
export function resolvePath(idx: RefIndex, ctx: RefContext, raw: string): string | null {
  const target = raw.split('#')[0]?.replace(/[.,;:)]+$/, '') ?? '';
  if (!target || /^[a-z]+:/i.test(target)) return null;
  for (const cand of [normalize(ctx.dir, target), normalize(undefined, target)]) {
    if (idx.files.has(cand)) return cand;
    if (idx.files.has(`${cand}/README.md`)) return `${cand}/README.md`;
  }
  return null;
}

/**
 * Link ranges (absolute offsets) for `text`. Link strings: `if:<entry>/IF-NNN`,
 * `entry:<NNNN>`, `adr:<NNNN>`, `file:<path>`. Overlaps keep the first found,
 * in the order Markdown links, intent-feedback ids, ADRs, paths, entry numbers.
 */
export function findRefs(text: string, idx: RefIndex, ctx: RefContext = {}): Range[] {
  const out: Range[] = [];
  const taken: [number, number][] = []; // link targets: hidden in prose, never linked twice
  const free = (s: number, e: number) =>
    !out.some((r) => s < r.end && e > r.start) && !taken.some(([a, b]) => s < b && e > a);
  const add = (s: number, e: number, link: string) => {
    if (e > s && free(s, e)) out.push({ start: s, end: e, cls: 'xref', link });
  };

  // Markdown links: the link text points at the resolved target.
  for (const m of text.matchAll(/\[([^\]\n]+)\]\(([^)\s]+)\)/g)) {
    const path = resolvePath(idx, ctx, m[2] as string);
    const at = m.index as number;
    const textEnd = at + 1 + (m[1] as string).length;
    if (path) add(at + 1, textEnd, `file:${path}`);
    taken.push([textEnd, at + m[0].length]);
  }
  // intent-feedback ids — and SF ids, their legacy spelling, as an alias — optionally qualified by their
  // entry: "0051 IF-001", "0031/IF-005", "IF-002", "SF-002".
  for (const m of text.matchAll(/\b(?:(\d{4})(?:-[a-z0-9-]+)?(?:['’]s)?[ /])?[IS]F-(\d{3})\b/g)) {
    const num = m[1];
    const sf = `IF-${m[2]}`;
    let entryDir = num ? idx.entries.get(num)?.replace(/^design\//, '') : ctx.entry;
    if (!entryDir && !num) {
      const hits = idx.preferred.filter((p) => p.endsWith(`/${sf}`));
      if (hits.length === 1) entryDir = (hits[0] as string).slice(0, -sf.length - 1);
    }
    if (!entryDir) continue;
    const id = `${entryDir}/${sf}`;
    if (idx.sfs.has(id)) add(m.index as number, (m.index as number) + m[0].length, `if:${id}`);
  }
  // ADRs: "ADR 0006", "ADR-0006".
  for (const m of text.matchAll(/\bADR[ -]?(\d{4})\b/g)) {
    if (idx.adrs.has(m[1] as string))
      add(m.index as number, (m.index as number) + m[0].length, `adr:${m[1]}`);
  }
  // Repository paths, and bare file names that are unique in the snapshot.
  for (const m of text.matchAll(
    /(?<![\w/.-])((?:\.\.?\/)*(?:intent|design|src|test|tools|template)\/[\w./-]*[\w/])/g,
  )) {
    const path = resolvePath(idx, ctx, m[1] as string);
    if (path) add(m.index as number, (m.index as number) + (m[1] as string).length, `file:${path}`);
  }
  for (const m of text.matchAll(/(?<![\w/.-])((?:\.\.?\/)*[\w.-]+\.md)\b/g)) {
    const raw = m[1] as string;
    const path = resolvePath(idx, ctx, raw) ?? uniqueBase(idx, raw);
    if (path) add(m.index as number, (m.index as number) + raw.length, `file:${path}`);
  }
  // Bare four-digit entry (or ADR) numbers: "0031", never inside a path or a longer number.
  for (const m of text.matchAll(/(?<![\w/.-])(0\d{3})(?![\w-])/g)) {
    const n = m[1] as string;
    const link = idx.entries.has(n) ? `entry:${n}` : idx.adrs.has(n) ? `adr:${n}` : null;
    if (link) add(m.index as number, (m.index as number) + n.length, link);
  }
  return out.sort((a, b) => a.start - b.start);
}

function uniqueBase(idx: RefIndex, raw: string): string | null {
  const hits = idx.basenames.get(raw.split('/').pop() as string) ?? [];
  return hits.length === 1 ? (hits[0] as string) : null;
}
