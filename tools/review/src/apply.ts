// Before the agent carries out decisions: is the repository still the one the human
// reviewed? The digest says the decisions answer this packet; it says nothing about the
// tree the agent is about to edit, which may have moved since the snapshot (another
// merge, the agent's own earlier edits). This re-checks what an edit needs — that each
// `before` still occurs, once, in the current file — and that the ref has not moved.
// Pure: the command line supplies the file reader and the current head.

import { locate } from './anchor.ts';
import { fieldText } from './fields.ts';
import type { Decisions, Edit, Item, Packet, VerdictKind } from './schema.ts';

/** Verdicts that land an edit somewhere: each needs its `before` to still be there. */
const LANDS: readonly VerdictKind[] = ['accept', 'accept-with-changes', 'amend'];

export type EditCheck = {
  item: string;
  verdict: VerdictKind;
  path: string;
  /** `edit` — the item's own; `composed` — the wording declared for it and another accepted item. */
  from: 'edit' | 'composed';
  status: 'ok' | 'missing' | 'ambiguous' | 'no-file';
  line?: number;
};

export type NoteCheck = {
  id: string;
  status: 'exact' | 'context' | 'orphaned' | 'agent-text' | 'item-text' | 'no-file';
};

export type ApplyReport = {
  ok: boolean;
  digest: { packet: string; decisions: string; match: boolean };
  ref: { packet?: string; head?: string; moved: boolean | null };
  edits: EditCheck[];
  notes: NoteCheck[];
};

const occurrences = (text: string, s: string): number[] => {
  const out: number[] = [];
  for (let i = text.indexOf(s); i >= 0 && out.length < 3; i = text.indexOf(s, i + 1)) out.push(i);
  return out;
};

const lineAt = (text: string, at: number) => text.slice(0, at).split('\n').length;

/** The commit part of a `name@sha` ref, as `scan` writes it. */
const shaOf = (ref?: string) => ref?.split('@').pop();

export function checkApply(
  packet: Packet,
  packetDigest: string,
  decisions: Decisions,
  read: (path: string) => string | undefined,
  head?: string,
): ApplyReport {
  const byId = new Map(packet.items.map((i) => [i.id, i]));
  const landing = new Map(
    decisions.verdicts.filter((v) => LANDS.includes(v.verdict)).map((v) => [v.item, v.verdict]),
  );
  const edits: EditCheck[] = [];
  const check = (item: string, verdict: VerdictKind, e: Edit, from: EditCheck['from']) => {
    const text = read(e.path);
    if (text === undefined) {
      edits.push({ item, verdict, path: e.path, from, status: 'no-file' });
      return;
    }
    const at = occurrences(text, e.before);
    const status = at.length === 0 ? 'missing' : at.length > 1 ? 'ambiguous' : 'ok';
    const row: EditCheck = { item, verdict, path: e.path, from, status };
    if (at.length) row.line = lineAt(text, at[0] as number);
    edits.push(row);
  };
  for (const [id, verdict] of landing) {
    const it = byId.get(id);
    if (!it) continue;
    // When a composed wording covers this item and another landing item, that is what lands.
    const composed = composedWith(it, packet.items, landing);
    if (composed) {
      for (const e of composed) check(id, verdict, e, 'composed');
      continue;
    }
    for (const e of it.nowWhat?.edits ?? []) check(id, verdict, e, 'edit');
  }
  const notes: NoteCheck[] = decisions.annotations.map((a) => {
    const t = a.target;
    if (t.kind === 'field') {
      const it = byId.get(t.item);
      return {
        id: a.id,
        status: it && fieldText(it, t.field) !== undefined ? 'agent-text' : 'orphaned',
      };
    }
    if (t.kind === 'item') return { id: a.id, status: 'item-text' };
    const text = read(t.path);
    if (text === undefined) return { id: a.id, status: 'no-file' };
    return { id: a.id, status: locate(text, a.selector, a.at?.start).status };
  });
  const pRef = packet.repo.ref;
  const moved = head && pRef ? shaOf(head) !== shaOf(pRef) : null;
  const digestOk = decisions.packet.digest === packetDigest;
  const ref: ApplyReport['ref'] = { moved };
  if (pRef) ref.packet = pRef;
  if (head) ref.head = head;
  return {
    ok:
      digestOk &&
      edits.every((e) => e.status === 'ok') &&
      notes.every((n) => n.status !== 'orphaned' && n.status !== 'no-file'),
    digest: { packet: packetDigest, decisions: decisions.packet.digest, match: digestOk },
    ref,
    edits,
    notes,
  };
}

/** The composed edits to land for an item, when every item it is composed with also lands. */
function composedWith(
  it: Item,
  all: readonly Item[],
  landing: Map<string, VerdictKind>,
): Edit[] | undefined {
  for (const c of it.nowWhat?.composed ?? []) {
    if (c.with.every((w) => landing.has(w))) return c.edits;
  }
  for (const other of all) {
    if (other.id === it.id || !landing.has(other.id)) continue;
    for (const c of other.nowWhat?.composed ?? []) {
      if (c.with.includes(it.id) && c.with.every((w) => w === it.id || landing.has(w)))
        return c.edits;
    }
  }
  return undefined;
}
