// Repository -> skeleton packet. The mechanical half of preparing a review:
// find what needs a ruling, read its fields, snapshot the intent, build the
// ledger. It never writes analysis — that is the agent's (intent principle 1).
// The only module that reads a repository.
//
// Two modes (design 0001, "Two modes"):
//   main   — the repository as it stands (working tree, or a git ref): every open
//            intent-feedback item and every cross-cutting open question.
//   branch — a branch against its base (base...head): every changed intent file,
//            every intent-feedback item the branch raises or re-statuses, every changed decision and
//            design entry, each carrying its diff.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, posix, relative, sep } from 'node:path';
import {
  type ChangeStatus,
  type FileChange,
  type IfStatus,
  type Item,
  type LedgerRow,
  PACKET_KIND,
  type Packet,
  type Ref,
  type RepoFile,
  type Section,
} from './schema.ts';

export type ScanOptions = {
  questions?: boolean;
  now?: Date;
  /** main mode: read this git ref instead of the working tree. */
  ref?: string;
  /** branch mode: the base to compare against (three-dot: from the merge base). */
  base?: string;
  /** branch mode: the head (default HEAD). */
  head?: string;
  /** What the snapshot carries: every tracked text file (default), or intent/ only. */
  files?: 'repo' | 'intent';
};

/** Files larger than this are left out of the snapshot (and listed as omitted). */
export const MAX_FILE_BYTES = 1024 * 1024;
export type ScanResult = { packet: Packet; warnings: string[] };

// Intent feedback: `intent-feedback.md` with `IF-NNN`, or the legacy `spec-feedback.md` with
// `SF-NNN` (the vocabulary before the rename). Ids are normalized to `IF-NNN`; source text keeps its spelling.
const SF_HEADING = /^#{2,3}\s+([IS]F-\d+)\s*(?:[—–:-]+\s*(.*))?$/;
const FEEDBACK_FILE = /^design\/(\d{4}-[^/]+)\/(?:intent|spec)-feedback\.md$/;
const normalizeIf = (id: string) => id.replace(/^S(?=F-)/, 'I'); // SF-NNN -> IF-NNN
const BULLET = /^- \*\*([^*]+?):\*\*\s?(.*)$/;
const LINK = /\]\(([^)\s]+)\)/g;
const OPEN_QUESTIONS = 'intent/00-foundation/open-questions.md';

export function scanRepo(root: string, opts: ScanOptions = {}): ScanResult {
  return opts.base === undefined ? scanMain(root, opts) : scanBranch(root, opts.base, opts);
}

// ---------------------------------------------------------------------------
// Main mode

function scanMain(root: string, opts: ScanOptions): ScanResult {
  const warnings: string[] = [];
  const tree = opts.ref === undefined ? fsTree(root) : gitTree(root, resolveRef(root, opts.ref));
  const fileText = new Map(readIntent(tree).map((f) => [f.path, f.text]));
  const items: Item[] = [];
  const ledger: LedgerRow[] = [];

  for (const sf of allSfs(tree, fileText, warnings)) {
    ledger.push(sf.row);
    if (sf.row.status === 'pending' || sf.row.status === 'ruled') items.push(sf.item);
  }
  if (opts.questions !== false) {
    const text = fileText.get(OPEN_QUESTIONS);
    if (text !== undefined) items.push(...parseOpenQuestions(text, OPEN_QUESTIONS));
  }
  items.push(...proposedDecisions(tree));
  const { files, omitted } = snapshot(tree, opts.files === 'intent' ? ['intent/'] : ['']);

  const name = basename(root);
  const ref = opts.ref === undefined ? gitRef(root, 'HEAD') : gitRef(root, opts.ref);
  const packet: Packet = {
    kind: PACKET_KIND,
    version: 1,
    mode: 'main',
    title: `Intent review — ${name}`,
    createdAt: (opts.now ?? new Date()).toISOString(),
    iteration: 1,
    producer: 'open-items',
    repo: ref ? { name, root, ref } : { name, root },
    items,
    files,
    ledger,
  };
  if (omitted.length) packet.omitted = omitted;
  return { packet, warnings };
}

