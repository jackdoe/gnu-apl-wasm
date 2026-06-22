import { loadEngine } from './engine.js';
import { loadCurriculum, type Topic } from './content.js';
import { renderBlock, type BlockCtx } from './blocks/index.js';
import { trackFocus, mountKeyboard, el, esc } from './dom.js';
import { insert } from './glyphs.js';
import { loadPassed, savePassed } from './progress.js';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const wrap = $('wrap');
const progressEl = $('progress');
const glyphbar = $('glyphbar');

const focus = trackFocus();
mountKeyboard(glyphbar, g => { const t = focus.current(); if (t) insert(t, g); }, { storageKey: 'apl-learn-kbmode', defaultMode: 'collapsed' });

const KB = 'apl-learn-kb';
const kbtoggle = $('kbtoggle');
const applyKb = (): void => {
  const on = localStorage.getItem(KB) === 'on';
  glyphbar.style.display = on ? '' : 'none';
  document.body.classList.toggle('kb-on', on);
  kbtoggle.classList.toggle('on', on);
};
kbtoggle.addEventListener('click', () => {
  localStorage.setItem(KB, localStorage.getItem(KB) === 'on' ? 'off' : 'on');
  applyKb();
});
applyKb();

const passed = loadPassed();
const exerciseIds = (t: Topic): string[] =>
  t.blocks.flatMap(b => (b.type === 'exercise' ? [b.id] : []));

type TopicView = { section: HTMLElement; twisty: HTMLElement; badge: HTMLElement; ids: string[] };
const setOpen = (v: TopicView, open: boolean): void => {
  v.section.classList.toggle('collapsed', !open);
  v.twisty.textContent = open ? '▾' : '▸';
};

(async () => {
  const engine = await loadEngine();
  const topics = await loadCurriculum();
  const totalEx = topics.reduce((n, t) => n + exerciseIds(t).length, 0);

  const views: TopicView[] = [];
  const badgeText = (ids: string[]): string => {
    if (!ids.length) return '';
    const done = ids.filter(id => passed.has(id)).length;
    return done === ids.length ? '✓' : `${done}/${ids.length}`;
  };
  const refresh = (): void => {
    progressEl.innerHTML = `<b>${passed.size}</b> / ${totalEx}`;
    for (const v of views) {
      v.badge.textContent = badgeText(v.ids);
      v.badge.classList.toggle('done', v.ids.length > 0 && v.ids.every(id => passed.has(id)));
    }
  };

  const ctx: BlockCtx = {
    engine,
    focus,
    progress: {
      has: id => passed.has(id),
      pass: id => { passed.add(id); savePassed(passed); refresh(); },
    },
  };

  wrap.innerHTML = '';
  const runnable: Array<() => void> = [];
  for (const topic of topics) {
    const ids = exerciseIds(topic);
    const twisty = el('span', { className: 'twisty', textContent: '▸' });
    const badge = el('span', { className: 'lesson-badge' });
    const head = el('h2', { className: 'lesson-head' }, [
      twisty,
      el('span', { className: 'lesson-title', textContent: topic.title }),
      badge,
    ]);
    const body = el('div', { className: 'lesson-body' });
    for (const block of topic.blocks) {
      const { el: bel, run } = renderBlock(block, ctx);
      body.appendChild(bel);
      if (run) runnable.push(run);
    }
    const section = el('section', { className: 'lesson collapsed' }, [head, body]);
    const view: TopicView = { section, twisty, badge, ids };
    head.addEventListener('click', () => setOpen(view, section.classList.contains('collapsed')));
    wrap.appendChild(section);
    views.push(view);
  }
  refresh();
  for (const run of runnable) run();

  let current = views.findIndex(v => v.ids.some(id => !passed.has(id)));
  if (current < 0) current = 0;
  views.forEach((v, i) => setOpen(v, i === current));

  const cur = views[current];
  if (cur) {
    await document.fonts.ready;
    requestAnimationFrame(() => cur.section.scrollIntoView({ block: 'start' }));
  }
})().catch(err => { wrap.innerHTML = `<p class="prose err">${esc(String(err))}</p>`; });
