import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, readsInput, evaluatedInput, definesOrAssigns, segments, functionName } from './source.js';

const FX_BARPLOT = `⎕cr⎕fx'barplot bar;len;rot ⍝⍝ Bar chart of int(s); LePage (1978)' 'len←↑⍴rot←¯1↓,⍉2 len⍴(¯2×len←1+↑⍴,bar)↑-(1+,bar),0' "⊖bar↓[1]rot⊖(bar len⍴'⎕')⍪(len⍴'- ')⍪((¯1+bar←1+⌈/,bar),len)⍴' '" ⍝ One-line function definition`;
const LAMBDA_BARPLOT = `Barplot←{⊖⍵↓[1]∆⊖(⍵ λ⍴'⎕')⍪(λ⍴'- ')⍪' '⍴⍨(¯1+⍵←1+⌈/,⍵),λ←≢∆←¯1↓,⍉2 λ⍴(¯2×λ←1+≢,⍵)↑-(1+,⍵),0;∆} ⍝ Barplot int(s) Lambda syntax`;
const QROOTS = `QRoots←{¯.5×⍵[3]÷⍨λ+1 ¯1×.5*⍨3↓⎕←'D =',(×⍨λ←2⊃⍵)-×/4,1↓1⌽⍵←3⍴⍵} ⍝ QRoots c b a`;

test('detects a genuine ⎕ read', () => {
  assert.equal(readsInput('2×⎕'), true);
  assert.equal(evaluatedInput('2×⎕'), true);
});

test('detects a genuine ⍞ read', () => {
  assert.equal(readsInput('⍞'), true);
  assert.equal(readsInput('m ← ⍞'), true);
  assert.equal(readsInput('m←⍞'), true);
});

test('⎕← output and ⍞← output are not reads', () => {
  assert.equal(readsInput('⎕←42'), false);
  assert.equal(readsInput("⍞←'hello'"), false);
});

test('system names are not reads', () => {
  assert.equal(readsInput('⎕IO←0'), false);
  assert.equal(readsInput('⎕AV[145]'), false);
  assert.equal(readsInput('⎕UCS 9109'), false);
});

test('plain arithmetic is not a read', () => {
  assert.equal(readsInput('+/⍳100'), false);
});

test('a quad inside a character constant is not a read', () => {
  assert.equal(readsInput("(bar len⍴'⎕')"), false);
  assert.equal(readsInput(`"⍴'⎕'"`), false);
});

test('a quad inside a comment is not a read', () => {
  assert.equal(readsInput('2+2 ⍝ ask with ⎕ later'), false);
  assert.equal(readsInput('2+2 ⍝ and ⍞ too'), false);
});

test('the ⎕FX barplot definition is not a read', () => {
  assert.equal(readsInput(FX_BARPLOT), false);
  assert.equal(evaluatedInput(FX_BARPLOT), false);
});

test('the barplot lambda is not a read', () => {
  assert.equal(readsInput(LAMBDA_BARPLOT), false);
});

test('the QRoots lambda is not a read', () => {
  assert.equal(readsInput(QROOTS), false);
});

test('a real read beside a quoted quad is still found', () => {
  assert.equal(readsInput("x←'⎕' ⋄ y←⎕"), true);
  assert.equal(readsInput("⎕ ⋄ '⎕'"), true);
});

test('tokenize reproduces its input exactly', () => {
  for (const s of [FX_BARPLOT, LAMBDA_BARPLOT, QROOTS, "a←'xy' ⍝ note", "'a''b'", 'x ⍝ c\ny', "'unterminated", '', '⎕', '⍝']) {
    assert.equal(tokenize(s).map(t => t.text).join(''), s, `lost text for ${JSON.stringify(s)}`);
  }
});

test('tokenize classifies constants, comments and quad names', () => {
  assert.deepEqual(tokenize("a←'x' ⍝ n").map(t => t.kind), ['other', 'assign', 'string', 'space', 'comment']);
  assert.deepEqual(tokenize('⎕IO←0').map(t => t.kind), ['system', 'assign', 'other']);
  assert.deepEqual(tokenize('2×⎕').map(t => t.kind), ['other', 'other', 'quad']);
  assert.deepEqual(tokenize("'a''b'").map(t => t.kind), ['string']);
});

