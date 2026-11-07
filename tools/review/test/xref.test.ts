import { expect, test } from 'bun:test';
import { buildIndex, entryOf, findRefs, resolvePath } from '../src/ui/xref.ts';

const IDX = buildIndex(
  [
    'intent/02-subsystems/01-session-multiplexer.md',
    'intent/00-foundation/01-principles.md',
    'design/0031-detached-session-hosting/README.md',
    'design/0031-detached-session-hosting/spec-feedback.md',
    'design/0051-floor-scope-sessions/README.md',
    'design/decisions/0006-tmux-detached-host.md',
  ],
  [
    '0031-detached-session-hosting/IF-005',
    '0031-detached-session-hosting/IF-001',
    '0051-floor-scope-sessions/IF-001',
  ],
  // the items under review
  [
    '0031-detached-session-hosting/IF-005',
    '0031-detached-session-hosting/IF-001',
    '0051-floor-scope-sessions/IF-001',
  ],
);
const IN_0031 = {
  dir: 'design/0031-detached-session-hosting',
  entry: '0031-detached-session-hosting',
};

// Each row: text, context -> [linked text, link] pairs.
const CASES: [string, object, [string, string][]][] = [
  // IF-NNN is the id; SF-NNN, the spelling before the rename, is an alias for the same item.
  ['see IF-005', IN_0031, [['IF-005', 'if:0031-detached-session-hosting/IF-005']]],
  ['as 0051 IF-001 says', IN_0031, [['0051 IF-001', 'if:0051-floor-scope-sessions/IF-001']]],
  ['see SF-005', IN_0031, [['SF-005', 'if:0031-detached-session-hosting/IF-005']]],
  ['see SF-009', {}, []],
  ['as 0051 SF-001 says', IN_0031, [['0051 SF-001', 'if:0051-floor-scope-sessions/IF-001']]],
  ['0031/SF-001 and SF-009', {}, [['0031/SF-001', 'if:0031-detached-session-hosting/IF-001']]],
  [
    'SF-005 is unique among the items; SF-001 is not',
    {},
    [['SF-005', 'if:0031-detached-session-hosting/IF-005']],
  ],
  ['ADR 0006 chose tmux', {}, [['ADR 0006', 'adr:0006']]],
  [
    'entry 0031 and 0006 and 2026 and 0999',
    {},
    [
      ['0031', 'entry:0031'],
      ['0006', 'adr:0006'],
    ],
  ],
  [
    'the [seam](../../intent/02-subsystems/01-session-multiplexer.md).',
    IN_0031,
    [['seam', 'file:intent/02-subsystems/01-session-multiplexer.md']],
  ],
  [
    'in intent/00-foundation/01-principles.md, §18',
    {},
    [['intent/00-foundation/01-principles.md', 'file:intent/00-foundation/01-principles.md']],
  ],
  [
    '`01-session-multiplexer.md` holds it',
    {},
    [['01-session-multiplexer.md', 'file:intent/02-subsystems/01-session-multiplexer.md']],
  ],
  [
    'design/0031-detached-session-hosting/ is the entry',
    {},
    [
      [
        'design/0031-detached-session-hosting/',
        'file:design/0031-detached-session-hosting/README.md',
      ],
    ],
  ],
  ['intent/nope.md is not there', {}, []],
];

test.each(CASES)('%p', (text, ctx, want) => {
  const got = findRefs(text, IDX, ctx).map((r) => [text.slice(r.start, r.end), r.link]);
  expect(got).toEqual(want);
});

test('entryOf and resolvePath', () => {
  expect([
    entryOf('design/0031-detached-session-hosting/spec-feedback.md'),
    entryOf('0051-floor-scope-sessions/IF-001'),
    entryOf('intent/README.md'),
  ]).toEqual(['0031-detached-session-hosting', '0051-floor-scope-sessions', undefined]);
  expect(resolvePath(IDX, IN_0031, '../decisions/0006-tmux-detached-host.md#why')).toBe(
    'design/decisions/0006-tmux-detached-host.md',
  );
  expect(resolvePath(IDX, {}, 'https://example.com/x.md')).toBeNull();
});
