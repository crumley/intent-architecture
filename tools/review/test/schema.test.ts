import { describe, expect, test } from 'bun:test';
import {
  type Annotation,
  advise,
  collisions,
  draftQuestion,
  type Item,
  type Packet,
  toDecisions,
  validateDecisions,
  validateDraft,
  validatePacket,
  validateSubmission,
} from '../src/schema.ts';
import { branchPacket, packet, SLICE, state } from './fixtures.ts';

// Each row: a mutation of the valid fixture packet -> the error paths it must produce.
const PACKET_CASES: [string, (p: Record<string, unknown>) => void, string[]][] = [
  ['the fixture is valid', () => {}, []],
  ['wrong kind', (p) => (p.kind = 'other'), ['kind']],
  ['future version refused', (p) => (p.version = 3), ['version']],
  ['a version 1 packet is refused', (p) => (p.version = 1), ['version']],
  [
    'every item asks a question',
    (p) => delete (p.items as { question?: string }[])[0]!.question,
    ['items[0].question'],
  ],
  [
    'the question is not empty',
    (p) => ((p.items as { question: string }[])[0]!.question = ' '),
    ['items[0].question'],
  ],
  [
    'version 1 analysis is named, with where it went',
    (p) => ((p.items as { analysis?: object }[])[0]!.analysis = { summary: 'x' }),
    ['items[0].analysis'],
  ],
  [
    'version 1 proposal is named, with where it went',
    (p) => ((p.items as { proposal?: object }[])[0]!.proposal = { edits: [] }),
    ['items[0].proposal'],
  ],
  [
    'what needs its facts',
    (p) => ((p.items as { what: object }[])[0]!.what = {}),
    ['items[0].what.facts'],
  ],
  [
    'so what needs its stakes',
    (p) => ((p.items as { soWhat: object }[])[0]!.soWhat = { stakes: '' }),
    ['items[0].soWhat.stakes'],
  ],
  [
    'a context file says why it is shown',
    (p) => ((p.items as { context?: object[] }[])[0]!.context = [{ path: SLICE }]),
    ['items[0].context[0].why'],
  ],
  [
    'a version 1 context note is pointed at why',
    (p) => ((p.items as { context?: object[] }[])[0]!.context = [{ path: SLICE, note: 'n' }]),
    ['items[0].context[0].why'],
  ],
  [
    'a ruled item names who, when, and the ruling',
    (p) =>
      ((p.items as { ruled: object }[])[1]!.ruled = { by: 'Rae', on: 'yesterday', ruling: '' }),
    ['items[1].ruled.on', 'items[1].ruled.ruling'],
  ],
  [
    'attention is valid in main mode',
    (p) => ((p.items as { attention?: string }[])[0]!.attention = 'routine'),
    [],
  ],
  [
    'attention is closed',
    (p) => ((p.items as { attention?: string }[])[0]!.attention = 'urgent'),
    ['items[0].attention'],
  ],
  [
    'changes belong to a branch review',
    (p) =>
      ((p.items as { changes?: object[] }[])[0]!.changes = [
        { path: SLICE, status: 'modified', patch: '' },
      ]),
    ['items[0].changes'],
  ],
  [
    'a change belongs to a branch review',
    (p) => (p.change = { base: { ref: 'a', sha: 'b' }, head: { ref: 'c', sha: 'd' } }),
    ['change'],
  ],
  [
    'members are strings',
    (p) => ((p.items as { members?: unknown[] }[])[0]!.members = ['a', 3]),
    ['items[0].members[1]'],
  ],
  [
    'a composed edit names other items that exist',
    (p) =>
      ((p.items as { nowWhat: { composed?: object[] } }[])[0]!.nowWhat.composed = [
        { with: ['0001-x/IF-001', 'nope'], edits: [] },
      ]),
    ['items[0].nowWhat.composed[0].with[0]', 'items[0].nowWhat.composed[0].with[1]'],
  ],
  ['empty title', (p) => (p.title = ' '), ['title']],
  ['missing repo name', (p) => (p.repo = {}), ['repo.name']],
  ['iteration must be >= 1', (p) => (p.iteration = 0), ['iteration']],
  ['items not an array', (p) => (p.items = {}), ['items']],
  [
    'duplicate item id',
    (p) => ((p.items as { id: string }[])[1]!.id = '0001-x/IF-001'),
    ['items[1].id'],
  ],
  [
    'item kind is open, but not empty',
    (p) => ((p.items as { kind: string }[])[0]!.kind = ''),
    ['items[0].kind'],
  ],
  [
    'a producer’s own item kind is accepted',
    (p) => ((p.items as { kind: string }[])[0]!.kind = 'drift'),
    [],
  ],
  [
    'evidence may point at a code line range',
    (p) =>
      ((p.items as { evidence: object[] }[])[0]!.evidence = [
        { path: SLICE, lines: { start: 3, end: 5 } },
      ]),
    [],
  ],
  [
    'a line range must not run backwards',
    (p) =>
      ((p.items as { evidence: object[] }[])[0]!.evidence = [
        { path: SLICE, lines: { start: 5, end: 3 } },
      ]),
    ['items[0].evidence[0].lines'],
  ],
  [
    'sf status is closed',
    (p) => ((p.items as { status: string }[])[0]!.status = 'open'),
    ['items[0].status'],
  ],
  [
    'passage path not in files',
    (p) =>
      ((p.items as { evidence: { path: string }[] }[])[0]!.evidence[0]!.path = 'intent/nope.md'),
    ['items[0].evidence[0].path'],
  ],
  [
    'edit path not in files',
    (p) =>
      ((p.items as { nowWhat: { edits: { path: string }[] } }[])[0]!.nowWhat.edits[0]!.path =
        'x.md'),
    ['items[0].nowWhat.edits[0].path'],
  ],
  [
    'edit needs before text',
    (p) =>
      ((p.items as { nowWhat: { edits: { before: string }[] } }[])[0]!.nowWhat.edits[0]!.before =
        ''),
    ['items[0].nowWhat.edits[0].before'],
  ],
  [
    'recommendation verdict closed',
    (p) =>
      ((
        p.items as { nowWhat: { recommendation: { verdict: string } } }[]
      )[0]!.nowWhat.recommendation.verdict = 'maybe'),
    ['items[0].nowWhat.recommendation.verdict'],
  ],
  [
    'relation to an unknown item',
    (p) =>
      ((p.items as { soWhat: object }[])[0]!.soWhat = {
        stakes: 's',
        relations: [{ item: 'SF-999', note: 'x' }],
      }),
    ['items[0].soWhat.relations[0].item'],
  ],
  [
    'duplicate section key',
    (p) =>
      (p.items as { sections: object[] }[])[1]!.sections.push({
        key: 'friction',
        label: 'F',
        text: '',
      }),
    ['items[1].sections[1].key'],
  ],
  [
    'duplicate file',
    (p) => (p.files as object[]).push({ path: SLICE, text: '' }),
    ['files[1].path'],
  ],
  [
    'ledger status closed',
    (p) =>
      (p.ledger = [
        {
          id: 'a',
          entry: 'e',
          title: 't',
          status: 'open',
          slices: [],
          source: { path: 'p', line: 1 },
        },
      ]),
    ['ledger[0].status'],
  ],
  ['unknown fields are ignored', (p) => (p.futureField = { anything: true }), []],
  ['mode is required', (p) => delete p.mode, ['mode']],
  ['mode is closed', (p) => (p.mode = 'pr'), ['mode']],
  ['branch mode needs the change refs', (p) => (p.mode = 'branch'), ['change']],
  [
    'change refs need shas',
    (p) =>
      Object.assign(p, {
        mode: 'branch',
        change: { base: { ref: 'main' }, head: { ref: 'x', sha: 'y' } },
      }),
    ['change.base.sha'],
  ],
  [
    'an sf item needs a status',
    (p) => delete (p.items as { status?: string }[])[0]!.status,
    ['items[0].status'],
  ],
  [
    'a change item may omit status',
    (p) =>
      inBranch(p).push({
        id: 'c',
        kind: 'decision',
        question: 'Approve?',
        title: 't',
        source: { path: 'd', line: 1 },
        evidence: [],
        sections: [],
        changes: [{ path: 'd', status: 'added', patch: '' }],
      }),
    [],
  ],
  [
    'change status is closed',
    (p) =>
      inBranch(p).push({
        id: 'c',
        kind: 'decision',
        question: 'Approve?',
        title: 't',
        source: { path: 'd', line: 1 },
        evidence: [],
        sections: [],
        changes: [{ path: 'd', status: 'moved', patch: '' }],
      }),
    ['items[2].changes[0].status'],
  ],
];

