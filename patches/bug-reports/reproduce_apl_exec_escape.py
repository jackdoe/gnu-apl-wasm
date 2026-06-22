#!/usr/bin/env python3
#
# Reproduce: apl_exec() lets an APL error escape as an uncaught C++ exception,
# crashing the host process (here, Python — same C API the gnu_apl module uses).
#
# Usage:
#   python3 reproduce_apl_exec_escape.py /path/to/libapl.so
#
# Expected with an UNPATCHED libapl:
#   2+2 prints 4, then "→3" prints SYNTAX ERROR ... and the process aborts:
#       terminate called after throwing an instance of 'Error'
#       Aborted (core dumped)            # exit code 134 (SIGABRT)
#
# Expected with the patched libapl (apl_exec wrapped in try/catch):
#   "→3" prints SYNTAX ERROR and the process continues normally ("SURVIVED").

import ctypes, sys

lib = ctypes.CDLL(sys.argv[1])
lib.init_libapl.argtypes = [ctypes.c_char_p, ctypes.c_int]
lib.apl_exec.argtypes    = [ctypes.c_char_p]

lib.init_libapl(b"apl", 0)

print(">>> apl_exec('2+2')"); sys.stdout.flush()
lib.apl_exec("2+2".encode("utf-8")); sys.stdout.flush()

print(">>> apl_exec('→3')  (a branch at the top level)"); sys.stdout.flush()
lib.apl_exec("→3".encode("utf-8")); sys.stdout.flush()   # →3

print(">>> PYTHON SURVIVED →3")   # only reached if apl_exec is exception-safe
