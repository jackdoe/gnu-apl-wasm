import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map<string, string>();
(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: () => null,
  get length() { return store.size; },
} as Storage;

const { loadPassed, savePassed } = await import('./progress.js');

beforeEach(() => store.clear());

test('passed set round-trips through storage', () => {
  savePassed(new Set(['a', 'b']));
  assert.deepEqual([...loadPassed()].sort(), ['a', 'b']);
});

test('empty storage yields an empty set', () => {
  assert.equal(loadPassed().size, 0);
});
