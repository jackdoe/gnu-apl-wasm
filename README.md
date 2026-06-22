# gnu-apl-wasm

[GNU APL 2.0](https://www.gnu.org/software/apl/) compiled to WebAssembly.
One script downloads the upstream source, applies three small patches, and
produces a ~4 MB `apl.wasm` you can call from Node or the browser.

## Build

Needs [Emscripten](https://emscripten.org) on PATH (`emcc`) and the usual
build tools (`curl`, `tar`, `patch`, `make`).

```sh
source /path/to/emsdk/emsdk_env.sh
./build.sh
```

Output lands in `dist/`:

```
dist/apl.mjs    ES module loader (glue)
dist/apl.wasm   the interpreter
```

## Test

```sh
node test.mjs
```

Runs a conformance check (arithmetic, reshape, reduce, scan, outer product,
indexing, dfns, and error reporting).

## Use

```js
import createModule from './dist/apl.mjs';

const out = [];
const apl = await createModule({ print: s => out.push(s), printErr: s => out.push(s) });

apl.ccall('init_libapl', 'void', ['string', 'number'], ['apl', 0]);   // once

const run = (line) => {
  out.length = 0;
  apl.ccall('apl_exec', 'number', ['string'], [line]);
  return out.join('\n');
};

run('2 3⍴⍳6');   // => "1 2 3\n4 5 6"
run('÷0');       // => "DOMAIN ERROR\n      ÷0\n      ^"
```

APL output (and error text, with caret markers) is written to stdout/stderr,
which Emscripten routes to the `print` / `printErr` callbacks.

In the browser, serve the files over HTTP (ES modules and `.wasm` need real
MIME types — `application/wasm`, `text/javascript`) and `import` the module
the same way.

## How it works

The build targets GNU APL's `libapl` library (clean C API: `init_libapl`,
`apl_exec`, `apl_command`) rather than the interactive `apl` binary, which
sidesteps the terminal, the `fork`-based shared-variable server, and signal
handling. Key choices:

- `CORE_COUNT_WANTED=0` — compiles out the pthread parallel engine
  (single-threaded, so no SharedArrayBuffer / COOP-COEP needed).
- `--without-optional_libs` and friends — no GTK, X, SQL, PCRE, Python.
- **`-fwasm-exceptions`** — *required*. GNU APL signals every APL error
  (`LENGTH ERROR`, `DOMAIN ERROR`, …) by throwing a C++ exception. Without
  exception support the first throw calls `abort()` and kills the module.
  (Native WebAssembly exceptions; needs a recent runtime — Node 17+, current
  browsers.)

Patches (neither changes APL semantics):

- `patches/libapl.cc.patch` — three stale references in upstream `libapl.cc`
  (a wrong include and two renamed types), plus making `apl_exec()`
  exception-safe: it wrapped `process_line()` with no `try/catch`, so an APL
  error thrown from the post-evaluation phase (e.g. a top-level branch `→3`)
  escaped `libapl` as an uncaught C++ exception and crashed the host. It now
  reports the error like the native binary instead of throwing.
- `patches/scalarfunction.cc.patch` — a latent use-after-destruction in the
  scalar-function worklist (`do_scalar_B`/`do_scalar_AB` explicitly destroy a
  persistent worklist member, which the next call then copy-assigns into).
  Harmless on native x86; under WASM's typed indirect calls it corrupted a
  cell vtable and trapped the 3rd consecutive monadic scalar call. Found via a
  differential test against the native binary; the fix took core-language
  fidelity from 96.8% to 99.2% of comparable testcase lines.

## Playground & learning environment (`repl/`)

`repl/` is a self-contained, dependency-free static site built on the compiled
engine. It is written in TypeScript and compiled with `tsc` — no bundler, no
framework. The whole site is assembled into `repl/dist/`, which is what you ship.

### Build

```sh
cd repl
npm install        # dev-only: typescript + @types/node (nothing ships to the browser)
npm run build      # tsc compiles src/ → dist/, then build.mjs copies the static assets in
```

`repl/dist/` is then the complete site: the HTML, CSS, compiled ES modules,
`apl.mjs` / `apl.wasm`, and `content/`. Every reference inside it is relative,
so the directory is portable to any static host.

### Test

```sh
npm test           # build → node --test on the compiled output → content validation
```

`validate.ts` re-derives every exercise's `expected` by running its solution
through the real engine, so the stored answers can never drift.

### Run locally

```sh
node serve.mjs     # serves dist/ at http://localhost:8137 (run a build first)
```

### Ship

Copy `repl/dist/` to any static file host. That is the entire deploy — no build
step on the server, no runtime dependencies, real MIME types only (`.wasm` →
`application/wasm`, `.js` → `text/javascript`).

### What's inside

Source lives in `repl/src/` as focused ES modules:

- `engine.ts` — the only wrapper over the WASM module; `apl_exec`'s return code
  is the authoritative error signal (no output scraping).
- `glyphs.ts` — one `LAYOUT` table drives both the backtick-prefix input map and
  the on-screen QWERTY-shaped keyboard.
- `dom.ts`, `share.ts`, `input-modal.ts`, `content.ts`, `progress.ts` — shared
  helpers (DOM builders, the URL-hash codec, `⎕`/`⍞` detection, the typed
  curriculum loader, progress storage).
- `blocks/` — one renderer per content block type (`prose`, `cell`, `predict`,
  `tryinput`, `hangman`, `exercise`), dispatched by a registry.
- `repl.ts` / `learn.ts` — the two page entry points; `static/repl.html` and
  `static/learn.html` are thin shells that load them.

Two pages:

- **`repl.html`** — a brutalist REPL: a glyph keyboard, backtick-prefix input
  (`` ` `` then a key → the APL glyph), right-to-left evaluation, and a "persist
  session" toggle (off by default, so each run starts fresh). Programs share by
  URL — **Share link** base64url-encodes the editor into the location hash,
  decoded only as text into the `textarea`, so a shared link can never inject
  anything.
- **`learn.html`** — a live notebook: a 19-topic, zero-to-fluent curriculum
  (~80 checked exercises) from arithmetic through sorting and capstone
  one-liners, ending in a playable **hangman** (its board computed by the APL you
  wrote) and tic-tac-toe logic. Topics collapse to a title list and the page
  opens to where you left off; cells auto-run; exercises check in-browser against
  a stored `expected`, showing your output vs. expected on a miss; progress
  persists in `localStorage`.

Content lives in `repl/content/` as one JSON file per topic plus an ordered
`_manifest.json`.

## Layout

```
build.sh                  download → patch → configure → build → link
test.mjs                  conformance test
patches/                  upstream fixes (libapl.cc, ScalarFunction.cc)
build/                    scratch (tarball + extracted source)  [generated]
dist/                     apl.mjs + apl.wasm                     [generated]
repl/                     TypeScript playground + learning site
  src/                    source modules (engine, glyphs, blocks/, repl, learn, …)
  static/                 repl.html, learn.html, style.css
  content/                curriculum JSON (one file per topic + _manifest.json)
  build.mjs               tsc + static-asset copy → dist/
  serve.mjs               local static server for dist/
  dist/                   self-contained deployable site         [generated]
```

## Credits

Everything here — the WebAssembly build, the two upstream `libapl` bug fixes,
the differential testing, and the entire `repl/` playground and learning
curriculum — was built by **Claude Opus 4.8**.

## License

GNU APL is GPLv3. This build tooling is too.
