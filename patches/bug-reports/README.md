# GNU APL 2.0 `libapl` bug reports

Two defects in `libapl` (the embedding library), found while compiling GNU APL
2.0 to WebAssembly and confirmed on a normal native Linux build. Both are in
`libapl` only — the standalone `apl` interpreter is **not** affected, because it
runs lines through `Workspace::immediate_execution()` (which has its own
error guard) rather than through the library entry point `apl_exec()`.

Each bug has a fix under `../` (`libapl.cc.patch`, `scalarfunction.cc.patch`).

---

## Bug 1 — `apl_exec()` lets an APL error escape as an uncaught C++ exception

**Severity:** crashes the host process. Affects every `libapl` embedder,
including the Python module (`gnu_apl.exec`).

**Symptom.** Evaluating a line whose error is raised in the post-evaluation
phase — e.g. a branch `→3` at the top level (a normal `SYNTAX ERROR`) — throws
a C++ `Error` that propagates out of `apl_exec()`, across the `extern "C"`
boundary, into the host → `std::terminate()` → `SIGABRT`.

**Root cause.** `libapl.cc:apl_exec()` calls `Command::process_line()` with no
`try/catch`. The standalone binary wraps the same call (`main.cc` /
`Workspace::immediate_execution()`), so it never sees this.

### Reproduce (native, ~3 min)

```sh
tar xzf apl-2.0.tar.gz && cd apl-2.0

# minimal edits so the shipped libapl.cc compiles against the 2.0 headers
# (these are packaging glitches, not part of the bug — see libapl.cc.patch):
sed -i 's#<DiffOut.hh>#<FileBuffers.hh>#'            src/libapl.cc
sed -i 's#extern ErrOut  CERR_filebuf#extern ErrOut_filebuf  CERR_filebuf#' src/libapl.cc
sed -i 's#<< \*f << UNI_LF#<< *f << "\\n"#'          src/libapl.cc

./configure --with-libapl
make -C src libapl.la
python3 ../reproduce_apl_exec_escape.py src/.libs/libapl.so
```

### Observed (unpatched)

```
>>> apl_exec('2+2')
4
>>> apl_exec('→3')  (a branch at the top level)
SYNTAX ERROR+
      →3
      ^
terminate called after throwing an instance of 'Error'
Aborted (core dumped)            # python exit code 134
```

The process never prints `PYTHON SURVIVED →3`.

### Fix (`libapl.cc.patch`)

Wrap `process_line()` in `apl_exec()` with `try/catch`, reporting the error via
`print_em()` like the native interpreter:

```cpp
   try { Command::process_line(line_ucs, 0); }
   catch (Error & err)
      { if (err.get_print_loc() == 0) err.print_em(UERR, LOC);
        return LIBAPL_error(err.get_error_code()); }
   catch (...) { return LAE_UNKNOWN_ERROR; }
```

After the fix the same run prints the `SYNTAX ERROR` and continues:

```
>>> apl_exec('→3')  (a branch at the top level)
SYNTAX ERROR+
      →3
      ^
>>> PYTHON SURVIVED →3            # python exit code 0
```

---

## Bug 2 — use-after-destruction of the scalar-function worklist

**Severity:** undefined behavior. Benign on x86 (reads still-intact memory), but
fatal under stricter memory models — under WebAssembly's type-checked
`call_indirect` it corrupts a `Cell` vtable pointer and traps the **3rd**
consecutive top-level monadic scalar call (`÷2`, `-2`, `⌈x`, `*x`, `!n`, …) with
`null function or function signature mismatch`.

**Root cause.** `ScalarFunction::do_scalar_B()` / `do_scalar_AB()` end each job
with an explicit destructor call on `Thread_context::get_master().joblist_B`'s
**persistent** `current_job` member:

```cpp
job_B->~PJob_scalar_B();   // current_job's lifetime ends here
```

The next call's `Parallel_job_list::next_job()` then does
`current_job = jobs.back();` — copy-assignment **into an object whose lifetime
already ended**.

**Reproduce.** Under a WASM build of `libapl`, call `apl_exec("÷2")` three times
in a row: the 3rd traps. (On native x86 the UB is silent; tools like ASan don't
catch it because GNU APL allocates `Cell`s from its own pool, not `malloc`.)

### Fix (`scalarfunction.cc.patch`)

Release ownership without ending the object's lifetime:

```cpp
*job_B = PJob_scalar_B();   // releases the Value_P members, stays a live object
```

---

*Reported against GNU APL 2.0. Build/measurement context: compiled to
WebAssembly via Emscripten; both fixes verified against the native `apl` binary
(differential testing) — wasm output matches native on 99.2% of the upstream
`.tc` testcase lines, with the residue being C-math-library last-bit
differences, not interpreter errors.*
