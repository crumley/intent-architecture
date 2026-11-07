// The loopback server: serves the page and the packet, keeps the draft, and
// on submit writes the decisions atomically and stops. It knows nothing about
// the page beyond the HTML string it is handed.

import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { basename, dirname, join } from 'node:path';
import {
  type Decisions,
  DRAFT_KIND,
  type Draft,
  type Packet,
  packetRef,
  SCHEMA_VERSION,
  toDecisions,
  type ValidationError,
  validateDecisions,
  validateDraft,
  validateSubmission,
} from './schema.ts';
import type { Theme } from './themes.ts';

export type ServeOptions = {
  packet: Packet;
  digest: string;
  out: string;
  draft: string;
  html: string;
  port?: number;
  token?: string;
  now?: () => Date;
  /** Custom themes (resolved), the theme to start in, and where preferences live. */
  themes?: Theme[];
  initialTheme?: string;
  themeDir?: string;
  prefsPath?: string;
};

export type ServeOutcome =
  | { kind: 'submitted'; out: string; decisions: Decisions }
  | { kind: 'abandoned' };

export type ServeHandle = {
  url: string;
  port: number;
  token: string;
  done: Promise<ServeOutcome>;
  close: () => Promise<void>;
};

const MAX_BODY = 16 * 1024 * 1024;

/** `<out>.json` -> `<out>.draft.json`; anything else gets `.draft.json` appended. */
export function draftPathFor(out: string): string {
  return out.endsWith('.json') ? `${out.slice(0, -5)}.draft.json` : `${out}.draft.json`;
}

