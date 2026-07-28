import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalize } from './engine.js';
import type { Topic } from './content.js';

const ESC = String.fromCharCode(27);
const trimOnly = (s: string): string =>
  s.split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');

const dir = new URL('../content/', import.meta.url);
const manifest: string[] = JSON.parse(await readFile(new URL('_manifest.json', dir), 'utf8'));
const expected: { id: string; text: string }[] = [];
for (const id of manifest) {
  const topic: Topic = JSON.parse(await readFile(new URL(`${id}.json`, dir), 'utf8'));
  for (const b of topic.blocks) {
    if (b.type === 'exercise' && b.expected) expected.push({ id: `${id}/${b.id}`, text: b.expected });
  }
}

test('the curriculum corpus is non-trivial', () => {
  assert.ok(expected.length >= 99, `only ${expected.length} expected values found`);
});

test('normalize alters nothing in escape-free curriculum output', () => {
  for (const { id, text } of expected) {
    assert.equal(text.includes(ESC), false, `${id} unexpectedly carries an escape byte`);
    assert.equal(normalize(text), trimOnly(text), `${id} was altered by normalize`);
  }
});

test('normalize preserves every bracketed form verbatim', () => {
  const forms = [
    '[BRIEF]', '[[lib] wsname]', '[object...]', '[from-to]', '[AUTO [ON|OFF]]',
    'A[i]', 'A[2]', 'M[1;2]', 'M[i;j]', '+/[1] M', '[a][b]', 'the [end]',
    '⍳[1]', '[⍺]', 'x[⎕IO]', '[[[deep]]]', '[m', '[', '[]',
  ];
  for (const f of forms) assert.equal(normalize(f), f, `altered: ${f}`);
});

test('normalize still strips real ansi sequences', () => {
  assert.equal(normalize(`${ESC}[32mgreen${ESC}[0m`), 'green');
  assert.equal(normalize(`${ESC}[1;31mred${ESC}[m`), 'red');
  assert.equal(normalize(`a${ESC}[Kb`), 'ab');
});

test('normalize is idempotent', () => {
  for (const { text } of expected) assert.equal(normalize(normalize(text)), normalize(text));
});
