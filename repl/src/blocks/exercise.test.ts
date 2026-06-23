import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hintLabel, matrixRavelMiss, missMessage } from './exercise.js';
import type { Block } from '../content.js';

const exercise = (b: Partial<Extract<Block, { type: 'exercise' }>>): Extract<Block, { type: 'exercise' }> => ({
  type: 'exercise',
  id: 'x',
  prompt: '',
  solution: '¯5 + 12',
  expected: '7',
  hints: ['make the number negative'],
  explain: 'High minus belongs to the numeric literal.',
  ...b,
});

test('hint labels include revealed depth', () => {
  assert.equal(hintLabel(0, 3), 'hint 0/3');
  assert.equal(hintLabel(2, 3), 'hint 2/3');
});

test('explicit miss rules match submitted answer text', () => {
  const block = exercise({
    solution: '+\\ 1 2 3',
    misses: [{ pattern: '+/', message: 'Use scan, not reduce.' }],
  });
  assert.equal(missMessage(block, '+/ 1 2 3', ''), 'Use scan, not reduce.');
});

test('regex miss rules can target output text', () => {
  const block = exercise({
    misses: [{ pattern: '^2 3 1$', message: 'Those are positions.', regex: true, target: 'output' }],
  });
  assert.equal(missMessage(block, '⍋ 30 10 20', '2 3 1'), 'Those are positions.');
});

test('ordinary minus before a number is recognized when solution uses high minus', () => {
  assert.equal(missMessage(exercise({}), '-5 + 12', ''), 'Use high minus ¯ for negative numbers; ordinary minus is a function.');
});

test('matrix ravel miss detects right values in vector shape', () => {
  assert.equal(matrixRavelMiss('1 2 3 4', '1 2\n3 4'), 'The values match after raveling; keep the matrix shape.');
});