/** Turn the main-mode fixture into a branch review, returning its items to push to. */
function inBranch(p: Record<string, unknown>): object[] {
  p.mode = 'branch';
  p.change = { base: { ref: 'main', sha: 'b' }, head: { ref: 'topic', sha: 'h' } };
  return p.items as object[];
}

const REF = {
  title: 'Fixture review',
  createdAt: '2026-11-07T00:00:00.000Z',
  mode: 'main' as const,
  iteration: 1,
  digest: `sha256:${'a'.repeat(64)}`,
};

// Each row: a submitted review state -> the error paths strict validation must produce.
const SUBMIT_CASES: [string, Record<string, unknown>, string[]][] = [
  ['an empty review is valid', state(), []],
  [
    'accept needs no words',
    state({ verdicts: [{ item: '0001-x/IF-001', verdict: 'accept' }] }),
    [],
  ],
  [
    'amend needs wording',
    state({ verdicts: [{ item: '0001-x/IF-001', verdict: 'amend' }] }),
    ['verdicts[0].wording'],
  ],
  [
    'amend with blank wording',
    state({ verdicts: [{ item: '0001-x/IF-001', verdict: 'amend', wording: '  ' }] }),
    ['verdicts[0].wording'],
  ],
  [
    'decline needs why',
    state({ verdicts: [{ item: '0001-x/IF-001', verdict: 'decline' }] }),
    ['verdicts[0].why'],
  ],
  [
    'revise needs request',
    state({ verdicts: [{ item: '0001-x/IF-001', verdict: 'revise' }] }),
    ['verdicts[0].request'],
  ],
  ['defer may stand alone', state({ verdicts: [{ item: '0001-x/IF-001', verdict: 'defer' }] }), []],
  [
    'unknown verdict',
    state({ verdicts: [{ item: '0001-x/IF-001', verdict: 'maybe' as 'accept' }] }),
    ['verdicts[0].verdict'],
  ],
  [
    'verdict on an unknown item',
    state({ verdicts: [{ item: 'nope', verdict: 'accept' }] }),
    ['verdicts[0].item'],
  ],
  [
    'two verdicts on one item',
    state({
      verdicts: [
        { item: '0001-x/IF-001', verdict: 'accept' },
        { item: '0001-x/IF-001', verdict: 'defer' },
      ],
    }),
    ['verdicts[1].item'],
  ],
  ['reviewer required', state({ reviewer: '' }), ['reviewer']],
  ['annotation on a file', state({ annotations: [ann()] }), []],
  [
    'annotation on an unknown file',
    state({ annotations: [ann({ target: { kind: 'file', path: 'intent/x.md' } })] }),
    ['annotations[0].target.path'],
  ],
  [
    'annotation on an item section',
    state({
      annotations: [ann({ target: { kind: 'item', item: '0001-x/IF-001', section: 'friction' } })],
    }),
    [],
  ],
  [
    'annotation on an unknown section',
    state({
      annotations: [ann({ target: { kind: 'item', item: '0001-x/IF-001', section: 'nope' } })],
    }),
    ['annotations[0].target.section'],
  ],
  [
    'annotation needs a quote',
    state({ annotations: [ann({ selector: { exact: '', prefix: '', suffix: '' } })] }),
    ['annotations[0].selector.exact'],
  ],
  [
    'intent-here and mismatch are note kinds',
    state({ annotations: [ann({ kind: 'intent-here' }), ann({ id: 'a2', kind: 'mismatch' })] }),
    [],
  ],
  [
    'a note may name the item it was made from',
    state({ annotations: [ann({ item: '0001-x/IF-001' })] }),
    [],
  ],
  [
    '…but only an item in the packet',
    state({ annotations: [ann({ item: 'nope' })] }),
    ['annotations[0].item'],
  ],
  [
    'comment needs words',
    state({ annotations: [ann({ comment: '' })] }),
    ['annotations[0].comment'],
  ],
  [
    'suggestion needs its replacement',
    state({ annotations: [ann({ kind: 'suggestion', comment: '' })] }),
    ['annotations[0].suggestion'],
  ],
  [
    'suggestion may omit the comment',
    state({ annotations: [ann({ kind: 'suggestion', comment: '', suggestion: 'new' })] }),
    [],
  ],
  ['duplicate annotation id', state({ annotations: [ann(), ann()] }), ['annotations[1].id']],
];

