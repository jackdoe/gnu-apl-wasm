import { describeThrown, loadEngine, type Engine } from './engine.js';
import { attach, insert } from './glyphs.js';
import { esc, trackFocus, mountKeyboard } from './dom.js';
import { needsInput, askInput } from './input-modal.js';
import { encodeProgram, decodeProgram } from './share.js';

const BUILD = 'repl-error-debug-2026-06-25a';
console.info(`[APL playground] ${BUILD}`);
const EVAL_INPUT = /⎕(?![A-Za-z←])/u;
const INPUT_READ = /[⎕⍞]/u;

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const src = $<HTMLTextAreaElement>('src');
const out = $('out');
const dot = $('dot');
const statustxt = $('statustxt');
const prefbox = $('prefbox');
const filepick = $<HTMLSelectElement>('filepick');
const filename = $<HTMLInputElement>('filename');
const newFileBtn = $<HTMLButtonElement>('newfile');
const saveFileBtn = $<HTMLButtonElement>('savefile');
const downloadFileBtn = $<HTMLButtonElement>('downloadfile');
const deleteFileBtn = $<HTMLButtonElement>('deletefile');

const focus = trackFocus();
attach(src, armed => prefbox.classList.toggle('arm', armed));

mountKeyboard($('kbmount'), g => insert(focus.current() ?? src, g));

type ReplFile = { id: string; name: string; code: string };
type ReplFiles = { activeId: string; files: ReplFile[] };

const FILES = 'apl-repl-files-v1';
const DEFAULT_CODE = src.value;
const id = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const cleanName = (name: string): string => name.trim().slice(0, 80) || 'untitled';
const fileOf = (name: string, code: string): ReplFile => ({ id: id(), name: cleanName(name), code });
const validFile = (f: unknown): f is ReplFile => {
  if (typeof f !== 'object' || f === null) return false;
  const v = f as Partial<ReplFile>;
  return typeof v.id === 'string' && typeof v.name === 'string' && typeof v.code === 'string';
};
const freshFiles = (): ReplFiles => {
  const file = fileOf('scratch', DEFAULT_CODE);
  return { activeId: file.id, files: [file] };
};
const loadFiles = (): ReplFiles => {
  try {
    const raw = JSON.parse(localStorage.getItem(FILES) || 'null') as Partial<ReplFiles> | null;
    const files = Array.isArray(raw?.files) ? raw.files.filter(validFile) : [];
    if (files.length) return { activeId: files.some(f => f.id === raw?.activeId) ? raw!.activeId! : files[0]!.id, files };
  } catch {}
  return freshFiles();
};
const saveFiles = (): void => localStorage.setItem(FILES, JSON.stringify(files));
const activeFile = (): ReplFile => files.files.find(f => f.id === files.activeId) ?? files.files[0]!;
const flash = (button: HTMLButtonElement, text: string): void => {
  const old = button.textContent;
  button.textContent = text;
  setTimeout(() => { button.textContent = old; }, 900);
};
const uniqueName = (base: string): string => {
  const names = new Set(files.files.map(f => f.name));
  let name = cleanName(base);
  let n = 2;
  while (names.has(name)) name = `${cleanName(base)} ${n++}`;
  return name;
};
const renderFiles = (): void => {
  const active = activeFile();
  filepick.replaceChildren(...files.files.map(f => {
    const option = document.createElement('option');
    option.value = f.id;
    option.textContent = f.name;
    return option;
  }));
  filepick.value = active.id;
  filename.value = active.name;
  deleteFileBtn.disabled = files.files.length === 1;
};
const openActive = (): void => {
  const active = activeFile();
  src.value = active.code;
  filename.value = active.name;
  filepick.value = active.id;
};
const saveActive = (quiet = false): void => {
  const active = activeFile();
  active.name = cleanName(filename.value);
  active.code = src.value;
  files.activeId = active.id;
  saveFiles();
  renderFiles();
  if (!quiet) flash(saveFileBtn, '✓');
};
const switchFile = (fileId: string): void => {
  if (fileId === files.activeId) return;
  saveActive(true);
  files.activeId = fileId;
  saveFiles();
  renderFiles();
  openActive();
  src.focus();
};
const downloadName = (): string => {
  const safe = cleanName(filename.value).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '_');
  return safe.endsWith('.apl') ? safe : `${safe}.apl`;
};

let files = loadFiles();
if (location.hash.length > 1) {
  try {
    const shared = fileOf(uniqueName('shared'), decodeProgram(location.hash.slice(1)));
    files.files = [shared, ...files.files];
    files.activeId = shared.id;
  } catch {}
}
renderFiles();
openActive();

const persist = $<HTMLInputElement>('persist');
persist.checked = localStorage.getItem('apl-repl-persist') === '1';
persist.addEventListener('change', () => localStorage.setItem('apl-repl-persist', persist.checked ? '1' : '0'));

const append = (html: string): void => { out.insertAdjacentHTML('beforeend', html); out.scrollTop = out.scrollHeight; };

let engine: Engine | null = null;
let running = false;

async function run(): Promise<void> {
  if (!engine || running) return;
  let inputs: string[] = [];
  const inputNeeded = needsInput(src.value);
  console.info('[APL playground] run', { build: BUILD, inputNeeded, chars: src.value.length });
  if (inputNeeded) {
    if (!persist.checked) out.innerHTML = '';
    append('<span class="ghost">Input required. Fill the modal to continue.</span>\n');
    const got = await askInput();
    if (got === null) { append('<span class="ghost">Run cancelled.</span>\n'); return; }
    if (EVAL_INPUT.test(src.value) && got.some(input => INPUT_READ.test(input))) {
      append('<span class="err">Nested input is not supported here. For ⎕, enter a concrete value like 21 or 3+4.</span>\n');
      return;
    }
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
      try {
        const { text, error } = engine.line(line);
        if (text.length) append(`<span class="${error ? 'err' : 'res'}">${esc(text)}</span>\n`);
      } catch (err) {
        append(`<span class="err">${esc(describeThrown(err))}</span>\n`);
        break;
      }
    }
    if (persist.checked) append(`<span class="sep">${'─'.repeat(48)}</span>\n`);
  } finally { running = false; }
}

src.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
});
document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveActive(); }
});
filepick.addEventListener('change', () => switchFile(filepick.value));
filename.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); saveActive(); src.focus(); }
});
newFileBtn.addEventListener('click', () => {
  saveActive(true);
  const file = fileOf(uniqueName('untitled'), '');
  files.files.unshift(file);
  files.activeId = file.id;
  saveFiles();
  renderFiles();
  openActive();
  src.focus();
});
saveFileBtn.addEventListener('click', () => saveActive());
downloadFileBtn.addEventListener('click', () => {
  const blob = new Blob([src.value], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadName();
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
deleteFileBtn.addEventListener('click', () => {
  if (files.files.length <= 1) return;
  const active = activeFile();
  if (!confirm(`Delete ${active.name}?`)) return;
  files.files = files.files.filter(f => f.id !== active.id);
  files.activeId = files.files[0]!.id;
  saveFiles();
  renderFiles();
  openActive();
  src.focus();
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
  out.innerHTML = '<span class="err">' + esc(describeThrown(err)) + '</span>';
});
