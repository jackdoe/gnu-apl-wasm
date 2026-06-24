import type { Block } from '../content.js';
import type { BlockCtx, Rendered } from './index.js';
import { esc } from '../dom.js';
import { md } from '../md.js';
import { attach } from '../glyphs.js';

export function renderTryInput(block: Extract<Block, { type: 'tryinput' }>, ctx: BlockCtx): Rendered {
  const el = document.createElement('div');
  el.className = 'block cell';
  el.innerHTML = `
    <div class="prose">${md(block.label || 'Try it — your input is fed to ⎕.')}</div>
    <div class="codeline">${esc(block.code)}</div>
    <div class="row">
      <input class="tryin" autocomplete="off" spellcheck="false" placeholder="${esc(block.ask || 'type input, then Enter')}">
      <button class="gbtn">▸ run with my input</button>
    </div>
    <div class="out ghost">type something above and run</div>`;
  const outEl = el.querySelector('.out') as HTMLElement;
  const input = el.querySelector('.tryin') as HTMLInputElement;
  attach(input);
  const go = (): void => {
    outEl.classList.remove('flash', 'err', 'ghost');
    outEl.textContent = '';
    const { text, error } = ctx.engine.run({ code: block.code, inputs: [input.value] });
    outEl.textContent = text || ' ';
    outEl.classList.toggle('err', error !== null);
    void outEl.offsetWidth;
    outEl.classList.add('flash');
  };
  (el.querySelector('.gbtn') as HTMLButtonElement).addEventListener('click', go);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  return { el };
}
