import { makeKeyboard, type TextControl } from './glyphs.js';

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

export function trackFocus(): { current(): TextControl | null } {
  let focused: TextControl | null = null;
  document.addEventListener('focusin', e => {
    const t = e.target as HTMLElement;
    if (t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && t.classList.contains('tryin'))) focused = t;
  });
  return { current: () => focused };
}

export function mountKeyboard(
  host: HTMLElement,
  onInsert: (glyph: string) => void,
): HTMLElement {
  const kbd = makeKeyboard(onInsert);
  host.append(kbd);
  return kbd;
}
