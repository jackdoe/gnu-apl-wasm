#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRUNK="$HERE/svn/apl/trunk"
BUILD="$HERE/build"
DIST="$HERE/dist"
SRC="$BUILD/apl-svn"

if ! command -v emcc >/dev/null 2>&1; then
  echo "error: emcc not found. Activate Emscripten first:" >&2
  echo "       source /path/to/emsdk/emsdk_env.sh" >&2
  exit 1
fi

if [ ! -d "$TRUNK" ]; then
  echo "error: $TRUNK not found. Check out GNU APL first:" >&2
  echo "       svn co svn://svn.sv.gnu.org/apl \"$HERE/svn/apl\"" >&2
  exit 1
fi

REV="$(svnversion "$HERE/svn/apl" 2>/dev/null || echo unknown)"
mkdir -p "$BUILD" "$DIST"

echo "[1/4] copy      svn trunk (r$REV)"
rm -rf "$SRC"
rsync -a --exclude='.svn' "$TRUNK/" "$SRC/"
( cd "$SRC" && make distclean >/dev/null 2>&1 || true )

echo "[2/4] patch     svn-trunk-wasm.patch"
patch -p0 -d "$BUILD" < "$HERE/patches/svn-trunk-wasm.patch"

echo "[3/4] build     libapl.a  (minimal core, single-threaded, wasm exceptions — a few minutes)"
cd "$SRC"
CORE_COUNT_WANTED=0 emconfigure ./configure \
  --with-libapl --without-optional_libs --disable-shared \
  --without-sqlite3 --without-postgresql --without-pcre \
  --without-gtk3 --without-x --without-python --without-erlang \
  >/dev/null
emmake make -C src libapl.la CXXFLAGS="-O2 -fwasm-exceptions" >/dev/null

echo "[4/4] link      apl.wasm + apl.mjs"
emcc src/.libs/libapl.a "$HERE/patches/wasm-stubs.c" -fwasm-exceptions --no-entry \
  -sEXPORTED_FUNCTIONS=_init_libapl,_apl_exec,_apl_command,_fix_function_NL,_repl,_malloc,_free \
  -sEXPORTED_RUNTIME_METHODS=ccall,cwrap,UTF8ToString,stringToUTF8,lengthBytesUTF8,FS \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=node,web \
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=67108864 -sFORCE_FILESYSTEM=1 \
  -lidbfs.js -O2 -g0 -o "$DIST/apl.mjs"

echo
echo "ok → $DIST/apl.mjs  ($(du -h "$DIST/apl.wasm" | cut -f1) wasm, GNU APL svn r$REV)"
echo "    test: node \"$HERE/test.mjs\""
