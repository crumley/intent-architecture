// The agent <-> tool contract, version 1: the packet (agent -> tool) and the
// decisions (tool -> agent). Types and validators live together because both
// sides of the wire (server, page, `validate`) must agree on exactly one reading.
// See design/0001-review-tool-v1/README.md for the field-by-field rationale.

export const PACKET_KIND = 'intent-review-packet';
export const DECISIONS_KIND = 'intent-review-decisions';
export const DRAFT_KIND = 'intent-review-draft';
export const SCHEMA_VERSION = 1;

export type Mode = 'main' | 'branch';
/**
 * Item kinds are an open vocabulary: the page renders the known ones specially
 * and any other kind generically, so a new producer needs no schema change.
 */
export type ItemKind = string;
export type IfStatus = 'pending' | 'ruled' | 'adjudicated' | 'declined';
export type Attention = 'judgment' | 'routine';
export type VerdictKind = 'accept' | 'amend' | 'decline' | 'defer' | 'revise';
export type OverallKind = 'approve' | 'request-changes' | 'comment';
export type AnnotationKind = 'comment' | 'question' | 'suggestion' | 'intent-here' | 'mismatch';
export type ChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export const MODES: readonly Mode[] = ['main', 'branch'];
/** The kinds this release renders specially; others render generically. */
export const KNOWN_KINDS = [
  'if',
  'question',
  'intent-change',
  'design-entry',
  'decision',
  'finding',
] as const;
/** Intent feedback; `sf` is the legacy spelling from before the rename and is accepted. */
export const isIntentFeedback = (kind: string): boolean => kind === 'if' || kind === 'sf';

export const IF_STATUSES: readonly IfStatus[] = ['pending', 'ruled', 'adjudicated', 'declined'];
export const VERDICTS: readonly VerdictKind[] = ['accept', 'amend', 'decline', 'defer', 'revise'];
export const OVERALL: readonly OverallKind[] = ['approve', 'request-changes', 'comment'];
export const ANNOTATION_KINDS: readonly AnnotationKind[] = [
  'comment',
  'question',
  'suggestion',
  'intent-here',
  'mismatch',
];
const CHANGE_STATUSES: readonly ChangeStatus[] = ['added', 'modified', 'deleted', 'renamed'];

/** The words each verdict must carry, by field name; accept and defer need none. */
export const REQUIRED_WORDS: Record<VerdictKind, 'wording' | 'why' | 'request' | null> = {
  accept: null,
  amend: 'wording',
  decline: 'why',
  defer: null,
  revise: 'request',
};

/**
 * A pointer into the snapshot: a file, optionally narrowed by a section heading,
 * an exact quote, or a 1-based line range — intent passages and code alike.
 */
export type Ref = {
  path: string;
  section?: string;
  quote?: string;
  lines?: { start: number; end: number };
  note?: string;
};
export type Section = { key: string; label: string; text: string };
export type Edit = { path: string; before: string; after: string };
export type SourceRef = { path: string; line: number };

/** One changed file in branch mode: a unified diff (`git diff`-style) of base...head. */
export type FileChange = { path: string; status: ChangeStatus; oldPath?: string; patch: string };

export type Item = {
  id: string;
  kind: ItemKind;
  category?: string; // a producer's own sub-kind, e.g. "drift" or "hidden-intent" for a finding
  title: string;
  status?: IfStatus; // required for kind "if" (intent feedback; legacy "sf")
  statusLine?: string;
  baseStatusLine?: string; // branch mode: the intent-feedback item's Status at the base, when the branch changed it
  attention?: Attention; // branch mode: needs the human's judgment, or routine
  source: SourceRef;
  changes?: FileChange[];
  evidence: Ref[]; // what the item is about: intent passages and/or code locations
  sections: Section[];
  proposal?: { summary?: string; edits: Edit[] };
  analysis?: {
    summary?: string;
    ifAccepted?: string;
    ifDeclined?: string;
    relations?: { item: string; note: string }[];
    recommendation?: { verdict: VerdictKind; why: string };
  };
  context?: Ref[]; // further reading beside the item
};

