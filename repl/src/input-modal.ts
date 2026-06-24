import { attach } from './glyphs.js';

const READS = /⍞(?!\s*←)|⎕(?![A-Za-z←])/u;

export const needsInput = (program: string): boolean => READS.test(program);

export function askInput(): Promise<string[] | null> {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `
      <div class="modal">
        <div class="modal-title">⎕ / ⍞ — input</div>
        <div class="modal-note">Your program reads input. Enter one response per line here, then run.</div>
        <textarea class="modal-in" rows="4" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
        <div class="modal-row">
          <button class="modal-run">▸ Run &nbsp;(Ctrl·↵)</button>
          <button class="modal-cancel">Cancel</button>
        </div>
      </div>`;
    const ta = ov.querySelector('.modal-in') as HTMLTextAreaElement;
    attach(ta);
    const close = (val: string[] | null, reason: string): void => {
      console.info('[APL playground] input modal closed', { reason });
      document.body.classList.remove('input-open');
      ov.remove();
      document.removeEventListener('keydown', onKey);
      resolve(val);
    };
    const submit = (reason: string): void => close(ta.value.split('\n'), reason);
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); close(null, 'escape'); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit('shortcut'); }
    };
    (ov.querySelector('.modal-run') as HTMLButtonElement).addEventListener('click', () => submit('button'));
    (ov.querySelector('.modal-cancel') as HTMLButtonElement).addEventListener('click', () => close(null, 'cancel'));
    document.body.classList.add('input-open');
    document.body.appendChild(ov);
    requestAnimationFrame(() => {
      document.addEventListener('keydown', onKey);
      ta.focus({ preventScroll: true });
      const rect = ov.getBoundingClientRect();
      console.info('[APL playground] input modal opened', {
        active: document.activeElement === ta,
        zIndex: getComputedStyle(ov).zIndex,
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      });
    });
  });
}
