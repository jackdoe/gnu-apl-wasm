import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (name: string): Promise<string> =>
  readFile(new URL(`./${name}`, import.meta.url), 'utf8');

const definedIds = (html: string): Set<string> =>
  new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]!));

const lookedUpIds = (js: string): string[] =>
  [...new Set([...js.matchAll(/getElementById\(['"]([^'"]+)['"]\)|\$\(['"]([^'"]+)['"]\)/g)]
    .map(m => m[1] ?? m[2]!))];

for (const page of ['repl', 'learn']) {
  test(`${page}.html defines every id ${page}.js looks up`, async () => {
    const have = definedIds(await read(`${page}.html`));
    const want = lookedUpIds(await read(`${page}.js`));
    assert.ok(want.length >= 4, `only ${want.length} id lookups found in ${page}.js`);
    for (const id of want) assert.ok(have.has(id), `${page}.html is missing #${id}`);
  });
}

test('both pages expose the glyph keyboard toggle', async () => {
  for (const page of ['repl', 'learn']) {
    const html = await read(`${page}.html`);
    assert.match(html, /id="kbtoggle"/, `${page}.html has no keyboard toggle`);
  }
});

test('the shipped css carries apl-capable glyph fallbacks', async () => {
  const css = await read('style.css');
  const mono = /--mono:([^;]+);/.exec(css)?.[1] ?? '';
  assert.match(mono, /APL385 Unicode/);
  assert.match(mono, /monospace$/);
});
