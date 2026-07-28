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

export function autoGrow(ta: HTMLTextAreaElement): void {
  const fit = (): void => {
    if (ta.clientHeight === 0) return;
    if (ta.scrollHeight > ta.clientHeight) ta.style.height = `${ta.scrollHeight + 2}px`;
  };
  ta.addEventListener('input', fit);
  new ResizeObserver(fit).observe(ta);
}

export function keyboardToggle(
  bar: HTMLElement,
  button: HTMLElement,
  key: string,
  defaultOn: () => boolean,
): void {
  const measure = (): void => {
    const height = document.body.classList.contains('kb-on')
      ? Math.ceil(bar.getBoundingClientRect().height)
      : 0;
    document.documentElement.style.setProperty('--glyphbar-height', `${height}px`);
  };
  const state = (): boolean => {
    const stored = localStorage.getItem(key);
    return stored === null ? defaultOn() : stored === 'on';
  };
  const apply = (): void => {
    const on = state();
    bar.style.display = on ? '' : 'none';
    document.body.classList.toggle('kb-on', on);
    button.classList.toggle('on', on);
    if (on) requestAnimationFrame(measure);
    else measure();
  };
  new ResizeObserver(measure).observe(bar);
  window.addEventListener('resize', measure);
  button.addEventListener('click', () => {
    localStorage.setItem(key, state() ? 'off' : 'on');
    apply();
  });
  apply();
}
