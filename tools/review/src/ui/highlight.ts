// A small, dependency-free syntax highlighter: a hand-written lexer per line
// with a carried state for block comments. Good enough to make code readable,
// never a parser. Emits style ranges; the renderer turns them into spans that
// keep every character's source offset.

import type { Range } from './source.ts';

export type Lang =
  | 'markdown'
  | 'ts'
  | 'json'
  | 'yaml'
  | 'toml'
  | 'shell'
  | 'css'
  | 'html'
  | 'python'
  | 'go'
  | 'rust'
  | 'plain';

export type HlState = { inBlockComment: boolean };

const EXT: Record<string, Lang> = {
  md: 'markdown',
  markdown: 'markdown',
  ts: 'ts',
  tsx: 'ts',
  mts: 'ts',
  cts: 'ts',
  js: 'ts',
  jsx: 'ts',
  mjs: 'ts',
  cjs: 'ts',
  json: 'json',
  jsonc: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  fish: 'shell',
  css: 'css',
  scss: 'css',
  html: 'html',
  htm: 'html',
  svg: 'html',
  xml: 'html',
  py: 'python',
  go: 'go',
  rs: 'rust',
};

export function langOf(path: string): Lang {
  const base = path.split('/').pop() ?? path;
  if (/^(\.envrc|\.?[a-z]*rc|Dockerfile|Makefile)$/i.test(base) && !base.includes('.json')) {
    return base === 'Makefile' || base === 'Dockerfile' ? 'shell' : 'shell';
  }
  const ext = base.includes('.') ? (base.split('.').pop() ?? '').toLowerCase() : '';
  return EXT[ext] ?? 'plain';
}

const KEYWORDS: Partial<Record<Lang, Set<string>>> = {
  ts: new Set(
    'abstract as async await break case catch class const continue debugger declare default delete do else enum export extends false finally for from function get if implements import in instanceof interface is keyof let new null of private protected public readonly return satisfies set static super switch this throw true try type typeof undefined var void while with yield'.split(
      ' ',
    ),
  ),
  json: new Set(['true', 'false', 'null']),
  yaml: new Set(['true', 'false', 'null', 'yes', 'no', 'on', 'off']),
  toml: new Set(['true', 'false']),
  shell: new Set(
    'if then else elif fi for in do done while until case esac function return local export set unset echo exit source alias'.split(
      ' ',
    ),
  ),
  python: new Set(
    'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield'.split(
      ' ',
    ),
  ),
  go: new Set(
    'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false'.split(
      ' ',
    ),
  ),
  rust: new Set(
    'as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while'.split(
      ' ',
    ),
  ),
  css: new Set(['important', 'inherit', 'initial', 'unset', 'none', 'auto']),
};

const SLASH_COMMENTS = new Set<Lang>(['ts', 'go', 'rust', 'css']);
const HASH_COMMENTS = new Set<Lang>(['shell', 'yaml', 'toml', 'python']);

/** Style ranges (offsets relative to the line) and the state after it. */
export function highlightLine(
  lang: Lang,
  text: string,
  state: HlState,
): { ranges: Range[]; state: HlState } {
  const ranges: Range[] = [];
  if (lang === 'plain' || lang === 'markdown') return { ranges, state };
  const kw = KEYWORDS[lang];
  let inBlock = state.inBlockComment;
  let i = 0;
  const n = text.length;
  const push = (start: number, end: number, cls: string) => {
    if (end > start) ranges.push({ start, end, cls });
  };

  // Keys at the start of a line in data languages read as keys, not words.
  if (!inBlock && (lang === 'yaml' || lang === 'toml')) {
    const m = /^(\s*-?\s*)([\w.@/-]+|"[^"]*")(\s*[:=])/.exec(text);
    if (m) {
      push(m[1]?.length ?? 0, (m[1]?.length ?? 0) + (m[2]?.length ?? 0), 'tk-key');
      i = m[0].length;
    } else if (lang === 'toml' && /^\s*\[/.test(text)) {
      push(0, n, 'tk-kw');
      return { ranges, state: { inBlockComment: false } };
    }
  }

  while (i < n) {
    if (inBlock) {
      const close = text.indexOf(lang === 'html' ? '-->' : '*/', i);
      const end = close === -1 ? n : close + (lang === 'html' ? 3 : 2);
      push(i, end, 'tk-com');
      i = end;
      inBlock = close === -1;
      continue;
    }
    const ch = text[i] as string;
    const rest = text.slice(i);
    if (SLASH_COMMENTS.has(lang) && rest.startsWith('/*')) {
      inBlock = true;
      continue;
    }
    if (lang === 'html' && rest.startsWith('<!--')) {
      inBlock = true;
      continue;
    }
    if (
      (SLASH_COMMENTS.has(lang) && lang !== 'css' && rest.startsWith('//')) ||
      (HASH_COMMENTS.has(lang) && ch === '#')
    ) {
      push(i, n, 'tk-com');
      break;
    }
    if (
      ch === '"' ||
      ch === "'" ||
      (ch === '`' && (lang === 'ts' || lang === 'go' || lang === 'shell'))
    ) {
      let j = i + 1;
      while (j < n && text[j] !== ch) j += text[j] === '\\' ? 2 : 1;
      const end = Math.min(n, j + 1);
      // A JSON string followed by a colon is a key.
      const isKey = lang === 'json' && /^\s*:/.test(text.slice(end));
      push(i, end, isKey ? 'tk-key' : 'tk-str');
      i = end;
      continue;
    }
    if (/[0-9]/.test(ch) && !/[\w$]/.test(text[i - 1] ?? '')) {
      const m = /^(0x[0-9a-f_]+|\d[\d_]*(\.\d+)?(e[+-]?\d+)?)/i.exec(rest);
      if (m) {
        push(i, i + m[0].length, 'tk-num');
        i += m[0].length;
        continue;
      }
    }
    if (/[A-Za-z_$@]/.test(ch)) {
      const m = /^[A-Za-z_$@][\w$-]*/.exec(rest) as RegExpExecArray;
      let word = m[0];
      if (lang !== 'css' && lang !== 'html' && lang !== 'shell') word = word.replace(/-.*$/, '');
      const end = i + word.length;
      if (kw?.has(word)) push(i, end, 'tk-kw');
      else if (lang === 'html' && text[i - 1] === '<') push(i, end, 'tk-kw');
      else if (/^\s*\(/.test(text.slice(end)) && lang !== 'css') push(i, end, 'tk-fn');
      else if (/^[A-Z][a-z0-9]/.test(word) && lang !== 'shell') push(i, end, 'tk-ty');
      i = end;
      continue;
    }
    i++;
  }
  return { ranges, state: { inBlockComment: inBlock } };
}