export type LedgerRow = {
  id: string;
  entry: string;
  title: string;
  status: IfStatus;
  slices: string[];
  source: SourceRef;
  statusLine?: string;
};

/** A text file in the snapshot: intent, design, code — whatever the packet carries. */
export type RepoFile = { path: string; text: string };

export type GitRef = { ref: string; sha: string };

/** Branch mode: what is being reviewed, and the agent's overall read of it. */
export type Change = {
  base: GitRef;
  head: GitRef;
  summary?: string;
  recommendation?: { verdict: OverallKind; why: string };
};

export type Packet = {
  kind: typeof PACKET_KIND;
  version: 1;
  mode: Mode;
  producer?: string; // the lens that prepared it, e.g. "open-items", "branch-review"
  title: string;
  createdAt: string;
  iteration?: number;
  repo: { name: string; root?: string; ref?: string };
  change?: Change; // required in branch mode
  reviewer?: string;
  intro?: string;
  items: Item[];
  files: RepoFile[];
  omitted?: { path: string; reason: string }[]; // tracked files left out (binary, too large)
  ledger?: LedgerRow[];
};

export type Verdict = {
  item: string;
  verdict: VerdictKind;
  wording?: string;
  why?: string;
  ruling?: string;
  request?: string;
  note?: string;
};

export type Selector = { exact: string; prefix: string; suffix: string };

export type AnnotationTarget =
  | { kind: 'file'; path: string }
  | { kind: 'item'; item: string; section: string };

export type Annotation = {
  id: string;
  target: AnnotationTarget;
  item?: string; // the item under review when it was made, if any (a file note made from an item)
  selector: Selector;
  at?: { start: number; end: number; line: number };
  kind: AnnotationKind;
  comment: string;
  suggestion?: string;
  createdAt: string;
};

export type PacketRef = {
  title: string;
  createdAt: string;
  mode: Mode;
  iteration?: number;
  digest: string;
};

export type Overall = { verdict: OverallKind; note?: string };

export type Decisions = {
  kind: typeof DECISIONS_KIND;
  version: 1;
  packet: PacketRef;
  reviewer: string;
  submittedAt: string;
  comment?: string;
  overall?: Overall; // required in branch mode
  verdicts: Verdict[];
  annotations: Annotation[];
};

/** What the page holds and sends: the decisions minus what only the server may stamp. */
export type ReviewState = {
  reviewer: string;
  comment?: string;
  overall?: Overall;
  verdicts: Verdict[];
  annotations: Annotation[];
};

export type Draft = ReviewState & { kind: typeof DRAFT_KIND; version: 1; packet: PacketRef };

export type ValidationError = { path: string; message: string };
export type Result<T> = { ok: true; value: T } | { ok: false; errors: ValidationError[] };

// ---------------------------------------------------------------------------
// A tiny checker: each helper records an error at a JSON path and returns
// whether the value had the expected shape, so validators read top-down.

