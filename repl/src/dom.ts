import { makeKeyboard } from './glyphs.js';

export const esc = (s: string): string =>
  s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

export function trackFocus(): { current(): HTMLTextAreaElement | null } {
  let focused: HTMLTextAreaElement | null = null;
  document.addEventListener('focusin', e => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'TEXTAREA') focused = t as HTMLTextAreaElement;
  });
  return { current: () => focused };
}

type KbMode = 'expanded' | 'collapsed';

export function mountKeyboard(
  host: HTMLElement,
  onInsert: (glyph: string) => void,
  opts: { storageKey: string; defaultMode: KbMode },
): HTMLElement {
  const btn = el('button', { className: 'hintbtn' });
  const ctl = el('div', { className: 'kbd-ctl' }, [btn]);
  const kbd = makeKeyboard(onInsert);
  host.append(ctl, kbd);
  const setMode = (m: KbMode): void => {
    kbd.classList.toggle('expanded', m === 'expanded');
    kbd.classList.toggle('collapsed', m === 'collapsed');
    btn.textContent = m === 'expanded' ? 'collapse' : 'expand';
    localStorage.setItem(opts.storageKey, m);
  };
  btn.addEventListener('click', () => setMode(kbd.classList.contains('expanded') ? 'collapsed' : 'expanded'));
  const stored = localStorage.getItem(opts.storageKey);
  const initial: KbMode = stored === 'expanded' || stored === 'collapsed'
    ? stored
    : matchMedia('(max-width: 820px)').matches ? 'collapsed' : opts.defaultMode;
  setMode(initial);
  return kbd;
}
