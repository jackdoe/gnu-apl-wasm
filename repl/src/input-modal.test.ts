import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsInput } from './input-modal.js';

test('detects ⎕ used as a read', () => {
  assert.equal(needsInput('2×⎕'), true);
});

test('detects ⍞ used as a read', () => {
  assert.equal(needsInput('⍞'), true);
});

test('detects assignment from ⍞ as a read', () => {
  assert.equal(needsInput('m ← ⍞'), true);
  assert.equal(needsInput('m←⍞'), true);
});

test('does not flag ⎕ assignment (⎕←) as a read', () => {
  assert.equal(needsInput('⎕←42'), false);
});

test('does not flag system names like ⎕IO', () => {
  assert.equal(needsInput('⎕IO←0'), false);
});

test('plain arithmetic needs no input', () => {
  assert.equal(needsInput('+/⍳100'), false);
});
