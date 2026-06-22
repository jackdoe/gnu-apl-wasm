import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeProgram, decodeProgram } from './share.js';

test('round-trips plain ASCII', () => {
  const s = '2 3⍴⍳6\n+/⍳100';
  assert.equal(decodeProgram(encodeProgram(s)), s);
});

test('round-trips APL glyphs (multibyte UTF-8)', () => {
  const s = 'mean ← {(+/⍵)÷≢⍵} ⋄ mean ⍳100';
  assert.equal(decodeProgram(encodeProgram(s)), s);
});

test('produces url-safe output (no +, /, or = padding)', () => {
  const h = encodeProgram('⍵∘.×⍳5');
  assert.equal(/[+/=]/.test(h), false);
});
