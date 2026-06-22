export const LAYOUT: ReadonlyArray<ReadonlyArray<readonly [string, string]>> = [
  [['1','¨'],['2','¯'],['3','<'],['4','≤'],['5','='],['6','≥'],['7','>'],['8','≠'],['9','∨'],['0','∧'],['-','×'],['=','÷']],
  [['q','?'],['w','⍵'],['e','∊'],['r','⍴'],['t','~'],['y','↑'],['u','↓'],['i','⍳'],['o','○'],['p','*'],['[','←'],[']','→']],
  [['a','⍺'],['s','⌈'],['d','⌊'],['f','_'],['g','∇'],['h','∆'],['j','∘'],['k',"'"],['l','⎕'],[';','⍎'],["'",'⍕']],
  [['z','⊂'],['x','⊃'],['c','∩'],['v','∪'],['b','⊥'],['n','⊤'],['m','|'],[',','⍝'],['.','⍀'],['/','⌿'],['`','⋄']],
];

export const MAP: Record<string, string> = Object.fromEntries(LAYOUT.flat());

export const KEYOF: Record<string, string> = Object.fromEntries(LAYOUT.flat().map(([k, g]) => [g, k]));

export function insert(textarea: HTMLTextAreaElement, text: string): void {
  const s = textarea.selectionStart, e = textarea.selectionEnd;
  textarea.value = textarea.value.slice(0, s) + text + textarea.value.slice(e);
  textarea.selectionStart = textarea.selectionEnd = s + text.length;
  textarea.focus();
}

export function makeKeyboard(onInsert: (glyph: string) => void): HTMLElement {
  const kbd = document.createElement('div');
  kbd.className = 'kbd';
  for (const row of LAYOUT) {
    const r = document.createElement('div');
    r.className = 'krow';
    for (const [k, g] of row) {
      const key = document.createElement('div');
      key.className = 'key';
      const gd = document.createElement('div'); gd.className = 'g'; gd.textContent = g;
      const kd = document.createElement('div'); kd.className = 'k'; kd.textContent = k;
      key.append(gd, kd);
      key.addEventListener('mousedown', e => { e.preventDefault(); onInsert(g); });
      r.appendChild(key);
    }
    kbd.appendChild(r);
  }
  return kbd;
}

export function attach(
  textarea: HTMLTextAreaElement,
  onArmed?: (armed: boolean) => void,
): { insert(text: string): void } {
  const setArmed = (v: boolean) => { armed = v; onArmed?.(v); };
  let armed = false;
  textarea.addEventListener('keydown', e => {
    if (armed) {
      if (e.key === 'Escape') { setArmed(false); e.preventDefault(); return; }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault(); setArmed(false); insert(textarea, MAP[e.key] ?? ('`' + e.key)); return;
      }
      return;
    }
    if (e.key === '`' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); setArmed(true); }
  });
  textarea.addEventListener('blur', () => setArmed(false));
  return { insert: (text: string) => insert(textarea, text) };
}
