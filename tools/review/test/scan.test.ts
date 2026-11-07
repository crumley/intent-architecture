import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { classifyStatus, findQuote, parseNameStatus, scanRepo } from '../src/scan.ts';
import { type SfStatus, validatePacket } from '../src/schema.ts';
import { tree } from './fixtures.ts';

// Each row: a Status line as written -> how the scanner classifies it.
const STATUS: [string | undefined, SfStatus][] = [
  [undefined, 'pending'],
  ['pending.', 'pending'],
  ['`pending`', 'pending'],
  ['pending — ruled by Rae 2026-11-06 (review of #9), awaiting the intent edit: x.', 'ruled'],
  ['adjudicated — [#95](https://example/95) (owner’s ruling: …)', 'adjudicated'],
  ['declined — the seam already says so.', 'declined'],
];

describe('classifyStatus', () => {
  test.each(STATUS)('%p -> %s', (line, want) => expect(classifyStatus(line)).toBe(want));
});

describe('findQuote', () => {
  const file =
    '- **Map a recorded session reference** (its identity) back to a live session\n  for resume, and re-create it when not running.';
  const CASES: [string, string | undefined][] = [
    ['back to a live session for resume', 'back to a live session\n  for resume'],
    [
      'map a recorded session reference … back to a live session **for resume**, and re-create it',
      'back to a live session\n  for resume, and re-create it',
    ],
    ['Map a recorded session reference', '**Map a recorded session reference**'],
    ['two words', undefined],
    ['not in the file at all', undefined],
  ];
  test.each(CASES)('%p', (q, want) => expect(findQuote(file, [q])).toBe(want));
});

test('parseNameStatus', () => {
  expect([
    parseNameStatus('M\tintent/a.md'),
    parseNameStatus('A\tdesign/0002-x/README.md'),
    parseNameStatus('R087\tintent/old.md\tintent/new.md'),
    parseNameStatus('D\tintent/gone.md'),
  ]).toEqual([
    { path: 'intent/a.md', status: 'modified' },
    { path: 'design/0002-x/README.md', status: 'added' },
    { path: 'intent/new.md', status: 'renamed', oldPath: 'intent/old.md' },
    { path: 'intent/gone.md', status: 'deleted' },
  ]);
});

describe('main mode', () => {
  const root = tree(REPO);
  const { packet, warnings } = scanRepo(root, { now: new Date('2026-11-07T00:00:00Z') });

  test('produces a valid main-mode packet', () => {
    const v = validatePacket(packet);
    expect(v.ok ? [] : v.errors).toEqual([]);
    expect(packet.mode).toBe('main');
  });

  test('items: pending and ruled SFs, then the cross-cutting open questions', () => {
    expect(packet.items.map((i) => [i.id, i.kind, i.status])).toEqual([
      ['0001-alpha/SF-001', 'sf', 'pending'],
      ['0001-alpha/SF-002', 'sf', 'ruled'],
      ['0001-alpha/SF-005', 'sf', 'pending'],
      ['OQ/who-owns-the-cadence', 'question', 'pending'],
      ['design/decisions/0002-pending.md', 'decision', undefined],
    ]);
  });

  test('the ledger holds every SF, settled ones included', () => {
    expect(packet.ledger?.map((r) => [r.id, r.status, r.slices])).toEqual([
      ['0001-alpha/SF-001', 'pending', ['intent/02-subsystems/00-seam.md']],
      ['0001-alpha/SF-002', 'ruled', ['intent/02-subsystems/00-seam.md']],
      ['0001-alpha/SF-003', 'adjudicated', []],
      ['0001-alpha/SF-004', 'declined', []],
      ['0001-alpha/SF-005', 'pending', []],
    ]);
  });

  test('an SF’s bullets become sections; the Slice yields a passage with section and quote', () => {
    const sf = packet.items[0];
    expect(sf?.sections.map((s) => s.key)).toEqual([
      'slice',
      'friction',
      'assumption',
      'revision',
      'entry-context',
    ]);
    expect(sf?.sections[1]?.text).toBe('two acts,\none verb.');
    expect(sf?.evidence).toEqual([
      {
        path: 'intent/02-subsystems/00-seam.md',
        section: 'Constraints',
        quote: 'back to a live session for resume',
      },
    ]);
    expect(packet.items[1]?.statusLine).toBe(
      'pending — ruled by Rae 2026-11-06, awaiting the intent edit: shared.',
    );
  });

  test('an SF without labelled bullets is kept as one body, with a warning', () => {
    expect(packet.items[2]?.sections.map((s) => s.key)).toEqual(['body', 'entry-context']);
    expect(warnings).toHaveLength(1);
  });

  test('the snapshot is every text file (binaries omitted); open questions stop at the index', () => {
    const want = Object.keys(REPO)
      .filter((p) => !p.endsWith('.png'))
      .sort();
    expect(packet.files.map((f) => f.path)).toEqual(want);
    expect(packet.omitted).toEqual([{ path: 'logo.png', reason: 'binary' }]);
    expect(packet.items.filter((i) => i.kind === 'question')).toHaveLength(1);
  });

  test('--files intent narrows the snapshot to intent/', () => {
    const narrow = scanRepo(root, { files: 'intent' }).packet;
    expect(narrow.files.map((f) => f.path)).toEqual([
      'intent/00-foundation/open-questions.md',
      'intent/02-subsystems/00-seam.md',
    ]);
  });

  test('a proposed ADR is an open decision; an accepted one is not', () => {
    const d = packet.items.filter((i) => i.kind === 'decision');
    expect(d.map((i) => [i.id, i.title])).toEqual([
      ['design/decisions/0002-pending.md', '0002 — Pending choice'],
    ]);
  });
});