describe('validatePacket', () => {
  test.each(PACKET_CASES)('%s', (_name, mutate, paths) => {
    const p = structuredClone(packet()) as unknown as Record<string, unknown>;
    mutate(p);
    const r = validatePacket(p);
    expect(r.ok ? [] : r.errors.map((e) => e.path)).toEqual(paths);
  });
});

describe('validateSubmission (strict, against the packet)', () => {
  test.each(SUBMIT_CASES)('%s', (_name, s, paths) => {
    const r = validateSubmission(s, packet());
    expect(r.ok ? [] : r.errors.map((e) => e.path)).toEqual(paths);
  });
});

describe('branch mode: the overall verdict', () => {
  const CASES: [string, Record<string, unknown>, string[]][] = [
    ['required on a branch review', state(), ['overall']],
    ['approve', state({ overall: { verdict: 'approve' } }), []],
    [
      'request-changes with a note',
      state({ overall: { verdict: 'request-changes', note: 'fix SF-001' } }),
      [],
    ],
    ['closed set', state({ overall: { verdict: 'merge' as 'approve' } }), ['overall.verdict']],
  ];
  test.each(CASES)('%s', (_name, s, paths) => {
    const r = validateSubmission(s, branchPacket());
    expect(r.ok ? [] : r.errors.map((e) => e.path)).toEqual(paths);
  });
  test('not required on a main review', () => {
    expect(validateSubmission(state(), packet()).ok).toBe(true);
  });
  test('the branch fixture packet is valid', () => {
    const r = validatePacket(branchPacket());
    expect(r.ok ? [] : r.errors).toEqual([]);
  });
});

