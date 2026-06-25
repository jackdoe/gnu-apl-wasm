import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeThrown, loadEngine, normalize } from './engine.js';

const engine = await loadEngine();

test('evaluates an expression with no error', () => {
  const r = engine.run({ code: '2+2' });
  assert.equal(r.text, '4');
  assert.equal(r.error, null);
});

test('reshape produces a matrix', () => {
  assert.equal(engine.run({ code: '3 3⍴⍳9' }).text, '1 2 3\n4 5 6\n7 8 9');
});

test('definitions do not leak across runs', () => {
  engine.run({ code: 'x←99' });
  assert.notEqual(engine.run({ code: 'x' }).error, null);
});

test('setup runs before code and its output is discarded', () => {
  const r = engine.run({ setup: 'v←⍳5', code: '+/v' });
  assert.equal(r.text, '15');
  assert.equal(r.error, null);
});

test('test field overrides code output', () => {
  const r = engine.run({ code: 'avg←{(+/⍵)÷≢⍵}', test: 'avg 2 4 9' });
  assert.equal(r.text, '5');
});

test('inputs feed ⎕ via stdin', () => {
  assert.equal(engine.run({ code: '2×⎕', inputs: ['21'] }).text.includes('42'), true);
});

test('nested input supplied to ⎕ is rejected without killing the engine', () => {
  const r = engine.run({ code: '2×⎕', inputs: ['2×⎕'] });
  assert.ok(r.error);
  assert.match(r.text, /Nested input/);
  assert.equal(engine.run({ code: '2×⎕', inputs: ['21'] }).text.includes('42'), true);
});

test('traditional function editor is rejected before wasm exit', () => {
  const r = engine.run({ code: '2+2\n∇ move n;c' });
  assert.equal(r.error?.code, -3);
  assert.match(r.text, /^4\n/);
  assert.match(r.text, /∇ function editor/);
  assert.match(r.text, /⎕FX/);
  assert.equal(engine.run({ code: '2+2' }).text, '4');
});

test('⍞ accepts input glyphs as raw text', () => {
  const r = engine.run({ code: '⌽⍞', inputs: ['2×⎕'] });
  assert.equal(r.error, null);
  assert.equal(r.text, '2×⎕\n⎕×2');
});

test('errors carry a nonzero code and the diagnostic appears in text', () => {
  const r = engine.run({ code: '÷0' });
  assert.ok(r.error);
  assert.notEqual(r.error.code, 0);
  assert.match(r.text, /DOMAIN ERROR/);
});

test('a result containing the word ERROR is not a false positive', () => {
  const r = engine.run({ code: "'NO ERROR HERE'" });
  assert.equal(r.error, null);
  assert.equal(r.text, 'NO ERROR HERE');
});

test('normalize strips trailing whitespace and blank lines, keeps leading', () => {
  assert.equal(normalize('  a  \nb\n\n'), '  a\nb');
});

test('describeThrown formats wasm exit-like objects', () => {
  assert.equal(describeThrown({ name: 'ExitStatus', message: 'Program terminated with exit(2)', status: 2 }), 'name: ExitStatus, message: Program terminated with exit(2), status: 2');
});