class Checker {
  readonly errors: ValidationError[] = [];
  fail(path: string, message: string): false {
    this.errors.push({ path, message });
    return false;
  }
  object(v: unknown, path: string): v is Record<string, unknown> {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) return true;
    return this.fail(path, 'must be an object');
  }
  array(v: unknown, path: string): v is unknown[] {
    return Array.isArray(v) || this.fail(path, 'must be an array');
  }
  string(v: unknown, path: string, opts: { nonEmpty?: boolean } = {}): v is string {
    if (typeof v !== 'string') return this.fail(path, 'must be a string');
    if (opts.nonEmpty && v.trim() === '') return this.fail(path, 'must not be empty');
    return true;
  }
  optString(v: unknown, path: string): boolean {
    return v === undefined || this.string(v, path);
  }
  int(v: unknown, path: string, min = 0): v is number {
    if (typeof v === 'number' && Number.isInteger(v) && v >= min) return true;
    return this.fail(path, `must be an integer >= ${min}`);
  }
  oneOf<T extends string>(v: unknown, allowed: readonly T[], path: string): v is T {
    if (typeof v === 'string' && (allowed as readonly string[]).includes(v)) return true;
    return this.fail(path, `must be one of ${allowed.map((a) => `"${a}"`).join(', ')}`);
  }
  header(v: Record<string, unknown>, kind: string): boolean {
    if (v.kind !== kind) return this.fail('kind', `must be "${kind}"`);
    if (v.version !== SCHEMA_VERSION) {
      return this.fail(
        'version',
        `unsupported version ${JSON.stringify(v.version)}; this tool reads ${SCHEMA_VERSION}`,
      );
    }
    return true;
  }
}

function done<T>(c: Checker, v: unknown): Result<T> {
  return c.errors.length === 0 ? { ok: true, value: v as T } : { ok: false, errors: c.errors };
}

// ---------------------------------------------------------------------------
// Packet

