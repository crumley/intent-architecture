// Source rendering, as pure functions the page turns into DOM: Markdown styled
// in place (and grouped into prose blocks so hard-wrapped text can flow), code
// highlighted. Every segment knows its offset in the source, so a selection in
// any presentation maps to exact source text (design 0001, "Prose that keeps
// its offsets").

import { type HlState, highlightLine, type Lang } from './highlight.ts';

export type Range = { start: number; end: number; cls: string; id?: string; link?: string };
export type Segment = {
  start: number;
  end: number;
  text: string;
  cls: string[];
  ids: string[];
  links: string[];
};
export type Line = { n: number; start: number; end: number; cls: string; segments: Segment[] };

// Inline Markdown may wrap across a hard line break (the source is hard-wrapped
// at 100 columns) but never across a blank line; `SPAN` is "any run without a
// blank line". Code spans stay on one line, as Markdown has it.
const SPAN = (not: string) => `(?:[^${not}\\n]|\\n(?![ \\t]*\\n))`;
const INLINE: { re: RegExp; parts: (m: RegExpExecArray) => [number, number, string][] }[] = [
  {
    // `code`
    re: /`[^`\n]+`/g,
    parts: (m) => [
      [0, 1, 'mk'],
      [1, m[0].length - 1, 'code'],
      [m[0].length - 1, m[0].length, 'mk'],
    ],
  },
  {
    // [text](target)
    re: new RegExp(`\\[(${SPAN('\\]')}+)\\]\\(([^)\\s]+)\\)`, 'g'),
    parts: (m) => {
      const t = (m[1] as string).length;
      return [
        [0, 1, 'mk'],
        [1, 1 + t, 'a'],
        [1 + t, m[0].length, 'mk url'],
      ];
    },
  },
  {
    // **strong**
    re: new RegExp(`\\*\\*(?=\\S)((?:${SPAN('*')}|\\*(?!\\*))+?)\\*\\*`, 'g'),
    parts: (m) => [
      [0, 2, 'mk'],
      [2, m[0].length - 2, 'b'],
      [m[0].length - 2, m[0].length, 'mk'],
    ],
  },
  {
    // _emphasis_ / *emphasis*
    re: new RegExp(
      `(?<![\\w*])_(?=\\S)(${SPAN('_')}+?)_(?!\\w)|(?<![\\w*])\\*(?=[^\\s*])(${SPAN('*')}+?)\\*(?![\\w*])`,
      'g',
    ),
    parts: (m) => [
      [0, 1, 'mk'],
      [1, m[0].length - 1, 'i'],
      [m[0].length - 1, m[0].length, 'mk'],
    ],
  },
];

/** Inline style ranges over the whole text (absolute offsets), skipping fenced code. */
export function inlineRanges(text: string): Range[] {
  const fences: [number, number][] = [];
  const fence = /^[ \t]*```.*$/gm;
  for (let open = fence.exec(text); open; open = fence.exec(text)) {
    const close = fence.exec(text);
    fences.push([open.index, close ? close.index + close[0].length : text.length]);
    if (!close) break;
  }
  const inFence = (a: number, b: number) => fences.some(([s, e]) => a < e && b > s);
  const out: Range[] = [];
  for (const { re, parts } of INLINE) {
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      if (inFence(m.index, m.index + m[0].length)) continue;
      for (const [s, e, c] of parts(m)) out.push({ start: m.index + s, end: m.index + e, cls: c });
    }
  }
  return out;
}

