#!/usr/bin/env python3
# scratchpad/gdd-audit.py — CS041 P3. REPORTING ONLY: never edits the GDD, never runs under
# run-all.js (which globs test-*.js).
#
# Answers one question: which identifiers does ORBITAL-OVERHAUL-GDD.md §2/§3 name in backticks
# that no longer exist in the build? Those are staleness CANDIDATES.
#
# ⛔ A CANDIDATE IS NOT A VERDICT. "GARBAGE_DECAY was removed in CS024 P3" is TRUE and PROTECTIVE,
#    and this tool flags it for exactly the reason the sentence exists. Every hit needs a context
#    read before anything happens to it. --detail exists to make that read cheap.
# ⛔ The comment/string strip is a CHARACTER SCANNER, never a regex. CLAUDE.md's Test rules say
#    why: a line comment in this build contains /*, so a block-comment regex run first eats live
#    code. 67% of the script block is comment or string, so getting this wrong is not subtle.
#    Template literals keep their ${...} expressions — identifiers used only there are still live.
#
# Usage:  python3 scratchpad/gdd-audit.py                 per-section candidate counts
#         python3 scratchpad/gdd-audit.py --detail 3      one line per hit, with context
#         python3 scratchpad/gdd-audit.py --detail 2.19 --all   include implausible names too

import re, sys, collections

GDD, BUILD = 'ORBITAL-OVERHAUL-GDD.md', 'orbital-overhaul.html'


def classic_script(html):
    """The one classic <script> block. The CS033 module bridge tag and any src= tag are skipped."""
    best = ''
    for m in re.finditer(r'<script(?P<attr>[^>]*)>', html):
        if 'type="module"' in m.group('attr') or 'src=' in m.group('attr'):
            continue
        body = html[m.end():html.index('</script>', m.end())]
        if len(body) > len(best):
            best = body
    return best


def strip(s):
    """Drop // and /* */ comments and string CONTENTS; keep ${...} inside template literals."""
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c == '/' and i + 1 < n and s[i + 1] == '/':
            while i < n and s[i] != '\n':
                i += 1
        elif c == '/' and i + 1 < n and s[i + 1] == '*':
            i += 2
            while i + 1 < n and not (s[i] == '*' and s[i + 1] == '/'):
                i += 1
            i += 2
        elif c in '"\'`':
            q, i = c, i + 1
            out.append(' ')
            while i < n and s[i] != q:
                if s[i] == '\\':
                    i += 2
                    continue
                if q == '`' and s[i] == '$' and i + 1 < n and s[i + 1] == '{':
                    depth, i = 1, i + 2
                    while i < n and depth:
                        if s[i] == '{':
                            depth += 1
                        elif s[i] == '}':
                            depth -= 1
                            if not depth:
                                break
                        out.append(s[i])
                        i += 1
                i += 1
            i += 1
        else:
            out.append(c)
            i += 1
    return ''.join(out)


def plausible(name):
    """A real build identifier looks like UPPER_SNAKE or camelCase. Prose in backticks does not."""
    return bool(re.fullmatch(r'[A-Z][A-Z0-9]*(_[A-Z0-9]+)+', name)
                or re.fullmatch(r'[a-z][a-z0-9]*([A-Z][A-Za-z0-9]*)+', name))


def main():
    args = sys.argv[1:]
    want = args[args.index('--detail') + 1] if '--detail' in args else None
    every = '--all' in args

    live = strip(classic_script(open(BUILD, encoding='utf-8').read()))
    lines = open(GDD, encoding='utf-8').read().split('\n')

    heads = [(i, re.match(r'^#{2,4} (\S+)', l).group(1).rstrip('.'))
             for i, l in enumerate(lines) if re.match(r'^#{2,4} ', l)]

    def section_of(idx):
        cur = 'pre'
        for i, num in heads:
            if i > idx:
                break
            cur = num
        return cur

    hits = collections.defaultdict(list)          # section -> [(name, lineno, row)]
    seen = collections.defaultdict(set)
    for i, line in enumerate(lines):
        sec = section_of(i)
        if not (sec[0] in '23'):
            continue
        if sec == '0' or (sec == '3' and i < 70):  # §0's own index rows are not GDD prose
            continue
        row = line.split(' | ')[0][1:].strip() if line.startswith('| **') else ''
        for quoted in re.findall(r'`([^`\n]{2,60})`', line):
            for name in re.findall(r'\b([A-Za-z_$][A-Za-z0-9_$]{3,})\b', quoted):
                if not every and not plausible(name):
                    continue
                if name.endswith('_') or re.search(r'\b' + re.escape(name) + r'\b', live):
                    continue
                if name in seen[(sec, i)]:
                    continue
                seen[(sec, i)].add(name)
                hits[sec].append((name, i + 1, row))

    order = sorted(hits, key=lambda s: [int(p) for p in s.split('.')])
    if want:
        want = want.lstrip('§').rstrip('.')
        got = hits.get(want, [])
        grouped = collections.defaultdict(set)
        for name, ln, row in got:
            grouped[(ln, row)].add(name)
        for (ln, row) in sorted(grouped):
            names = grouped[(ln, row)]
            print('L%-6d %-42s %s' % (ln, (row or '—')[:42], ', '.join(sorted(names))))
        print('\n%d rows/lines carry candidates in §%s; %d distinct names\n'
              % (len(grouped), want, len({n for n, _, _ in got})))
        return
    total = {n for v in hits.values() for n, _, _ in v}
    print('%d distinct identifiers named in GDD §2/§3 have ZERO live occurrence in the build.'
          % len(total))
    print('⛔ Candidates, not verdicts — read the context before touching one.\n')
    for sec in order:
        names = sorted({n for n, _, _ in hits[sec]})
        print('§%-8s %3d  %s' % (sec, len(names), ', '.join(names)))


main()
