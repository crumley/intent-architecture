import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { join } from 'node:path';
import { validateDecisions } from '../src/schema.ts';
import { draftPathFor, type ServeHandle, serve, writeFileAtomic } from '../src/server.ts';
import { branchPacket, type Loose, packet, SLICE, state, tempDir } from './fixtures.ts';

const DIGEST = `sha256:${'c'.repeat(64)}`;

describe('access', () => {
  // Each row: method, path, whether the token is sent, Host override -> status.
  const CASES: [string, string, boolean, string | null, number][] = [
    ['GET', '/?token=TOKEN', false, null, 200],
    ['GET', '/', false, null, 403],
    ['GET', '/?token=wrong', false, null, 403],
    ['GET', '/api/packet', true, null, 200],
    ['GET', '/api/packet', false, null, 403],
    ['GET', '/api/packet', true, 'evil.example:80', 403],
    ['GET', '/api/packet', true, 'localhost:PORT', 200],
    ['GET', '/nope', true, null, 404],
    ['DELETE', '/api/draft', true, null, 404],
  ];
  test.each(CASES)('%s %s token=%p host=%p -> %d', async (method, path, withToken, host, want) => {
    const s = await start();
    const res = await raw(
      s,
      method,
      path.replace('TOKEN', s.token),
      withToken,
      host?.replace('PORT', String(s.port)) ?? null,
    );
    expect(res.status).toBe(want);
  });

  test('listens on loopback only, and the page carries a strict CSP', async () => {
    const s = await start();
    expect(s.url).toStartWith('http://127.0.0.1:');
    const res = await raw(s, 'GET', `/?token=${s.token}`, false, null);
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    expect(res.body).toBe('<html>page</html>');
  });
});

describe('draft', () => {
  test('round-trips, stamped with the packet, and is reported fresh', async () => {
    const s = await start();
    const put = await api(
      s,
      'PUT',
      '/api/draft',
      state({ verdicts: [{ item: '0001-x/IF-001', verdict: 'amend' }] }),
    );
    expect(put.status).toBe(200);
    const onDisk = JSON.parse(readFileSync(s.draft, 'utf8'));
    expect([onDisk.kind, onDisk.packet.digest, onDisk.verdicts[0].verdict]).toEqual([
      'intent-review-draft',
      DIGEST,
      'amend',
    ]);
    const got = await api(s, 'GET', '/api/draft');
    expect([got.body.stale, got.body.draft.verdicts.length]).toEqual([false, 1]);
  });

  test('a draft from another packet version is restored and marked stale', async () => {
    const s = await start();
    writeFileSync(
      s.draft,
      JSON.stringify({
        kind: 'intent-review-draft',
        version: 1,
        packet: { title: 't', createdAt: 'c', mode: 'main', digest: `sha256:${'d'.repeat(64)}` },
        ...state(),
      }),
    );
    const got = await api(s, 'GET', '/api/draft');
    expect(got.body.stale).toBe(true);
  });

  test('a corrupt draft is ignored with a reason, never fatal', async () => {
    const s = await start();
    writeFileSync(s.draft, '{not json');
    const got = await api(s, 'GET', '/api/draft');
    expect([got.status, got.body.draft]).toEqual([200, null]);
    expect(got.body.error).toContain('not JSON');
  });

  test('draft path sits beside the decisions file', () => {
    expect([draftPathFor('/x/decisions.json'), draftPathFor('/x/out')]).toEqual([
      '/x/decisions.draft.json',
      '/x/out.draft.json',
    ]);
  });
});

