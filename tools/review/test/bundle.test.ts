// End to end: the committed bundle — exactly what the skill ships — run under
// plain `node` (the pinned floor, Node 20, when run through mise).

import { describe, expect, test } from 'bun:test';
import { type ChildProcess, execFileSync, spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { branchPacket, type Loose, packet, state, tempDir } from './fixtures.ts';

const BUNDLE = join(
  import.meta.dir,
  '../../../.agents/skills/intent-architecture/scripts/review.mjs',
);

describe('the shipped bundle', () => {
  test('runs under Node >= 20', () => {
    const v = execFileSync('node', ['--version'], { encoding: 'utf8' }).trim();
    expect(Number(/^v(\d+)/.exec(v)?.[1])).toBeGreaterThanOrEqual(20);
  });

  test('imports nothing but node: built-ins', () => {
    const src = readFileSync(BUNDLE, 'utf8');
    const specs = [
      ...src.matchAll(
        /\bfrom\s+["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)|\brequire\(\s*["']([^"']+)["']\s*\)/g,
      ),
    ].map((m) => m[1] ?? m[2] ?? m[3]);
    expect(specs.length).toBeGreaterThan(0);
    expect(specs.filter((s) => !s?.startsWith('node:'))).toEqual([]);
  });

  // Each row: arguments -> exit code (and a fragment of what it prints).
  const CLI: [string[], number, string][] = [
    [['--version'], 0, '1.0.0'],
    [['--help'], 0, 'usage:'],
    [[], 0, 'usage:'],
    [['frobnicate'], 2, 'unknown command'],
    [['serve', '--packet'], 2, '--packet needs a value'],
    [['serve', '--out', 'x.json'], 2, '--packet is required'],
    [['validate', '--packet', 'BAD'], 2, 'is not a valid packet'],
    [['validate', '--packet', 'GOOD'], 0, 'is a valid packet'],
    [['scan', '--repo', '/nonexistent'], 2, 'has no intent/'],
    [['scan', '--repo', '.', '--head', 'x'], 2, '--head needs --base'],
  ];
  test.each(CLI)('%p -> exit %d', (args, code, fragment) => {
    const dir = tempDir();
    writeFileSync(join(dir, 'good.json'), JSON.stringify(packet()));
    writeFileSync(join(dir, 'bad.json'), JSON.stringify({ ...packet(), version: 9 }));
    const argv = args.map((a) =>
      a === 'GOOD' ? join(dir, 'good.json') : a === 'BAD' ? join(dir, 'bad.json') : a,
    );
    const r = spawnSync('node', [BUNDLE, ...argv], { encoding: 'utf8' });
    expect(r.status).toBe(code);
    expect(r.stdout + r.stderr).toContain(fragment);
  });

  test('serve → page + packet over HTTP → submit → exit 0 with valid decisions', async () => {
    const run = await serveBundle(packet());
    const page = await fetch(run.url);
    const html = await page.text();
    expect(html).toContain('<div id="app">');
    expect(html).not.toContain('/*__JS__*/');
    const p = await run.api('GET', '/api/packet');
    expect(p.body.packet.items).toHaveLength(2);
    const r = await run.api(
      'POST',
      '/api/submit',
      state({ verdicts: [{ item: '0001-x/SF-001', verdict: 'defer', ruling: 'later' }] }),
    );
    expect(r.status).toBe(200);
    expect(await run.exit).toBe(0);
    expect(run.stdout()).toContain('review: decisions written to');
    const v = spawnSync('node', [BUNDLE, 'validate', '--decisions', run.out], { encoding: 'utf8' });
    expect([v.status, v.stdout]).toEqual([0, expect.stringContaining('1 verdicts')]);
  });

  test('a branch review round-trips its overall verdict', async () => {
    const run = await serveBundle(branchPacket());
    const r = await run.api('POST', '/api/submit', state({ overall: { verdict: 'approve' } }));
    expect(r.status).toBe(200);
    expect(await run.exit).toBe(0);
    expect(JSON.parse(readFileSync(run.out, 'utf8')).overall).toEqual({ verdict: 'approve' });
  });

  test('abandon from the page → exit 3, no decisions, draft kept', async () => {
    const run = await serveBundle(packet());
    await run.api('PUT', '/api/draft', state());
    await run.api('POST', '/api/abandon');
    expect(await run.exit).toBe(3);
    expect(spawnSync('test', ['-e', run.out]).status).not.toBe(0);
    expect(spawnSync('test', ['-e', run.out.replace('.json', '.draft.json')]).status).toBe(0);
  });

  test('a signal → exit 3', async () => {
    const run = await serveBundle(packet());
    run.child.kill('SIGTERM');
    expect(await run.exit).toBe(3);
  });
});

// --- harness ----------------------------------------------------------------

type Run = {
  child: ChildProcess;
  url: string;
  out: string;
  exit: Promise<number | null>;
  stdout: () => string;
  api: (method: string, path: string, body?: unknown) => Promise<{ status: number; body: Loose }>;
};

async function serveBundle(p: object): Promise<Run> {
  const dir = tempDir();
  const packetPath = join(dir, 'packet.json');
  const out = join(dir, 'decisions.json');
  writeFileSync(packetPath, JSON.stringify(p));
  const child = spawn('node', [BUNDLE, 'serve', '--packet', packetPath, '--out', out], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  const exit = new Promise<number | null>((resolve) => child.on('exit', (code) => resolve(code)));
  const url = await new Promise<string>((resolve, reject) => {
    child.stdout?.on('data', (c: Buffer) => {
      stdout += c.toString();
      const m = /review: open (\S+)/.exec(stdout);
      if (m) resolve(m[1] as string);
    });
    child.on('exit', () => reject(new Error(`exited before listening: ${stdout}`)));
  });
  const token = new URL(url).searchParams.get('token') as string;
  const origin = new URL(url).origin;
  return {
    child,
    url,
    out,
    exit,
    stdout: () => stdout,
    api: async (method, path, body) => {
      const res = await fetch(origin + path, {
        method,
        headers: { 'x-review-token': token, 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
  };
}
