// Themes are sets of CSS custom properties. Built-ins draw on the Gyokuro theme
// family (its base palettes and syntax colours, plus the "graffiti" neon
// accents for headings, identifiers, and verdicts) and a plain neutral pair.
// A custom theme is a JSON file naming a built-in base and overriding any
// tokens; the server loads and validates them, the page applies them.

export const TOKENS = [
  'bg',
  'surface',
  'sunken',
  'raised',
  'ink',
  'ink-2',
  'muted',
  'faint',
  'line',
  'line-2',
  'accent',
  'accent-ink',
  'accent-soft',
  'heading',
  'heading-2',
  'xref',
  'focus',
  'focus-line',
  'accept',
  'amend',
  'decline',
  'defer',
  'revise',
  'hl-comment',
  'hl-question',
  'hl-suggestion',
  'hl-intent-here',
  'hl-mismatch',
  'add-bg',
  'add-strong',
  'del-bg',
  'del-strong',
  'tk-kw',
  'tk-str',
  'tk-com',
  'tk-num',
  'tk-fn',
  'tk-ty',
  'tk-key',
  'shadow',
] as const;

export type Token = (typeof TOKENS)[number];
export type Theme = { id: string; name: string; dark: boolean; colors: Record<Token, string> };
export type CustomTheme = {
  id: string;
  name: string;
  base: string;
  colors: Partial<Record<Token, string>>;
};

const SHADOW_DARK = '0 1px 2px rgb(0 0 0 / 0.35), 0 12px 32px rgb(0 0 0 / 0.5)';
const SHADOW_LIGHT = '0 1px 2px rgb(0 0 0 / 0.05), 0 8px 24px rgb(0 0 0 / 0.1)';

