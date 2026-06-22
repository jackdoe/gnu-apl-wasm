import type { Block } from '../content.js';
import type { BlockCtx, Rendered } from './index.js';
import { attach } from '../glyphs.js';
import { esc } from '../dom.js';

export function renderCell(block: Extract<Block, { type: 'cell' }>, ctx: BlockCtx): Rendered {
  const el = document.createElement('div');
  el.className = 'block cell';
  const target = block.expect !== undefined ? `<div class="target">→ ${esc(block.expect)}</div>` : '';
  el.innerHTML = `<textarea spellcheck="false"></textarea>${target}<div class="out ghost">…</div>`;
  const ta = el.querySelector('textarea') as HTMLTextAreaElement;
  const outEl = el.querySelector('.out') as HTMLElement;
  ta.value = block.code;
  ta.rows = block.code.split('\n').length;
  attach(ta);

  const run = (): void => {
    outEl.classList.remove('flash', 'err', 'ghost');
    outEl.textContent = '';
    requestAnimationFrame(() => {
      const { text, error } = ctx.engine.run({ setup: block.setup ?? '', code: ta.value, inputs: block.inputs ?? [] });
      outEl.textContent = text || ' ';
      outEl.classList.toggle('err', error !== null);
      void outEl.offsetWidth;
      outEl.classList.add('flash');
    });
  };

  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<button>▸ run</button>`;
  (row.querySelector('button') as HTMLButtonElement).addEventListener('click', run);
  el.appendChild(row);
  return { el, run };
}
