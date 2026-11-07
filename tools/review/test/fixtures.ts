// Shared fixtures: a small valid packet and helpers. Imported by the tests,
// kept below their cases so each test file reads top-down.

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Packet, ReviewState } from '../src/schema.ts';

export const SLICE = 'intent/02-subsystems/00-seam.md';
export const SLICE_TEXT = `# Seam

## Constraints

- **Map a recorded reference** back to a live session for resume, and re-create it when not
  running.
- Let a human **attach**, and **observe read-only**.
`;

export function packet(over: Partial<Packet> = {}): Packet {
  return {
    kind: 'intent-review-packet',
    version: 1,
    mode: 'main',
    title: 'Fixture review',
    createdAt: '2026-11-07T00:00:00.000Z',
    iteration: 1,
    repo: { name: 'fixture' },
    reviewer: 'Rae',
    items: [
      {
        id: '0001-x/SF-001',
        kind: 'sf',
        title: 'resume conflates attach',
        status: 'pending',
        source: { path: 'design/0001-x/spec-feedback.md', line: 3 },
        evidence: [{ path: SLICE, section: 'Constraints', quote: 'for resume' }],
        sections: [
          { key: 'friction', label: 'Friction', text: 'Two acts share one verb.' },
          { key: 'revision', label: 'Proposed revision', text: 'Name both acts.' },
        ],
        proposal: {
          edits: [{ path: SLICE, before: 'for resume', after: 'to attach when live, or resume' }],
        },
        analysis: { recommendation: { verdict: 'accept', why: 'It holds for any host.' } },
      },
      {
        id: '0001-x/SF-002',
        kind: 'sf',
        title: 'attach multiplicity',
        status: 'ruled',
        statusLine: 'pending — ruled by Rae 2026-11-06, awaiting the intent edit: shared.',
        source: { path: 'design/0001-x/spec-feedback.md', line: 9 },
        evidence: [{ path: SLICE }],
        sections: [{ key: 'friction', label: 'Friction', text: 'Silent on writers.' }],
      },
    ],
    files: [{ path: SLICE, text: SLICE_TEXT }],
    ledger: [],
    ...over,
  };
}

export function state(over: Partial<ReviewState> = {}): ReviewState {
  return { reviewer: 'Rae', verdicts: [], annotations: [], ...over };
}

export function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'intent-review-'));
}

/** Write a tree of files (relative path -> text) under a fresh temp dir. */
export function tree(files: Record<string, string>): string {
  const root = tempDir();
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
}

/** A branch-mode packet: the fixture plus an intent-change item and the change refs. */
export function branchPacket(): Packet {
  const p = packet({
    mode: 'branch',
    change: {
      base: { ref: 'main', sha: 'b'.repeat(40) },
      head: { ref: 'topic', sha: 'h'.repeat(40) },
      recommendation: { verdict: 'request-changes', why: 'SF-001 needs a ruling first.' },
    },
  });
  p.items.push({
    id: `intent-change/${SLICE}`,
    kind: 'intent-change',
    title: `${SLICE} — modified`,
    attention: 'judgment',
    source: { path: SLICE, line: 5 },
    evidence: [{ path: SLICE }],
    sections: [],
    changes: [{ path: SLICE, status: 'modified', patch: '@@ -5 +5 @@\n-old\n+new\n' }],
  });
  return p;
}

/** JSON bodies the tests inspect structurally. */
// biome-ignore lint/suspicious/noExplicitAny: test responses are inspected structurally
export type Loose = any;
