import createModule from './apl.mjs';
import { evaluatedInput, readsInput, segments, functionName, isCommand, commandName } from './source.js';

const WORKSPACE_ROOT = '/workspaces';
const WRITES_LIBRARY = new Set(['SAVE', 'DUMP', 'DUMPV', 'DUMP-HTML', 'DROP', 'OUT']);
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;
const strip = (s: string): string => s.replace(ANSI, '');

export const normalize = (s: string): string =>
  strip(s).split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');

export type AplError = { code: number };
export type Result = { text: string; error: AplError | null };
export type RunOpts = { setup?: string; code?: string; test?: string; inputs?: string[] };
export type Engine = {
  run(opts: RunOpts): Result;
  line(code: string): Result;
  define(text: string): Result;
  reset(inputs?: string[]): void;
};

export const describeThrown = (err: unknown): string => {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err !== 'object' || err === null) return String(err);
  const v = err as Record<string, unknown>;
  const parts = ['name', 'message', 'status', 'code']
    .filter(k => v[k] !== undefined)
    .map(k => `${k}: ${String(v[k])}`);
  if (parts.length) return parts.join(', ');
  try { return JSON.stringify(err); }
  catch { return String(err); }
};

export async function loadEngine(): Promise<Engine> {
  const out: string[] = [];
  let queue: number[] = [];
  let pending: number[] = [];
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const flush = (): void => {
    if (!pending.length) return;
    out.push(dec.decode(new Uint8Array(pending)));
    pending = [];
  };
  const sink = (byte: number | null): void => {
    if (byte === null) flush();
    else if (byte === 10) { out.push(dec.decode(new Uint8Array(pending))); pending = []; }
    else pending.push(byte);
  };

  const mod = await createModule({
    stdout: sink,
    stderr: sink,
    stdin: () => (queue.length ? queue.shift()! : null),
  });
  const store = mod.FS;
  const persistent = await (async (): Promise<boolean> => {
    if (!store) return false;
    try { store.mkdir(WORKSPACE_ROOT); } catch {}
    const idbfs = store.filesystems?.['IDBFS'];
    if (!idbfs) return false;
    try { store.mount(idbfs, {}, WORKSPACE_ROOT); }
    catch { return false; }
    return new Promise<boolean>(resolve => {
      try { store.syncfs(true, err => resolve(!err)); }
      catch { resolve(false); }
    });
  })();
  const persist = (): void => {
    if (!persistent || !store) return;
    try { store.syncfs(false, () => {}); } catch {}
  };

  mod.ccall('init_libapl', 'void', ['string', 'number'], ['apl', 0]);
  flush();
  out.length = 0;

  const feed = (inputs: string[]): void => {
    queue = Array.from(enc.encode(inputs.length ? inputs.join('\n') + '\n' : ''));
  };
  const runCommand = (c: string): string => {
    queue = [];
    const owned = mod.ccall('apl_command', 'number', ['string'], [c]) as number;
    const text = owned ? mod.UTF8ToString(owned) : '';
    if (owned) mod.ccall('free', 'void', ['number'], [owned]);
    flush();
    return text.replace(/\n+$/, '');
  };
  const command = (c: string): void => { runCommand(c); };

  command(`)LIBS 0 ${WORKSPACE_ROOT}`);
  out.length = 0;

  const fixFunction = (text: string): number => {
    const rc = mod.ccall('fix_function_NL', 'number', ['string'], [text]) as number;
    flush();
    if (rc === 0) {
      const name = functionName(text.split('\n')[0] ?? '');
      if (name) out.push(name);
    }
    return rc;
  };

  const exec = (src: string): Result => {
    out.length = 0;
    let err = 0;
    for (const seg of segments(src)) {
      if (seg.kind === 'define') {
        const rc = fixFunction(seg.text);
        if (rc !== 0) err = rc;
        continue;
      }
      if (isCommand(seg.text)) {
        mod.ccall('apl_exec', 'number', ['string'], [seg.text]);
        flush();
        if (WRITES_LIBRARY.has(commandName(seg.text))) persist();
        continue;
      }
      const c = mod.ccall('apl_exec', 'number', ['string'], [seg.text]) as number;
      if (c !== 0) err = c;
    }
    flush();
    return { text: normalize(out.join('\n')), error: err !== 0 ? { code: err } : null };
  };

  const define = (text: string): Result => {
    out.length = 0;
    const rc = fixFunction(text);
    return { text: normalize(out.join('\n')), error: rc !== 0 ? { code: rc } : null };
  };

  const run = ({ setup = '', code = '', test = '', inputs = [] }: RunOpts): Result => {
    if (evaluatedInput(`${setup}\n${code}\n${test}`) && inputs.some(readsInput)) {
      return {
        text: 'Nested input is not supported here. For ⎕, enter a concrete value like 21 or 3+4.',
        error: { code: -1 },
      };
    }
    command(')CLEAR');
    feed(inputs);
    if (setup) exec(setup);
    let r = exec(code);
    if (test) r = exec(test);
    return r;
  };
  const line = (code: string): Result => exec(code);
  const reset = (inputs: string[] = []): void => { command(')CLEAR'); feed(inputs); out.length = 0; };

  return { run, line, define, reset };
}
