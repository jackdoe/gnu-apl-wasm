import { esc } from './dom.js';
import { KEYOF } from './glyphs.js';

const inline = (s: string): string =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[\[(.+?)\]\]/g, (_m, g: string) => {
      const key = KEYOF[g];
      return key
        ? `<code class="glyph" title="prefix: \`${key}">${g}</code>`
        : `<code class="glyph">${g}</code>`;
    });

export function md(s: string): string {
  const out: string[] = [];
  let list: string[] = [];
  const flush = (): void => {
    if (list.length) { out.push(`<ul>${list.map(li => `<li>${inline(li)}</li>`).join('')}</ul>`); list = []; }
  };
  for (const line of s.split('\n')) {
    const m = /^- (.*)/.exec(line);
    if (m) list.push(m[1]!);
    else { flush(); if (line.trim()) out.push(inline(line)); }
  }
  flush();
  return out.join('');
}