/** Style ranges for one line, offsets relative to the line. */
function lineStyle(text: string, inFence: boolean): { cls: string; ranges: Range[] } {
  const ranges: Range[] = [];
  if (inFence || /^\s*```/.test(text)) return { cls: 'code-line', ranges };
  let cls = '';
  const heading = /^(#{1,6})\s/.exec(text);
  if (heading) {
    cls = `h h${(heading[1] as string).length}`;
    ranges.push({ start: 0, end: heading[0].length, cls: 'mk' });
  } else if (/^\s*>/.test(text)) {
    const m = /^\s*>\s?/.exec(text) as RegExpExecArray;
    cls = 'bq';
    ranges.push({ start: 0, end: m[0].length, cls: 'mk' });
  } else if (/^\s*\|/.test(text)) {
    cls = 'tbl';
  } else {
    const li = /^(\s*)([-*+]|\d+\.)\s/.exec(text);
    if (li) {
      const ordered = /\d/.test(li[2] as string);
      ranges.push({
        start: (li[1] as string).length,
        end: li[0].length,
        cls: ordered ? 'mk li ol' : 'mk li',
      });
    }
  }
  return { cls, ranges };
}

/** Cut [start, end) at every range boundary; each piece carries the union of covering ranges. */
export function segment(text: string, start: number, end: number, ranges: Range[]): Segment[] {
  const cuts = new Set<number>([start, end]);
  for (const r of ranges) {
    if (r.start > start && r.start < end) cuts.add(r.start);
    if (r.end > start && r.end < end) cuts.add(r.end);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const s = points[i] as number;
    const e = points[i + 1] as number;
    const cover = ranges.filter((r) => r.start <= s && r.end >= e);
    out.push({
      start: s,
      end: e,
      text: text.slice(s, e),
      cls: [...new Set(cover.flatMap((r) => r.cls.split(' ').filter(Boolean)))],
      ids: [...new Set(cover.flatMap((r) => (r.id === undefined ? [] : [r.id])))],
      links: [...new Set(cover.flatMap((r) => (r.link === undefined ? [] : [r.link])))],
    });
  }
  return out;
}

/**
 * Split source into lines of segments, styled as Markdown or highlighted as
 * code. `marks` are ranges in source offsets (annotations, a focused quote);
 * a segment carries the union of every style and mark covering it.
 */
export function renderLines(text: string, lang: Lang = 'markdown', marks: Range[] = []): Line[] {
  const lines: Line[] = [];
  let offset = 0;
  let inFence = false;
  let hl: HlState = { inBlockComment: false };
  // Inline Markdown is found once over the text, then clipped to each line with the marks.
  const clipped = lang === 'markdown' ? [...inlineRanges(text), ...marks] : marks;
  text.split('\n').forEach((lineText, idx) => {
    const start = offset;
    const end = start + lineText.length;
    offset = end + 1;
    let cls = '';
    let ranges: Range[];
    if (lang === 'markdown') {
      const fenceMarker = /^\s*```/.test(lineText);
      const st = lineStyle(lineText, inFence);
      if (fenceMarker) inFence = !inFence;
      cls = st.cls;
      ranges = st.ranges;
    } else {
      const r = highlightLine(lang, lineText, hl);
      hl = r.state;
      ranges = r.ranges;
    }
    const all: Range[] = ranges.map((r) => ({ ...r, start: r.start + start, end: r.end + start }));
    for (const m of clipped) {
      if (m.end > start && m.start < end) {
        const r: Range = { start: Math.max(m.start, start), end: Math.min(m.end, end), cls: m.cls };
        if (m.id !== undefined) r.id = m.id;
        if (m.link !== undefined) r.link = m.link;
        all.push(r);
      }
    }
    lines.push({ n: idx + 1, start, end, cls, segments: segment(text, start, end, all) });
  });
  return lines;
}

/** @deprecated name kept for the tests' reading: Markdown lines. */
export const renderSource = (text: string, marks: Range[] = []) =>
  renderLines(text, 'markdown', marks);

export type BlockKind =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'p'
  | 'li'
  | 'bq'
  | 'code'
  | 'table'
  | 'hr';
export type Block = { kind: BlockKind; depth: number; ordered: boolean; lines: Line[] };

/**
 * Group Markdown lines into prose blocks (paragraphs, list items, headings,
 * quotes, fences, tables) so hard-wrapped source can flow as prose while every
 * segment keeps its source offset. Blank lines separate blocks and are dropped.
 */
export function blocks(lines: Line[], text: string): Block[] {
  const out: Block[] = [];
  let cur: Block | null = null;
  let fence = false;
  const close = () => {
    cur = null;
  };
  const open = (kind: BlockKind, line: Line, depth = 0, ordered = false) => {
    cur = { kind, depth, ordered, lines: [line] };
    out.push(cur);
  };
  for (const line of lines) {
    const t = text.slice(line.start, line.end);
    if (fence) {
      (cur as Block | null)?.lines.push(line);
      if (/^\s*```/.test(t)) {
        fence = false;
        close();
      }
      continue;
    }
    if (/^\s*```/.test(t)) {
      open('code', line);
      fence = true;
      continue;
    }
    if (t.trim() === '') {
      close();
      continue;
    }
    const h = /^(#{1,6})\s/.exec(t);
    if (h) {
      open(`h${(h[1] as string).length}` as BlockKind, line);
      close();
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(t)) {
      open('hr', line);
      close();
      continue;
    }
    if (/^\s*\|/.test(t)) {
      if ((cur as Block | null)?.kind === 'table') (cur as unknown as Block).lines.push(line);
      else open('table', line);
      continue;
    }
    if (/^\s*>/.test(t)) {
      if ((cur as Block | null)?.kind === 'bq') (cur as unknown as Block).lines.push(line);
      else open('bq', line);
      continue;
    }
    const li = /^(\s*)([-*+]|\d+\.)\s/.exec(t);
    if (li) {
      open('li', line, Math.floor((li[1] as string).length / 2), /\d/.test(li[2] as string));
      continue;
    }
    if (cur) (cur as Block).lines.push(line);
    else open('p', line);
  }
  return out;
}

/** The plain text of a heading line, markers and emphasis stripped. */
export function headingText(line: string): string | null {
  const m = /^#{1,6}\s+(.*)$/.exec(line);
  if (!m) return null;
  return (m[1] as string).replace(/[`*_]/g, '').trim();
}

/** Offset of the first heading whose text contains `section` (case-insensitive). */
export function findSection(text: string, section: string): number | null {
  const want = section.replace(/[`*_]/g, '').trim().toLowerCase();
  if (!want) return null;
  let offset = 0;
  for (const line of text.split('\n')) {
    const h = headingText(line);
    if (h?.toLowerCase().includes(want)) return offset;
    offset += line.length + 1;
  }
  return null;
}