export const THEMES: Theme[] = [
  {
    id: 'gyokuro-desert',
    name: 'Gyokuro Desert',
    dark: true,
    colors: {
      bg: '#232527',
      surface: '#1d1f21',
      sunken: '#17181a',
      raised: '#2a2c2f',
      ink: '#d4d4d4',
      'ink-2': '#bdbdbd',
      muted: '#a2a4a2',
      faint: '#7a7c7a',
      line: '#303336',
      'line-2': '#3c4046',
      accent: '#9acd32',
      'accent-ink': '#1d1f21',
      'accent-soft': '#2c3a1a',
      heading: '#9bf99c',
      'heading-2': '#e5db74',
      xref: '#87ceeb',
      focus: '#4a3d14',
      'focus-line': '#e5db74',
      accept: '#9bf99c',
      amend: '#87ceeb',
      decline: '#ff7b7a',
      defer: '#e5db74',
      revise: '#d4a6ff',
      'hl-comment': '#4d4614',
      'hl-question': '#173a4f',
      'hl-suggestion': '#1f4524',
      'hl-intent-here': '#3e2a57',
      'hl-mismatch': '#55201f',
      'add-bg': '#1c3320',
      'add-strong': '#2f6136',
      'del-bg': '#3a1c1c',
      'del-strong': '#723030',
      'tk-kw': '#e5db74',
      'tk-str': '#90ee90',
      'tk-com': '#7ccd7d',
      'tk-num': '#9acd32',
      'tk-fn': '#87ceeb',
      'tk-ty': '#feddaa',
      'tk-key': '#87ceeb',
      shadow: SHADOW_DARK,
    },
  },
  {
    id: 'gyokuro-desert-og',
    name: 'Gyokuro Desert OG',
    dark: true,
    colors: {
      bg: '#232527',
      surface: '#1d1f21',
      sunken: '#17181a',
      raised: '#2a2c2f',
      ink: '#d4d4d4',
      'ink-2': '#bdbdbd',
      muted: '#a2a4a2',
      faint: '#7a7c7a',
      line: '#303336',
      'line-2': '#3c4046',
      accent: '#ffa54f',
      'accent-ink': '#1d1f21',
      'accent-soft': '#3d2b17',
      heading: '#ffa54f',
      'heading-2': '#fa8072',
      xref: '#87ceeb',
      focus: '#4a3216',
      'focus-line': '#ffa54f',
      accept: '#9bf99c',
      amend: '#87ceeb',
      decline: '#ff7b7a',
      defer: '#ffd27a',
      revise: '#d4a6ff',
      'hl-comment': '#4d4614',
      'hl-question': '#173a4f',
      'hl-suggestion': '#1f4524',
      'hl-intent-here': '#3e2a57',
      'hl-mismatch': '#55201f',
      'add-bg': '#1c3320',
      'add-strong': '#2f6136',
      'del-bg': '#3a1c1c',
      'del-strong': '#723030',
      'tk-kw': '#e5db74',
      'tk-str': '#fa8072',
      'tk-com': '#7ccd7d',
      'tk-num': '#ffa54f',
      'tk-fn': '#87ceeb',
      'tk-ty': '#feddaa',
      'tk-key': '#87ceeb',
      shadow: SHADOW_DARK,
    },
  },
  {
    id: 'gyokuro-dark',
    name: 'Gyokuro Dark',
    dark: true,
    colors: {
      bg: '#0f1d16',
      surface: '#1a2920',
      sunken: '#13221a',
      raised: '#213428',
      ink: '#d3ddd7',
      'ink-2': '#b3c4b8',
      muted: '#93ab9a',
      faint: '#6f8a76',
      line: '#26392c',
      'line-2': '#33493a',
      accent: '#5fe08a',
      'accent-ink': '#0f1d16',
      'accent-soft': '#22432e',
      heading: '#b8f28f',
      'heading-2': '#9fd3a7',
      xref: '#ffb86b',
      focus: '#4a3d14',
      'focus-line': '#ffd700',
      accept: '#5fe08a',
      amend: '#5ce1ff',
      decline: '#ff6b8b',
      defer: '#ffd75e',
      revise: '#d29bff',
      'hl-comment': '#4a4416',
      'hl-question': '#173d4d',
      'hl-suggestion': '#1f4a2a',
      'hl-intent-here': '#3d2a55',
      'hl-mismatch': '#55212a',
      'add-bg': '#1d3a26',
      'add-strong': '#2f6a40',
      'del-bg': '#3a1d22',
      'del-strong': '#71303b',
      'tk-kw': '#8fbc8f',
      'tk-str': '#a8d1a3',
      'tk-com': '#7d9a82',
      'tk-num': '#b8d4a3',
      'tk-fn': '#7db87f',
      'tk-ty': '#9fd3a7',
      'tk-key': '#9fd3a7',
      shadow: SHADOW_DARK,
    },
  },
  {
    id: 'gyokuro-light',
    name: 'Gyokuro Light',
    dark: false,
    colors: {
      bg: '#e8f2e8',
      surface: '#f7f9f7',
      sunken: '#edf4ed',
      raised: '#ffffff',
      ink: '#24352a',
      'ink-2': '#3d5940',
      muted: '#52695a',
      faint: '#8aa08e',
      line: '#d7e5d7',
      'line-2': '#c3d6c3',
      accent: '#1a6b1a',
      'accent-ink': '#ffffff',
      'accent-soft': '#dcecdc',
      heading: '#0d5016',
      'heading-2': '#2d5a30',
      xref: '#a14400',
      focus: '#ffe9a8',
      'focus-line': '#d99a00',
      accept: '#176c28',
      amend: '#0b6e99',
      decline: '#c0263d',
      defer: '#8f5c00',
      revise: '#7a2fc4',
      'hl-comment': '#fff0a0',
      'hl-question': '#d4eaff',
      'hl-suggestion': '#d3f2cf',
      'hl-intent-here': '#eadcff',
      'hl-mismatch': '#ffd9dc',
      'add-bg': '#e0f3df',
      'add-strong': '#b4e2b0',
      'del-bg': '#fde8ea',
      'del-strong': '#f5bcc3',
      'tk-kw': '#1a6b1a',
      'tk-str': '#0d5016',
      'tk-com': '#4d6852',
      'tk-num': '#1a6b1a',
      'tk-fn': '#2d5a30',
      'tk-ty': '#0d5016',
      'tk-key': '#0d5016',
      shadow: SHADOW_LIGHT,
    },
  },
  {
    id: 'neutral-light',
    name: 'Neutral Light',
    dark: false,
    colors: {
      bg: '#f6f6f3',
      surface: '#ffffff',
      sunken: '#efefeb',
      raised: '#ffffff',
      ink: '#1c1e22',
      'ink-2': '#3d4149',
      muted: '#62676f',
      faint: '#a4a8ae',
      line: '#e4e3de',
      'line-2': '#d6d5cf',
      accent: '#3657c8',
      'accent-ink': '#ffffff',
      'accent-soft': '#e9eefc',
      heading: '#1c1e22',
      'heading-2': '#3d4149',
      xref: '#3657c8',
      focus: '#fde9c6',
      'focus-line': '#f0b45a',
      accept: '#1a7046',
      amend: '#3657c8',
      decline: '#b4362c',
      defer: '#8f5c00',
      revise: '#7442c8',
      'hl-comment': '#fff0a6',
      'hl-question': '#d7e9ff',
      'hl-suggestion': '#d9f3df',
      'hl-intent-here': '#ece0ff',
      'hl-mismatch': '#ffdcd8',
      'add-bg': '#e7f6ea',
      'add-strong': '#b5e6c0',
      'del-bg': '#fdecea',
      'del-strong': '#f6c2bc',
      'tk-kw': '#8a3fbf',
      'tk-str': '#1f6e32',
      'tk-com': '#5b6068',
      'tk-num': '#a65400',
      'tk-fn': '#2f5fc4',
      'tk-ty': '#096a75',
      'tk-key': '#2f5fc4',
      shadow: SHADOW_LIGHT,
    },
  },
  {
    id: 'neutral-dark',
    name: 'Neutral Dark',
    dark: true,
    colors: {
      bg: '#111215',
      surface: '#17191d',
      sunken: '#0d0e10',
      raised: '#1d2025',
      ink: '#e6e7ea',
      'ink-2': '#c5c8ce',
      muted: '#959aa3',
      faint: '#5b6068',
      line: '#262a30',
      'line-2': '#323740',
      accent: '#7d9cff',
      'accent-ink': '#0b1020',
      'accent-soft': '#1d2640',
      heading: '#e6e7ea',
      'heading-2': '#c5c8ce',
      xref: '#7d9cff',
      focus: '#4a3516',
      'focus-line': '#c98b2e',
      accept: '#4cc38a',
      amend: '#7d9cff',
      decline: '#ff7b72',
      defer: '#e3b341',
      revise: '#b392f0',
      'hl-comment': '#4b4415',
      'hl-question': '#193553',
      'hl-suggestion': '#173d27',
      'hl-intent-here': '#35254f',
      'hl-mismatch': '#4f1f1c',
      'add-bg': '#10291b',
      'add-strong': '#1d5a35',
      'del-bg': '#2f1517',
      'del-strong': '#6b2a2a',
      'tk-kw': '#c792ea',
      'tk-str': '#8fd18f',
      'tk-com': '#7d838d',
      'tk-num': '#f2a65a',
      'tk-fn': '#82aaff',
      'tk-ty': '#5fd4d0',
      'tk-key': '#82aaff',
      shadow: SHADOW_DARK,
    },
  },
];

