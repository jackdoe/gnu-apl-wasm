import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc } from './dom.js';

test('escapes the three HTML-significant characters', () => {
  assert.equal(esc('a < b & c > d'), 'a &lt; b &amp; c &gt; d');
});

test('leaves APL glyphs untouched', () => {
  assert.equal(esc('⍵∘.×⍳5'), '⍵∘.×⍳5');
});
