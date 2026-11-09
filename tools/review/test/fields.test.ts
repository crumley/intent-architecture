import { expect, test } from 'bun:test';
import { fieldLabel, fieldText, parseField } from '../src/fields.ts';
import type { Item } from '../src/schema.ts';
import { packet } from './fixtures.ts';

const it = packet().items[0] as Item;

test.each([
  ['question', it.question],
  ['what.facts', it.what?.facts],
  ['nowWhat.edits[0].after', 'to attach when live, or resume'],
  ['nowWhat.recommendation.why', 'It holds for any host.'],
  ['what', undefined], // an object, not text
  ['nowWhat.edits[9].after', undefined],
  ['constructor', undefined], // own fields only
  ['.what', undefined],
  ['what..facts', undefined],
])('fieldText(%s)', (path, want) => {
  expect(fieldText(it, path)).toBe(want as string | undefined);
});

test('a path parses into keys and indexes', () => {
  expect(parseField('soWhat.relations[1].note')).toEqual(['soWhat', 'relations', 1, 'note']);
  expect(parseField('a b')).toBeNull();
});

test('labels read 1-based, in the item’s own words', () => {
  expect(fieldLabel('nowWhat.edits[0].after')).toBe('Now what · edit 1, proposed wording');
  expect(fieldLabel('what.facts')).toBe('What · the facts');
  expect(fieldLabel('some.other')).toBe('some.other');
});
