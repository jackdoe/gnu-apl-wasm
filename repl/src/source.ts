const EVAL_INPUT = /⎕(?![A-Za-z←])/u;
const CHAR_INPUT = /⍞(?!\s*←)/u;

export const stripLiterals = (src: string): string => {
  let bare = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === '⍝') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === "'" || c === '"') {
      i++;
      while (i < src.length && src[i] !== '\n') {
        if (src[i] === c) {
          if (src[i + 1] === c) { i += 2; continue; }
          i++;
          break;
        }
        i++;
      }
      bare += ' ';
      continue;
    }
    bare += c;
    i++;
  }
  return bare;
};

export const evaluatedInput = (src: string): boolean => EVAL_INPUT.test(stripLiterals(src));

export const readsInput = (src: string): boolean => {
  const bare = stripLiterals(src);
  return EVAL_INPUT.test(bare) || CHAR_INPUT.test(bare);
};

export const definesOrAssigns = (src: string): boolean => {
  const bare = stripLiterals(src);
  return /[←⋄\n]/u.test(bare) || /⎕FX/iu.test(bare);
};
