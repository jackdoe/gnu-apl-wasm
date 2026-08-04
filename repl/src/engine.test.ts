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

test('a ∇ block defines a traditional function that can then be called', () => {
  const r = engine.run({
    code: '∇sum3 a;t\nt←+/a\nt\n∇',
    test: 'sum3 1 2 3 4',
  });
  assert.equal(r.error, null);
  assert.equal(r.text, '10');
});

test('a ∇ block reports the function name like ⎕FX does', () => {
  const r = engine.run({ code: '∇sum3 a;t\nt←+/a\nt\n∇' });
  assert.equal(r.error, null);
  assert.equal(r.text, 'sum3');
});

test('a ∇ block closed on the last body line still defines', () => {
  const r = engine.run({ code: '∇twice n\n2×n ∇', test: 'twice 21' });
  assert.equal(r.error, null);
  assert.equal(r.text, '42');
});

test('line labels pasted from a listing are ignored', () => {
  const r = engine.run({ code: '∇thrice n\n[1] 3×n\n[2] ⍝ done\n∇', test: 'thrice 5' });
  assert.equal(r.error, null);
  assert.equal(r.text, '15');
});

test('statements around a ∇ block still run in order', () => {
  const r = engine.run({ code: "1+1\n∇pick v\nv[2]\n∇\n'after'" });
  assert.equal(r.error, null);
  assert.equal(r.text, '2\npick\nafter');
});

test('Daves barplot defines from plain pasted lines', () => {
  const r = engine.run({
    code: "∇barplot bar;len;rot ⍝⍝ Bar chart of int(s); LePage (1978)\nlen←↑⍴rot←¯1↓,⍉2 len⍴(¯2×len←1+↑⍴,bar)↑-(1+,bar),0\n⊖bar↓[1]rot⊖(bar len⍴'⎕')⍪(len⍴'- ')⍪((¯1+bar←1+⌈/,bar),len)⍴' '\n∇",
    test: 'barplot 2 1 3',
  });
  assert.equal(r.error, null);
  assert.equal(r.text, '     ⎕\n ⎕   ⎕\n ⎕ ⎕ ⎕\n-⎕-⎕-⎕-');
});

test('a λ-header ∇ block reports its error instead of killing the engine', () => {
  const r = engine.define('λ←lamf ⍵\nλ←⍵+1');
  assert.ok(r.error, 'expected the λ-header DEFN error to be reported');
  assert.equal(engine.line('2+2').text, '4', 'engine died after the λ-header definition');
});

test('a lambda mentioning ∇ is run, not treated as a definition', () => {
  const r = engine.run({ code: "'∇ inside a lambda'" });
  assert.equal(r.error, null);
  assert.equal(r.text, '∇ inside a lambda');
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

test('a workspace saves, survives )CLEAR and loads back', () => {
  engine.line('wsv←⍳5');
  engine.line("⎕FX'wsf x' 'x×2'");
  const saved = engine.line(')SAVE wstest');
  assert.equal(saved.error, null);
  assert.doesNotMatch(saved.text, /Unable to/);

  engine.line(')CLEAR');
  assert.ok(engine.line('wsv').error, 'workspace was not cleared');

  const loaded = engine.line(')LOAD wstest');
  assert.equal(loaded.error, null);
  assert.match(loaded.text, /SAVED/);
  assert.equal(engine.line('wsv').text, '1 2 3 4 5');
  assert.equal(engine.line('wsf 21').text, '42');
});

test('a ]usercmd user-defined command runs when invoked', () => {
  const install = engine.line("]usercmd ]tcmd {⍺,'; ',⍵,'; ⍺:',(⍴⍺),(≢⍺),'⍵:',(⍴⍵),≢⍵}");
  assert.match(install.text, /installed/);
  const used = engine.line(']tcmd this is a test');
  assert.notEqual(used.text.trim(), '', ']tcmd produced no output — user commands are being dropped');
  assert.match(used.text, /\]tcmd this is a test/);
  assert.match(engine.line(']USERCMD').text, /\]tcmd/);
});

