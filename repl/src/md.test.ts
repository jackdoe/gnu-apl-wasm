import { test } from 'node:test';
import assert from 'node:assert/strict';
import { md } from './md.js';

test('renders bold and inline code', () => {
  assert.equal(md('a **b** `c`'), 'a <b>b</b> <code>c</code>');
});

test('escapes HTML before formatting', () => {
  assert.equal(md('a < b & c'), 'a &lt; b &amp; c');
});

test('glyph token renders the glyph with its prefix key tooltip', () => {
  const out = md('the iota [[⍳]] glyph');
  assert.match(out, /<code class="glyph" title="prefix: `i">⍳<\/code>/);
});

test('glyph token with no mapped key still renders the glyph', () => {
  const out = md('[[≡]]');
  assert.match(out, /<code class="glyph">≡<\/code>/);
});

test('consecutive dash lines become a single list', () => {
  assert.equal(md('- one\n- two'), '<ul><li>one</li><li>two</li></ul>');
});

test('prose before a list stays outside the list', () => {
  assert.equal(md('Steps:\n- a\n- b'), 'Steps:<ul><li>a</li><li>b</li></ul>');
});

test('inline formatting works inside list items', () => {
  assert.equal(md('- use `+/`'), '<ul><li>use <code>+/</code></li></ul>');
});
