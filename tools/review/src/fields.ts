// Field paths into an item: how a note on agent-written text (the question, What,
// So what, Now what, an edit's proposed wording…) names what it is anchored to.
// Pure and shared by the validator, `locate`, and the page, so all three read one
// path the same way. A path is dotted keys with [n] indexes: `what.facts`,
// `nowWhat.edits[0].after`, `soWhat.relations[1].note`.

import type { Item } from './schema.ts';

const STEP = /^(?:\.?([A-Za-z_][A-Za-z0-9_]*)|\[(\d+)\])/;

/** The path's steps, or null when it is not a well-formed field path. */
export function parseField(path: string): (string | number)[] | null {
  if (!path || path.length > 120 || path.startsWith('.')) return null;
  const out: (string | number)[] = [];
  let rest = path;
  while (rest) {
    const m = STEP.exec(rest);
    if (!m) return null;
    out.push(m[1] !== undefined ? m[1] : Number(m[2]));
    rest = rest.slice(m[0].length);
  }
  return out;
}

/** The text a field path names in an item, or undefined when it names no string. */
export function fieldText(item: Item, path: string): string | undefined {
  const steps = parseField(path);
  if (!steps) return undefined;
  let at: unknown = item;
  for (const s of steps) {
    if (at === null || typeof at !== 'object') return undefined;
    if (typeof s === 'number') {
      if (!Array.isArray(at)) return undefined;
      at = at[s];
    } else {
      if (Array.isArray(at) || !Object.hasOwn(at, s)) return undefined;
      at = (at as Record<string, unknown>)[s];
    }
  }
  return typeof at === 'string' ? at : undefined;
}

const LABELS: [RegExp, string][] = [
  [/^question$/, 'the question'],
  [/^title$/, 'the title'],
  [/^ruled\.ruling$/, 'the earlier ruling'],
  [/^what\.facts$/, 'What · the facts'],
  [/^what\.ranInto$/, 'What · what it ran into'],
  [/^what\.assumption$/, 'What · the assumption'],
  [/^evidence\[(\d+)\]\.note$/, 'What · note on quote $1'],
  [/^soWhat\.stakes$/, 'So what · why it matters'],
  [/^soWhat\.relations\[(\d+)\]\.note$/, 'So what · relation $1'],
  [/^nowWhat\.summary$/, 'Now what · summary'],
  [/^nowWhat\.edits\[(\d+)\]\.after$/, 'Now what · edit $1, proposed wording'],
  [/^nowWhat\.edits\[(\d+)\]\.before$/, 'Now what · edit $1, current wording'],
  [/^nowWhat\.edits\[(\d+)\]\.note$/, 'Now what · edit $1, note'],
  [/^nowWhat\.composed\[(\d+)\]\.edits\[(\d+)\]\.after$/, 'Now what · composed wording'],
  [/^nowWhat\.composed\[(\d+)\]\.note$/, 'Now what · composed note'],
  [/^nowWhat\.ifAccepted$/, 'Now what · if accepted'],
  [/^nowWhat\.ifDeclined$/, 'Now what · if declined'],
  [/^nowWhat\.recommendation\.why$/, 'Now what · the agent’s advice'],
  [/^context\[(\d+)\]\.why$/, 'why a related file is shown'],
];

/** A reader's name for a field path ("Now what · edit 1, proposed wording"). Indexes read 1-based. */
export function fieldLabel(path: string): string {
  for (const [re, label] of LABELS) {
    const m = re.exec(path);
    if (m) return label.replace(/\$(\d)/g, (_, n) => String(Number(m[Number(n)]) + 1));
  }
  return path;
}