describe('drafts and decisions', () => {
  test('a draft keeps a half-written verdict that a submission refuses', () => {
    const half = state({ verdicts: [{ item: '0001-x/IF-001', verdict: 'amend' }] });
    expect(
      validateDraft({ kind: 'intent-review-draft', version: 1, packet: REF, ...half }).ok,
    ).toBe(true);
    expect(validateSubmission(half, packet()).ok).toBe(false);
  });

  test('a decisions file needs a well-formed packet digest', () => {
    const d = toDecisions(state(), { ...REF, digest: 'md5:x' }, '2026-11-07T01:00:00.000Z');
    const r = validateDecisions(d);
    expect(r.ok ? [] : r.errors.map((e) => e.path)).toEqual(['packet.digest']);
  });

  test('toDecisions keeps only each verdict kind’s own words, in contract shape', () => {
    const s = state({
      reviewer: ' Rae ',
      comment: '  ',
      verdicts: [
        {
          item: '0001-x/IF-001',
          verdict: 'decline',
          why: 'no',
          wording: 'left over from amend',
          note: '',
        },
        { item: '0001-x/IF-002', verdict: 'defer', ruling: 'shared by design', note: 'later' },
      ],
      annotations: [{ ...ann({ kind: 'comment', suggestion: 'stale' }), extra: 1 } as Annotation],
    });
    const d = toDecisions(s, REF, '2026-11-07T01:00:00.000Z');
    expect(d.reviewer).toBe('Rae');
    expect('comment' in d).toBe(false);
    expect(d.verdicts).toEqual([
      { item: '0001-x/IF-001', verdict: 'decline', why: 'no' },
      { item: '0001-x/IF-002', verdict: 'defer', ruling: 'shared by design', note: 'later' },
    ]);
    expect(Object.keys(d.annotations[0] as object).sort()).toEqual([
      'at',
      'comment',
      'createdAt',
      'id',
      'kind',
      'selector',
      'target',
    ]);
    expect(validateDecisions(d, packet()).ok).toBe(true);
  });
});

