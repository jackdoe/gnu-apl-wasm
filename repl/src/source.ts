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

const COMMAND = /^\s*[)\]]\s*([A-Za-z][A-Za-z0-9-]*)?/u;

export const isCommand = (src: string): boolean => COMMAND.test(src);

export const commandName = (src: string): string =>
  (COMMAND.exec(src)?.[1] ?? '').toUpperCase();

export type Segment =
  | { kind: 'define'; text: string; name: string }
  | { kind: 'statement'; text: string };

const OPENER = /^\s*∇(.*)$/u;
const LABEL = /^\s*\[[0-9]+(?:\.[0-9]+)?\]\s?/u;

export const functionName = (header: string): string => {
  const bare = (header.split('⍝')[0] ?? '').split(';')[0] ?? '';
  const rhs = bare.includes('←') ? bare.slice(bare.indexOf('←') + 1) : bare;
  const parts = rhs.trim().split(/\s+/u).filter(Boolean);
  return (parts.length >= 3 ? parts[1] : parts[0]) ?? '';
};

export const segments = (src: string): Segment[] => {
  const lines = src.split('\n');
  const found: Segment[] = [];
  let i = 0;
  while (i < lines.length) {
    const opener = OPENER.exec(lines[i]!);
    const header = (opener?.[1] ?? '').replace(LABEL, '').trim();
    if (!opener || header === '') {
      found.push({ kind: 'statement', text: lines[i]! });
      i++;
      continue;
    }
    i++;
    const body: string[] = [];
    let head = header;
    if (head.endsWith('∇')) {
      head = head.slice(0, -1).trim();
    } else {
      while (i < lines.length) {
        const line = lines[i]!.replace(LABEL, '');
        i++;
        const shut = line.trim();
        if (shut === '∇') break;
        if (shut.endsWith('∇')) { body.push(shut.slice(0, -1).trimEnd()); break; }
        body.push(line);
      }
    }
    found.push({ kind: 'define', text: [head, ...body].join('\n'), name: functionName(head) });
  }
  return found;
};

export const definesOrAssigns = (src: string): boolean =>
  code(tokenize(src)).some(t =>
    t.kind === 'assign' || t.kind === 'diamond' || t.kind === 'newline' ||
    (t.kind === 'system' && t.name === 'FX'));
