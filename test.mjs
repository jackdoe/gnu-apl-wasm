// Conformance smoke test for the WASM libapl build.
// Usage: node test.mjs        (after ./build.sh has produced dist/apl.mjs)

import createModule from './dist/apl.mjs';

const out = [];
const M = await createModule({ print: s => out.push(s), printErr: s => out.push(s) });
M.ccall('init_libapl', 'void', ['string', 'number'], ['apl', 0]);

const run = (line) => {
  out.length = 0;
  M.ccall('apl_exec', 'number', ['string'], [line]);
  return out.join('\n');
};

// [input, expected-output]   (multi-line output joined with \n)
const cases = [
  ['2 + 2',                 '4'],
  ['÷4',                    '0.25'],
  ['⍳5',                    '1 2 3 4 5'],
  ['+/⍳100',                '5050'],
  ['×/⍳5',                  '120'],
  ['⌈/3 1 4 1 5 9 2 6',     '9'],
  ['2 3⍴⍳6',                '1 2 3\n4 5 6'],
  ['⍴ 2 3⍴⍳6',              '2 3'],
  ['+\\1 2 3 4',            '1 3 6 10'],
  ['⌽1 2 3 4 5',            '5 4 3 2 1'],
  ['(⍳3) ∘.× ⍳3',           '1 2 3\n2 4 6\n3 6 9'],
  ['(1 2 3 4 5)[2 4]',      '2 4'],
  ['+/ (1 3 5 7 9) > 4',    '3'],
  ['{(+/⍵)÷⍴⍵} 2 4 6 8',    '5'],
  ['fac←{×/⍳⍵} ⋄ fac 6',    '720'],
];

const errs = [
  ['1 2 3 + 1 2', 'LENGTH ERROR'],
  ['÷0',          'DOMAIN ERROR'],
  ['nosuchname',  'VALUE ERROR'],
];

let pass = 0, fail = 0;
const check = (input, want, mode) => {
  const got = run(input);
  const ok = mode === 'startsWith' ? got.startsWith(want) : got === want;
  if (ok) { pass++; }
  else { fail++; console.log(`FAIL  ${input}\n  want: ${JSON.stringify(want)}\n  got:  ${JSON.stringify(got)}`); }
};

for (const [i, w] of cases) check(i, w, 'eq');
for (const [i, w] of errs)  check(i, w, 'startsWith');

// regression: a monadic scalar function across separate statements used to
// trap the wasm on the 3rd call (PJob worklist use-after-destruction).
let recipOk = true;
for (let i = 0; i < 6; i++) {
  try { if (run('÷2') !== '0.5') recipOk = false; }
  catch { recipOk = false; }
}
if (recipOk) pass++;
else { fail++; console.log('FAIL  monadic ÷ repeated 6x (worklist-lifecycle regression)'); }

// regression: a top-level branch (→3) used to escape apl_exec as an uncaught
// C++ exception; it must now be reported as an error, not thrown to the host.
let branchOk;
try { branchOk = run('→3').startsWith('SYNTAX ERROR'); }
catch { branchOk = false; }
if (branchOk) pass++;
else { fail++; console.log('FAIL  →3 top-level branch (apl_exec exception-safety regression)'); }

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