describe('submit', () => {
  test('an invalid submission is refused with named errors; the review stays open', async () => {
    const s = await start();
    const r = await api(
      s,
      'POST',
      '/api/submit',
      state({ verdicts: [{ item: '0001-x/IF-001', verdict: 'decline' }] }),
    );
    expect(r.status).toBe(400);
    expect(r.body.errors.map((e: { path: string }) => e.path)).toEqual(['verdicts[0].why']);
    expect(existsSync(s.out)).toBe(false);
    expect((await api(s, 'GET', '/api/packet')).status).toBe(200);
  });

  test('a valid submission writes decisions whole, removes the draft, and ends the review', async () => {
    const s = await start();
    await api(s, 'PUT', '/api/draft', state());
    const review = state({
      verdicts: [
        { item: '0001-x/IF-001', verdict: 'accept' },
        { item: '0001-x/IF-002', verdict: 'decline', why: 'already said' },
      ],
      annotations: [
        {
          id: 'a1',
          target: { kind: 'file', path: SLICE },
          selector: { exact: 'observe read-only', prefix: '', suffix: '' },
          kind: 'question',
          comment: 'enforced?',
          createdAt: '2026-11-07T00:00:00Z',
        },
      ],
    });
    const r = await api(s, 'POST', '/api/submit', review);
    expect(r.status).toBe(200);
    const outcome = await s.handle.done;
    expect(outcome.kind).toBe('submitted');
    const d = JSON.parse(readFileSync(s.out, 'utf8'));
    expect(validateDecisions(d, packet()).ok).toBe(true);
    expect([d.packet.digest, d.reviewer, d.verdicts.length, d.annotations.length]).toEqual([
      DIGEST,
      'Rae',
      2,
      1,
    ]);
    expect(existsSync(s.draft)).toBe(false);
    expect(readdirSync(s.dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });

  test('a branch review is refused without its overall verdict, accepted with it', async () => {
    const s = await start(branchPacket());
    expect((await api(s, 'POST', '/api/submit', state())).status).toBe(400);
    const ok = await api(
      s,
      'POST',
      '/api/submit',
      state({ overall: { verdict: 'request-changes', note: 'rule on SF-001' } }),
    );
    expect(ok.status).toBe(200);
    expect(JSON.parse(readFileSync(s.out, 'utf8')).overall).toEqual({
      verdict: 'request-changes',
      note: 'rule on SF-001',
    });
  });

  test('abandon ends the review without decisions and keeps the draft', async () => {
    const s = await start();
    await api(s, 'PUT', '/api/draft', state());
    expect((await api(s, 'POST', '/api/abandon')).status).toBe(200);
    expect((await s.handle.done).kind).toBe('abandoned');
    expect([existsSync(s.out), existsSync(s.draft)]).toEqual([false, true]);
  });
});

describe('themes and preferences', () => {
  test('custom themes, the starting theme, and saved preferences are served', async () => {
    const dir = tempDir();
    const prefsPath = join(dir, 'cfg', 'prefs.json');
    const s = await start(packet(), {
      themes: [],
      initialTheme: 'gyokuro-light',
      themeDir: join(dir, 'themes'),
      prefsPath,
    });
    expect((await api(s, 'GET', '/api/themes')).body).toEqual({
      themes: [],
      initial: 'gyokuro-light',
      dir: join(dir, 'themes'),
      prefs: {},
    });
    expect((await api(s, 'PUT', '/api/prefs', { theme: 'neutral-dark' })).status).toBe(200);
    expect(JSON.parse(readFileSync(prefsPath, 'utf8'))).toEqual({ theme: 'neutral-dark' });
    expect((await api(s, 'GET', '/api/themes')).body.prefs).toEqual({ theme: 'neutral-dark' });
    expect((await api(s, 'PUT', '/api/prefs', { theme: 'x;y' })).status).toBe(400);
    // the diff display is remembered beside the theme
    expect((await api(s, 'PUT', '/api/prefs', { diff: 'split' })).status).toBe(200);
    expect(JSON.parse(readFileSync(prefsPath, 'utf8'))).toEqual({
      theme: 'neutral-dark',
      diff: 'split',
    });
    expect((await api(s, 'PUT', '/api/prefs', { diff: 'sideways' })).status).toBe(400);
  });
});

test('writeFileAtomic replaces whole and leaves no temp file', () => {
  const dir = tempDir();
  const f = join(dir, 'd.json');
  writeFileAtomic(f, 'one');
  writeFileAtomic(f, 'two');
  expect([readFileSync(f, 'utf8'), readdirSync(dir)]).toEqual(['two', ['d.json']]);
});

// --- harness ----------------------------------------------------------------

type Started = {
  handle: ServeHandle;
  token: string;
  port: number;
  url: string;
  dir: string;
  out: string;
  draft: string;
};
const open: ServeHandle[] = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((h) => h.close()));
});

async function start(
  p = packet(),
  extra: Partial<Parameters<typeof serve>[0]> = {},
): Promise<Started> {
  const dir = tempDir();
  const out = join(dir, 'decisions.json');
  const draft = draftPathFor(out);
  const handle = await serve({
    packet: p,
    digest: DIGEST,
    out,
    draft,
    html: '<html>page</html>',
    ...extra,
  });
  open.push(handle);
  return { handle, token: handle.token, port: handle.port, url: handle.url, dir, out, draft };
}
async function api(
  s: Started,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: Loose }> {
  const res = await fetch(`http://127.0.0.1:${s.port}${path}`, {
    method,
    headers: { 'x-review-token': s.token, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

function raw(
  s: Started,
  method: string,
  path: string,
  withToken: boolean,
  host: string | null,
): Promise<{
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { host: host ?? `127.0.0.1:${s.port}` };
    if (withToken) headers['x-review-token'] = s.token;
    const req = request({ host: '127.0.0.1', port: s.port, method, path, headers }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}