export function validatePacket(v: unknown): Result<Packet> {
  const c = new Checker();
  if (!c.object(v, '$')) return done(c, v);
  if (!c.header(v, PACKET_KIND)) return done(c, v);
  const modeOk = c.oneOf(v.mode, MODES, 'mode');
  c.string(v.title, 'title', { nonEmpty: true });
  c.string(v.createdAt, 'createdAt', { nonEmpty: true });
  if (v.iteration !== undefined) c.int(v.iteration, 'iteration', 1);
  if (c.object(v.repo, 'repo')) {
    c.string(v.repo.name, 'repo.name', { nonEmpty: true });
    c.optString(v.repo.root, 'repo.root');
    c.optString(v.repo.ref, 'repo.ref');
  }
  c.optString(v.reviewer, 'reviewer');
  c.optString(v.intro, 'intro');
  c.optString(v.producer, 'producer');
  if (v.omitted !== undefined && c.array(v.omitted, 'omitted')) {
    v.omitted.forEach((o, i) => {
      if (!c.object(o, `omitted[${i}]`)) return;
      c.string(o.path, `omitted[${i}].path`, { nonEmpty: true });
      c.string(o.reason, `omitted[${i}].reason`, { nonEmpty: true });
    });
  }
  if (v.change !== undefined || (modeOk && v.mode === 'branch')) {
    if (c.object(v.change, 'change')) {
      for (const side of ['base', 'head'] as const) {
        if (c.object(v.change[side], `change.${side}`)) {
          c.string(v.change[side].ref, `change.${side}.ref`, { nonEmpty: true });
          c.string(v.change[side].sha, `change.${side}.sha`, { nonEmpty: true });
        }
      }
      c.optString(v.change.summary, 'change.summary');
      const rec = v.change.recommendation;
      if (rec !== undefined && c.object(rec, 'change.recommendation')) {
        c.oneOf(rec.verdict, OVERALL, 'change.recommendation.verdict');
        c.string(rec.why, 'change.recommendation.why', { nonEmpty: true });
      }
    }
  }

  const files = new Set<string>();
  if (c.array(v.files, 'files')) {
    v.files.forEach((f, i) => {
      const p = `files[${i}]`;
      if (!c.object(f, p)) return;
      if (c.string(f.path, `${p}.path`, { nonEmpty: true })) {
        if (files.has(f.path)) c.fail(`${p}.path`, `duplicate file "${f.path}"`);
        files.add(f.path);
      }
      c.string(f.text, `${p}.text`);
    });
  }
  const filePath = (x: unknown, p: string) => {
    if (c.string(x, p, { nonEmpty: true }) && !files.has(x)) {
      c.fail(p, `"${x}" is not in files[]`);
    }
  };
  const refs = (x: unknown, p: string) => {
    if (!c.array(x, p)) return;
    x.forEach((r, j) => {
      const rp = `${p}[${j}]`;
      if (!c.object(r, rp)) return;
      filePath(r.path, `${rp}.path`);
      c.optString(r.section, `${rp}.section`);
      c.optString(r.quote, `${rp}.quote`);
      c.optString(r.note, `${rp}.note`);
      if (r.lines !== undefined && c.object(r.lines, `${rp}.lines`)) {
        const okS = c.int(r.lines.start, `${rp}.lines.start`, 1);
        const okE = c.int(r.lines.end, `${rp}.lines.end`, 1);
        if (okS && okE && (r.lines.end as number) < (r.lines.start as number))
          c.fail(`${rp}.lines`, 'end is before start');
      }
    });
  };

  const ids = new Set<string>();
  const relationRefs: { id: string; path: string }[] = [];
  if (c.array(v.items, 'items')) {
    v.items.forEach((it, i) => {
      const p = `items[${i}]`;
      if (!c.object(it, p)) return;
      if (c.string(it.id, `${p}.id`, { nonEmpty: true })) {
        if (ids.has(it.id)) c.fail(`${p}.id`, `duplicate item id "${it.id}"`);
        ids.add(it.id);
      }
      const kindOk = c.string(it.kind, `${p}.kind`, { nonEmpty: true });
      c.optString(it.category, `${p}.category`);
      c.string(it.title, `${p}.title`, { nonEmpty: true });
      if (it.status !== undefined || (kindOk && isIntentFeedback(it.kind as string))) {
        c.oneOf(it.status, IF_STATUSES, `${p}.status`);
      }
      c.optString(it.statusLine, `${p}.statusLine`);
      c.optString(it.baseStatusLine, `${p}.baseStatusLine`);
      if (it.attention !== undefined) {
        c.oneOf(it.attention, ['judgment', 'routine'] as const, `${p}.attention`);
      }
      if (it.changes !== undefined && c.array(it.changes, `${p}.changes`)) {
        it.changes.forEach((ch, j) => {
          const cp = `${p}.changes[${j}]`;
          if (!c.object(ch, cp)) return;
          c.string(ch.path, `${cp}.path`, { nonEmpty: true });
          c.oneOf(ch.status, CHANGE_STATUSES, `${cp}.status`);
          c.optString(ch.oldPath, `${cp}.oldPath`);
          c.string(ch.patch, `${cp}.patch`);
        });
      }
      if (c.object(it.source, `${p}.source`)) {
        c.string(it.source.path, `${p}.source.path`, { nonEmpty: true });
        c.int(it.source.line, `${p}.source.line`, 1);
      }
      refs(it.evidence, `${p}.evidence`);
      if (it.context !== undefined) refs(it.context, `${p}.context`);
      if (c.array(it.sections, `${p}.sections`)) {
        const keys = new Set<string>();
        it.sections.forEach((s, j) => {
          const sp = `${p}.sections[${j}]`;
          if (!c.object(s, sp)) return;
          if (c.string(s.key, `${sp}.key`, { nonEmpty: true })) {
            if (keys.has(s.key)) c.fail(`${sp}.key`, `duplicate section key "${s.key}"`);
            keys.add(s.key);
          }
          c.string(s.label, `${sp}.label`, { nonEmpty: true });
          c.string(s.text, `${sp}.text`);
        });
      }
      if (it.proposal !== undefined && c.object(it.proposal, `${p}.proposal`)) {
        c.optString(it.proposal.summary, `${p}.proposal.summary`);
        if (c.array(it.proposal.edits, `${p}.proposal.edits`)) {
          it.proposal.edits.forEach((e, j) => {
            const ep = `${p}.proposal.edits[${j}]`;
            if (!c.object(e, ep)) return;
            filePath(e.path, `${ep}.path`);
            c.string(e.before, `${ep}.before`, { nonEmpty: true });
            c.string(e.after, `${ep}.after`);
          });
        }
      }
      if (it.analysis !== undefined && c.object(it.analysis, `${p}.analysis`)) {
        const a = it.analysis;
        for (const k of ['summary', 'ifAccepted', 'ifDeclined'] as const) {
          c.optString(a[k], `${p}.analysis.${k}`);
        }
        if (a.relations !== undefined && c.array(a.relations, `${p}.analysis.relations`)) {
          a.relations.forEach((r, j) => {
            const rp = `${p}.analysis.relations[${j}]`;
            if (!c.object(r, rp)) return;
            if (c.string(r.item, `${rp}.item`, { nonEmpty: true })) {
              relationRefs.push({ id: r.item, path: `${rp}.item` });
            }
            c.string(r.note, `${rp}.note`, { nonEmpty: true });
          });
        }
        if (a.recommendation !== undefined) {
          const rp = `${p}.analysis.recommendation`;
          if (c.object(a.recommendation, rp)) {
            c.oneOf(a.recommendation.verdict, VERDICTS, `${rp}.verdict`);
            c.string(a.recommendation.why, `${rp}.why`, { nonEmpty: true });
          }
        }
      }
    });
  }
  for (const r of relationRefs) {
    if (!ids.has(r.id)) c.fail(r.path, `"${r.id}" is not an item id`);
  }

  if (v.ledger !== undefined && c.array(v.ledger, 'ledger')) {
    v.ledger.forEach((row, i) => {
      const p = `ledger[${i}]`;
      if (!c.object(row, p)) return;
      c.string(row.id, `${p}.id`, { nonEmpty: true });
      c.string(row.entry, `${p}.entry`, { nonEmpty: true });
      c.string(row.title, `${p}.title`, { nonEmpty: true });
      c.oneOf(row.status, IF_STATUSES, `${p}.status`);
      if (c.array(row.slices, `${p}.slices`)) {
        row.slices.forEach((s, j) => {
          c.string(s, `${p}.slices[${j}]`);
        });
      }
      if (c.object(row.source, `${p}.source`)) {
        c.string(row.source.path, `${p}.source.path`, { nonEmpty: true });
        c.int(row.source.line, `${p}.source.line`, 1);
      }
      c.optString(row.statusLine, `${p}.statusLine`);
    });
  }
  return done(c, v);
}

