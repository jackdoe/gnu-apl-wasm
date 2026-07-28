export type Token =
  | { kind: 'string'; text: string }
  | { kind: 'comment'; text: string }
  | { kind: 'space'; text: string }
  | { kind: 'newline'; text: string }
  | { kind: 'quad'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'system'; text: string; name: string }
  | { kind: 'assign'; text: string }
  | { kind: 'diamond'; text: string }
  | { kind: 'other'; text: string };

const SYSTEM_NAME = /^[A-Za-z][A-Za-z0-9]*/u;
const BLANK = (c: string): boolean => c === ' ' || c === '\t' || c === '\r';

export const tokenize = (src: string): Token[] => {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === '\n') { tokens.push({ kind: 'newline', text: c }); i++; continue; }
    if (BLANK(c)) {
      let j = i;
      while (j < src.length && BLANK(src[j]!)) j++;
      tokens.push({ kind: 'space', text: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === '⍝') {
      let j = i;
      while (j < src.length && src[j] !== '\n') j++;
      tokens.push({ kind: 'comment', text: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '\n') {
        if (src[j] === c) {
          if (src[j + 1] === c) { j += 2; continue; }
          j++;
          break;
        }
        j++;
      }
      tokens.push({ kind: 'string', text: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === '⎕') {
      const name = SYSTEM_NAME.exec(src.slice(i + 1))?.[0];
      if (name !== undefined) {
        tokens.push({ kind: 'system', text: `⎕${name}`, name: name.toUpperCase() });
        i += 1 + name.length;
        continue;
      }
      tokens.push({ kind: 'quad', text: c });
      i++;
      continue;
    }
    if (c === '⍞') { tokens.push({ kind: 'quote', text: c }); i++; continue; }
    if (c === '←') { tokens.push({ kind: 'assign', text: c }); i++; continue; }
    if (c === '⋄') { tokens.push({ kind: 'diamond', text: c }); i++; continue; }
    tokens.push({ kind: 'other', text: c });
    i++;
  }
  return tokens;
};

const code = (tokens: Token[]): Token[] =>
  tokens.filter(t => t.kind !== 'string' && t.kind !== 'comment' && t.kind !== 'space');

const reads = (tokens: Token[], kind: 'quad' | 'quote'): boolean => {
  const sig = code(tokens);
  return sig.some((t, i) => t.kind === kind && sig[i + 1]?.kind !== 'assign');
};

export const evaluatedInput = (src: string): boolean => reads(tokenize(src), 'quad');

export const readsInput = (src: string): boolean => {
  const tokens = tokenize(src);
  return reads(tokens, 'quad') || reads(tokens, 'quote');
};

export const definesOrAssigns = (src: string): boolean =>
  code(tokenize(src)).some(t =>
    t.kind === 'assign' || t.kind === 'diamond' || t.kind === 'newline' ||
    (t.kind === 'system' && t.name === 'FX'));
