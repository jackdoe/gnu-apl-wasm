import { spawn } from 'node:child_process';
import { cp, rm, mkdir } from 'node:fs/promises';

const root = new URL('./', import.meta.url);
const dist = new URL('dist/', root);
const watch = process.argv.includes('--watch');

const copyAssets = async () => {
  await cp(new URL('static/', root), dist, { recursive: true });
  await cp(new URL('content/', root), new URL('content/', dist), { recursive: true });
  await cp(new URL('src/apl.mjs', root), new URL('apl.mjs', dist));
  await cp(new URL('src/apl.wasm', root), new URL('apl.wasm', dist));
};

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await copyAssets();

const tsc = spawn('npx', ['tsc', ...(watch ? ['--watch', '--preserveWatchOutput'] : [])], {
  stdio: 'inherit',
  cwd: root.pathname,
});
tsc.on('exit', code => process.exit(code ?? 1));