// ---------------------------------------------------------------------------
// Decisions, drafts, and the review state the page sends

type StateRules = {
  /** Enforce each verdict's required words (submit) or only shape (draft). */
  strict: boolean;
  packet?: Packet;
};

function checkState(c: Checker, v: Record<string, unknown>, rules: StateRules): void {
  const { strict, packet } = rules;
  if (strict) c.string(v.reviewer, 'reviewer', { nonEmpty: true });
  else c.string(v.reviewer, 'reviewer');
  c.optString(v.comment, 'comment');
  if (v.overall !== undefined && c.object(v.overall, 'overall')) {
    c.oneOf(v.overall.verdict, OVERALL, 'overall.verdict');
    c.optString(v.overall.note, 'overall.note');
  } else if (v.overall === undefined && strict && packet?.mode === 'branch') {
    c.fail(
      'overall',
      'a branch review needs an overall verdict (approve, request-changes, or comment)',
    );
  }
  const items = packet ? new Set(packet.items.map((i) => i.id)) : null;
  const sections = packet
    ? new Map(packet.items.map((i) => [i.id, new Set(i.sections.map((s) => s.key))]))
    : null;
  const files = packet ? new Set(packet.files.map((f) => f.path)) : null;

  if (c.array(v.verdicts, 'verdicts')) {
    const seen = new Set<string>();
    v.verdicts.forEach((x, i) => {
      const p = `verdicts[${i}]`;
      if (!c.object(x, p)) return;
      if (c.string(x.item, `${p}.item`, { nonEmpty: true })) {
        if (seen.has(x.item)) c.fail(`${p}.item`, `more than one verdict for "${x.item}"`);
        seen.add(x.item);
        if (items && !items.has(x.item)) c.fail(`${p}.item`, `"${x.item}" is not in the packet`);
      }
      for (const k of ['wording', 'why', 'ruling', 'request', 'note'] as const) {
        c.optString(x[k], `${p}.${k}`);
      }
      if (c.oneOf(x.verdict, VERDICTS, `${p}.verdict`) && strict) {
        const need = REQUIRED_WORDS[x.verdict];
        if (need && (typeof x[need] !== 'string' || (x[need] as string).trim() === '')) {
          c.fail(`${p}.${need}`, `a "${x.verdict}" verdict needs its ${need}`);
        }
      }
    });
  }

  if (c.array(v.annotations, 'annotations')) {
    const seen = new Set<string>();
    v.annotations.forEach((a, i) => {
      const p = `annotations[${i}]`;
      if (!c.object(a, p)) return;
      if (c.string(a.id, `${p}.id`, { nonEmpty: true })) {
        if (seen.has(a.id)) c.fail(`${p}.id`, `duplicate annotation id "${a.id}"`);
        seen.add(a.id);
      }
      if (c.object(a.target, `${p}.target`)) {
        const t = a.target;
        if (c.oneOf(t.kind, ['file', 'item'] as const, `${p}.target.kind`)) {
          if (t.kind === 'file') {
            if (c.string(t.path, `${p}.target.path`, { nonEmpty: true }) && files) {
              if (!files.has(t.path))
                c.fail(`${p}.target.path`, `"${t.path}" is not in the packet`);
            }
          } else {
            const okItem = c.string(t.item, `${p}.target.item`, { nonEmpty: true });
            const okSec = c.string(t.section, `${p}.target.section`, { nonEmpty: true });
            if (okItem && okSec && sections) {
              const keys = sections.get(t.item as string);
              if (!keys) c.fail(`${p}.target.item`, `"${t.item}" is not in the packet`);
              else if (!keys.has(t.section as string)) {
                c.fail(`${p}.target.section`, `"${t.section}" is not a section of "${t.item}"`);
              }
            }
          }
        }
      }
      if (c.object(a.selector, `${p}.selector`)) {
        c.string(a.selector.exact, `${p}.selector.exact`, { nonEmpty: true });
        c.string(a.selector.prefix, `${p}.selector.prefix`);
        c.string(a.selector.suffix, `${p}.selector.suffix`);
      }
      if (a.at !== undefined && c.object(a.at, `${p}.at`)) {
        c.int(a.at.start, `${p}.at.start`);
        c.int(a.at.end, `${p}.at.end`);
        c.int(a.at.line, `${p}.at.line`, 1);
      }
      if (a.item !== undefined && c.string(a.item, `${p}.item`) && items && !items.has(a.item)) {
        c.fail(`${p}.item`, `"${a.item}" is not in the packet`);
      }
      const kindOk = c.oneOf(a.kind, ANNOTATION_KINDS, `${p}.kind`);
      if (strict) c.string(a.comment, `${p}.comment`, { nonEmpty: a.kind !== 'suggestion' });
      else c.string(a.comment, `${p}.comment`);
      c.optString(a.suggestion, `${p}.suggestion`);
      if (strict && kindOk && a.kind === 'suggestion' && typeof a.suggestion !== 'string') {
        c.fail(`${p}.suggestion`, 'a suggestion needs its replacement text');
      }
      c.string(a.createdAt, `${p}.createdAt`, { nonEmpty: true });
    });
  }
}

