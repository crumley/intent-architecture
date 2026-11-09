import { describe, expect, test } from 'bun:test';
import type { AnnotationTarget } from '../src/schema.ts';
import { afterEdits, inlineDiff, mapRange, rangesFor, splitDiff } from '../src/ui/composite.ts';

const FILE: AnnotationTarget = { kind: 'file', path: 'intent/x.md' };
const AFTER: AnnotationTarget = { kind: 'field', item: 'i1', field: 'nowWhat.edits[0].after' };
const before = 'map a record\n  to a session for resume';
const after = 'map a record to a\n  live session for attach and resume';

describe('a word diff knows where each word came from', () => {
  test('inline: a selection maps to the proposed wording, deleted words skipped', () => {
    const c = inlineDiff('keep it for resume', 'keep it for attach', {
      after: { target: AFTER, off: 0 },
    });
    expect(c.text).toBe('keep it for resumeattach');
    // "for resumeattach" spans a deleted word: it maps to "for attach" in the proposal
    const m = mapRange(c, c.text.indexOf('for'), c.text.length);
    expect(m).toEqual({ ok: true, target: AFTER, start: 8, end: 18 });
    // only the deleted word: nothing to anchor to
    const del = c.text.indexOf('resume');
    expect(mapRange(c, del, del + 6)).toEqual({ ok: false, why: 'nothing' });
  });
  test('split: the current wording anchors to the file, at its offset', () => {
    const at = 40;
    const { before: b, after: a } = splitDiff(before, after, {
      before: { target: FILE, off: at },
      after: { target: AFTER, off: 0 },
    });
    expect(b.text).toBe(before);
    expect(a.text).toBe(after);
    const i = b.text.indexOf('session');
    expect(mapRange(b, i, i + 7)).toEqual({
      ok: true,
      target: FILE,
      start: at + i,
      end: at + i + 7,
    });
    const j = a.text.indexOf('live');
    expect(mapRange(a, j, j + 4)).toEqual({ ok: true, target: AFTER, start: j, end: j + 4 });
    expect(rangesFor(a, AFTER, j, j + 4)).toEqual([{ start: j, end: j + 4 }]);
  });
});

describe('a file after the edits', () => {
  const text = 'Intro.\n\nThe seam maps for resume.\n\nOutro.';
  const s = text.indexOf('for resume');
  const edit = { start: s, end: s + 10, after: 'for attach', target: AFTER };
  test('text around the edit anchors to the file; the new wording to the edit', () => {
    const { view, spans } = afterEdits('intent/x.md', text, [edit], 'split');
    expect(view.text).toBe('Intro.\n\nThe seam maps for attach.\n\nOutro.');
    expect(spans).toEqual([{ start: s, end: s + 10 }]);
    const o = view.text.indexOf('Outro');
    expect(mapRange(view, o, o + 5)).toMatchObject({
      ok: true,
      target: FILE,
      start: text.indexOf('Outro'),
    });
    expect(mapRange(view, s + 4, s + 10)).toEqual({ ok: true, target: AFTER, start: 4, end: 10 });
  });
  test('a selection across the edit and the file says it cannot be one anchor', () => {
    const { view } = afterEdits('intent/x.md', text, [edit], 'inline');
    const m = mapRange(view, view.text.indexOf('seam'), view.text.indexOf('Outro'));
    expect(m).toMatchObject({ ok: false, why: 'mixed' });
  });
});