test('a user-defined command survives beside built-ins', () => {
  engine.line("]usercmd ]twice {2×≢⍵}");
  assert.match(engine.line(']USERCMD').text, /\]twice/);
  assert.notEqual(engine.line(']twice abc').text.trim(), '');
  assert.match(engine.line(')HELP').text, /\)CHECK \[BRIEF\]/);
});

test('a )DUMPV workspace loads back with contents and user commands', () => {
  engine.line(')CLEAR');
  engine.line("]usercmd ]tdump {⍺,'; ',⍵}");
  engine.line('davg←{(+/⍵)÷≢⍵}');
  engine.line('dv←2 2⍴⍳4');
  engine.line(')WSID dumprt');
  assert.match(engine.line(')DUMPV dumprt.apl').text, /DUMPED/);

  engine.line(')CLEAR');
  assert.ok(engine.line('davg 1 2 3').error, 'workspace was not cleared');

  assert.match(engine.line(')LOAD dumprt.apl').text, /DUMPED/);
  assert.equal(engine.line('davg ⍳100').text, '50.5', 'dumped function missing after )LOAD');
  assert.equal(engine.line('dv').text, '1 2\n3 4', 'dumped variable missing after )LOAD');
  assert.match(engine.line(']tdump hi').text, /hi/, 'dumped ]usercmd missing after )LOAD');
});

test(']USERCMD accepts a lambda with an explicit mode, as )DUMP writes it', () => {
  engine.line(']USERCMD REMOVE-ALL');
  const r = engine.line("]USERCMD ]tmode {⍺,'/',⍵} 1");
  assert.match(r.text, /installed/);
  assert.match(engine.line(']tmode x').text, /x/);
});

test(')LOAD reports the date the same way )SAVE does', () => {
  engine.line('dv←1');
  engine.line(')WSID datecheck');
  const saved = engine.line(')SAVE datecheck').text;
  const loaded = engine.line(')LOAD datecheck').text;
  const stamp = /(\d{4})-(\d{2})-(\d{2})/;
  const s = stamp.exec(saved);
  const l = stamp.exec(loaded);
  assert.ok(s, `no date in )SAVE output: ${saved}`);
  assert.ok(l, `no date in )LOAD output: ${loaded}`);
  assert.deepEqual(l.slice(1), s.slice(1), ')LOAD date disagrees with )SAVE');
  assert.ok(Number(l[2]) >= 1 && Number(l[2]) <= 12, `month out of range: ${l[2]}`);
  assert.ok(Number(l[3]) >= 1 && Number(l[3]) <= 31, `day out of range: ${l[3]}`);
});

test(')LIB lists a saved workspace', () => {
  engine.line('wsv←1');
  engine.line(')SAVE wslisted');
  assert.match(engine.line(')LIB').text, /wslisted/);
});

test('a ∇ definition survives a workspace round trip', () => {
  engine.line(')CLEAR');
  engine.define('wsd n\n3×n');
  engine.line(')SAVE wsdel');
  engine.line(')CLEAR');
  engine.line(')LOAD wsdel');
  assert.equal(engine.line('wsd 5').text, '15');
});

test('a command after an error is not reported as failing', () => {
  engine.line('wse←⍳3');
  engine.line(')SAVE wserr');
  engine.line(')CLEAR');
  assert.ok(engine.line('wse').error, 'expected the cleared variable to fail');
  const loaded = engine.line(')LOAD wserr');
  assert.equal(loaded.error, null, 'a successful )LOAD must not inherit the previous error');
  assert.match(loaded.text, /SAVED/);
  assert.equal(engine.line(')VARS').error, null);
});

test('a bad command reports its own text without a thrown error', () => {
  const r = engine.line(')NOSUCHCOMMAND');
  assert.match(r.text, /BAD COMMAND/);
});

test('safe mode still blocks )HOST', () => {
  assert.match(engine.line(')HOST echo hello').text, /safe mode/);
});

test('describeThrown formats wasm exit-like objects', () => {
  assert.equal(describeThrown({ name: 'ExitStatus', message: 'Program terminated with exit(2)', status: 2 }), 'name: ExitStatus, message: Program terminated with exit(2), status: 2');
});