// --- fixtures ---------------------------------------------------------------

function ann(over: Partial<Annotation> = {}): Annotation {
  return {
    id: 'a1',
    target: { kind: 'file', path: SLICE },
    selector: { exact: 'observe read-only', prefix: 'attach**, and **', suffix: '**.\n' },
    at: { start: 10, end: 20, line: 7 },
    kind: 'comment',
    comment: 'Is observe enforced?',
    createdAt: '2026-11-07T00:10:00.000Z',
    ...over,
  };
}

test('kind "sf" — the spelling before intent feedback — is accepted, and still needs a status', () => {
  const p = packet();
  const legacy = { ...(p.items[0] as Item), kind: 'sf' };
  expect(validatePacket({ ...p, items: [legacy] }).ok).toBe(true);
  const { status: _drop, ...noStatus } = legacy;
  const r = validatePacket({ ...p, items: [noStatus] });
  expect(r.ok ? [] : r.errors.map((e) => e.path)).toEqual(['items[0].status']);
});

describe('version 1 → 2', () => {
  test('a version 1 packet is refused with how to migrate it', () => {
    const r = validatePacket({ ...packet(), version: 1 });
    expect(r.ok).toBe(false);
    const msg = r.ok ? '' : (r.errors[0]?.message ?? '');
    expect(msg).toContain('version 1 packet');
    for (const field of [
      'question',
      'what.facts',
      'soWhat.stakes',
      'nowWhat.edits',
      'context[].why',
    ]) {
      expect(msg).toContain(field);
    }
  });
});

describe('advise: what a valid packet still lacks', () => {
  const messages = (p: Packet) => advise(p).map((a) => `${a.path}: ${a.message}`);

  test('the fixture needs no advice beyond the ruled item it leaves bare', () => {
    expect(messages(packet())).toEqual([
      expect.stringContaining('items[1]: 0001-x/IF-002: no what / soWhat / nowWhat yet'),
    ]);
  });

  test('a scanner-drafted question, a statement, and a ruled Status without its block', () => {
    const p = packet();
    const [a, b] = p.items as [Item, Item];
    a.question = draftQuestion(a);
    b.question = 'Land the wording.';
    delete b.ruled;
    const m = messages(p);
    expect(m).toContainEqual(
      expect.stringContaining(
        "items[0].question: 0001-x/IF-001: the question is still the scanner's draft",
      ),
    );
    expect(m).toContainEqual(
      expect.stringContaining(
        'items[1].question: 0001-x/IF-002: phrase the question as a question',
      ),
    );
    expect(m).toContainEqual(expect.stringContaining('items[1].ruled'));
  });

  test('a quote or "before" not verbatim, or ambiguous, is named', () => {
    const p = packet();
    const a = p.items[0] as Item;
    a.evidence = [{ path: SLICE, quote: 'for resume and re-create' }];
    (a.nowWhat?.edits ?? [])[0]!.before = '**';
    const m = messages(p);
    expect(m).toContainEqual(
      expect.stringContaining('evidence[0].quote: the quote is not verbatim'),
    );
    expect(m).toContainEqual(expect.stringContaining('"before" occurs more than once'));
  });

  test('a one-sided recommendation is flagged', () => {
    const p = packet();
    delete (p.items[0] as Item).nowWhat?.ifDeclined;
    expect(messages(p)).toContainEqual(expect.stringContaining('reads one-sided'));
  });

  test('two items editing one passage collide until one declares a composed wording', () => {
    const p = packet();
    const b = p.items[1] as Item;
    b.nowWhat = {
      edits: [{ path: SLICE, before: 'back to a live session for resume', after: 'x' }],
    };
    expect(collisions(p)).toEqual([
      { a: '0001-x/IF-001', b: '0001-x/IF-002', path: SLICE, aEdit: 0, bEdit: 0 },
    ]);
    expect(messages(p)).toContainEqual(expect.stringContaining('edit overlapping text'));
    b.nowWhat.composed = [{ with: ['0001-x/IF-001'], edits: [] }];
    expect(messages(p).some((m) => m.includes('overlapping'))).toBe(false);
  });
});
