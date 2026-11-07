import { describe, expect, test } from 'bun:test';
import { highlightLine, type Lang, langOf } from '../src/ui/highlight.ts';
import { blocks, renderLines } from '../src/ui/source.ts';

// Each row: language, a line -> the [text, class] tokens it must produce.
const TOKENS: [Lang, string, [string, string][]][] = [
  [
    'ts',
    "const x = load('a') // why",
    [
      ['const', 'tk-kw'],
      ['load', 'tk-fn'],
      ["'a'", 'tk-str'],
      ['// why', 'tk-com'],
    ],
  ],
  [
    'ts',
    'type T = Map<string, 42>;',
    [
      ['type', 'tk-kw'],

      ['Map', 'tk-ty'],
      ['42', 'tk-num'],
    ],
  ],
  [
    'json',
    '  "kind": "packet", "n": 1, "ok": true',
    [
      ['"kind"', 'tk-key'],
      ['"packet"', 'tk-str'],
      ['"n"', 'tk-key'],
      ['1', 'tk-num'],
      ['"ok"', 'tk-key'],
      ['true', 'tk-kw'],
    ],
  ],
  [
    'yaml',
    '  runs-on: ubuntu-latest # ci',
    [
      ['runs-on', 'tk-key'],
      ['# ci', 'tk-com'],
    ],
  ],
  ['toml', '[tools]', [['[tools]', 'tk-kw']]],
  [
    'shell',
    'if [ -z "$x" ]; then echo hi; fi',
    [
      ['if', 'tk-kw'],
      ['"$x"', 'tk-str'],
      ['then', 'tk-kw'],
      ['echo', 'tk-kw'],
      ['fi', 'tk-kw'],
    ],
  ],
  ['plain', 'nothing here', []],
];

describe('highlightLine', () => {
  test.each(TOKENS)('%s: %s', (lang, line, want) => {
    const got = highlightLine(lang, line, { inBlockComment: false }).ranges.map((r) => [
      line.slice(r.start, r.end),
      r.cls,
    ]);
    expect(got).toEqual(want);
  });

  test('a block comment carries across lines', () => {
    const a = highlightLine('ts', 'x /* open', { inBlockComment: false });
    const b = highlightLine('ts', 'still */ y', a.state);
    expect([a.state.inBlockComment, b.state.inBlockComment]).toEqual([true, false]);
    expect(b.ranges[0]).toEqual({ start: 0, end: 8, cls: 'tk-com' });
  });
});

test('langOf maps extensions, defaulting to plain', () => {
  expect(
    ['a.ts', 'b.md', 'c.json', 'd.yml', 'mise.toml', 'x.sh', 'LICENSE', '.envrc'].map(langOf),
  ).toEqual(['ts', 'markdown', 'json', 'yaml', 'toml', 'shell', 'plain', 'shell']);
});

test('code lines keep exact source offsets', () => {
  const text = 'const a = 1;\n/* c\n */ b();\n';
  const lines = renderLines(text, 'ts');
  for (const l of lines)
    for (const s of l.segments) expect(text.slice(s.start, s.end)).toBe(s.text);
  expect(lines[1]?.segments.map((s) => s.cls)).toEqual([['tk-com']]);
});

test('blocks: hard-wrapped Markdown groups into prose blocks', () => {
  const text =
    '# T\n\nA para\nwrapped.\n\n- one\n  cont.\n  - nested\n1. first\n\n> q1\n> q2\n\n| a |\n| b |\n\n```\ncode\n```\n---\n';
  const got = blocks(renderLines(text), text).map((b) => [
    b.kind,
    b.depth,
    b.ordered,
    b.lines.length,
  ]);
  expect(got).toEqual([
    ['h1', 0, false, 1],
    ['p', 0, false, 2],
    ['li', 0, false, 2],
    ['li', 1, false, 1],
    ['li', 0, true, 1],
    ['bq', 0, false, 2],
    ['table', 0, false, 2],
    ['code', 0, false, 3],
    ['hr', 0, false, 1],
  ]);
});
