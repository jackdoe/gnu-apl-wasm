#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VER=2.0
URL="https://mirrors.ibiblio.org/gnu/apl/apl-${VER}.tar.gz"
SHA256="24bbb744fce47e62837234a053bdeecee51b9ea61c82c79f7cc191bc6a54c0a1"

BUILD="$HERE/build"
DIST="$HERE/dist"
SRC="$BUILD/apl-${VER}"
TARBALL="$BUILD/apl-${VER}.tar.gz"

if ! command -v emcc >/dev/null 2>&1; then
  echo "error: emcc not found. Activate Emscripten first:" >&2
  echo "       source /path/to/emsdk/emsdk_env.sh" >&2
  exit 1
fi

mkdir -p "$BUILD" "$DIST"

echo "[1/5] fetch     $URL"
[ -f "$TARBALL" ] || curl -fL --retry 3 "$URL" -o "$TARBALL"
echo "$SHA256  $TARBALL" | sha256sum -c - >/dev/null

echo "[2/5] extract   apl-${VER}"
rm -rf "$SRC"
tar xzf "$TARBALL" -C "$BUILD"

echo "[3/5] patch     libapl.cc + ScalarFunction.cc"
patch -p0 -d "$BUILD" < "$HERE/patches/libapl.cc.patch"
patch -p0 -d "$BUILD" < "$HERE/patches/scalarfunction.cc.patch"

echo "[4/5] build     libapl.a  (minimal core, single-threaded, wasm exceptions — a few minutes)"
cd "$SRC"
CORE_COUNT_WANTED=0 emconfigure ./configure \
  --with-libapl --without-optional_libs --disable-shared \
  --without-sqlite3 --without-postgresql --without-pcre \
  --without-gtk3 --without-x --without-python --without-erlang \
  >/dev/null
emmake make -C src libapl.la CXXFLAGS="-O2 -fwasm-exceptions" >/dev/null

echo "[5/5] link      apl.wasm + apl.mjs"
emcc src/.libs/libapl.a -fwasm-exceptions --no-entry \
  -sEXPORTED_FUNCTIONS=_init_libapl,_apl_exec,_apl_command,_fix_function_NL,_malloc,_free \
  -sEXPORTED_RUNTIME_METHODS=ccall,cwrap,UTF8ToString,stringToUTF8,lengthBytesUTF8 \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=node,web \
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=67108864 -sFORCE_FILESYSTEM=1 \
  -O2 -g0 -o "$DIST/apl.mjs"

echo
echo "ok → $DIST/apl.mjs  ($(du -h "$DIST/apl.wasm" | cut -f1) wasm)"
echo "    test: node \"$HERE/test.mjs\""
