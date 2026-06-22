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

`repl/` is a self-contained, static black-and-white site built on the compiled
engine. Serve it (`node repl/serve.mjs`, then open `http://localhost:8137`):

- **`repl.html`** — a brutalist REPL: a glyph keyboard, backtick-prefix input
  (`` ` `` then a key → the APL glyph), and right-to-left evaluation. Programs can
  be shared by URL: **Share link** base64url-encodes the editor into the location
  hash, and opening such a link restores it (decoded only as text into the
  `textarea`, so a shared link can never inject anything).
- **`learn.html`** — a live notebook: an 18-topic, zero-to-fluent curriculum
  (~76 checked exercises) ending in a playable **hangman** (a keydown-driven
  widget whose board is computed by the APL you wrote) and tic-tac-toe logic.
  Cells auto-run; exercises are checked in-browser against a stored `expected`;
  `⎕`/`⍞` input is a live "type it" box; progress and scroll position persist in
  `localStorage`.

Content lives in `repl/content/` as one JSON file per topic plus an ordered
`_manifest.json`. `validate.mjs` re-derives every exercise's `expected` by running
its solution through the real engine, so the stored answers can never drift.

To **deploy**, ship only the runtime files: `apl.wasm`, `apl.mjs`, `engine.mjs`,
`glyphs.mjs`, `style.css`, `repl.html`, `learn.html`, and `content/`. The rest
(`*.test.mjs`, `test.mjs`, `validate.mjs`, `serve.mjs`) is for development.

## Layout

```
build.sh                  download → patch → configure → build → link
test.mjs                  conformance test
patches/                  upstream fixes (libapl.cc, ScalarFunction.cc)
build/                    scratch (tarball + extracted source)  [generated]
dist/                     apl.mjs + apl.wasm                     [generated]
repl/                     static playground + learning site (runtime + dev files)
```

## Credits

Everything here — the WebAssembly build, the two upstream `libapl` bug fixes,
the differential testing, and the entire `repl/` playground and learning
curriculum — was built by **Claude Opus 4.8**.

## License

GNU APL is GPLv3. This build tooling is too.
