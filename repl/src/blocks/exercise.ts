import type { Block } from '../content.js';
import type { BlockCtx, Rendered } from './index.js';
import { normalize } from '../engine.js';
import { attach } from '../glyphs.js';
import { md } from '../md.js';

export function renderExercise(block: Extract<Block, { type: 'exercise' }>, ctx: BlockCtx): Rendered {
  const el = document.createElement('div');
  el.className = 'block exercise';
  el.innerHTML = `
    <div class="prompt prose">${md(block.prompt)}</div>
    <textarea spellcheck="false" rows="2"></textarea>
    <div class="row">
      <button class="check">check</button>
      <button class="hintbtn">hint</button>
      <button class="revealbtn">reveal answer</button>
    </div>
    <div class="verdict"></div>
    <div class="diff" hidden></div>
    <div class="hint" hidden></div>
    <div class="reveal" hidden></div>`;
  const ta = el.querySelector('textarea') as HTMLTextAreaElement;
  const verdict = el.querySelector('.verdict') as HTMLElement;
  const diff = el.querySelector('.diff') as HTMLElement;
  attach(ta);
  if (ctx.progress.has(block.id)) { verdict.textContent = '✓ done'; verdict.className = 'verdict ok'; }

  const flash = (): void => { void verdict.offsetWidth; verdict.classList.add('flash'); };

  (el.querySelector('.check') as HTMLButtonElement).addEventListener('click', () => {
    diff.hidden = true;
    if (block.requires && !ta.value.includes(block.requires)) {
      verdict.textContent = `✗ use ${block.requires} in your answer`; verdict.className = 'verdict miss';
      flash();
      return;
    }
    const { text, error } = ctx.engine.run({ setup: '', code: ta.value, test: block.test ?? '', inputs: block.inputs ?? [] });
    if (normalize(text) === normalize(block.expected)) {
      verdict.textContent = '✓ correct'; verdict.className = 'verdict ok';
      ctx.progress.pass(block.id);
    } else {
      verdict.textContent = '✗ not yet — check the hint'; verdict.className = 'verdict miss';
      const got = error ? text : (text || '(no output)');
      diff.textContent = `your output:\n${got}\n\nexpected:\n${block.expected}`;
      diff.hidden = false;
    }
    flash();
  });
  (el.querySelector('.hintbtn') as HTMLButtonElement).addEventListener('click', () => {
    const h = el.querySelector('.hint') as HTMLElement; h.hidden = !h.hidden; h.textContent = 'hint: ' + block.hint;
  });
  (el.querySelector('.revealbtn') as HTMLButtonElement).addEventListener('click', () => {
    const r = el.querySelector('.reveal') as HTMLElement; r.hidden = !r.hidden; r.textContent = 'answer: ' + block.solution;
  });
  return { el };
}
