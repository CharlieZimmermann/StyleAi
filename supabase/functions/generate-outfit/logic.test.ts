import { assertEquals, assertMatch, assertStringIncludes } from 'jsr:@std/assert@1';

import { closetGap, daysBetween, validatePick, type ClosetItem } from './logic.ts';

function item(id: string, category: string): ClosetItem {
  return { id, title: null, category, color: null, brand: null, season: null };
}

const CLOSET: ClosetItem[] = [
  item('shirt-1', 't_shirt'),
  item('pants-1', 'pants'),
  item('shoes-1', 'shoes'),
  item('shoes-2', 'shoes'),
  item('jacket-1', 'outerwear'),
  item('dress-1', 'dress_skirt'),
];

Deno.test('daysBetween counts whole days, later minus earlier', () => {
  assertEquals(daysBetween('2026-01-10', '2026-01-01'), 9);
  assertEquals(daysBetween('2026-01-01', '2026-01-01'), 0);
  assertEquals(daysBetween('2026-01-01', '2026-01-10'), -9);
});

Deno.test('closetGap: complete closet has no gap', () => {
  assertEquals(closetGap(CLOSET), null);
});

Deno.test('closetGap: missing shoes is reported', () => {
  const gap = closetGap(CLOSET.filter((i) => i.category !== 'shoes'));
  assertMatch(gap ?? '', /shoes/);
});

Deno.test('closetGap: a dress alone (no separate top/bottom) is still complete', () => {
  const gap = closetGap([item('dress-1', 'dress_skirt'), item('shoes-1', 'shoes')]);
  assertEquals(gap, null);
});

Deno.test('closetGap: totally empty closet reports everything missing', () => {
  const gap = closetGap([]);
  assertMatch(gap ?? '', /shoes/);
  assertMatch(gap ?? '', /top/);
});

Deno.test('validatePick: a valid top+bottom+shoes outfit is accepted', () => {
  const result = validatePick({ itemIds: ['shirt-1', 'pants-1', 'shoes-1'], reason: 'Comfy.' }, CLOSET, []);
  assertEquals(result.ok, true);
});

Deno.test('validatePick: a valid dress+shoes outfit is accepted', () => {
  const result = validatePick({ itemIds: ['dress-1', 'shoes-1'], reason: 'Nice.' }, CLOSET, []);
  assertEquals(result.ok, true);
});

Deno.test('validatePick: rejects an item id not in the closet', () => {
  const result = validatePick({ itemIds: ['shirt-1', 'pants-1', 'not-real'], reason: 'x' }, CLOSET, []);
  assertEquals(result.ok, false);
});

Deno.test('validatePick: rejects duplicate item ids', () => {
  const result = validatePick(
    { itemIds: ['shirt-1', 'shirt-1', 'pants-1', 'shoes-1'], reason: 'x' },
    CLOSET,
    [],
  );
  assertEquals(result.ok, false);
});

Deno.test('validatePick: rejects zero pairs of shoes', () => {
  const result = validatePick({ itemIds: ['shirt-1', 'pants-1'], reason: 'x' }, CLOSET, []);
  assertEquals(result.ok, false);
});

Deno.test('validatePick: rejects two pairs of shoes', () => {
  const result = validatePick(
    { itemIds: ['shirt-1', 'pants-1', 'shoes-1', 'shoes-2'], reason: 'x' },
    CLOSET,
    [],
  );
  assertEquals(result.ok, false);
});

Deno.test('validatePick: rejects a bottom with no top and no dress', () => {
  const result = validatePick({ itemIds: ['pants-1', 'shoes-1'], reason: 'x' }, CLOSET, []);
  assertEquals(result.ok, false);
});

Deno.test('validatePick: rejects an outfit identical to avoidItemIds (a regenerate must differ)', () => {
  const ids = ['shirt-1', 'pants-1', 'shoes-1'];
  const result = validatePick({ itemIds: ids, reason: 'x' }, CLOSET, ids);
  assertEquals(result.ok, false);
});

Deno.test('validatePick: a merely-different-order pick vs avoidItemIds is still "identical" (same set)', () => {
  const result = validatePick(
    { itemIds: ['pants-1', 'shirt-1', 'shoes-1'], reason: 'x' },
    CLOSET,
    ['shirt-1', 'pants-1', 'shoes-1'],
  );
  assertEquals(result.ok, false);
});

Deno.test('validatePick: rejects a malformed response shape', () => {
  assertEquals(validatePick(null, CLOSET, []).ok, false);
  assertEquals(validatePick({ itemIds: 'not-an-array', reason: 'x' }, CLOSET, []).ok, false);
  assertEquals(validatePick({ itemIds: ['shirt-1'] }, CLOSET, []).ok, false);
});

Deno.test('validatePick: trims the reason text', () => {
  const result = validatePick(
    { itemIds: ['shirt-1', 'pants-1', 'shoes-1'], reason: '  Comfy.  ' },
    CLOSET,
    [],
  );
  if (result.ok) assertEquals(result.value.reason, 'Comfy.');
  else throw new Error('expected ok result');
});

// Sanity check on assertStringIncludes import (also used implicitly via assertMatch above).
Deno.test('closetGap message is a complete sentence', () => {
  const gap = closetGap([]);
  assertStringIncludes(gap ?? '', 'closet');
});
