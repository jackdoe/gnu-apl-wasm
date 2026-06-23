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

export function mountKeyboard(
  host: HTMLElement,
  onInsert: (glyph: string) => void,
): HTMLElement {
  const shiftBtn = el('button', { className: 'hintbtn shiftbtn', textContent: 'shift' });
  const ctl = el('div', { className: 'kbd-ctl' }, [shiftBtn]);
  const kbd = makeKeyboard(onInsert);
  host.append(ctl, kbd);
  shiftBtn.addEventListener('click', () => {
    const on = !kbd.classList.contains('shifted');
    kbd.classList.toggle('shifted', on);
    shiftBtn.classList.toggle('on', on);
  });
  return kbd;
}
