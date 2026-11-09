import { describe, expect, test } from 'bun:test';
import type { Item } from '../src/schema.ts';
import { itemPassages, passageFor, rangeOf } from '../src/ui/passages.ts';

const A = 'intent/a.md';
const B = 'intent/b.md';
const D = 'design/0001-x/README.md';
const FILES = new Map([
  [A, '# A\n\n- one: map for resume.\n- two: attach.\n- three: observe.\n'],
  [B, '# B\n\nDifferent acts deserve different words.\n'],
  [D, '# 0001\n\nWe built two verbs.\n'],
]);

function item(over: Partial<Item>): Item {
  return {
    id: 'x/IF-001',
    kind: 'if',
    question: 'Q?',
    title: 't',
    status: 'pending',
    source: { path: D, line: 1 },
    evidence: [],
    sections: [],
    ...over,
  };
}

describe('itemPassages', () => {
  const it = item({
    evidence: [
      { path: A, quote: 'map for resume' }, // overlaps edit 1: shares its number
      { path: B, quote: 'deserve different words' }, // not edited: numbered after the edits
    ],
    context: [{ path: D, quote: 'two verbs', why: 'the entry builds both' }],
    nowWhat: {
      edits: [
        { path: A, before: '- one: map for resume.', after: '- one: map to attach or resume.' },
        { path: A, before: '- three: observe.', after: '- three: observe read-only.' },
      ],
    },
  });
  const ip = itemPassages(it, FILES);

  test('edits are numbered first, then quoted passages no edit covers; context is unnumbered', () => {
    expect(ip.passages.map((p) => [p.n, p.role, p.path, p.edit, p.evidence, p.context])).toEqual([
      [1, 'edit', A, 0, [0], undefined],
      [2, 'edit', A, 1, [], undefined],
      [3, 'evidence', B, undefined, [1], undefined],
      [0, 'context', D, undefined, [], 0],
    ]);
    expect(ip.numbered.map((p) => p.n)).toEqual([1, 2, 3]);
  });

  test('files: what the decision edits, then related files each saying why', () => {
    expect(ip.files.map((f) => [f.path, f.group, f.why, f.passages.map((p) => p.n)])).toEqual([
      [A, 'edit', undefined, [1, 2]],
      [B, 'related', 'Quoted under What — this decision does not edit it.', [3]],
      [D, 'related', 'the entry builds both', [0]],
    ]);
  });

  test('with no edit, the quoted files are the ones in question', () => {
    const q = itemPassages(item({ evidence: [{ path: B, quote: 'different words' }] }), FILES);
    expect(q.files.map((f) => [f.path, f.group])).toEqual([[B, 'question']]);
  });

  test('another item editing overlapping text is named on the passage', () => {
    const other = item({
      id: 'x/IF-002',
      nowWhat: { edits: [{ path: A, before: 'map for resume', after: 'x' }] },
    });
    const withOther = itemPassages(it, FILES, [it, other]);
    expect(withOther.passages[0]?.also).toEqual([{ item: 'x/IF-002', edit: 0 }]);
    expect(withOther.passages[1]?.also).toEqual([]);
  });

  test('a ref lands on the numbered passage it overlaps', () => {
    const text = FILES.get(A) as string;
    expect(passageFor(ip, { path: A, quote: 'for resume' }, text)?.n).toBe(1);
    expect(passageFor(ip, { path: A, lines: { start: 5, end: 5 } }, text)?.n).toBe(2);
    expect(passageFor(ip, { path: A, quote: 'two: attach' }, text)).toBeUndefined();
  });
});

test('rangeOf: a quote, else a line range, else nothing', () => {
  const t = 'a\nbb\nccc\n';
  expect(rangeOf({ path: A, quote: 'bb' }, t)).toEqual({ start: 2, end: 4 });
  expect(rangeOf({ path: A, lines: { start: 2, end: 3 } }, t)).toEqual({ start: 2, end: 8 });
  expect(rangeOf({ path: A }, t)).toBeNull();
});
