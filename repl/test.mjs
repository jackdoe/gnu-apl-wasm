import { spawnSync } from 'node:child_process';
import { globSync } from 'node:fs';

const root = new URL('.', import.meta.url);
const step = (label, cmd, args) => {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

step('build', 'node', ['build.mjs']);
const tests = globSync('dist/**/*.test.js', { cwd: root });
step('unit tests', 'node', ['--test', ...tests]);
step('content validation', 'node', ['dist/validate.js']);
console.log('\nall green');
