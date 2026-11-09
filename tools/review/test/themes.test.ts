import { describe, expect, test } from 'bun:test';
import { contrast, resolveTheme, THEMES, TOKENS, themeCss, validateTheme } from '../src/themes.ts';

// Readable text: every text and syntax colour clears WCAG AA (4.5:1) on every background.
const TEXT = [
  'ink',
  'ink-2',
  'muted',
  'heading',
  'heading-2',
  'xref',
  'accent-passage',
  'accent',
  'accept',
  'amend',
  'decline',
  'defer',
  'revise',
  'tk-kw',
  'tk-str',
  'tk-com',
  'tk-num',
  'tk-fn',
  'tk-ty',
  'tk-key',
] as const;
const GROUNDS = ['surface', 'bg', 'sunken'] as const;

describe('built-in themes', () => {
  test('a pinned set: six themes, Gyokuro first', () => {
    expect(THEMES.map((t) => t.id)).toEqual([
      'gyokuro-desert',
      'gyokuro-desert-og',
      'gyokuro-dark',
      'gyokuro-light',
      'neutral-light',
      'neutral-dark',
    ]);
  });
  test.each(THEMES.map((t) => [t.id, t] as const))(
    '%s defines every token and reads at AA',
    (_id, t) => {
      expect(Object.keys(t.colors).sort()).toEqual([...TOKENS].sort());
      const low = TEXT.flatMap((k) =>
        GROUNDS.map((g) => [k, g, contrast(t.colors[k], t.colors[g])] as const),
      ).filter(([, , r]) => r < 4.5);
      expect(low).toEqual([]);
      expect(contrast(t.colors['accent-ink'], t.colors.accent)).toBeGreaterThanOrEqual(4.5);
    },
  );
  // Passage numbers must stand out from the headings and the accent they sit beside.
  test.each(THEMES.map((t) => [t.id, t] as const))(
    '%s gives passage markers their own colour',
    (_id, t) => {
      const rgb = (hex: string) =>
        [0, 2, 4].map((i) => Number.parseInt(hex.replace('#', '').slice(i, i + 2), 16));
      const dist = (a: string, b: string) => {
        const [x, y] = [rgb(a), rgb(b)];
        return Math.hypot(...x.map((v, i) => v - (y[i] as number)));
      };
      const p = t.colors['accent-passage'];
      for (const other of ['accent', 'heading', 'heading-2', 'xref'] as const) {
        expect([other, dist(p, t.colors[other]) > 80]).toEqual([other, true]);
      }
    },
  );
  test('themeCss scopes tokens under the theme id', () => {
    const css = themeCss(THEMES[0] as (typeof THEMES)[number]);
    expect(css.startsWith(':root[data-theme="gyokuro-desert"]{--bg:')).toBe(true);
    expect(css).toContain('color-scheme:dark;');
  });
});

// Each row: a custom theme file's content -> the errors (none means valid).
const CUSTOM: [string, unknown, string[]][] = [
  ['minimal', { id: 'mine', name: 'Mine', base: 'gyokuro-dark' }, []],
  [
    'with colours',
    {
      id: 'mine',
      name: 'Mine',
      base: 'neutral-light',
      colors: { accent: '#ff00aa', 'tk-kw': 'rgb(1 2 3)' },
    },
    [],
  ],
  ['not an object', [], ['must be a JSON object']],
  [
    'bad id',
    { id: 'Mine!', name: 'M', base: 'gyokuro-dark' },
    ['id: lower-case letters, digits and dashes'],
  ],
  [
    'shadows a built-in',
    { id: 'gyokuro-dark', name: 'M', base: 'gyokuro-dark' },
    ['id: "gyokuro-dark" is a built-in theme'],
  ],
  [
    'unknown base',
    { id: 'm', name: 'M', base: 'solarized' },
    [`base: one of ${THEMES.map((t) => t.id).join(', ')}`],
  ],
  [
    'unknown token',
    { id: 'm', name: 'M', base: 'gyokuro-dark', colors: { sparkle: '#fff' } },
    ['colors.sparkle: not a theme token'],
  ],
  [
    'CSS injection refused',
    { id: 'm', name: 'M', base: 'gyokuro-dark', colors: { bg: 'red;}body{x' } },
    ['colors.bg: not a CSS colour value'],
  ],
];

test.each(CUSTOM)('custom theme: %s', (_name, v, errors) => {
  const r = validateTheme(v);
  expect(r.ok ? [] : r.errors).toEqual(errors);
});

test('a custom theme resolves over its base', () => {
  const r = validateTheme({
    id: 'mine',
    name: 'Mine',
    base: 'gyokuro-light',
    colors: { accent: '#123456' },
  });
  if (!r.ok) throw new Error('invalid');
  const t = resolveTheme(r.theme);
  expect([t?.dark, t?.colors.accent, t?.colors.bg]).toEqual([false, '#123456', '#e8f2e8']);
});
