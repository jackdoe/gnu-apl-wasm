import { loadEngine, normalize } from './engine.js';
import { readFile, writeFile } from 'node:fs/promises';
import type { Block, Topic } from './content.js';

const dir = new URL('../content/', import.meta.url);
const manifest: string[] = JSON.parse(await readFile(new URL('_manifest.json', dir), 'utf8'));
const engine = await loadEngine();

let checked = 0, filled = 0, fail = 0;
for (const id of manifest) {
  const path = new URL(`${id}.json`, dir);
  const topic: Topic = JSON.parse(await readFile(path, 'utf8'));
  let changed = false;
  for (const b of topic.blocks) {
    if (b.type !== 'exercise') continue;
    const ex: Extract<Block, { type: 'exercise' }> = b;
    const { text } = engine.run({ setup: '', code: ex.solution, test: ex.test ?? '', inputs: ex.inputs ?? [] });
    const got = normalize(text);
    if (ex.expected === undefined || ex.expected === '') {
      ex.expected = got; changed = true; filled++; continue;
    }
    checked++;
    if (normalize(ex.expected) !== got) {
      fail++;
      console.error(`MISMATCH ${id}/${ex.id}\n  solution: ${ex.solution}\n  expected: ${JSON.stringify(ex.expected)}\n  got:      ${JSON.stringify(got)}`);
    }
  }
  if (changed) await writeFile(path, JSON.stringify(topic, null, 2) + '\n');
}
console.log(`validated ${checked}, filled ${filled}, failed ${fail}`);
process.exit(fail ? 1 : 0);
