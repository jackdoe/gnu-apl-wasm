import type { Block } from '../content.js';
import type { BlockCtx, Rendered } from './index.js';
import { describeThrown, normalize, type Engine } from '../engine.js';
import { esc } from '../dom.js';
import { attach } from '../glyphs.js';
import { md } from '../md.js';
import { clearDraft, loadDraft, saveDraft } from '../drafts.js';

type Exercise = Extract<Block, { type: 'exercise' }>;

export const hintLabel = (shown: number, total: number): string =>
  total ? `hint ${shown}/${total}` : 'hint';

const matches = (pattern: string, value: string, regex = false): boolean =>
  regex ? new RegExp(pattern, 'u').test(value) : value.includes(pattern);

export function missMessage(block: Exercise, answer: string, output: string): string | null {
  for (const miss of block.misses ?? []) {
    if (matches(miss.pattern, miss.target === 'output' ? output : answer, miss.regex)) return miss.message;
  }
  if (block.solution.includes('¯') && /(^|[^\w¯])- *\d/u.test(answer)) {
    return 'Use high minus ¯ for negative numbers; ordinary minus is a function.';
  }
  return null;
}

export function matrixRavelMiss(got: string, expected: string): string | null {
  const g = normalize(got);
  const e = normalize(expected);
  if (!e.includes('\n') || g.includes('\n')) return null;
  const gt = g.split(/\s+/u).filter(Boolean);
  const et = e.split(/\s+/u).filter(Boolean);
  return gt.length > 0 && gt.length === et.length && gt.every((t, i) => t === et[i])
    ? 'The values match after raveling; keep the matrix shape.'
    : null;
}

const shapeExpr = (block: Exercise, code: string): string | null => {
  if (block.shapeTest) return block.shapeTest;
  if (block.test) return block.test;
  return /[←⋄\n]/u.test(code) || code.includes('⎕FX') ? null : code;
};

const shapeOf = (engine: Engine, block: Exercise, code: string): string | null => {
  const expr = shapeExpr(block, code);
  if (!expr) return null;
  const needsSetup = block.shapeTest !== undefined || block.test !== undefined;
  const { text, error } = needsSetup
    ? engine.run({ code, test: `⍴ ${expr}`, inputs: block.inputs ?? [] })
    : engine.run({ code: `⍴ ${expr}`, inputs: block.inputs ?? [] });
  if (error) return null;
  return text || 'scalar';
};

export function renderExercise(block: Exercise, ctx: BlockCtx): Rendered {
  const el = document.createElement('div');
  el.className = 'block exercise';
  el.dataset.exerciseId = block.id;
  const inputs = block.inputs?.length
    ? `<div class="exercise-input">graded input: <code>${esc(block.inputs.join('\\n'))}</code></div>`
    : '';
  el.innerHTML = `
    <div class="prompt prose">${md(block.prompt)}</div>
    ${inputs}
    <textarea spellcheck="false" rows="2"></textarea>
    <div class="row">
      <button class="check">check</button>
      <button class="hintbtn"></button>
      <button class="revealbtn secondary">reveal answer</button>
      <button class="nextbtn" hidden>next</button>
    </div>
    <div class="verdict"></div>
    <div class="diff" hidden></div>
    <div class="hint" hidden></div>
    <div class="reveal" hidden></div>
    <div class="explain prose" hidden></div>`;
  const ta = el.querySelector('textarea') as HTMLTextAreaElement;
  const verdict = el.querySelector('.verdict') as HTMLElement;
  const diff = el.querySelector('.diff') as HTMLElement;
  const hint = el.querySelector('.hint') as HTMLElement;
  const hintBtn = el.querySelector('.hintbtn') as HTMLButtonElement;
  const explain = el.querySelector('.explain') as HTMLElement;
  const nextBtn = el.querySelector('.nextbtn') as HTMLButtonElement;
  attach(ta);
  ta.value = loadDraft(block.id);
  explain.innerHTML = md(block.explain);
  hintBtn.textContent = hintLabel(0, block.hints.length);
  nextBtn.hidden = !ctx.navigation?.hasNext(block.id);
  if (ctx.progress.has(block.id)) {
    verdict.textContent = '✓ done';
    verdict.className = 'verdict ok';
    explain.hidden = false;
  }

  const flash = (): void => { void verdict.offsetWidth; verdict.classList.add('flash'); };
  const miss = (message: string): void => {
    verdict.textContent = message;
    verdict.className = 'verdict miss';
    flash();
    ta.focus();
  };

  const check = (): void => {
    diff.hidden = true;
    verdict.classList.remove('flash');
    try {
      const sourceMiss = missMessage(block, ta.value, '');
      if (sourceMiss) { miss('✗ ' + sourceMiss); return; }
      if (block.requires && !ta.value.includes(block.requires)) {
        miss(`✗ use ${block.requires} in your answer`);
        return;
      }
      const { text, error } = ctx.engine.run({ setup: '', code: ta.value, test: block.test ?? '', inputs: block.inputs ?? [] });
      if (normalize(text) === normalize(block.expected)) {
        verdict.textContent = '✓ correct'; verdict.className = 'verdict ok';
        clearDraft(block.id);
        ctx.progress.pass(block.id);
        explain.hidden = false;
        nextBtn.hidden = !ctx.navigation?.hasNext(block.id);
      } else {
        const got = error ? text : (text || '(no output)');
        const yourShape = error ? null : shapeOf(ctx.engine, block, ta.value);
        const expectedShape = shapeOf(ctx.engine, block, block.solution);
        const shape = yourShape || expectedShape
          ? `\n\nyour shape:\n${yourShape ?? 'unknown'}\n\nexpected shape:\n${expectedShape ?? 'unknown'}`
          : '';
        verdict.textContent = '✗ ' + (missMessage(block, ta.value, got) ?? matrixRavelMiss(got, block.expected) ?? 'not yet; check the hint');
        verdict.className = 'verdict miss';
        diff.textContent = `your output:\n${got}\n\nexpected:\n${block.expected}${shape}`;
        diff.hidden = false;
        ta.focus();
      }
    } catch (err) {
      verdict.textContent = '✗ runner error';
      verdict.className = 'verdict miss';
      diff.textContent = describeThrown(err);
      diff.hidden = false;
      ta.focus();
    }
    flash();
  };

  ta.addEventListener('input', () => saveDraft(block.id, ta.value));
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); check(); }
  });
  (el.querySelector('.check') as HTMLButtonElement).addEventListener('click', check);
  hintBtn.addEventListener('click', () => {
    const shown = Math.min(block.hints.length, hint.textContent ? hint.textContent.split('\n').length + 1 : 1);
    hint.hidden = false;
    hint.textContent = block.hints.slice(0, shown).map((h, i) => `hint ${i + 1}: ${h}`).join('\n');
    hintBtn.textContent = hintLabel(shown, block.hints.length);
  });
  (el.querySelector('.revealbtn') as HTMLButtonElement).addEventListener('click', () => {
    const r = el.querySelector('.reveal') as HTMLElement; r.hidden = !r.hidden; r.textContent = 'answer: ' + block.solution;
  });
  nextBtn.addEventListener('click', () => ctx.navigation?.next(block.id));
  return { el };
}
