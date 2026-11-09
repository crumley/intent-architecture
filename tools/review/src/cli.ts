// The command line: scan | validate | serve | locate. Parses arguments, maps
// every outcome to the exit codes the design fixes, and prints stable,
// `review:`-prefixed lines an agent can read.
//
//   0 done (serve: decisions written)   2 usage error or invalid input
//   3 review abandoned (no decisions)   1 anything unexpected

import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { locate } from './anchor.ts';
import { checkApply } from './apply.ts';
import { fieldText } from './fields.ts';
import { type ScanOptions, scanRepo } from './scan.ts';
import {
  advise,
  formatErrors,
  type Packet,
  type ValidationError,
  validateDecisions,
  validatePacket,
} from './schema.ts';
import { draftPathFor, serve } from './server.ts';
import { resolveTheme, THEMES, type Theme, validateTheme } from './themes.ts';

const THEME_DOCS =
  'https://github.com/crumley/intent-architecture/blob/main/.agents/skills/intent-architecture/references/review-themes.md';

declare const __PAGE_HTML__: string | undefined;

export const TOOL_VERSION = '1.0.0';

const USAGE = `intent review tool ${TOOL_VERSION} — review a repository's intent and open intent feedback

usage:
  review.mjs scan     --repo <dir> [--out <packet.json>] [--ref <ref>] [--files repo|intent]
                      [--no-questions] [--no-inline] [--merged <#n,…>]
  review.mjs scan     --repo <dir> --base <ref> [--head <ref>] [--files repo|intent] [--out <packet.json>]
  review.mjs validate (--packet <file> | --decisions <file>)
  review.mjs serve    --packet <file> --out <decisions.json> [--port <n>] [--open] [--theme <id|file.json>]
  review.mjs locate   --decisions <file> --repo <dir> [--packet <file>]
  review.mjs check-apply --packet <file> --decisions <file> --repo <dir>

exit codes: 0 done · 2 usage error or invalid input · 3 review abandoned ·
  4 check-apply found drift (a before no longer in the tree, a note orphaned, a digest mismatch) · 1 unexpected

themes: built-in ${THEMES.map((t) => t.id).join(', ')}; custom themes are JSON files in
  <config>/themes/ (config: $INTENT_REVIEW_CONFIG, else $XDG_CONFIG_HOME/intent-review, else
  ~/.config/intent-review) or passed with --theme. Format: ${THEME_DOCS}`;

class UsageError extends Error {}
class InputError extends Error {
  readonly errors: ValidationError[];
  constructor(message: string, errors: ValidationError[] = []) {
    super(message);
    this.errors = errors;
  }
}

type Flags = Record<string, string | true>;

const KNOWN: Record<string, { values: string[]; switches: string[] }> = {
  scan: {
    values: ['repo', 'out', 'ref', 'base', 'head', 'files', 'merged'],
    switches: ['no-questions', 'no-inline'],
  },
  validate: { values: ['packet', 'decisions'], switches: [] },
  serve: { values: ['packet', 'out', 'port', 'theme'], switches: ['open'] },
  locate: { values: ['decisions', 'repo', 'packet'], switches: [] },
  'check-apply': { values: ['packet', 'decisions', 'repo'], switches: [] },
};

export function parseArgs(argv: string[]): { command: string; flags: Flags } {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    return { command: 'help', flags: {} };
  }
  if (command === '--version' || command === '-v') return { command: 'version', flags: {} };
  const spec = KNOWN[command];
  if (!spec) throw new UsageError(`unknown command "${command}"`);
  const flags: Flags = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i] as string;
    if (!arg.startsWith('--')) throw new UsageError(`unexpected argument "${arg}"`);
    const eq = arg.indexOf('=');
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (spec.switches.includes(name)) {
      flags[name] = true;
    } else if (spec.values.includes(name)) {
      const value = eq === -1 ? rest[++i] : arg.slice(eq + 1);
      if (value === undefined || value === '') throw new UsageError(`--${name} needs a value`);
      flags[name] = value;
    } else {
      throw new UsageError(`unknown option --${name} for ${command}`);
    }
  }
  return { command, flags };
}

function need(flags: Flags, name: string): string {
  const v = flags[name];
  if (typeof v !== 'string') throw new UsageError(`--${name} is required`);
  return v;
}

