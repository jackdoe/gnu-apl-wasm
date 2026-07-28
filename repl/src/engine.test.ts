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

test('normalize keeps bracketed text that is not an escape sequence', () => {
  assert.equal(normalize(')CHECK [BRIEF]'), ')CHECK [BRIEF]');
  assert.equal(normalize(')COPY [lib] wsname [object...]'), ')COPY [lib] wsname [object...]');
  assert.equal(normalize(')MORE [AUTO [ON|OFF]]'), ')MORE [AUTO [ON|OFF]]');
  assert.equal(normalize('A[i] selects'), 'A[i] selects');
  assert.equal(normalize('the [end]'), 'the [end]');
});

test('normalize strips real ansi colour sequences', () => {
  assert.equal(normalize('\x1b[32mgreen\x1b[0m'), 'green');
  assert.equal(normalize('\x1b[1;31mred\x1b[m'), 'red');
});

test('character output keeps its brackets end to end', () => {
  assert.equal(engine.run({ code: "'A[i] selects'" }).text, 'A[i] selects');
  assert.equal(engine.run({ code: "'[abc]'" }).text, '[abc]');
});

test(')HELP renders its bracketed argument syntax intact', () => {
  const r = engine.line(')HELP');
  assert.match(r.text, /\)CHECK \[BRIEF\]/);
  assert.match(r.text, /\)HELP \[primitive\]/);
  assert.match(r.text, /\)MORE \[AUTO \[ON\|OFF\]\]/);
});

test(')HELP renders both command families verbatim', () => {
  const text = engine.line(')HELP').text;
  const forms = [
    ')CHECK [BRIEF]',
    ')COPY_ONCE [[lib] wsname]',
    ')COPY [lib] wsname [object...]',
    ')IN filename [object...]',
    ')LIB [lib|path] [from-to]',
    ')MORE [AUTO [ON|OFF]]',
    ')OFF [exit_code]',
    ')WSID [[lib] wsname]',
    ']BOXING [OFF|2-4|7-9|i20-25|29]',
    ']COLOR [ON|OFF]',
    ']KEYB [XMOD|XKBD|GUESS] [KEYS] [CURS] [KPAD] [FUNK]',
    ']LOG [facility|ON|OFF]',
    ']PSTAT [CLEAR|SAVE]',
    ']USERCMD [ ]ucmd APL_fun [mode]',
    ']XTERM [ON|OFF]',
  ];
  for (const f of forms) assert.ok(text.includes(f), `missing from )HELP: ${f}`);
});

test('unterminated output does not leak into the next statement', () => {
  const help = engine.line(')HELP').text;
  assert.match(help, /⎕UCS/);
  assert.equal(engine.line('2+2').text, '4');
  assert.equal(engine.line('⍳3').text, '1 2 3');
  engine.line(')HELP');
  assert.match(engine.line('÷0').text, /^DOMAIN ERROR/);
});

test(')HELP keeps its final line', () => {
  const lines = engine.line(')HELP').text.split('\n');
  assert.ok(lines.length >= 72, `only ${lines.length} lines`);
  assert.match(lines[lines.length - 1] ?? '', /⎕/);
});

test(']COLOR ON escapes are stripped from real engine output', () => {
  engine.line(']COLOR ON');
  const err = engine.line('÷0');
  assert.equal(err.text.includes('\x1b'), false);
  assert.match(err.text, /^DOMAIN ERROR/);
  assert.equal(engine.line('2+2').text, '4');
  assert.equal(engine.line(')HELP').text.includes(')CHECK [BRIEF]'), true);
  engine.line(']COLOR OFF');
  assert.equal(engine.line('2+2').text, '4');
});

test('describeThrown formats wasm exit-like objects', () => {
  assert.equal(describeThrown({ name: 'ExitStatus', message: 'Program terminated with exit(2)', status: 2 }), 'name: ExitStatus, message: Program terminated with exit(2), status: 2');
});
