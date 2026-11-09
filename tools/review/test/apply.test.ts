import { describe, expect, test } from 'bun:test';
import { checkApply } from '../src/apply.ts';
import { settleMerged } from '../src/scan.ts';
import type { Decisions, Item } from '../src/schema.ts';
import { packet, SLICE, SLICE_TEXT } from './fixtures.ts';

const DIGEST = `sha256:${'b'.repeat(64)}`;
const decisions = (verdicts: Decisions['verdicts'], digest = DIGEST): Decisions => ({
  kind: 'intent-review-decisions',
  version: 2,
  packet: { title: 'Fixture review', createdAt: '2026-11-07T00:00:00.000Z', mode: 'main', digest },
  reviewer: 'Rae',
  submittedAt: '2026-11-08T00:00:00.000Z',
  verdicts,
  annotations: [],
});

describe('check-apply: is every edit still anchored in the tree as it is now?', () => {
  const p = { ...packet(), repo: { name: 'fixture', ref: 'main@aaaaaaaaaaaa' } };
  const tree = (text: string) => (path: string) => (path === SLICE ? text : undefined);
  test('an accepted edit whose before still holds is ready, even when the tree moved', () => {
    const r = checkApply(
      p,
      DIGEST,
      decisions([{ item: '0001-x/IF-001', verdict: 'accept' }]),
      tree(SLICE_TEXT),
      'main@bbbbbbbbbbbb',
    );
    expect([r.ok, r.ref.moved, r.edits.map((e) => e.status)]).toEqual([true, true, ['ok']]);
  });
  test('a before that is gone, or a digest that answers another packet, is drift', () => {
    const r = checkApply(
      p,
      DIGEST,
      decisions(
        [{ item: '0001-x/IF-001', verdict: 'amend', wording: 'w' }],
        `sha256:${'c'.repeat(64)}`,
      ),
      tree(SLICE_TEXT.replace('for resume', 'for attach')),
    );
    expect([r.ok, r.digest.match, r.edits.map((e) => e.status)]).toEqual([
      false,
      false,
      ['missing'],
    ]);
  });
  test('verdicts that land nothing are not checked', () => {
    const r = checkApply(
      p,
      DIGEST,
      decisions([{ item: '0001-x/IF-001', verdict: 'revise', request: 'again' }]),
      tree(''),
    );
    expect([r.ok, r.edits]).toEqual([true, []]);
  });
});

describe('scan --merged: a ruling whose intent change merged is offered as settling', () => {
  const file = (status: string) =>
    `# Intent feedback\n\n## IF-002 — attach multiplicity\n\n- **Status:** ${status}\n`;
  test('the Status flips to adjudicated, linking the change and keeping the ruling', () => {
    const status =
      'pending — ruled by Rae 2026-11-06, awaiting the intent edit: shared, by design.\n  (#7)';
    const it = structuredClone(packet().items[1]) as Item;
    it.statusLine = status.replace(/\s+/g, ' ');
    it.ruled = { by: 'Rae', on: '2026-11-06', ruling: 'shared, by design. (#7)' };
    const n = settleMerged([it], () => file(status), ['7']);
    expect(n).toBe(1);
    expect([it.category, it.attention, it.ruled]).toEqual(['settle', 'routine', undefined]);
    expect(it.nowWhat?.edits).toEqual([
      {
        path: it.source.path,
        before: status,
        after: "adjudicated — #7 (Rae's ruling: shared, by design)",
        note: 'the Status line',
      },
    ]);
  });
  test('a ruling awaiting a change that has not merged is left as it is', () => {
    const it = structuredClone(packet().items[1]) as Item;
    it.statusLine = 'pending — ruled by Rae 2026-11-06, awaiting the intent edit: shared. (#8)';
    expect(settleMerged([it], () => file(it.statusLine as string), ['#7'])).toBe(0);
    expect(it.category).toBeUndefined();
  });
});