export const DEFAULT_DARK = 'gyokuro-desert';
export const DEFAULT_LIGHT = 'gyokuro-light';

/** The CSS for one theme: its tokens as custom properties under [data-theme]. */
export function themeCss(t: Theme): string {
  const vars = TOKENS.map((k) => `--${k}:${t.colors[k]};`).join('');
  return `:root[data-theme="${t.id}"]{${vars}color-scheme:${t.dark ? 'dark' : 'light'};}`;
}

/** Resolve a custom theme against its base into a full theme. */
export function resolveTheme(c: CustomTheme, builtins: Theme[] = THEMES): Theme | null {
  const base = builtins.find((b) => b.id === c.base);
  if (!base) return null;
  return { id: c.id, name: c.name, dark: base.dark, colors: { ...base.colors, ...c.colors } };
}

const VALUE = /^[#a-zA-Z0-9(),.%\s/+-]{1,120}$/;

/** Validate a custom theme file's content; errors name the offending field. */
export function validateTheme(
  v: unknown,
): { ok: true; theme: CustomTheme } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (typeof v !== 'object' || v === null || Array.isArray(v))
    return { ok: false, errors: ['must be a JSON object'] };
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(o.id)) {
    errors.push('id: lower-case letters, digits and dashes');
  } else if (THEMES.some((t) => t.id === o.id)) errors.push(`id: "${o.id}" is a built-in theme`);
  if (typeof o.name !== 'string' || !o.name.trim()) errors.push('name: required');
  if (typeof o.base !== 'string' || !THEMES.some((t) => t.id === o.base)) {
    errors.push(`base: one of ${THEMES.map((t) => t.id).join(', ')}`);
  }
  const colors: Partial<Record<Token, string>> = {};
  if (o.colors !== undefined) {
    if (typeof o.colors !== 'object' || o.colors === null) errors.push('colors: must be an object');
    else {
      for (const [k, val] of Object.entries(o.colors)) {
        if (!(TOKENS as readonly string[]).includes(k))
          errors.push(`colors.${k}: not a theme token`);
        else if (typeof val !== 'string' || !VALUE.test(val))
          errors.push(`colors.${k}: not a CSS colour value`);
        else colors[k as Token] = val;
      }
    }
  }
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    theme: { id: o.id as string, name: o.name as string, base: o.base as string, colors },
  };
}

/** WCAG relative luminance contrast ratio between two #rrggbb colours. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = hex.replace('#', '');
    const ch = [0, 2, 4].map((i) => Number.parseInt(n.slice(i, i + 2), 16) / 255);
    const [r, g, bl] = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
      number,
      number,
      number,
    ];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