/** ADRs still marked proposed: decisions nobody has taken yet. */
function proposedDecisions(tree: Tree): Item[] {
  const out: Item[] = [];
  for (const path of tree.list('design/decisions/')) {
    if (!/\/\d{4}-[^/]+\.md$/.test(path) || /\/0000-/.test(path)) continue;
    const text = tree.read(path) ?? '';
    const status = /\*\*Status:\*\*\s*`?([a-z-]+)/i.exec(text)?.[1]?.toLowerCase();
    if (status !== 'proposed') continue;
    const title = /^#\s+(.+)$/m.exec(text)?.[1]?.trim() ?? path;
    out.push({
      id: path,
      kind: 'decision',
      title,
      source: { path, line: 1 },
      evidence: [{ path }],
      sections: [],
    });
  }
  return out;
}

/** Every listed text file under the prefixes; binaries and very large files are omitted. */
export function snapshot(
  tree: Tree,
  prefixes: string[],
): { files: RepoFile[]; omitted: { path: string; reason: string }[] } {
  const files: RepoFile[] = [];
  const omitted: { path: string; reason: string }[] = [];
  const seen = new Set<string>();
  for (const prefix of prefixes) {
    for (const path of tree.list(prefix)) {
      if (seen.has(path)) continue;
      seen.add(path);
      const text = tree.read(path);
      if (text === undefined) continue;
      if (text.includes('\u0000')) omitted.push({ path, reason: 'binary' });
      else if (text.length > MAX_FILE_BYTES) {
        omitted.push({ path, reason: `too large (${Math.round(text.length / 1024)} KiB)` });
      } else files.push({ path, text });
    }
  }
  return { files, omitted };
}

function allSfs(tree: Tree, intent: Map<string, string>, warnings: string[]): ParsedSf[] {
  const out: ParsedSf[] = [];
  for (const path of tree.list('design/')) {
    const m = FEEDBACK_FILE.exec(path);
    if (!m || (m[1] as string).startsWith('0000-')) continue;
    const parsed = parseSpecFeedback(tree.read(path) ?? '', path, m[1] as string, intent);
    warnings.push(...parsed.warnings);
    out.push(...parsed.sfs);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Branch mode

function scanBranch(root: string, base: string, opts: ScanOptions): ScanResult {
  const warnings: string[] = [];
  const headRef = opts.head ?? 'HEAD';
  const headSha = resolveRef(root, headRef);
  const baseSha = git(root, ['merge-base', resolveRef(root, base), headSha]).trim();
  const head = gitTree(root, headSha);
  const baseTree = gitTree(root, baseSha);

  const changed = git(root, [
    'diff',
    '--name-status',
    '-M',
    baseSha,
    headSha,
    '--',
    'intent',
    'design',
  ])
    .split('\n')
    .filter(Boolean)
    .map(parseNameStatus);
  const patchOf = (c: { path: string; oldPath?: string }): string =>
    git(root, ['diff', '-M', baseSha, headSha, '--', ...(c.oldPath ? [c.oldPath] : []), c.path]);
  const change = (c: NameStatus): FileChange => {
    const fc: FileChange = { path: c.path, status: c.status, patch: patchOf(c) };
    if (c.oldPath) fc.oldPath = c.oldPath;
    return fc;
  };

  const intentText = new Map(readIntent(head).map((f) => [f.path, f.text]));
  // The snapshot is the repository at head; with --files intent, the intent plus every
  // changed design file, so the reviewer can always read and annotate what changed.
  const changedDesign = changed
    .filter((c) => c.path.startsWith('design/') && c.status !== 'deleted')
    .map((c) => c.path);
  const { files, omitted } =
    opts.files === 'intent' ? snapshot(head, ['intent/', ...changedDesign]) : snapshot(head, ['']);
  const inSnapshot = new Set(files.map((f) => f.path));
  const items: Item[] = [];

  // 1. Intent changes — always the human's judgment: intent governs everything else.
  for (const c of changed.filter((x) => x.path.startsWith('intent/'))) {
    const fc = change(c);
    const item: Item = {
      id: `intent-change/${c.path}`,
      kind: 'intent-change',
      title: `${c.path} — ${c.status}`,
      attention: 'judgment',
      source: { path: c.path, line: firstHunkLine(fc.patch) },
      evidence: inSnapshot.has(c.path) ? [{ path: c.path }] : [],
      sections: [],
      changes: [fc],
    };
    items.push(item);
  }

  // 2. Intent feedback the branch raises, re-statuses, or rewrites.
  const baseIntent = new Map(readIntent(baseTree).map((f) => [f.path, f.text]));
  for (const c of changed.filter((x) => FEEDBACK_FILE.test(x.path))) {
    if (c.status === 'deleted') continue;
    const entry = c.path.split('/')[1] as string;
    const now = parseSpecFeedback(head.read(c.path) ?? '', c.path, entry, intentText);
    const was = parseSpecFeedback(
      baseTree.read(c.oldPath ?? c.path) ?? '',
      c.path,
      entry,
      baseIntent,
    );
    warnings.push(...now.warnings);
    const before = new Map(was.sfs.map((s) => [s.item.id, s]));
    for (const sf of now.sfs) {
      const prev = before.get(sf.item.id);
      let note: string | null = null;
      if (!prev) note = 'Raised on this branch.';
      else if ((prev.item.statusLine ?? '') !== (sf.item.statusLine ?? '')) {
        note = `Status changed on this branch — was: ${prev.item.statusLine ?? 'pending (no Status line)'}`;
        if (prev.item.statusLine) sf.item.baseStatusLine = prev.item.statusLine;
      } else if (prev.body !== sf.body) note = 'Text edited on this branch.';
      if (!note) continue;
      sf.item.attention = 'judgment';
      sf.item.sections.unshift({ key: 'on-branch', label: 'On this branch', text: note });
      items.push(sf.item);
    }
  }

  // 3. Decisions (ADRs), then 4. design entries — one item per entry directory.
  const groups = new Map<string, NameStatus[]>();
  for (const c of changed.filter((x) => x.path.startsWith('design/'))) {
    const m = /^design\/(decisions\/[^/]+|\d{4}-[^/]+)\//.exec(`${c.path}/`);
    const key = m ? (m[1] as string).replace(/\/$/, '') : '(other)';
    const k = key.startsWith('decisions/') ? key : (key.split('/')[0] as string);
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  const decisionItems: Item[] = [];
  const entryItems: Item[] = [];
  for (const [key, cs] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const isDecision = key.startsWith('decisions/');
    const main = isDecision ? cs[0] : (cs.find((c) => c.path.endsWith('/README.md')) ?? cs[0]);
    const mainText = main && main.status !== 'deleted' ? head.read(main.path) : undefined;
    const h1 = mainText ? /^#\s+(.+)$/m.exec(mainText)?.[1]?.trim() : undefined;
    const added = cs.every((c) => c.status === 'added');
    const status = added
      ? 'added'
      : cs.every((c) => c.status === 'deleted')
        ? 'deleted'
        : 'modified';
    const item: Item = {
      id: isDecision ? `design/${key}` : `design/${key}`,
      kind: isDecision ? 'decision' : 'design-entry',
      title: `${h1 ?? (key === '(other)' ? 'design/ (other files)' : key)} — ${status}`,
      source: { path: main?.path ?? 'design/', line: 1 },
      evidence: [],
      sections: [],
      changes: cs.map(change),
    };
    const context = mainText ? intentLinks(mainText, main?.path ?? '', intentText) : [];
    if (context.length) item.context = context;
    (isDecision ? decisionItems : entryItems).push(item);
  }
  items.push(...decisionItems, ...entryItems);

  const ledger = allSfs(head, intentText, []).map((s) => s.row);
  const name = basename(root);
  const packet: Packet = {
    kind: PACKET_KIND,
    version: 1,
    mode: 'branch',
    title: `Branch review — ${name}: ${headRef} vs ${base}`,
    createdAt: (opts.now ?? new Date()).toISOString(),
    iteration: 1,
    repo: { name, root, ref: `${headRef}@${headSha.slice(0, 12)}` },
    producer: 'branch-review',
    change: { base: { ref: base, sha: baseSha }, head: { ref: headRef, sha: headSha } },
    items,
    files,
    ledger,
  };
  if (omitted.length) packet.omitted = omitted;
  return { packet, warnings };
}

type NameStatus = { path: string; status: ChangeStatus; oldPath?: string };

export function parseNameStatus(line: string): NameStatus {
  const [code = '', a = '', b] = line.split('\t');
  const status: ChangeStatus =
    code[0] === 'A'
      ? 'added'
      : code[0] === 'D'
        ? 'deleted'
        : code[0] === 'R'
          ? 'renamed'
          : 'modified';
  return status === 'renamed' && b ? { path: b, status, oldPath: a } : { path: a, status };
}

function firstHunkLine(patch: string): number {
  const m = /^@@ -\d+(?:,\d+)? \+(\d+)/m.exec(patch);
  return Math.max(1, Number(m?.[1] ?? 1));
}

/** Links from a Markdown file into intent/, resolved from its directory. */
function intentLinks(text: string, path: string, intent: Map<string, string>): Ref[] {
  const dir = posix.dirname(path);
  const out: Ref[] = [];
  for (const m of text.matchAll(LINK)) {
    const target = posix.normalize(posix.join(dir, (m[1] as string).split('#')[0] as string));
    if (target.startsWith('intent/') && intent.has(target) && !out.some((p) => p.path === target)) {
      out.push({ path: target });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Intent-feedback files (and legacy spec-feedback files)

export type ParsedSf = { row: LedgerRow; item: Item; body: string };

export function parseSpecFeedback(
  text: string,
  path: string,
  entry: string,
  intent: Map<string, string>,
): { sfs: ParsedSf[]; warnings: string[] } {
  const lines = text.split('\n');
  const warnings: string[] = [];
  const heads: { i: number; id: string; title: string }[] = [];
  lines.forEach((l, i) => {
    const m = SF_HEADING.exec(l);
    if (m)
      heads.push({
        i,
        id: normalizeIf(m[1] as string),
        title: (m[2] ?? '').trim() || (m[1] as string),
      });
  });
  const firstHead = heads[0]?.i ?? lines.length;
  const preamble = lines.slice(1, firstHead).join('\n').trim();

  const sfs: ParsedSf[] = heads.map((h, n) => {
    let end = heads[n + 1]?.i ?? lines.length;
    for (let k = h.i + 1; k < end; k++) {
      if (/^#{1,2}\s/.test(lines[k] as string)) {
        end = k;
        break;
      }
    }
    const block = lines.slice(h.i + 1, end);
    const bullets = parseBullets(block);
    const status = bullets.find((b) => b.key === 'status');
    const statusLine = status?.text.replace(/\s+/g, ' ').trim();
    const sfStatus = classifyStatus(statusLine);
    const slice = bullets.find((b) => b.key === 'slice');
    const evidence = slice ? slicePassages(slice.text, path, intent) : [];
    const id = `${entry}/${h.id}`;
    const source = { path, line: h.i + 1 };

    let sections: Section[] = bullets
      .filter((b) => b.key !== 'status')
      .map((b) => ({ key: b.key, label: b.label, text: b.text }));
    if (bullets.length === 0) {
      const body = block.join('\n').trim();
      warnings.push(`${path}:${h.i + 1}: ${h.id} has no "- **Label:**" bullets; kept as one body`);
      sections = body ? [{ key: 'body', label: 'Body', text: body }] : [];
    }
    if (preamble) sections.push({ key: 'entry-context', label: 'Entry context', text: preamble });

    const row: LedgerRow = {
      id,
      entry,
      title: h.title,
      status: sfStatus,
      slices: [...new Set(evidence.map((p) => p.path))],
      source,
    };
    if (statusLine) row.statusLine = statusLine;
    const item: Item = {
      id,
      kind: 'if',
      title: h.title,
      status: sfStatus,
      source,
      evidence,
      sections,
    };
    if (statusLine) item.statusLine = statusLine;
    return { row, item, body: block.join('\n').trim() };
  });
  return { sfs, warnings };
}

type Bullet = { key: string; label: string; text: string };

/** Top-level `- **Label:** text` bullets, continuation lines kept (dedented). */
export function parseBullets(block: string[]): Bullet[] {
  const out: Bullet[] = [];
  let cur: { label: string; lines: string[] } | null = null;
  const flush = () => {
    if (cur)
      out.push({ key: keyOf(cur.label), label: cur.label, text: cur.lines.join('\n').trim() });
    cur = null;
  };
  for (const line of block) {
    const m = BULLET.exec(line);
    if (m) {
      flush();
      cur = { label: (m[1] as string).trim(), lines: [m[2] as string] };
    } else if (cur && line.trim() !== '' && !line.startsWith('- ')) {
      cur.lines.push(line.replace(/^ {2}/, ''));
    } else {
      flush();
    }
  }
  flush();
  return out;
}

export function keyOf(label: string): string {
  const l = label.toLowerCase();
  if (l.startsWith('assumption')) return 'assumption';
  if (l.startsWith('proposed revision') || l === 'revision') return 'revision';
  return l.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function classifyStatus(line: string | undefined): IfStatus {
  if (!line) return 'pending';
  const s = line.replace(/`/g, '').trim().toLowerCase();
  if (s.startsWith('adjudicated')) return 'adjudicated';
  if (s.startsWith('declined')) return 'declined';
  if (/^pending\s*[—–-]+\s*ruled/.test(s)) return 'ruled';
  return 'pending';
}