/** Write via a temp file in the same directory and rename: whole or absent. */
export function writeFileAtomic(path: string, data: string): void {
  const tmp = join(
    dirname(path),
    `.${basename(path)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`,
  );
  try {
    writeFileSync(tmp, data, { encoding: 'utf8', flag: 'wx' });
    renameSync(tmp, path);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}

export async function serve(opts: ServeOptions): Promise<ServeHandle> {
  const token = opts.token ?? randomBytes(16).toString('hex');
  const now = opts.now ?? (() => new Date());
  const ref = packetRef(opts.packet, opts.digest);
  let finished = false;
  let resolveDone: (o: ServeOutcome) => void = () => {};
  const done = new Promise<ServeOutcome>((r) => {
    resolveDone = r;
  });
  let port = 0;

  const finish = (outcome: ServeOutcome) => {
    finished = true;
    setImmediate(() => {
      server.close();
      server.closeAllConnections();
      resolveDone(outcome);
    });
  };

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const host = req.headers.host ?? '';
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) {
      return send(res, 403, { error: 'forbidden host' });
    }
    if (url.pathname === '/') {
      if (req.method !== 'GET') return send(res, 405, { error: 'method not allowed' });
      if (url.searchParams.get('token') !== token) {
        return sendText(res, 403, 'Open the URL the review tool printed (it carries the token).');
      }
      return sendHtml(res, opts.html);
    }
    if (!url.pathname.startsWith('/api/')) return send(res, 404, { error: 'not found' });
    if (req.headers['x-review-token'] !== token) return send(res, 403, { error: 'bad token' });
    if (finished) return send(res, 409, { error: 'this review has already ended' });

    const route = `${req.method} ${url.pathname}`;
    switch (route) {
      case 'GET /api/packet':
        return send(res, 200, { packet: opts.packet, digest: opts.digest, draftPath: opts.draft });
      case 'GET /api/themes':
        return send(res, 200, {
          themes: opts.themes ?? [],
          initial: opts.initialTheme ?? null,
          dir: opts.themeDir ?? null,
          prefs: readPrefs(opts.prefsPath),
        });
      case 'PUT /api/prefs': {
        const body = await readJson(req);
        const theme = body.ok ? (body.value as { theme?: unknown }).theme : undefined;
        if (typeof theme !== 'string' || !/^[a-z0-9-]{1,41}$/.test(theme)) {
          return send(res, 400, { errors: [{ path: 'theme', message: 'a theme id' }] });
        }
        if (opts.prefsPath) {
          try {
            mkdirSync(dirname(opts.prefsPath), { recursive: true });
            writeFileAtomic(
              opts.prefsPath,
              `${JSON.stringify({ ...readPrefs(opts.prefsPath), theme }, null, 2)}\n`,
            );
          } catch {
            // preferences are a convenience; a read-only home must not break a review
          }
        }
        return send(res, 200, { theme });
      }
      case 'GET /api/draft':
        return send(res, 200, readDraft(opts.draft, opts.digest));
      case 'PUT /api/draft': {
        const body = await readJson(req);
        if (!body.ok) return send(res, 400, { errors: body.errors });
        const draft = {
          ...(body.value as object),
          kind: DRAFT_KIND,
          version: SCHEMA_VERSION,
          packet: ref,
        };
        const v = validateDraft(draft);
        if (!v.ok) return send(res, 400, { errors: v.errors });
        writeFileAtomic(opts.draft, `${JSON.stringify(v.value, null, 2)}\n`);
        return send(res, 200, { saved: now().toISOString() });
      }
      case 'POST /api/submit': {
        const body = await readJson(req);
        if (!body.ok) return send(res, 400, { errors: body.errors });
        const v = validateSubmission(body.value, opts.packet);
        if (!v.ok) return send(res, 400, { errors: v.errors });
        const decisions = toDecisions(v.value, ref, now().toISOString());
        const check = validateDecisions(decisions, opts.packet);
        if (!check.ok) return send(res, 400, { errors: check.errors });
        writeFileAtomic(opts.out, `${JSON.stringify(decisions, null, 2)}\n`);
        rmSync(opts.draft, { force: true });
        send(res, 200, { out: opts.out });
        return finish({ kind: 'submitted', out: opts.out, decisions });
      }
      case 'POST /api/abandon':
        send(res, 200, { draft: opts.draft });
        return finish({ kind: 'abandoned' });
      default:
        return send(res, 404, { error: `no route ${route}` });
    }
  };

  const server = createServer((req, res) => {
    handle(req, res).catch((e: unknown) => {
      send(res, 500, { error: e instanceof Error ? e.message : String(e) });
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port ?? 0, '127.0.0.1', () => resolve());
  });
  port = (server.address() as AddressInfo).port;

  return {
    url: `http://127.0.0.1:${port}/?token=${token}`,
    port,
    token,
    done,
    close: () =>
      new Promise<void>((resolve) => {
        if (!server.listening) return resolve();
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}

function readPrefs(path: string | undefined): { theme?: string } {
  if (!path) return {};
  try {
    const v = JSON.parse(readFileSync(path, 'utf8')) as { theme?: unknown };
    return typeof v.theme === 'string' ? { theme: v.theme } : {};
  } catch {
    return {};
  }
}

function readDraft(
  path: string,
  digest: string,
): { draft: Draft | null; stale: boolean; error?: string } {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return { draft: null, stale: false };
  }
  try {
    const v = validateDraft(JSON.parse(raw));
    if (!v.ok) return { draft: null, stale: false, error: `draft at ${path} is invalid; ignored` };
    return { draft: v.value, stale: v.value.packet.digest !== digest };
  } catch {
    return { draft: null, stale: false, error: `draft at ${path} is not JSON; ignored` };
  }
}

function readJson(
  req: IncomingMessage,
): Promise<{ ok: true; value: unknown } | { ok: false; errors: ValidationError[] }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size <= MAX_BODY) chunks.push(c);
    });
    req.on('end', () => {
      if (size > MAX_BODY)
        return resolve({ ok: false, errors: [{ path: '$', message: 'body too large' }] });
      try {
        resolve({ ok: true, value: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
      } catch {
        resolve({ ok: false, errors: [{ path: '$', message: 'body is not JSON' }] });
      }
    });
  });
}

const BASE_HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { ...BASE_HEADERS, 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function sendText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { ...BASE_HEADERS, 'content-type': 'text/plain; charset=utf-8' });
  res.end(body);
}

function sendHtml(res: ServerResponse, html: string): void {
  res.writeHead(200, {
    ...BASE_HEADERS,
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy':
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'",
    'referrer-policy': 'no-referrer',
  });
  res.end(html);
}