describe('branch mode', () => {
  const root = tree(REPO);
  const g = (...args: string[]) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  g('init', '-q', '-b', 'main');
  g('-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '.');
  g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'base');
  g('checkout', '-q', '-b', 'topic');
  writeFileSync(
    join(root, 'intent/02-subsystems/00-seam.md'),
    REPO['intent/02-subsystems/00-seam.md'].replace('for resume', 'to attach or resume'),
  );
  writeFileSync(
    join(root, 'design/0001-alpha/spec-feedback.md'),
    `${REPO['design/0001-alpha/spec-feedback.md'].replace('- **Status:** pending — ruled', '- **Status:** adjudicated — [#7](x) (ruled')}\n## SF-006 — raised here\n\n- **Friction:** new.\n`,
  );
  writeFileSync(join(root, 'design/decisions-note.md'), 'x');
  execFileSync('mkdir', ['-p', join(root, 'design/decisions'), join(root, 'design/0002-beta')]);
  writeFileSync(join(root, 'design/decisions/0001-tool.md'), '# 0001 — A tool\n');
  writeFileSync(
    join(root, 'design/0002-beta/README.md'),
    '# 0002 — Beta\n\nServes [seam](../../intent/02-subsystems/00-seam.md).\n',
  );
  g('-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '.');
  g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'topic');
  const { packet } = scanRepo(root, { base: 'main', head: 'topic' });

  test('produces a valid branch-mode packet with both refs', () => {
    const v = validatePacket(packet);
    expect(v.ok ? [] : v.errors).toEqual([]);
    expect([packet.mode, packet.change?.base.ref, packet.change?.head.ref]).toEqual([
      'branch',
      'main',
      'topic',
    ]);
    expect(packet.change?.base.sha).toMatch(/^[0-9a-f]{40}$/);
  });

  test('items: intent changes, SFs raised or re-statused, decisions, design entries — in that order', () => {
    expect(packet.items.map((i) => [i.id, i.kind, i.attention ?? null])).toEqual([
      ['intent-change/intent/02-subsystems/00-seam.md', 'intent-change', 'judgment'],
      ['0001-alpha/SF-002', 'sf', 'judgment'],
      ['0001-alpha/SF-006', 'sf', 'judgment'],
      ['design/decisions/0001-tool.md', 'decision', null],
      ['design/(other)', 'design-entry', null],
      ['design/0001-alpha', 'design-entry', null],
      ['design/0002-beta', 'design-entry', null],
    ]);
  });

  test('change items carry their diff; an SF records what the branch did to it', () => {
    const intent = packet.items[0];
    expect(intent?.changes?.[0]?.patch).toContain(
      '+- **Map a recorded reference** back to a live session to attach or resume',
    );
    expect(packet.items[1]?.baseStatusLine).toStartWith('pending — ruled');
    expect(packet.items[1]?.sections[0]).toEqual(expect.objectContaining({ key: 'on-branch' }));
    expect(packet.items[2]?.sections[0]?.text).toBe('Raised on this branch.');
    expect(packet.items[6]?.context).toEqual([{ path: 'intent/02-subsystems/00-seam.md' }]);
    expect(packet.items[6]?.title).toBe('0002 — Beta — added');
  });

  test('the snapshot is the intent at head plus the changed design files', () => {
    expect(packet.files.find((f) => f.path === 'intent/02-subsystems/00-seam.md')?.text).toContain(
      'to attach or resume',
    );
    expect(packet.files.map((f) => f.path)).toContain('design/0002-beta/README.md');
  });
});

// --- fixture repository -----------------------------------------------------

const REPO = {
  'intent/02-subsystems/00-seam.md': `# Seam

## Constraints

- **Map a recorded reference** back to a live session for resume, and re-create it.
`,
  'intent/00-foundation/open-questions.md': `# Open Questions

## Cross-cutting items

- **Who owns the cadence.** Nothing fires the recurring work.
- **<Tension>** — <placeholder, skipped>.

## Index of per-slice open questions

- **Not an item.** An index entry.

## Recently resolved

- **Also not an item.** Settled.
`,
  'design/0001-alpha/README.md': '# 0001 — Alpha\n',
  'design/0001-alpha/spec-feedback.md': `# 0001 — Spec-feedback

> Frictions found building alpha.

## SF-001 — resume conflates attach

- **Slice:** [\`seam\`](../../intent/02-subsystems/00-seam.md), _Constraints_ ("back to a live session for resume").
- **Friction:** two acts,
  one verb.
- **Assumption made to keep moving:** both.
- **Proposed revision:** name both.

## SF-002 — attach multiplicity

- **Slice:** [\`seam\`](../../intent/02-subsystems/00-seam.md), _Constraints_.
- **Friction:** silent on writers.
- **Status:** pending — ruled by Rae 2026-11-06, awaiting the intent edit:
  shared.

## SF-003 — settled

- **Friction:** x.
- **Status:** adjudicated — [#5](x).

## SF-004 — refused

- **Friction:** y.
- **Status:** declined — already said.

## SF-005 — free prose

Just a paragraph, no labelled bullets.
`,
  'design/0000-template/spec-feedback.md': '## SF-001 — <template, skipped>\n',
  'design/decisions/0001-settled.md':
    '# 0001 — Settled choice\n\n> **Status:** accepted · **Date:** 2026-01-01\n',
  'design/decisions/0002-pending.md':
    '# 0002 — Pending choice\n\n> **Status:** proposed · **Date:** 2026-01-02\n',
  'src/app.ts': 'export const x = 1;\n',
  'logo.png': 'PNG\u0000binary',
};
