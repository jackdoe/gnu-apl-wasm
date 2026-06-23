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

const { clearDraft, loadDraft, saveDraft } = await import('./drafts.js');

beforeEach(() => store.clear());

test('drafts are stored by exercise id under one key', () => {
  saveDraft('a', '2+2');
  saveDraft('b', '⍳5');
  assert.equal(loadDraft('a'), '2+2');
  assert.equal(loadDraft('b'), '⍳5');
  assert.equal(store.size, 1);
});

test('empty draft deletes the exercise entry', () => {
  saveDraft('a', '2+2');
  clearDraft('a');
  assert.equal(loadDraft('a'), '');
});
