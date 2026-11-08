// Repository -> skeleton packet. The mechanical half of preparing a review:
// find what needs a ruling, read its fields, snapshot the intent, build the
// ledger. It never writes analysis — that is the agent's (intent principle 1).
// The only module that reads a repository.
//
// Two modes (design 0001, "Two modes"):
//   main   — the repository as it stands (working tree, or a git ref): every open
//            intent-feedback item (in an intent-feedback file, or written inline in an
//            entry's README the older way), every cross-cutting open question that is not
//            a standing watch, and every ADR still proposed.
//   branch — a branch against its base (base...head): every changed intent file,
//            every intent-feedback item the branch raises or re-statuses, every changed decision and
//            design entry, each carrying its diff.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, posix, relative, sep } from 'node:path';
import {
  type ChangeStatus,
  type ContextRef,
  draftQuestion,
  type FileChange,
  type IfStatus,
  type Item,
  type LedgerRow,
  PACKET_KIND,
  PACKET_VERSION,
  type Packet,
  type Ref,
  type RepoFile,
  type Ruled,
  type Section,
} from './schema.ts';

export type ScanOptions = {
  questions?: boolean;
  /** main mode: also offer open intent feedback written inline in entry READMEs (default true). */
  inline?: boolean;
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
const ENTRY_README = /^design\/(\d{4}-[^/]+)\/README\.md$/;
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
  const { files, omitted } = snapshot(tree, opts.files === 'intent' ? ['intent/'] : ['']);
  const inSnapshot = new Set(files.map((f) => f.path));

  const open = (sf: ParsedSf) => sf.row.status === 'pending' || sf.row.status === 'ruled';
  for (const sf of allSfs(tree, fileText, warnings)) {
    ledger.push(sf.row);
    if (open(sf)) items.push(sf.item);
  }
  const inline = allInline(tree, fileText, warnings, new Set(ledger.map((r) => r.id)));
  for (const sf of inline) {
    ledger.push(sf.row);
    if (open(sf) && opts.inline !== false) items.push(sf.item);
  }
  if (inline.length) {
    const open = inline.filter((x) => x.row.status === 'pending').length;
    warnings.push(
      `${inline.length} intent-feedback items are written inline in entry READMEs; ${open} carry no settled disposition` +
        (opts.inline === false
          ? ' (left out of the items: --no-inline)'
          : ' — group them for the human'),
    );
  }
  if (opts.questions !== false) {
    const text = fileText.get(OPEN_QUESTIONS);
    if (text !== undefined) {
      const oq = parseOpenQuestions(text, OPEN_QUESTIONS);
      items.push(...oq.items);
      if (oq.standing.length) {
        warnings.push(
          `${oq.standing.length} open question(s) marked _Standing watch_ left out: ${oq.standing.join(', ')}`,
        );
      }
    }
  }
  items.push(...proposedDecisions(tree));
  for (const it of items) withEntryContext(it, tree, inSnapshot);

  const name = basename(root);
  const ref = opts.ref === undefined ? gitRef(root, 'HEAD') : gitRef(root, opts.ref);
  const packet: Packet = {
    kind: PACKET_KIND,
    version: PACKET_VERSION,
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
    const item: Item = {
      id: path,
      kind: 'decision',
      question: '',
      title,
      source: { path, line: 1 },
      evidence: [{ path }],
      sections: [],
    };
    item.question = draftQuestion(item);
    out.push(item);
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

/** Intent feedback written inline under an entry README's `## Intent feedback` heading. */
function allInline(
  tree: Tree,
  intent: Map<string, string>,
  warnings: string[],
  known: Set<string>,
): ParsedSf[] {
  const out: ParsedSf[] = [];
  for (const path of tree.list('design/')) {
    const m = ENTRY_README.exec(path);
    if (!m || (m[1] as string).startsWith('0000-')) continue;
    for (const sf of parseInlineFeedback(tree.read(path) ?? '', path, m[1] as string, intent)) {
      if (known.has(sf.item.id)) {
        warnings.push(
          `${path}:${sf.item.source.line}: ${sf.item.id} is also in a feedback file; kept that one`,
        );
        continue;
      }
      out.push(sf);
    }
  }
  return out;
}

/**
 * Context the scanner can name without judgment: where an intent-feedback item is
 * written (the whole block) and the design entry that raised it — each only when the
 * snapshot carries it, so the packet stays self-contained.
 */
function withEntryContext(it: Item, tree: Tree, inSnapshot: Set<string>): void {
  const ctx: ContextRef[] = [...(it.context ?? [])];
  const has = (p: string) => ctx.some((c) => c.path === p);
  if (isIfKind(it.kind) && inSnapshot.has(it.source.path) && !has(it.source.path)) {
    const text = tree.read(it.source.path) ?? '';
    const end = blockEnd(text, it.source.line);
    ctx.push({
      path: it.source.path,
      lines: { start: it.source.line, end },
      why:
        it.category === 'inline'
          ? 'Where this intent-feedback item is written, inline in its design entry.'
          : 'Where this intent-feedback item is written, as the build raised it.',
    });
  }
  const entry = /^design\/(\d{4}-[^/]+)\//.exec(it.source.path)?.[1];
  const readme = entry ? `design/${entry}/README.md` : undefined;
  if (readme && inSnapshot.has(readme) && !has(readme)) {
    ctx.push({ path: readme, why: 'The design entry that raised it: what was being built.' });
  }
  if (ctx.length) it.context = ctx;
}

const isIfKind = (k: string) => k === 'if' || k === 'sf';

/** The last line of the Markdown block starting at `line`: up to the next heading or item. */
function blockEnd(text: string, line: number): number {
  const lines = text.split('\n');
  const first = lines[line - 1] ?? '';
  const heading = /^#{1,6}\s/.test(first);
  let end = line;
  for (let k = line; k < lines.length; k++) {
    const l = lines[k] as string;
    if (/^#{1,6}\s/.test(l)) break;
    if (!heading && (/^- /.test(l) || (/^\S/.test(l) && (lines[k - 1] ?? '').trim() === ''))) break;
    if (l.trim() !== '') end = k + 1;
  }
  return end;
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
      question: draftQuestion({ id: c.path, kind: 'intent-change', title: c.path }),
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
      id: `design/${key}`,
      kind: isDecision ? 'decision' : 'design-entry',
      question: '',
      title: `${h1 ?? (key === '(other)' ? 'design/ (other files)' : key)} — ${status}`,
      source: { path: main?.path ?? 'design/', line: 1 },
      evidence: [],
      sections: [],
      changes: cs.map(change),
    };
    item.question = draftQuestion(item);
    const context = mainText ? intentLinks(mainText, main?.path ?? '', intentText) : [];
    if (context.length) {
      item.context = context.map((r) => ({
        ...r,
        why: 'Intent this design entry says it serves.',
      }));
    }
    (isDecision ? decisionItems : entryItems).push(item);
  }
  items.push(...decisionItems, ...entryItems);

  const ledger = allSfs(head, intentText, []).map((s) => s.row);
  const name = basename(root);
  const packet: Packet = {
    kind: PACKET_KIND,
    version: PACKET_VERSION,
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

    const parsed = feedbackItem({
      id,
      entry,
      title: h.title,
      statusLine,
      source,
      evidence,
      sections,
    });
    if (!statusLine) parsed.row.inferred = 'no Status line: pending by default';
    return { ...parsed, body: block.join('\n').trim() };
  });
  return { sfs, warnings };
}

