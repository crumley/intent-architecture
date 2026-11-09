import { describe, expect, test } from 'bun:test';
import { diffAligned, diffWords } from '../src/diff.ts';

const CASES: [string, string, string, string][] = [
  ['identical', 'a b c', 'a b c', '=a b c'],
  ['one word replaced', 'map for resume', 'map to attach', '=map |-for resume|+to attach'],
  ['insertion', 'start a session', 'start a live session', '=start a |+live |=session'],
  ['deletion', 'keep it alive when detached', 'keep it alive', '=keep it alive|- when detached'],
  ['punctuation is its own token', 'shared.', 'shared, by design.', '=shared|+, by design|=.'],
  ['from nothing', '', 'new', '+new'],
];

test.each(CASES)('%s', (_name, before, after, want) => {
  const got = diffWords(before, after)
    .map((p) => `${p.op === 'same' ? '=' : p.op === 'del' ? '-' : '+'}${p.text}`)
    .join('|');
  expect(got).toBe(want);
});

test('reassembles both sides exactly', () => {
  const before = 'Map a recorded session reference back to a live session\n  for resume.';
  const after =
    'Map a recorded session reference back to a live session — to **attach** when\n  running, and to re-create it when not.';
  const parts = diffWords(before, after);
  expect(
    parts
      .filter((p) => p.op !== 'ins')
      .map((p) => p.text)
      .join(''),
  ).toBe(before);
  expect(
    parts
      .filter((p) => p.op !== 'del')
      .map((p) => p.text)
      .join(''),
  ).toBe(after);
});

describe('diffAligned: each side keeps its own text', () => {
  test('a reflowed sentence is the same, and each side reassembles exactly', () => {
    const before = 'the seam maps a record\n  to a live session for resume';
    const after = 'the seam maps a record to a\n  live session for attach and resume';
    const parts = diffAligned(before, after);
    expect(parts.map((p) => p.a).join('')).toBe(before);
    expect(parts.map((p) => p.b).join('')).toBe(after);
    const changed = parts.filter((p) => p.op !== 'same').map((p) => p.a + p.b);
    expect(changed).toEqual(['attach and ']);
  });
  test('a paragraph break is a change, not whitespace', () => {
    const parts = diffAligned('one two', 'one\n\ntwo');
    expect(parts.some((p) => p.op !== 'same')).toBe(true);
  });
});
