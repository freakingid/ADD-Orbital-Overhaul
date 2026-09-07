#!/usr/bin/env python3
# scratchpad/gdd-sizes.py — added 2026-09-07 (off-cycle GDD accuracy pass).
# REPORTING ONLY: never edits the GDD, never runs under run-all.js (which globs test-*.js).
# Sibling of gdd-audit.py — that one finds dead identifiers, this one finds drifted SIZES.
#
# Exists to make CLAUDE.md's closing-phase rule cheap to obey:
#   "A closing phase re-measures every row of GDD §0's size column against the just-finished
#    changeset's GDD, before writing STATUS.md's headline number (CS041 P9)."
# Those ~35 numbers are SNAPSHOTS, not live formulas, so any phase that edits GDD content
# invalidates them. Doing that by hand is the reason it gets skipped.
#
# ⛔ A sub-subsection counts SEPARATELY, not inside its parent — that is §0's own stated rule
#    ("a sub-subsection counts separately, not inside its parent"), and getting it wrong makes
#    every parent row look ~2x too big.
#
# Usage:  python3 scratchpad/gdd-sizes.py            measured KB per §2.x/§3.x
#         python3 scratchpad/gdd-sizes.py --check    diff measured against §0's table; exit 1 on drift

import re, sys

GDD = 'ORBITAL-OVERHAUL-GDD.md'


def measure(lines):
    """Bytes per numbered section, each ending where the NEXT numbered heading starts."""
    heads = []
    for i, l in enumerate(lines):
        m = re.match(r'^(#{2,4}) (\d[\d.]*)\.? ', l)
        if m:
            heads.append((i, m.group(2).rstrip('.')))
    heads.append((len(lines), 'EOF'))
    out = {}
    for k in range(len(heads) - 1):
        i, num = heads[k]
        j = heads[k + 1][0]
        out[num] = sum(len(l.encode('utf-8')) + 1 for l in lines[i:j])
    return out


def table_rows(lines):
    """§0's index rows: (line number, section number, stated KB as written)."""
    for i, l in enumerate(lines):
        m = re.match(r'^\| \*\*([\d.]+)\*\*.*? \| ([\d.]+) \|', l)
        if m:
            yield i + 1, m.group(1).rstrip('.'), m.group(2)


def main():
    lines = open(GDD, encoding='utf-8').read().split('\n')
    meas = measure(lines)
    if '--check' not in sys.argv:
        for num, b in meas.items():
            if num[0] in '23':
                print(f"{num}\t{b / 1024:.1f}")
        return 0
    drift = 0
    for ln, num, stated in table_rows(lines):
        got = meas.get(num)
        got = f"{got / 1024:.1f}" if got is not None else "MISSING"
        if got != stated:
            print(f"L{ln}  §{num:<7} table {stated:>6}  measured {got:>6}")
            drift += 1
    print(f"{drift} §0 size row(s) out of sync"
          + ("" if drift else " — table matches the document"))
    return 1 if drift else 0


sys.exit(main())