/** The ledger row and the item for one intent-feedback item, however it was written. */
function feedbackItem(f: {
  id: string;
  entry: string;
  title: string;
  statusLine: string | undefined;
  source: { path: string; line: number };
  evidence: Ref[];
  sections: Section[];
}): { row: LedgerRow; item: Item } {
  const status = classifyStatus(f.statusLine);
  const row: LedgerRow = {
    id: f.id,
    entry: f.entry,
    title: f.title,
    status,
    slices: [...new Set(f.evidence.map((p) => p.path))],
    source: f.source,
  };
  if (f.statusLine) row.statusLine = f.statusLine;
  const item: Item = {
    id: f.id,
    kind: 'if',
    question: '',
    title: f.title,
    status,
    source: f.source,
    evidence: f.evidence,
    sections: f.sections,
  };
  item.question = draftQuestion(item);
  if (f.statusLine) item.statusLine = f.statusLine;
  const ruled = status === 'ruled' ? parseRuled(f.statusLine ?? '') : undefined;
  if (ruled) item.ruled = ruled;
  return { row, item };
}

/**
 * A ruled-but-pending Status line, as the review skill writes it:
 * `pending — ruled by <who> <YYYY-MM-DD> [(<where>)], awaiting the intent edit: <ruling>`.
 */
