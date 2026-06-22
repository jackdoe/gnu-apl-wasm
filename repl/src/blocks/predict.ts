import type { Block } from '../content.js';
import type { BlockCtx, Rendered } from './index.js';
import { normalize } from '../engine.js';
import { esc } from '../dom.js';
import { md } from '../md.js';

export function renderPredict(block: Extract<Block, { type: 'predict' }>, ctx: BlockCtx): Rendered {
  const el = document.createElement('div');
  el.className = 'block predict';
  el.innerHTML = `
    <div class="prose">🔮 ${md(block.prompt || 'Predict the result, then reveal.')}</div>
    <div class="codeline">${esc(block.code)}</div>
    <div class="row">
      <input class="tryin" autocomplete="off" spellcheck="false" placeholder="what will it print?">
      <button class="gbtn">reveal</button>
    </div>
    <div class="out ghost">your guess is checked against the real result</div>`;
  const outEl = el.querySelector('.out') as HTMLElement;
  const input = el.querySelector('.tryin') as HTMLInputElement;

  const reveal = (): void => {
    const { text } = ctx.engine.run({ setup: block.setup ?? '', code: block.code, inputs: block.inputs ?? [] });
    const match = normalize(input.value) === normalize(text);
    outEl.classList.remove('flash', 'err', 'ghost');
    outEl.textContent = (input.value.trim() ? (match ? '✓ you nailed it — ' : '✗ not quite — ') : '') + (text || ' ');
    outEl.classList.toggle('err', input.value.trim() !== '' && !match);
    void outEl.offsetWidth;
    outEl.classList.add('flash');
  };

  (el.querySelector('.gbtn') as HTMLButtonElement).addEventListener('click', reveal);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); reveal(); } });
  return { el };
}
