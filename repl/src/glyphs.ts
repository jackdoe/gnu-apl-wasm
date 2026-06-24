type KeySpec = readonly [key: string, glyph: string, shiftedGlyph?: string];
export type TextControl = HTMLTextAreaElement | HTMLInputElement;

export const LAYOUT: ReadonlyArray<ReadonlyArray<KeySpec>> = [
  [['`','⋄','⌺'],['1','¨','⌶'],['2','¯','⍫'],['3','<','⍒'],['4','≤','⍋'],['5','=','⌽'],['6','≥','⍉'],['7','>','⊖'],['8','≠','⍟'],['9','∨','⍱'],['0','∧','⍲'],['-','×','!'],['=','÷','⌹']],
  [['q','?'],['w','⍵'],['e','∊','⍷'],['r','⍴'],['t','~','⍨'],['y','↑'],['u','↓'],['i','⍳','⍸'],['o','○','⍥'],['p','*','⍣'],['[','←','⍞'],[']','→','⍬'],['\\','⊢','⊣']],
  [['a','⍺'],['s','⌈'],['d','⌊'],['f','_','⍛'],['g','∇'],['h','∆'],['j','∘','⍤'],['k',"'",'⌸'],['l','⎕','⌷'],[';','⍎','≡'],["'",'⍕','≢']],
  [['z','⊂','⊆'],['x','⊃'],['c','∩'],['v','∪'],['b','⊥'],['n','⊤'],['m','|'],[',','⍝','⍪'],['.','⍀','⍙'],['/','⌿','⍠']],
];

const SHIFTED_KEYS: Record<string, string> = {
  '1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^',
  '7': '&', '8': '*', '9': '(', '0': ')', '-': '_', '=': '+',
  '[': '{', ']': '}', ';': ':', "'": '"', ',': '<', '.': '>',
  '/': '?', '`': '~', '\\': '|',
};

const shiftedKey = (key: string): string =>
  /^[a-z]$/u.test(key) ? key.toUpperCase() : SHIFTED_KEYS[key] ?? key;

const keyEntries = LAYOUT.flatMap(row => row.flatMap(([key, glyph, shiftedGlyph]) =>
  shiftedGlyph ? [[key, glyph], [shiftedKey(key), shiftedGlyph]] : [[key, glyph]],
));

export const MAP: Record<string, string> = Object.fromEntries(keyEntries);

const keyLabels = LAYOUT.flatMap(row => row.flatMap(([key, glyph, shiftedGlyph]) =>
  shiftedGlyph ? [[glyph, key], [shiftedGlyph, `Shift+${key}`]] : [[glyph, key]],
));

export const KEYOF: Record<string, string> = Object.fromEntries(keyLabels);

const SHIFT_EVENT = 'apl-keyboard-shift';

const emitShift = (shifted: boolean): void => {
  document.dispatchEvent(new CustomEvent<boolean>(SHIFT_EVENT, { detail: shifted }));
};

export function insert(target: TextControl, text: string): void {
  const s = target.selectionStart ?? target.value.length;
  const e = target.selectionEnd ?? s;
  target.value = target.value.slice(0, s) + text + target.value.slice(e);
  target.selectionStart = target.selectionEnd = s + text.length;
  target.focus();
}

export function makeKeyboard(onInsert: (glyph: string) => void): HTMLElement {
  const kbd = document.createElement('div');
  kbd.className = 'kbd';
  const shiftKeys: HTMLElement[] = [];
  let stickyShift = false;
  let physicalShift = false;
  const renderShift = (): void => {
    const shifted = stickyShift || physicalShift;
    kbd.classList.toggle('shifted', shifted);
    for (const key of shiftKeys) key.classList.toggle('on', shifted);
  };
  const shiftKey = (): HTMLElement => {
    const key = document.createElement('button');
    key.className = 'shiftkey';
    key.type = 'button';
    key.ariaLabel = 'shift';
    key.textContent = '⇧';
    key.addEventListener('mousedown', e => {
      e.preventDefault();
      stickyShift = !stickyShift;
      renderShift();
    });
    shiftKeys.push(key);
    return key;
  };
  document.addEventListener(SHIFT_EVENT, e => {
    physicalShift = (e as CustomEvent<boolean>).detail;
    renderShift();
  });
  for (const [rowIndex, row] of LAYOUT.entries()) {
    const r = document.createElement('div');
    r.className = 'krow';
    if (rowIndex === LAYOUT.length - 1) r.appendChild(shiftKey());
    for (const [k, g, sg] of row) {
      const key = document.createElement('div');
      key.className = 'key';
      if (sg) key.classList.add('has-shift');
      const gd = document.createElement('div'); gd.className = 'g primary'; gd.textContent = g;
      const sd = document.createElement('div'); sd.className = 'g shifted'; sd.textContent = sg ?? g;
      const kd = document.createElement('div'); kd.className = 'k'; kd.textContent = k;
      key.append(gd, sd, kd);
      key.addEventListener('mousedown', e => {
        e.preventDefault();
        onInsert(kbd.classList.contains('shifted') && sg ? sg : g);
      });
      r.appendChild(key);
    }
    if (rowIndex === LAYOUT.length - 1) r.appendChild(shiftKey());
    kbd.appendChild(r);
  }
  return kbd;
}

export function attach(
  textarea: TextControl,
  onArmed?: (armed: boolean) => void,
): { insert(text: string): void } {
  let armed = false;
  let physicalShift = false;
  const setShift = (v: boolean): void => {
    if (physicalShift === v) return;
    physicalShift = v;
    emitShift(v);
  };
  const setArmed = (v: boolean): void => {
    armed = v;
    if (!v) setShift(false);
    onArmed?.(v);
  };
  textarea.addEventListener('keydown', event => {
    const e = event as KeyboardEvent;
    if (armed) {
      if (e.key === 'Shift') { e.preventDefault(); setShift(true); return; }
      if (e.key === 'Escape') { setArmed(false); e.preventDefault(); return; }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault(); setArmed(false); insert(textarea, MAP[e.key] ?? ('`' + e.key)); return;
      }
      return;
    }
    if (e.key === '`' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setArmed(true); }
  });
  textarea.addEventListener('keyup', event => {
    const e = event as KeyboardEvent;
    if (armed && e.key === 'Shift') setShift(false);
  });
  textarea.addEventListener('blur', () => setArmed(false));
  return { insert: (text: string) => insert(textarea, text) };
}