export function parseRuled(line: string): Ruled | undefined {
  const m =
    /ruled by\s+(.+?)\s+(\d{4}-\d{2}-\d{2})\s*(?:\(([^)]*)\))?\s*,?\s*awaiting the intent edit:?\s*([\s\S]*)$/i.exec(
      line.replace(/`/g, ''),
    );
  if (!m) return undefined;
  const ruling = (m[4] as string).trim();
  if (!ruling) return undefined;
  const out: Ruled = { by: (m[1] as string).trim(), on: m[2] as string, ruling };
  if (m[3]) out.where = (m[3] as string).trim();
  return out;
}

// Inline intent feedback: the shape older entries used before intent-feedback files —
// `- **IF-001** — <slice>, <section>. _Friction:_ … _Assumption…:_ … _Proposed revision:_ …`
// under the README's `## Intent feedback` heading, settled by a trailing
// `_Disposition:_ adjudicated — <link>` (or `declined — <why>`), or by an explicit Status.
const INLINE_HEAD = /^##\s+(?:intent|spec)[- ]feedback\b/i;
const INLINE_ITEM = /^- \*\*([IS]F-\d+)\*\*\s*[—–:-]*\s?(.*)$/;
const INLINE_LABEL =
  /(?:_|\*\*)(Friction|Assumption[^:_*]{0,40}|Proposed revision|Disposition|Status|Adjudicated|Declined)(?::_|:\*\*|\*\*:|_:)\s*/g;

export function parseInlineFeedback(
  text: string,
  path: string,
  entry: string,
  intent: Map<string, string>,
): ParsedSf[] {
  const lines = text.split('\n');
  const out: ParsedSf[] = [];
  let inSection = false;
  let cur: { line: number; id: string; lines: string[] } | null = null;
  const flush = () => {
    if (cur) out.push(inlineItem(cur, path, entry, intent));
    cur = null;
  };
  lines.forEach((l, i) => {
    if (/^##\s/.test(l)) {
      flush();
      inSection = INLINE_HEAD.test(l);
      return;
    }
    if (!inSection) return;
    const m = INLINE_ITEM.exec(l);
    if (m) {
      flush();
      cur = { line: i + 1, id: normalizeIf(m[1] as string), lines: [m[2] as string] };
    } else if (cur && (l.trim() === '' || l.startsWith('  '))) {
      cur.lines.push(l.replace(/^ {2}/, ''));
    } else flush();
  });
  flush();
  return out;
}

function inlineItem(
  cur: { line: number; id: string; lines: string[] },
  path: string,
  entry: string,
  intent: Map<string, string>,
): ParsedSf {
  const body = cur.lines.join('\n').trim();
  const marks = [...body.matchAll(INLINE_LABEL)];
  const lead = (marks.length ? body.slice(0, marks[0]?.index) : body).trim();
  const parts: { label: string; text: string }[] = [];
  marks.forEach((m, n) => {
    const from = (m.index as number) + m[0].length;
    const to = marks[n + 1]?.index ?? body.length;
    parts.push({ label: (m[1] as string).trim(), text: body.slice(from, to).trim() });
  });
  const disposition = parts.find((x) =>
    /^(disposition|status|adjudicated|declined)$/i.test(x.label),
  );
  const said = disposition?.text.replace(/\s+/g, ' ').replace(/\*\*/g, '').trim();
  // `_Adjudicated:_ <how>` and `_Declined:_ <why>` say the disposition in the label itself.
  let statusLine =
    said && /^(adjudicated|declined)$/i.test(disposition?.label ?? '')
      ? `${(disposition?.label ?? '').toLowerCase()} — ${said}`
      : said;
  let inferred: string | undefined;
  if (!statusLine && /`pending`\.\s*$/.test(body)) statusLine = 'pending.';
  if (!statusLine && /\*\*Resolution\b/.test(body)) {
    statusLine = 'adjudicated — a Resolution paragraph in the entry records the ruling.';
    inferred = 'a Resolution paragraph, no disposition line';
  }
  if (!statusLine) inferred = 'no Status or disposition line';
  const sections: Section[] = [];
  if (lead) sections.push({ key: 'slice', label: 'Slice', text: lead });
  for (const x of parts) {
    if (x === disposition) continue;
    const key = keyOf(x.label);
    if (sections.some((s) => s.key === key)) continue;
    sections.push({ key, label: x.label, text: x.text });
  }
  const friction = parts.find((x) => /^friction$/i.test(x.label))?.text ?? lead;
  const parsed = feedbackItem({
    id: `${entry}/${cur.id}`,
    entry,
    title: firstSentence(friction),
    statusLine: inferred ? undefined : statusLine,
    source: { path, line: cur.line },
    evidence: slicePassages(lead, path, intent, /"([^"]+)"/g),
    sections,
  });
  parsed.row.form = 'inline';
  parsed.item.category = 'inline';
  if (inferred) {
    parsed.row.inferred = inferred;
    if (statusLine) {
      parsed.row.status = classifyStatus(statusLine);
      parsed.item.status = parsed.row.status;
    }
  }
  return { ...parsed, body };
}

/** A plain one-line title from Markdown prose: its first sentence, links and markers dropped. */
function firstSentence(text: string): string {
  const plain = text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const s = /^(.{12,}?[.;:!?])(\s|$)/.exec(plain)?.[1] ?? plain;
  const t = s.replace(/[.;:]$/, '');
  if (t.length <= 110) return t;
  return `${t.slice(0, 107).replace(/\s+\S*$/, '')}…`;
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
function slicePassages(
  text: string,
  sfPath: string,
  intent: Map<string, string>,
  quoted: RegExp = /\("([^"]+)"/g,
): Ref[] {
  const dir = posix.dirname(sfPath);
  const out: Ref[] = [];
  const section = /_([^_]+)_/.exec(text.replace(/\[[^\]]*\]\([^)]*\)/g, ''))?.[1];
  const quotes = [...text.matchAll(quoted)].map((m) => m[1] as string);
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

/** Marks a cross-cutting bullet as a check to repeat, not a question to settle. */
export const STANDING_WATCH = /_Standing watch[.:]?_/i;

export function parseOpenQuestions(
  text: string,
  path: string,
): { items: Item[]; standing: string[] } {
  const lines = text.split('\n');
  const items: Item[] = [];
  const standing: string[] = [];
  let inSection = false;
  let pastIndex = false;
  let cur: { line: number; raw: string[] } | null = null;
  const flush = () => {
    if (!cur) return;
    const raw = cur.raw.join('\n');
    const title = /^- \*\*(.+?)\*\*/.exec(raw)?.[1]?.replace(/[.:]$/, '').trim();
    if (title && STANDING_WATCH.test(raw)) standing.push(title);
    else if (title && !raw.includes('<')) {
      const body = raw
        .replace(/^- /, '')
        .split('\n')
        .map((l) => l.replace(/^ {2}/, ''))
        .join('\n');
      items.push({
        id: `OQ/${slug(title)}`,
        kind: 'question',
        question: draftQuestion({ id: '', kind: 'question', title }),
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
  return { items, standing };
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
