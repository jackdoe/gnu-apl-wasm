import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAP, KEYOF, LAYOUT, insert } from './glyphs.js';

test('MAP derives core glyphs from LAYOUT', () => {
  assert.equal(MAP['i'], '⍳');
  assert.equal(MAP['r'], '⍴');
  assert.equal(MAP['='], '÷');
  assert.equal(MAP['2'], '¯');
});

test('MAP keeps the prefix-only glyphs that the old PALETTE dropped', () => {
  assert.equal(MAP['h'], '∆');
  assert.equal(MAP['k'], "'");
});

test('MAP includes shifted glyphs from LAYOUT', () => {
  assert.equal(MAP['"'], '≢');
  assert.equal(MAP[':'], '≡');
  assert.equal(MAP['{'], '⍞');
  assert.equal(MAP['^'], '⍉');
  assert.equal(MAP['$'], '⍋');
  assert.equal(MAP['#'], '⍒');
  assert.equal(MAP['|'], '⊣');
  assert.equal(MAP['P'], '⍣');
  assert.equal(MAP['L'], '⌷');
});

test('LAYOUT has no duplicate keys', () => {
  const keys = LAYOUT.flat().map(([k]) => k);
  assert.equal(keys.length, new Set(keys).size);
});

test('KEYOF inverts MAP', () => {
  assert.equal(KEYOF['⍳'], 'i');
  assert.equal(KEYOF['÷'], '=');
  assert.equal(KEYOF['⍵'], 'w');
  assert.equal(KEYOF['≢'], "Shift+'");
  assert.equal(KEYOF['⍞'], 'Shift+[');
});

test('insert works with input-like text controls', () => {
  const input = {
    value: '10 + ',
    selectionStart: 5,
    selectionEnd: 5,
    focus() {},
  } as HTMLInputElement;
  insert(input, '⍳');
  assert.equal(input.value, '10 + ⍳');
  assert.equal(input.selectionStart, 6);
  assert.equal(input.selectionEnd, 6);
});