export function digestOf(bytes: Buffer | string): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function readJsonFile(path: string): { bytes: Buffer; value: unknown } {
  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch {
    throw new InputError(`cannot read ${path}`);
  }
  try {
    return { bytes, value: JSON.parse(bytes.toString('utf8')) };
  } catch {
    throw new InputError(`${path} is not JSON`);
  }
}

export function loadPacket(path: string): { packet: Packet; digest: string } {
  const { bytes, value } = readJsonFile(path);
  const v = validatePacket(value);
  if (!v.ok) throw new InputError(`${path} is not a valid packet`, v.errors);
  return { packet: v.value, digest: digestOf(bytes) };
}

type Io = { out: (s: string) => void; err: (s: string) => void };

export async function run(argv: string[], io: Io): Promise<number> {
  try {
    const { command, flags } = parseArgs(argv);
    switch (command) {
      case 'help':
        io.out(USAGE);
        return 0;
      case 'version':
        io.out(TOOL_VERSION);
        return 0;
      case 'scan':
        return cmdScan(flags, io);
      case 'validate':
        return cmdValidate(flags, io);
      case 'serve':
        return await cmdServe(flags, io);
      case 'locate':
        return cmdLocate(flags, io);
      case 'check-apply':
        return cmdCheckApply(flags, io);
      default:
        throw new UsageError(`unknown command "${command}"`);
    }
  } catch (e) {
    if (e instanceof UsageError) {
      io.err(`review: ${e.message}\n\n${USAGE}`);
      return 2;
    }
    if (e instanceof InputError) {
      io.err(`review: ${e.message}${e.errors.length ? `\n${formatErrors(e.errors)}` : ''}`);
      return 2;
    }
    io.err(`review: unexpected error: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
    return 1;
  }
}

function cmdScan(flags: Flags, io: Io): number {
  const root = resolve(need(flags, 'repo'));
  if (!existsSync(join(root, 'intent'))) throw new InputError(`${root} has no intent/ directory`);
  const str = (k: string) => (typeof flags[k] === 'string' ? (flags[k] as string) : undefined);
  const base = str('base');
  const ref = str('ref');
  const head = str('head');
  if (base === undefined && head !== undefined) throw new UsageError('--head needs --base');
  if (base !== undefined && ref !== undefined)
    throw new UsageError('--ref is for main mode; use --head');
  const files = str('files');
  if (files !== undefined && files !== 'repo' && files !== 'intent') {
    throw new UsageError('--files is "repo" (every tracked text file, the default) or "intent"');
  }
  const opts: ScanOptions = {
    questions: flags['no-questions'] !== true,
    inline: flags['no-inline'] !== true,
  };
  if (files !== undefined) opts.files = files;
  const merged = str('merged');
  if (merged !== undefined) {
    if (base !== undefined) throw new UsageError('--merged is for main mode');
    opts.merged = merged.split(/[,\s]+/).filter(Boolean);
  }
  if (base !== undefined) opts.base = base;
  if (head !== undefined) opts.head = head;
  if (ref !== undefined) opts.ref = ref;
  let result: ReturnType<typeof scanRepo>;
  try {
    result = scanRepo(root, opts);
  } catch (e) {
    throw new InputError(e instanceof Error ? e.message : String(e));
  }
  const { packet, warnings } = result;
  for (const w of warnings) io.err(`review: warning: ${w}`);
  const json = `${JSON.stringify(packet, null, 2)}\n`;
  const out = flags.out;
  if (typeof out === 'string') {
    writeFileSync(out, json);
    const count = new Map<string, number>();
    for (const i of packet.items) count.set(i.kind, (count.get(i.kind) ?? 0) + 1);
    const kinds = [...count.entries()].map(([k, n]) => `${n} ${k}`).join(', ') || 'no items';
    io.out(
      `review: wrote ${out} — ${packet.mode} mode: ${kinds}; ` +
        `${packet.ledger?.length ?? 0} intent-feedback items in the ledger, ${packet.files.length} files`,
    );
    io.out(
      "review: next — write each item's question, what, soWhat, and nowWhat (the skill's references/review.md), then validate",
    );
  } else {
    io.out(json.trimEnd());
  }
  return 0;
}

function cmdValidate(flags: Flags, io: Io): number {
  const p = flags.packet;
  const d = flags.decisions;
  if ((typeof p === 'string') === (typeof d === 'string')) {
    throw new UsageError('give exactly one of --packet or --decisions');
  }
  if (typeof p === 'string') {
    const { packet } = loadPacket(p);
    io.out(
      `review: ${p} is a valid packet (${packet.items.length} items, ${packet.files.length} files)`,
    );
    const advice = advise(packet);
    for (const a of advice) io.out(`review: advice: ${a.path}: ${a.message}`);
    if (advice.length)
      io.out(`review: ${advice.length} pieces of advice — not errors, but worth fixing`);
    return 0;
  }
  const { value } = readJsonFile(d as string);
  const v = validateDecisions(value);
  if (!v.ok) throw new InputError(`${d} is not a valid decisions file`, v.errors);
  io.out(
    `review: ${d} is a valid decisions file (${v.value.verdicts.length} verdicts, ${v.value.annotations.length} annotations)`,
  );
  return 0;
}

async function cmdServe(flags: Flags, io: Io): Promise<number> {
  const { packet, digest } = loadPacket(need(flags, 'packet'));
  const out = resolve(need(flags, 'out'));
  let port: number | undefined;
  if (typeof flags.port === 'string') {
    port = Number(flags.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535)
      throw new UsageError('--port must be 0–65535');
  }
  mkdirSync(dirname(out), { recursive: true });
  const draft = draftPathFor(out);
  const html = typeof __PAGE_HTML__ === 'string' ? __PAGE_HTML__ : FALLBACK_HTML;
  const config = configDir();
  const themeDir = join(config, 'themes');
  const { themes, initial } = loadThemes(
    themeDir,
    typeof flags.theme === 'string' ? flags.theme : undefined,
    io,
  );
  const base = {
    packet,
    digest,
    out,
    draft,
    html,
    themes,
    themeDir,
    prefsPath: join(config, 'prefs.json'),
  };
  const withTheme = initial === undefined ? base : { ...base, initialTheme: initial };
  const handle = await serve(port === undefined ? withTheme : { ...withTheme, port });
  // Handlers first: an agent may signal the process the moment it sees the URL.
  const abandon = () => {
    io.out(`review: abandoned — no decisions written; draft kept at ${draft}`);
    handle.close().finally(() => process.exit(3));
  };
  process.once('SIGINT', abandon);
  process.once('SIGTERM', abandon);
  io.out(`review: open ${handle.url}`);
  io.out(`review: ${packet.items.length} items; draft autosaves to ${draft}`);
  if (flags.open === true) openBrowser(handle.url);

  const outcome = await handle.done;
  process.off('SIGINT', abandon);
  process.off('SIGTERM', abandon);
  if (outcome.kind === 'abandoned') {
    io.out(`review: abandoned from the page — no decisions written; draft kept at ${draft}`);
    return 3;
  }
  const d = outcome.decisions;
  io.out(
    `review: decisions written to ${outcome.out} (${d.verdicts.length} verdicts, ${d.annotations.length} annotations)`,
  );
  return 0;
}

function cmdLocate(flags: Flags, io: Io): number {
  const decisionsPath = need(flags, 'decisions');
  const root = resolve(need(flags, 'repo'));
  const { value } = readJsonFile(decisionsPath);
  const v = validateDecisions(value);
  if (!v.ok) throw new InputError(`${decisionsPath} is not a valid decisions file`, v.errors);
  const packet = typeof flags.packet === 'string' ? loadPacket(flags.packet).packet : null;
  const results = v.value.annotations.map((a) => {
    let path: string | null = null;
    if (a.target.kind === 'field') {
      // Agent-written text lives in the packet, not the repository: nothing to re-find there.
      const { item, field } = a.target;
      const it = packet?.items.find((i) => i.id === item);
      const text = it ? fieldText(it, field) : undefined;
      if (text === undefined)
        return {
          id: a.id,
          item,
          field,
          status: 'unknown' as const,
          note: packet
            ? `agent-written text; "${field}" names no text in "${item}"`
            : 'agent-written text in the packet; pass --packet to check the quote',
        };
      return {
        id: a.id,
        item,
        field,
        note: 'agent-written text in the packet, not in the repository',
        ...locate(text, a.selector),
      };
    }
    if (a.target.kind === 'file') path = a.target.path;
    else {
      const target = a.target;
      path = packet?.items.find((i) => i.id === target.item)?.source.path ?? null;
    }
    if (!path)
      return {
        id: a.id,
        path: null,
        status: 'unknown' as const,
        note: 'item annotation; pass --packet to locate it in its source file',
      };
    let text: string;
    try {
      text = readFileSync(join(root, path), 'utf8');
    } catch {
      return { id: a.id, path, status: 'orphaned' as const, note: 'file not found' };
    }
    return { id: a.id, path, ...locate(text, a.selector) };
  });
  io.out(JSON.stringify(results, null, 2));
  return 0;
}

/**
 * Before carrying out decisions: do they answer this packet, and is every edit they land
 * still anchored in the repository as it is now? Prints the report; exit 4 on any drift.
 */
function cmdCheckApply(flags: Flags, io: Io): number {
  const { packet, digest } = loadPacket(need(flags, 'packet'));
  const decisionsPath = need(flags, 'decisions');
  const { value } = readJsonFile(decisionsPath);
  const v = validateDecisions(value, packet);
  if (!v.ok) throw new InputError(`${decisionsPath} is not a valid decisions file`, v.errors);
  const root = resolve(need(flags, 'repo'));
  const read = (path: string) => {
    try {
      return readFileSync(join(root, path), 'utf8');
    } catch {
      return undefined;
    }
  };
  let head: string | undefined;
  try {
    const git = (args: string[]) =>
      execFileSync('git', ['-C', root, ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    head = `${git(['rev-parse', '--abbrev-ref', 'HEAD'])}@${git(['rev-parse', '--short=12', 'HEAD'])}`;
  } catch {
    head = undefined;
  }
  const report = checkApply(packet, digest, v.value, read, head);
  io.out(JSON.stringify(report, null, 2));
  const bad = report.edits.filter((e) => e.status !== 'ok').length;
  io.err(
    report.ok
      ? `review: ready to apply — ${report.edits.length} edit(s) anchored${report.ref.moved ? ` (the tree moved since the snapshot: ${report.ref.packet} → ${report.ref.head}; every before still holds)` : ''}`
      : `review: drift — ${bad} edit(s) not anchored, digest ${report.digest.match ? 'matches' : 'does NOT match'}; re-read the report before editing`,
  );
  return report.ok ? 0 : 4;
}

/** Where preferences and custom themes live: never inside the reviewed repository. */
export function configDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.INTENT_REVIEW_CONFIG) return env.INTENT_REVIEW_CONFIG;
  const xdg = env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(xdg, 'intent-review');
}

/**
 * Custom themes from the themes directory, plus `--theme` — a built-in id, or a
 * theme file (which is loaded and becomes the starting theme). A broken file is
 * reported and skipped; a theme never stops a review.
 */
export function loadThemes(
  dir: string,
  flag: string | undefined,
  io: Io,
): { themes: Theme[]; initial?: string } {
  const themes: Theme[] = [];
  const load = (path: string): Theme | null => {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      io.err(`review: warning: theme ${path} is not readable JSON; skipped`);
      return null;
    }
    const v = validateTheme(raw);
    if (!v.ok) {
      io.err(`review: warning: theme ${path} skipped:\n  ${v.errors.join('\n  ')}`);
      return null;
    }
    const t = resolveTheme(v.theme);
    if (t) themes.push(t);
    return t;
  };
  if (existsSync(dir)) {
    for (const name of readdirSync(dir).sort()) if (name.endsWith('.json')) load(join(dir, name));
  }
  if (flag === undefined) return { themes };
  if (THEMES.some((t) => t.id === flag) || themes.some((t) => t.id === flag))
    return { themes, initial: flag };
  if (!existsSync(flag))
    throw new UsageError(`--theme: "${flag}" is neither a theme id nor a file`);
  const t = load(flag);
  return t ? { themes, initial: t.id } : { themes };
}

function openBrowser(url: string): void {
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '""', url]]
        : ['xdg-open', [url]];
  try {
    const child = spawn(cmd as string, args as string[], { detached: true, stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
  } catch {
    // Opening a browser is a convenience; the printed URL is the contract.
  }
}

const FALLBACK_HTML =
  '<!doctype html><meta charset="utf-8"><title>Review</title><p>The page is not built into this copy. Run <code>mise run build</code> and use the bundle.</p>';
