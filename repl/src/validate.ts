import { loadEngine } from './engine.js';
import { readFile, writeFile } from 'node:fs/promises';
import type { Block, Topic } from './content.js';

const dir = new URL('../content/', import.meta.url);
const manifest: string[] = JSON.parse(await readFile(new URL('_manifest.json', dir), 'utf8'));
const engine = await loadEngine();

let checked = 0, filled = 0, cells = 0, fail = 0;
for (const id of manifest) {
  const path = new URL(`${id}.json`, dir);
  const topic: Topic = JSON.parse(await readFile(path, 'utf8'));
  let changed = false;
  for (const b of topic.blocks) {
    if (b.type === 'cell') {
      cells++;
      const { text, error } = engine.run({ setup: b.setup ?? '', code: b.code, inputs: b.inputs ?? [] });
      if (error) {
        fail++;
        console.error(`CELL FAILED ${id}\n  code: ${b.code}\n  got:  ${JSON.stringify(text)}`);
      } else if (b.expect !== undefined && b.expect !== text) {
        fail++;
        console.error(`CELL EXPECT ${id}\n  code:   ${b.code}\n  expect: ${JSON.stringify(b.expect)}\n  got:    ${JSON.stringify(text)}`);
      }
      continue;
    }
    if (b.type !== 'exercise') continue;
    const ex: Extract<Block, { type: 'exercise' }> = b;
    const { text: got } = engine.run({ setup: '', code: ex.solution, test: ex.test ?? '', inputs: ex.inputs ?? [] });
    if (ex.expected === undefined || ex.expected === '') {
      ex.expected = got; changed = true; filled++; continue;
    }
    checked++;
    if (ex.expected !== got) {
      fail++;
      console.error(`MISMATCH ${id}/${ex.id}\n  solution: ${ex.solution}\n  expected: ${JSON.stringify(ex.expected)}\n  got:      ${JSON.stringify(got)}`);
    }
  }
  if (changed) await writeFile(path, JSON.stringify(topic, null, 2) + '\n');
}
console.log(`validated ${checked} exercises, ${cells} cells, filled ${filled}, failed ${fail}`);
process.exit(fail ? 1 : 0);
