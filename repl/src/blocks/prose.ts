import type { Block } from '../content.js';
import { el } from '../dom.js';
import { md } from '../md.js';

export function renderProse(block: Extract<Block, { type: 'prose' }>): { el: HTMLElement } {
  return { el: el('div', { className: 'block prose', innerHTML: md(block.md) }) };
}