function checkPacketRef(c: Checker, v: unknown): void {
  if (!c.object(v, 'packet')) return;
  c.string(v.title, 'packet.title', { nonEmpty: true });
  c.string(v.createdAt, 'packet.createdAt', { nonEmpty: true });
  c.oneOf(v.mode, MODES, 'packet.mode');
  if (v.iteration !== undefined) c.int(v.iteration, 'packet.iteration', 1);
  if (c.string(v.digest, 'packet.digest') && !/^sha256:[0-9a-f]{64}$/.test(v.digest)) {
    c.fail('packet.digest', 'must be "sha256:" followed by 64 hex digits');
  }
}

/** The review state the page submits, checked strictly against its packet. */
export function validateSubmission(v: unknown, packet: Packet): Result<ReviewState> {
  const c = new Checker();
  if (c.object(v, '$')) checkState(c, v, { strict: true, packet });
  return done(c, v);
}

export function validateDecisions(v: unknown, packet?: Packet): Result<Decisions> {
  const c = new Checker();
  if (!c.object(v, '$')) return done(c, v);
  if (!c.header(v, DECISIONS_KIND)) return done(c, v);
  checkPacketRef(c, v.packet);
  c.string(v.submittedAt, 'submittedAt', { nonEmpty: true });
  checkState(c, v, packet ? { strict: true, packet } : { strict: true });
  return done(c, v);
}

