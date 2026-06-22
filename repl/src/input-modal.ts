import { attach } from './glyphs.js';

const READS = /⍞(?!\s*←)|⎕(?![A-Za-z←])/u;

export const needsInput = (program: string): boolean => READS.test(program);

export function askInput(): Promise<string[] | null> {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `
      <div class="modal">
        <div class="modal-title">⎕ / ⍞ — input</div>
        <div class="modal-note">Your program reads input. Enter one value per line, in the order it asks for them.</div>
        <textarea class="modal-in" rows="4" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
        <div class="modal-row">
          <button class="modal-run">▸ Run &nbsp;(Ctrl·↵)</button>
          <button class="modal-cancel">Cancel</button>
        </div>
      </div>`;
    const ta = ov.querySelector('.modal-in') as HTMLTextAreaElement;
    attach(ta);
    const close = (val: string[] | null): void => {
      ov.remove();
      document.removeEventListener('keydown', onKey);
      resolve(val);
    };
    const submit = (): void => close(ta.value === '' ? [] : ta.value.split('\n'));
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); close(null); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
    };
    (ov.querySelector('.modal-run') as HTMLButtonElement).addEventListener('click', submit);
    (ov.querySelector('.modal-cancel') as HTMLButtonElement).addEventListener('click', () => close(null));
    ov.addEventListener('mousedown', e => { if (e.target === ov) close(null); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
    ta.focus();
  });
}
