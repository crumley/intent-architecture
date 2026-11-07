import { describe, expect, test } from 'bun:test';
import { findSection, renderSource } from '../src/ui/source.ts';

const TEXT =
  '# Title\n\n- **Map** a `ref` to [the seam](a.md).\n> quoted _here_\n```\n**not bold**\n```';

describe('renderSource', () => {
  const lines = renderSource(TEXT, [
    { start: TEXT.indexOf('Map'), end: TEXT.indexOf('ref') + 3, cls: 'hl', id: 'a1' },
  ]);

  test('segments reassemble the source exactly, line by line', () => {
    expect(lines.map((l) => l.segments.map((s) => s.text).join('')).join('\n')).toBe(TEXT);
    for (const l of lines)
      for (const s of l.segments) expect(TEXT.slice(s.start, s.end)).toBe(s.text);
  });

  // Each row: a substring of TEXT -> the classes its segment must carry.
  const STYLE: [string, string[]][] = [
    ['# ', ['mk']],
    ['Map', ['b', 'hl']],
    ['ref', ['code', 'hl']],
    ['the seam', ['a']],
    ['](a.md)', ['mk', 'url']],
    ['here', ['i']],
  ];
  test.each(STYLE)('%s is styled %p', (sub, cls) => {
    const seg = lines.flatMap((l) => l.segments).find((s) => s.text === sub);
    expect(seg?.cls.sort()).toEqual([...cls].sort());
  });

  test('line classes: heading, quote, fenced code (not styled inside)', () => {
    expect(lines.map((l) => l.cls)).toEqual([
      'h h1',
      '',
      '',
      'bq',
      'code-line',
      'code-line',
      'code-line',
    ]);
    expect(lines[5]?.segments).toHaveLength(1);
  });

  test('highlights carry their annotation id', () => {
    const marked = lines.flatMap((l) => l.segments).filter((s) => s.ids.includes('a1'));
    expect(marked.map((s) => s.text).join('')).toBe('Map** a `ref');
  });
});

test('findSection finds a heading by its text, ignoring markers and case', () => {
  const t = '# A\n\n## Constraints any design must honor\n\ntext\n## _Open questions_\n';
  expect(findSection(t, 'Constraints')).toBe(t.indexOf('## Constraints'));
  expect(findSection(t, 'open questions')).toBe(t.indexOf('## _Open'));
  expect(findSection(t, 'Missing')).toBeNull();
});

describe('inline Markdown across a hard wrap', () => {
  // Each row: source -> the text that must carry the class.
  const CASES: [string, string, string][] = [
    ['a **bold that\n  wraps** b', 'b', 'bold that\n  wraps'],
    ['x _Why that is\n  admissible:_ y', 'i', 'Why that is\n  admissible:'],
    ['see [the\n  slice](a.md).', 'a', 'the\n  slice'],
  ];
  test.each(CASES)('%p', (text, cls, want) => {
    const got = renderSource(text)
      .flatMap((l) => l.segments)
      .filter((s) => s.cls.includes(cls))
      .map((s) => s.text)
      .join('\n');
    expect(got).toBe(want.replace('\n  ', '\n  ').split('\n').join('\n'));
  });

  test('never across a blank line, never inside a fence', () => {
    for (const text of ['a **open\n\nclose** b', '```\n**x**\n```']) {
      expect(
        renderSource(text)
          .flatMap((l) => l.segments)
          .some((s) => s.cls.includes('b')),
      ).toBe(false);
    }
  });
});
