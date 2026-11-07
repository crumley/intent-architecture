import { expect, test } from 'bun:test';
import { diffWords } from '../src/diff.ts';

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
