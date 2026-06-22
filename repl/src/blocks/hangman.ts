import type { Block } from '../content.js';
import type { BlockCtx, Rendered } from './index.js';
import { md } from '../md.js';

export function renderHangman(block: Extract<Block, { type: 'hangman' }>, ctx: BlockCtx): Rendered {
  const word = (block.word || 'apl').toLowerCase();
  const lives = block.lives || 6;
  const revealDef = "reveal←{b←(≢⍺)⍴'_' ⋄ m←⍺∊⍵ ⋄ b[m/⍳≢⍺]←m/⍺ ⋄ b}";
  let guesses = '';

  const el = document.createElement('div');
  el.className = 'block game';
  el.innerHTML = `
    <div class="prose">🎯 ${md(block.label || 'Hangman — guess the hidden word one letter at a time.')}</div>
    <div class="board"></div>
    <div class="ginfo"></div>
    <div class="row">
      <input class="gin" maxlength="1" autocomplete="off" spellcheck="false">
      <button class="gbtn">guess</button>
      <button class="gnew">new game</button>
    </div>
    <div class="verdict"></div>`;
  const board = el.querySelector('.board') as HTMLElement;
  const info = el.querySelector('.ginfo') as HTMLElement;
  const verdict = el.querySelector('.verdict') as HTMLElement;
  const input = el.querySelector('.gin') as HTMLInputElement;
  const guessBtn = el.querySelector('.gbtn') as HTMLButtonElement;

  const wrongOf = (): string[] => [...guesses].filter(c => !word.includes(c));
  const reveal = (): string => ctx.engine.run({ code: `${revealDef} ⋄ '${word}' reveal '${guesses}'` }).text;

  const render = (): void => {
    const shown = reveal();
    board.textContent = shown.split('').join(' ');
    const wrong = wrongOf();
    info.textContent = `wrong: ${wrong.join(' ') || '—'}    lives: ${lives - wrong.length}`;
    const won = !shown.includes('_');
    const lost = wrong.length >= lives;
    if (won) { verdict.textContent = '✓ solved!'; verdict.className = 'verdict ok'; }
    else if (lost) { verdict.textContent = `✗ out of lives — the word was ${word}`; verdict.className = 'verdict miss'; board.textContent = word.split('').join(' '); }
    else { verdict.textContent = ''; verdict.className = 'verdict'; }
    const over = won || lost;
    input.disabled = over; guessBtn.disabled = over;
    void verdict.offsetWidth; verdict.classList.add('flash');
  };

  const guess = (): void => {
    const c = (input.value || '').toLowerCase();
    input.value = '';
    if (!/[a-z]/.test(c) || guesses.includes(c)) { input.focus(); return; }
    guesses += c;
    render();
    input.focus();
  };

  guessBtn.addEventListener('click', guess);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); guess(); } });
  (el.querySelector('.gnew') as HTMLButtonElement).addEventListener('click', () => {
    guesses = ''; render(); input.disabled = false; guessBtn.disabled = false; input.focus();
  });

  return { el, run: render };
}
