import createModule from './apl.mjs';

const ANSI = /\x1b?\[[0-9;]*[A-Za-z]/g;
const strip = (s: string): string => s.replace(ANSI, '');

export const normalize = (s: string): string =>
  strip(s).split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');

export type AplError = { code: number };
export type Result = { text: string; error: AplError | null };
export type RunOpts = { setup?: string; code?: string; test?: string; inputs?: string[] };
export type Engine = {
  run(opts: RunOpts): Result;
  line(code: string): Result;
  reset(inputs?: string[]): void;
};

export async function loadEngine(): Promise<Engine> {
  const out: string[] = [];
  let queue: number[] = [];
  const enc = new TextEncoder();

  const mod = await createModule({
    print: s => out.push(s),
    printErr: s => out.push(s),
    stdin: () => (queue.length ? queue.shift()! : null),
  });
  mod.ccall('init_libapl', 'void', ['string', 'number'], ['apl', 0]);

  const feed = (inputs: string[]): void => {
    queue = Array.from(enc.encode(inputs.length ? inputs.join('\n') + '\n' : ''));
  };
  const command = (c: string): void => { mod.ccall('apl_command', 'string', ['string'], [c]); };

  const exec = (src: string): Result => {
    out.length = 0;
    let err = 0;
    for (const ln of src.split('\n')) {
      const c = mod.ccall('apl_exec', 'number', ['string'], [ln]) as number;
      if (c !== 0) err = c;
    }
    return { text: normalize(out.join('\n')), error: err !== 0 ? { code: err } : null };
  };

  const run = ({ setup = '', code = '', test = '', inputs = [] }: RunOpts): Result => {
    command(')CLEAR');
    feed(inputs);
    if (setup) exec(setup);
    let r = exec(code);
    if (test) r = exec(test);
    return r;
  };
  const line = (code: string): Result => exec(code);
  const reset = (inputs: string[] = []): void => { command(')CLEAR'); feed(inputs); out.length = 0; };

  return { run, line, reset };
}
