import { loadEngine, type Engine } from './engine.js';
import { attach, insert } from './glyphs.js';
import { esc, trackFocus, mountKeyboard } from './dom.js';
import { needsInput, askInput } from './input-modal.js';
import { encodeProgram, decodeProgram } from './share.js';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const src = $<HTMLTextAreaElement>('src');
const out = $('out');
const dot = $('dot');
const statustxt = $('statustxt');
const prefbox = $('prefbox');

const focus = trackFocus();
attach(src, armed => prefbox.classList.toggle('arm', armed));

mountKeyboard($('kbmount'), g => insert(focus.current() ?? src, g));

const persist = $<HTMLInputElement>('persist');
persist.checked = localStorage.getItem('apl-repl-persist') === '1';
persist.addEventListener('change', () => localStorage.setItem('apl-repl-persist', persist.checked ? '1' : '0'));

if (location.hash.length > 1) {
  try { src.value = decodeProgram(location.hash.slice(1)); } catch { /* leave default */ }
}

const append = (html: string): void => { out.insertAdjacentHTML('beforeend', html); out.scrollTop = out.scrollHeight; };

let engine: Engine | null = null;
let running = false;

async function run(): Promise<void> {
  if (!engine || running) return;
  let inputs: string[] = [];
  if (needsInput(src.value)) {
    const got = await askInput();
    if (got === null) return;
    inputs = got;
  }
  running = true;
  try {
    if (!persist.checked) out.innerHTML = '';
    engine.reset(inputs);
    for (const raw of src.value.split('\n')) {
      const line = raw.replace(/\s+$/, '');
      if (line.trim() === '') continue;
      append(`<span class="in">${esc(line)}</span>\n`);
      const { text, error } = engine.line(line);
      if (text.length) append(`<span class="${error ? 'err' : 'res'}">${esc(text)}</span>\n`);
    }
    if (persist.checked) append(`<span class="sep">${'─'.repeat(48)}</span>\n`);
  } finally { running = false; }
}

src.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
});
$('run').addEventListener('click', run);
$('clear').addEventListener('click', () => { out.innerHTML = ''; });

const shareBtn = $<HTMLButtonElement>('share');
shareBtn.addEventListener('click', async () => {
  const hash = '#' + encodeProgram(src.value);
  history.replaceState(null, '', location.pathname + hash);
  const flash = (msg: string): void => { const o = shareBtn.textContent; shareBtn.textContent = msg; setTimeout(() => { shareBtn.textContent = o; }, 1200); };
  try { await navigator.clipboard.writeText(location.href); flash('Copied ✓'); }
  catch { flash('URL in address bar'); }
});

loadEngine().then(e => {
  engine = e;
  dot.classList.add('on'); statustxt.textContent = 'ENGINE READY';
  out.innerHTML = '<span class="ghost intro">Ready. Press Run, or Ctrl+Enter, to evaluate the buffer.</span>\n';
  src.focus();
}).catch(err => {
  statustxt.textContent = 'ENGINE FAILED';
  out.innerHTML = '<span class="err">' + esc(String(err)) + '</span>';
});