/** Links into intent/ from a Slice bullet, resolved from the entry's directory. */
function slicePassages(text: string, sfPath: string, intent: Map<string, string>): Ref[] {
  const dir = posix.dirname(sfPath);
  const out: Ref[] = [];
  const section = /_([^_]+)_/.exec(text.replace(/\[[^\]]*\]\([^)]*\)/g, ''))?.[1];
  const quotes = [...text.matchAll(/\("([^"]+)"/g)].map((m) => m[1] as string);
  for (const m of text.matchAll(LINK)) {
    const target = (m[1] as string).split('#')[0] as string;
    const path = posix.normalize(posix.join(dir, target));
    if (!path.startsWith('intent/') || !intent.has(path)) continue;
    if (out.some((p) => p.path === path)) continue;
    const p: Ref = { path };
    if (out.length === 0) {
      if (section) p.section = section;
      const q = findQuote(intent.get(path) as string, quotes);
      if (q) p.quote = q;
    }
    out.push(p);
  }
  return out;
}

/**
 * The exact source text matching a quote cited in an intent-feedback item, if one can be found:
 * the whole quote or, for an elided quote ("a … b"), its longest fragment —
 * matched across line wrapping, returned as the file's own text.
 */
export function findQuote(file: string, quotes: string[]): string | undefined {
  let best: string | undefined;
  for (const q of quotes) {
    for (const frag of [q, ...q.split('…')]) {
      const words = frag
        .trim()
        .split(/\s+/)
        .map((w) => w.replace(/[*_`]/g, ''))
        .filter(Boolean);
      if (words.length < 3) continue;
      // Emphasis markers may sit on either side of any word, in the intent-feedback item or the file.
      const esc = words.map((w) => `[*_\`]*${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[*_\`]*`);
      const m = new RegExp(esc.join('\\s+'), 'i').exec(file);
      if (m && (!best || m[0].length > best.length)) best = m[0];
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Open questions: the cross-cutting bullets, before the per-slice index.

export function parseOpenQuestions(text: string, path: string): Item[] {
  const lines = text.split('\n');
  const items: Item[] = [];
  let inSection = false;
  let pastIndex = false;
  let cur: { line: number; raw: string[] } | null = null;
  const flush = () => {
    if (!cur) return;
    const raw = cur.raw.join('\n');
    const title = /^- \*\*(.+?)\*\*/.exec(raw)?.[1]?.replace(/[.:]$/, '').trim();
    if (title && !raw.includes('<')) {
      const body = raw
        .replace(/^- /, '')
        .split('\n')
        .map((l) => l.replace(/^ {2}/, ''))
        .join('\n');
      items.push({
        id: `OQ/${slug(title)}`,
        kind: 'question',
        title,
        status: 'pending',
        source: { path, line: cur.line },
        evidence: [{ path, quote: raw.replace(/^- /, '') }],
        sections: [{ key: 'question', label: 'Question', text: body }],
      });
    }
    cur = null;
  };
  lines.forEach((line, i) => {
    if (/^##\s/.test(line)) {
      flush();
      // Only the cross-cutting section(s) before the per-slice index are open items;
      // the index and anything after it (e.g. recently resolved) are not.
      if (/^##\s+index/i.test(line)) pastIndex = true;
      inSection = !pastIndex;
      return;
    }
    if (!inSection) return;
    if (line.startsWith('- ')) {
      flush();
      cur = { line: i + 1, raw: [line] };
    } else if (cur && line.startsWith('  ') && line.trim() !== '') {
      cur.raw.push(line);
    } else {
      flush();
    }
  });
  flush();
  const seen = new Map<string, number>();
  for (const it of items) {
    const n = (seen.get(it.id) ?? 0) + 1;
    seen.set(it.id, n);
    if (n > 1) it.id = `${it.id}-${n}`;
  }
  return items;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

// ---------------------------------------------------------------------------
// The repository, read through a tree: the working tree, or a git ref.

export type Tree = {
  list: (prefix: string) => string[];
  read: (path: string) => string | undefined;
};

export function fsTree(root: string): Tree {
  let tracked: string[] | null = null;
  try {
    // Tracked plus untracked-but-not-ignored: what the repository's own .gitignore admits.
    tracked = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
      .split('\0')
      .filter(Boolean)
      .filter((p) => existsSync(join(root, p)))
      .sort();
  } catch {
    tracked = null; // not a git checkout: walk the directory instead
  }
  return {
    list(prefix) {
      if (tracked) return [...new Set(tracked)].filter((p) => p.startsWith(prefix));
      const out: string[] = [];
      const walk = (dir: string) => {
        if (!existsSync(dir)) return;
        for (const name of readdirSync(dir).sort()) {
          if (name === '.git' || name === 'node_modules') continue;
          const abs = join(dir, name);
          if (statSync(abs).isDirectory()) walk(abs);
          else out.push(relative(root, abs).split(sep).join('/'));
        }
      };
      walk(join(root, prefix));
      return out.sort();
    },
    read(path) {
      try {
        return readFileSync(join(root, path), 'utf8');
      } catch {
        return undefined;
      }
    },
  };
}

export function gitTree(root: string, sha: string): Tree {
  return {
    list(prefix) {
      // An empty pathspec is an error to git; no prefix means the whole tree.
      const spec = prefix === '' ? [] : ['--', prefix];
      return git(root, ['ls-tree', '-r', '--name-only', sha, ...spec])
        .split('\n')
        .filter(Boolean)
        .sort();
    },
    read(path) {
      try {
        return git(root, ['show', `${sha}:${path}`]);
      } catch {
        return undefined;
      }
    },
  };
}

export function readIntent(tree: Tree): RepoFile[] {
  return tree
    .list('intent/')
    .filter((p) => p.endsWith('.md'))
    .map((path) => ({ path, text: tree.read(path) ?? '' }));
}

function git(root: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function resolveRef(root: string, ref: string): string {
  try {
    return git(root, ['rev-parse', '--verify', `${ref}^{commit}`]).trim();
  } catch {
    throw new Error(`cannot resolve git ref "${ref}" in ${root}`);
  }
}

function gitRef(root: string, ref: string): string | undefined {
  try {
    const name = ref === 'HEAD' ? git(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim() : ref;
    return `${name}@${git(root, ['rev-parse', '--short=12', ref]).trim()}`;
  } catch {
    return undefined;
  }
}
