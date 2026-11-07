import { describe, expect, test } from 'bun:test';
import { createSelector, lineOf, locate } from '../src/anchor.ts';

const ORIGINAL = `# Seam

- Start a session for a scope.
- Map a recorded reference back to a live session for resume.
- Observe read-only. Observe read-only is the protected grain.
`;

// Each row: the quote anchored in ORIGINAL (nth occurrence), an edit, and where it must land.
const CASES: [string, string, number, (t: string) => string, Expect][] = [
  [
    'unchanged file',
    'live session',
    0,
    (t) => t,
    { status: 'exact', text: 'live session', line: 4 },
  ],
  [
    'text inserted above',
    'live session',
    0,
    (t) => t.replace('# Seam\n', '# Seam\n\nA new paragraph.\nAnother.\n'),
    { status: 'exact', text: 'live session', line: 7 },
  ],
  [
    'text edited elsewhere on its line',
    'live session',
    0,
    (t) => t.replace('Map a recorded', 'Map any recorded'),
    { status: 'exact', text: 'live session', line: 4 },
  ],
  [
    'first of two occurrences',
    'Observe read-only',
    0,
    (t) => t,
    { status: 'exact', at: 'first', line: 5 },
  ],
  [
    'second of two occurrences',
    'Observe read-only',
    1,
    (t) => t,
    { status: 'exact', at: 'second', line: 5 },
  ],
  [
    'second occurrence after an edit before both',
    'Observe read-only',
    1,
    (t) => `Preface.\n${t}`,
    { status: 'exact', at: 'second', line: 6 },
  ],
  [
    'the quote itself reworded',
    'for resume',
    0,
    (t) => t.replace('for resume', 'to attach or resume'),
    { status: 'context', text: 'to attach or resume', line: 4 },
  ],
  [
    'the passage deleted',
    'for resume',
    0,
    (t) => t.replace(/- Map.*\n/, ''),
    { status: 'orphaned' },
  ],
];

type Expect = {
  status: 'exact' | 'context' | 'orphaned';
  text?: string;
  at?: 'first' | 'second';
  line?: number;
};

describe('locate', () => {
  test.each(CASES)('%s', (_name, quote, nth, edit, want) => {
    const start = nthIndex(ORIGINAL, quote, nth);
    const sel = createSelector(ORIGINAL, start, start + quote.length);
    const edited = edit(ORIGINAL);
    const got = locate(edited, sel, start);
    expect(got.status).toBe(want.status);
    if (got.status === 'orphaned') return;
    if (want.line !== undefined) expect(got.line).toBe(want.line);
    if (want.text !== undefined) expect(edited.slice(got.start, got.end)).toBe(want.text);
    if (want.at !== undefined)
      expect(got.start).toBe(nthIndex(edited, quote, want.at === 'first' ? 0 : 1));
  });
});

describe('createSelector', () => {
  test('keeps up to 32 characters of context each side', () => {
    const t = `${'a'.repeat(40)}QUOTE${'b'.repeat(40)}`;
    const s = createSelector(t, 40, 45);
    expect([s.exact, s.prefix.length, s.suffix.length]).toEqual(['QUOTE', 32, 32]);
    expect(createSelector('xQUOTEy', 1, 6)).toEqual({ exact: 'QUOTE', prefix: 'x', suffix: 'y' });
  });
  test('lineOf is 1-based', () => {
    expect([lineOf('a\nb\nc', 0), lineOf('a\nb\nc', 2), lineOf('a\nb\nc', 4)]).toEqual([1, 2, 3]);
  });
});

// --- helpers ----------------------------------------------------------------

function nthIndex(text: string, needle: string, n: number): number {
  let i = -1;
  for (let k = 0; k <= n; k++) i = text.indexOf(needle, i + 1);
  if (i === -1) throw new Error(`no occurrence ${n} of ${needle}`);
  return i;
}