test('a quad name is one token regardless of case', () => {
  assert.equal(tokenize('⎕fx').find(t => t.kind === 'system')?.name, 'FX');
  assert.equal(tokenize('⎕FX').find(t => t.kind === 'system')?.name, 'FX');
  assert.equal(tokenize('⎕Cr').find(t => t.kind === 'system')?.name, 'CR');
});

test('a glyph separated from ← by a newline is still a read', () => {
  assert.equal(readsInput('⍞\n←5'), true);
  assert.equal(readsInput('⎕\n←5'), true);
});

test('doubled quotes inside a constant do not end it', () => {
  assert.equal(readsInput("'it''s ⎕ here'"), false);
});

test('a response holding only a quoted glyph is not a nested read', () => {
  assert.equal(readsInput("'⎕'"), false);
  assert.equal(readsInput("'has ⍞ inside'"), false);
  assert.equal(readsInput('42'), false);
});

test('a response that genuinely reads is still caught', () => {
  assert.equal(readsInput('2×⎕'), true);
  assert.equal(readsInput('⍞'), true);
});

test('segments splits a ∇ block from surrounding statements', () => {
  assert.deepEqual(segments("1+1\n∇foo n\nn×2\n∇\n'after'"), [
    { kind: 'statement', text: '1+1' },
    { kind: 'define', text: 'foo n\nn×2', name: 'foo' },
    { kind: 'statement', text: "'after'" },
  ]);
});

test('segments accepts a ∇ closed on the last body line', () => {
  assert.deepEqual(segments('∇foo n\nn×2 ∇'), [
    { kind: 'define', text: 'foo n\nn×2', name: 'foo' },
  ]);
});

test('segments strips line labels pasted from a listing', () => {
  assert.deepEqual(segments('∇foo n\n[1] n×2\n[2.1] n\n∇'), [
    { kind: 'define', text: 'foo n\nn×2\nn', name: 'foo' },
  ]);
});

test('segments leaves a lone ∇ and braced ∇ as statements', () => {
  assert.deepEqual(segments('∇').map(s => s.kind), ['statement']);
  assert.deepEqual(segments('f←{⍵×∇⍵-1}').map(s => s.kind), ['statement']);
  assert.deepEqual(segments("'∇'").map(s => s.kind), ['statement']);
});

test('segments handles an unterminated block and several blocks', () => {
  assert.deepEqual(segments('∇a x\nx\n∇\n∇b y\ny').map(s => (s.kind === 'define' ? s.name : s.kind)), ['a', 'b']);
});

test('functionName reads every header shape', () => {
  assert.equal(functionName('foo'), 'foo');
  assert.equal(functionName('foo x'), 'foo');
  assert.equal(functionName('l foo r'), 'foo');
  assert.equal(functionName('R←foo x'), 'foo');
  assert.equal(functionName('R←l foo r;a;b'), 'foo');
  assert.equal(functionName('barplot bar;len;rot ⍝⍝ Bar chart'), 'barplot');
});

test('definesOrAssigns sees real assignment, definition and separators', () => {
  assert.equal(definesOrAssigns('x←5'), true);
  assert.equal(definesOrAssigns('a←1 ⋄ b←2'), true);
  assert.equal(definesOrAssigns('2+2\n3+3'), true);
  assert.equal(definesOrAssigns("⎕FX'f' 'x←1'"), true);
  assert.equal(definesOrAssigns("⎕fx'f' 'x←1'"), true);
});

test('definesOrAssigns ignores separators hidden in constants and comments', () => {
  assert.equal(definesOrAssigns("'a←b'"), false);
  assert.equal(definesOrAssigns("'a⋄b'"), false);
  assert.equal(definesOrAssigns("'use ⎕FX someday'"), false);
  assert.equal(definesOrAssigns('2+2 ⍝ x←5'), false);
  assert.equal(definesOrAssigns('+/⍳100'), false);
});