export function validateDraft(v: unknown): Result<Draft> {
  const c = new Checker();
  if (!c.object(v, '$')) return done(c, v);
  if (!c.header(v, DRAFT_KIND)) return done(c, v);
  checkPacketRef(c, v.packet);
  checkState(c, v, { strict: false });
  return done(c, v);
}

export function packetRef(packet: Packet, digest: string): PacketRef {
  const ref: PacketRef = {
    title: packet.title,
    createdAt: packet.createdAt,
    mode: packet.mode,
    digest,
  };
  if (packet.iteration !== undefined) ref.iteration = packet.iteration;
  return ref;
}

/** Keep only the fields the contract defines, in a stable order, for writing. */
export function toDecisions(state: ReviewState, ref: PacketRef, submittedAt: string): Decisions {
  const d: Decisions = {
    kind: DECISIONS_KIND,
    version: SCHEMA_VERSION,
    packet: ref,
    reviewer: state.reviewer.trim(),
    submittedAt,
    verdicts: state.verdicts.map(cleanVerdict),
    annotations: state.annotations.map(cleanAnnotation),
  };
  if (state.comment?.trim()) d.comment = state.comment;
  if (state.overall) {
    d.overall = { verdict: state.overall.verdict };
    if (state.overall.note?.trim()) d.overall.note = state.overall.note;
  }
  return d;
}

function pick<T extends object>(v: T, keys: readonly (keyof T)[]): T {
  const out = {} as T;
  for (const k of keys) if (v[k] !== undefined) out[k] = v[k];
  return out;
}

/** A verdict carries only the words its kind uses (plus a note). */
function cleanVerdict(v: Verdict): Verdict {
  const need = REQUIRED_WORDS[v.verdict];
  const keys: (keyof Verdict)[] = ['item', 'verdict'];
  if (need) keys.push(need);
  if (v.verdict === 'defer' && v.ruling?.trim()) keys.push('ruling');
  if (v.note?.trim()) keys.push('note');
  return pick(v, keys);
}

function cleanAnnotation(a: Annotation): Annotation {
  const out = pick(a, ['id', 'target', 'item', 'selector', 'at', 'kind', 'comment', 'createdAt']);
  out.target =
    a.target.kind === 'file'
      ? { kind: 'file', path: a.target.path }
      : { kind: 'item', item: a.target.item, section: a.target.section };
  out.selector = { exact: a.selector.exact, prefix: a.selector.prefix, suffix: a.selector.suffix };
  if (a.kind === 'suggestion' && a.suggestion !== undefined) out.suggestion = a.suggestion;
  return out;
}

export function formatErrors(errors: ValidationError[]): string {
  return errors.map((e) => `  ${e.path}: ${e.message}`).join('\n');
}
