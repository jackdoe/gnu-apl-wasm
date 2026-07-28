import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadEngine } from './engine.js';
import { tokenize, readsInput, definesOrAssigns } from './source.js';
import type { Topic } from './content.js';

const SENTINEL = '867530999';
const DECOY = "⎕ ⍞ ⎕FX x←1 ⋄ '⎕'";
const quote = (s: string): string => `'${s.replaceAll("'", "''")}'`;

const dir = new URL('../content/', import.meta.url);
const manifest: string[] = JSON.parse(await readFile(new URL('_manifest.json', dir), 'utf8'));

const corpus: { id: string; src: string; inputs: string[] }[] = [];
for (const id of manifest) {
  const topic: Topic = JSON.parse(await readFile(new URL(`${id}.json`, dir), 'utf8'));
  for (const b of topic.blocks) {
    if (b.type !== 'exercise') continue;
    if (b.solution.includes('\n') || b.solution.includes('⍝')) continue;
    corpus.push({ id: `${id}/${b.id}`, src: b.solution, inputs: b.inputs ?? [] });
  }
}

test('the generated corpus is large enough to be meaningful', () => {
  assert.ok(corpus.length >= 90, `corpus is only ${corpus.length}`);
});

test('a fully quoted program is never a read nor a definition', () => {
  for (const { id, src } of corpus) {
    const quoted = quote(src);
    assert.equal(readsInput(quoted), false, `${id}: ${quoted}`);
    assert.equal(definesOrAssigns(quoted), false, `${id}: ${quoted}`);
  }
});

test('appending a comment never changes any predicate', () => {
  for (const { id, src } of corpus) {
    const commented = `${src} ⍝ ${DECOY}`;
    assert.equal(readsInput(commented), readsInput(src), `${id}: ${commented}`);
    assert.equal(definesOrAssigns(commented), definesOrAssigns(src), `${id}: ${commented}`);
  }
});

test('a quoted decoy statement never changes the read predicate', () => {
  for (const { id, src } of corpus) {
    const decoyed = `${quote(DECOY)} ⋄ ${src}`;
    assert.equal(readsInput(decoyed), readsInput(src), `${id}: ${decoyed}`);
  }
});

test('a bare glyph outside any literal is always seen', () => {
  for (const { id, src } of corpus) {
    assert.equal(readsInput(`${src} ⋄ ⎕`), true, `${id} lost a bare ⎕`);
    assert.equal(readsInput(`${src} ⋄ ⍞`), true, `${id} lost a bare ⍞`);
    assert.equal(definesOrAssigns(`${src} ⋄ z←1`), true, `${id} lost a bare ←`);
  }
});

test('tokenize is lossless and stable on every shape', () => {
  const shapes = corpus.flatMap(({ src }) => [
    src, quote(src), `${src} ⍝ ${DECOY}`, `${quote(DECOY)} ⋄ ${src}`, `${src} ⍝ '`, `'${src}`, `${src}"`,
  ]);
  for (const s of shapes) {
    const tokens = tokenize(s);
    assert.equal(tokens.map(t => t.text).join(''), s, `lossy for ${JSON.stringify(s)}`);
    assert.equal(tokens.some(t => t.text === ''), false, `empty token for ${JSON.stringify(s)}`);
    for (const t of tokens) {
      if (t.kind === 'quad' || t.kind === 'quote') assert.equal(t.text.length, 1);
      if (t.kind === 'string') assert.ok(/^['"]/u.test(t.text));
      if (t.kind === 'comment') assert.ok(t.text.startsWith('⍝'));
    }
  }
});

test('the predicate agrees with the engine on every corpus program and its quoted form', async () => {
  const engine = await loadEngine();
  const observed = (src: string): boolean | null => {
    try {
      const { text } = engine.run({ code: src, inputs: [SENTINEL] });
      return text.includes(SENTINEL) || text.includes('⎕:');
    } catch { return null; }
  };
  for (const { id, src } of corpus) {
    for (const variant of [src, quote(src), `${src} ⍝ ${DECOY}`]) {
      const seen = observed(variant);
      if (seen === null) continue;
      assert.equal(readsInput(variant), seen, `${id} disagrees with engine: ${variant}`);
    }
  }
});

test('no generated program ever reads without the predicate saying so', async () => {
  const engine = await loadEngine();
  let seed = 20260728;
  const rnd = (): number => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;

  const ATOM = ['1', '⍳3', 'x', '¯1', "'ab'", '⎕IO', '⎕UCS 65'] as const;
  const FN = ['+', '×', '⌽', '⍴', '≢', '+/'] as const;
  const GLYPH = ['⎕', '⍞'] as const;
  const FILLER = ['⎕', '⍞', '←', '⋄', 'a', "'"] as const;
  const noise = (): string => Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => pick(FILLER)).join('');
  const shard = (): string => {
    switch (Math.floor(rnd() * 7)) {
      case 0: return pick(ATOM);
      case 1: return `${pick(FN)}${pick(ATOM)}`;
      case 2: return pick(GLYPH);
      case 3: return `${pick(FN)}${pick(GLYPH)}`;
      case 4: return `'${noise()}'`;
      case 5: return `⍝ ${noise()}`;
      default: return `x←${pick(GLYPH)}`;
    }
  };

  const missed: string[] = [];
  for (let i = 0; i < 400; i++) {
    const src = Array.from({ length: 1 + Math.floor(rnd() * 3) }, shard).join(pick([' ⋄ ', '\n']));
    let text: string;
    try { text = engine.run({ code: src, inputs: [SENTINEL, SENTINEL, SENTINEL] }).text; }
    catch { continue; }
    const didRead = text.includes(SENTINEL) || text.includes('⎕:');
    if (didRead && !readsInput(src)) missed.push(src);
  }
  assert.deepEqual(missed, [], `programs read input with no prompt: ${JSON.stringify(missed.slice(0, 5))}`);
});

test('declared curriculum inputs match the predicate', () => {
  for (const { id, src, inputs } of corpus) {
    assert.equal(readsInput(src), inputs.length > 0, `${id} disagrees with its declared inputs`);
  }
});
