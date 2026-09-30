import { assertEquals, assertMatch } from 'jsr:@std/assert@1';

import { MAX_SUGGESTIONS, searchUrl, validate } from './logic.ts';

Deno.test('validate: accepts a well-formed suggestion list', () => {
  const result = validate({
    suggestions: [{ productName: 'White t-shirt', reason: 'You have no plain tops.' }],
  });
  assertEquals(result.ok, true);
});

Deno.test('validate: rejects a missing suggestions field', () => {
  assertEquals(validate({}).ok, false);
  assertEquals(validate(null).ok, false);
});

Deno.test('validate: rejects an empty suggestions array', () => {
  assertEquals(validate({ suggestions: [] }).ok, false);
});

Deno.test('validate: rejects a suggestion missing productName', () => {
  const result = validate({ suggestions: [{ reason: 'x' }] });
  assertEquals(result.ok, false);
});

Deno.test('validate: brand defaults to null when absent, kept when present', () => {
  const result = validate({
    suggestions: [
      { productName: 'Belt', reason: 'x' },
      { productName: 'Sneakers', brand: 'Nike', reason: 'y' },
    ],
  });
  if (!result.ok) throw new Error('expected ok result');
  assertEquals(result.value[0].brand, null);
  assertEquals(result.value[1].brand, 'Nike');
});

Deno.test('validate: truncates to MAX_SUGGESTIONS even if the model returns more', () => {
  const suggestions = Array.from({ length: MAX_SUGGESTIONS + 5 }, (_, i) => ({
    productName: `Item ${i}`,
    reason: 'x',
  }));
  const result = validate({ suggestions });
  if (!result.ok) throw new Error('expected ok result');
  assertEquals(result.value.length, MAX_SUGGESTIONS);
});

Deno.test('searchUrl: uses the suggestion brand when present', () => {
  const url = searchUrl({ productName: 'Sneakers', brand: 'Nike', reason: 'x' }, ['Adidas']);
  assertMatch(url, /^https:\/\/www\.google\.com\/search\?tbm=shop&q=/);
  assertMatch(decodeURIComponent(url), /Nike Sneakers/);
});

Deno.test('searchUrl: falls back to the first preferred brand when the suggestion has none', () => {
  const url = searchUrl({ productName: 'Belt', brand: null, reason: 'x' }, ['Levi\'s', 'Gap']);
  assertMatch(decodeURIComponent(url), /Levi's Belt/);
});

Deno.test('searchUrl: no brand at all when neither the suggestion nor preferences have one', () => {
  const url = searchUrl({ productName: 'Belt', brand: null, reason: 'x' }, []);
  assertMatch(decodeURIComponent(url), /q=Belt$/);
});
