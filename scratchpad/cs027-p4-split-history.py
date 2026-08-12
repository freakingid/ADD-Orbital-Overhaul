#!/usr/bin/env python3
"""CS027 P4 — split archive/STATUS-HISTORY.md, the current STATUS.md
narrative, and GDD-VERSION-HISTORY.md into per-changeset log/CS0NN.md
files (see CLAUDE.md's document map).

Paragraph model: entries in this project's status logs are one
paragraph per physical line (blank lines between them are cosmetic,
not load-bearing — see the many adjacent non-blank entry lines in
archive/STATUS-HISTORY.md, e.g. lines 309/310), EXCEPT where a
historical `>>`-append bug fused many physical lines into one (up to
159,598 chars / 24 sub-entries in archive/STATUS-HISTORY.md line 320).
Fused lines are re-split on a hand-verified anchor set (see
split_fused()) with one guarded false-positive shape excluded (an
inline "→ **vX.Y**" chain reference is never itself a new entry).

Marker detection (which changeset a paragraph "opens with", for
inheritance) requires the CS0NN/vX.Y token to appear essentially
immediately after the paragraph's own opening "**" (optionally past a
"(N)" sub-bullet numeral and a short recognized lead-in phrase like
"Prior session"). A naive scan of the whole first-220-chars window
false-positives constantly: numbered continuation bullets routinely
cite an OLDER changeset as historical context deep in an ALL-CAPS
headline ("...WHICH CLOSES FLAG-CS020-i...", "...(CS020 P2, CS022 P4,
CS024 P7, and now this one)...") without being about that changeset at
all. See MARKER_OPEN_RE / VERSION_OPEN_RE and their inline tests.
"""
import re
import sys
from collections import OrderedDict, defaultdict

REPO = "/home/paulk/projects/game/ADD-Orbital-Overhaul"

# ---------------------------------------------------------------- anchors --

SPLIT_ANCHOR_RE = re.compile(
    r'\*\*(Prior session\b|Last session\b|Headless-verified\b|CS0\d\d\b|v\d+(?:\.\d+)+\b)'
)

MARKER_OPEN_RE = re.compile(
    r'^-?\s*\*\*'
    r'(?:\(\w+\)\s*)?'
    r'(?:[⛔✅⚠️]+\s*)*'
    r'(?:(?:Prior session|This session|Last session|Headless-verified)\b[^\n]{0,40}?)?'
    r'\(?CS0(\d\d)\b'
)

VERSION_OPEN_RE = re.compile(
    r'^-?\s*'
    r'(?:(?:Prior session|This session|Last session)\s*[:,]?\s*)?'
    r'\*\*'
    r'(?:\(\w+\)\s*)?'
    r'(?:[⛔✅⚠️]+\s*)*'
    # a short label before the version is fine ("Controller (v1.8/F7):",
    # "Powerup drop economy (v3.6 P3) —") as long as it stays inside the
    # SAME opening bold span (no literal '*' allowed in the label, so a
    # "**...**" that closes before reaching a "(vN" elsewhere can't match)
    r'[^*\n(]{0,50}?'
    r'\(?v(\d+)\.(\d+)\b'  # dot mandatory: bare "v31" is a filename fragment
                            # (test-v31-coalesce.js), not a version marker
)

# STATUS.md's own metadata line ("Last updated: ... Build version: **CS027 ...")
# is the one genuine marker that isn't at paragraph position 0.
METADATA_MARKER_RE = re.compile(r'^Last updated:.{0,80}?\*\*CS0(\d\d)\b')


# A file-wide anchor scan (see the .md dumps this script was developed
# against) false-positives constantly on ordinary bold emphasis inside a
# single ongoing paragraph — "Contains everything **CS022 and older**,
# including...", "**v3.4** planning cycle", "the **CS017 P1-P7 entries**
# consolidated...", "**CS023's inward debris drift** are removed...".
# None of those are paragraph boundaries; they're just bolded noun
# phrases mid-sentence. A length-only pre-filter (checked against every
# line >8000 chars in all three source files, by hand) turned up exactly
# four physical lines that are genuinely multiple fused entries. Splitting
# is restricted to those four, by exact line content match, rather than
# applied blindly file-wide.
# archive/STATUS-HISTORY.md:234 (3 entries), :244 (6 entries), :320 (33
# entries); STATUS.md:459 (16 entries) — see split_fused() below.
PREFIX_CUES = ("Prior session:", "Last session:", "Previous build state:")


def _fused_split_positions(line):
    matches = list(SPLIT_ANCHOR_RE.finditer(line))
    positions = [0]
    for m in matches:
        if m.start() == 0:
            continue
        pos = m.start()
        pre = line[:pos].rstrip()
        if pre and pre[-1] == '→':  # inline chain reference ("v3.2 P1 -> v3.6 P1a"), not a boundary
            continue
        # if a recognized lead-in cue immediately precedes this anchor
        # (e.g. "Previous build state: **CS023 P4"), the boundary belongs
        # at the START of the cue, not at the "**"
        best_cue_pos = None
        for cue in PREFIX_CUES:
            idx = pre.rfind(cue)
            if idx != -1 and pre[idx + len(cue):].strip() == '':
                if best_cue_pos is None or idx < best_cue_pos:
                    best_cue_pos = idx
        positions.append(best_cue_pos if best_cue_pos is not None else pos)
    positions = sorted(set(positions))
    chunks = []
    for i, pos in enumerate(positions):
        end = positions[i + 1] if i + 1 < len(positions) else len(line)
        chunk = line[pos:end].strip()
        if chunk:
            chunks.append(chunk)
    return chunks


def split_fused(line, whitelist_check=True):
    """Split a physical line into 1+ paragraphs, but ONLY for the four
    hand-verified fused lines (see FUSED_LINE_PREFIXES / module docstring).
    Every other line — regardless of length or incidental bold markers —
    is returned unsplit, one physical line = one paragraph."""
    if whitelist_check:
        stripped = line.strip()
        is_known_fused = (
            stripped.startswith("**Prior session (CS012 P5):**") or
            stripped.startswith("**Prior session (CS011 P3):**") or
            stripped.startswith("**Prior session summary (v3.6 P3):") or
            stripped.startswith("Previous build state: **CS023 P4")
        )
        if not is_known_fused:
            return [stripped] if stripped else []
    return _fused_split_positions(line)


def detect_marker(text):
    """Returns ('CS0NN', None) or (None, 'pre-CS009') or (None, None)."""
    m = MARKER_OPEN_RE.match(text)
    if m:
        return 'CS0' + m.group(1), None
    m = METADATA_MARKER_RE.match(text)
    if m:
        return 'CS0' + m.group(1), None
    m = VERSION_OPEN_RE.match(text)
    if m:
        return None, 'pre-CS009'
    return None, None


def canon_section(raw):
    if raw is None:
        return 'Recap'
    s = raw.lstrip('#').strip()
    s = re.sub(r'\s*\([^)]*\)\s*$', '', s).strip()
    return s


DEEP_HISTORY_MARK = 'Deep history'


def tokenize(path):
    """Walk a file, yielding dicts: text, section (canonical), raw_section,
    line (1-indexed), src (basename)."""
    with open(path, encoding='utf-8') as f:
        lines = f.readlines()
    section = None
    out = []
    for i, raw in enumerate(lines, 1):
        line = raw.rstrip('\n')
        stripped = line.strip()
        if stripped == '':
            continue
        if stripped == '---':
            continue
        if line.startswith('##'):
            section = line
            continue
        if line.startswith('#'):
            continue  # H1 document title — not a section boundary
        for chunk in split_fused(line):
            out.append({
                'text': chunk,
                'section': canon_section(section),
                'raw_section': section,
                'line': i,
            })
    return out


def classify(paragraphs, src_name, force_section_prefix=None, force_dest=None):
    """Attach dest_changeset to each paragraph (mutates+returns list).
    force_section_prefix: canonical section name (exact match) whose
    paragraphs are force-routed to force_dest regardless of computed marker,
    AND which also resets the running tracker (matches CLAUDE.md step 2's
    explicit override for the Deep History section)."""
    current = None
    for p in paragraphs:
        cs_marker, pseudo = detect_marker(p['text'])
        if cs_marker:
            current = cs_marker
        elif pseudo:
            current = pseudo
        # else: inherit `current` unchanged (continuation paragraph)

        if force_section_prefix is not None and p['section'] == force_section_prefix:
            current = force_dest  # also updates the persistent tracker, per spec
            p['dest'] = force_dest
        else:
            p['dest'] = current if current is not None else 'UNSORTED'
        p['src'] = src_name
    return paragraphs


# --------------------------------------------------------- GDD history --

def tokenize_gdd_history(path):
    """GDD-VERSION-HISTORY.md is a different shape: no fusion, mostly one
    bullet per changeset, but CS025/CS026 are '## ' entry headings (not
    bold text) with multi-paragraph bodies. The title/blockquote intro and
    the '## 7. Version History' scaffolding heading (lines 1-7) are
    structural front matter, not content — dropped, and reported as such
    rather than silently discarded."""
    with open(path, encoding='utf-8') as f:
        lines = f.readlines()
    paras = []
    dropped = []
    heading_marker_re = re.compile(r'^CS0(\d\d)\b')
    for i, raw in enumerate(lines, 1):
        line = raw.rstrip('\n')
        s = line.strip()
        if s == '' or s == '---':
            continue
        if i <= 7:
            dropped.append((i, line))
            continue
        if line.startswith('##'):
            text = line.lstrip('#').strip()
            paras.append({'text': text, 'section': 'GDD version history',
                          'line': i, 'forced_marker': None})
            m = heading_marker_re.match(text)
            if m:
                paras[-1]['forced_marker'] = 'CS0' + m.group(1)
            continue
        for chunk in split_fused(line):
            paras.append({'text': chunk, 'section': 'GDD version history',
                          'line': i, 'forced_marker': None})
    return paras, dropped


def classify_gdd(paragraphs, src_name):
    current = None
    for p in paragraphs:
        if p.get('forced_marker'):
            current = p['forced_marker']
        else:
            cs_marker, pseudo = detect_marker(p['text'])
            if cs_marker:
                current = cs_marker
            elif pseudo:
                current = pseudo
        p['dest'] = current if current is not None else 'UNSORTED'
        p['src'] = src_name
    return paragraphs


# ------------------------------------------------------------- output --

SECTION_ORDER = [
    'Recap', 'Deep history', 'Working / verified', 'Known issues',
    'Balance notes', 'Next up', 'Playtest asks', 'GDD version history',
]


def write_log_files(all_paragraphs, log_dir):
    import os
    by_dest = OrderedDict()
    for p in all_paragraphs:
        by_dest.setdefault(p['dest'], []).append(p)

    written = {}
    for dest, plist in by_dest.items():
        by_section = OrderedDict()
        for p in plist:
            by_section.setdefault(p['section'], []).append(p)
        ordered_sections = [s for s in SECTION_ORDER if s in by_section]
        ordered_sections += [s for s in by_section if s not in SECTION_ORDER]

        out = [f"# {dest}", ""]
        for sec in ordered_sections:
            if sec == 'Recap':
                for p in by_section[sec]:
                    out.append(p['text'])
                    out.append("")
            else:
                out.append(f"## {sec}")
                out.append("")
                for p in by_section[sec]:
                    out.append(p['text'])
                    out.append("")
        content = "\n".join(out).rstrip() + "\n"
        path = os.path.join(log_dir, f"{dest}.md")
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        written[dest] = len(plist)
    return written


# --------------------------------------------------------------- main --

def run(repo=REPO, dry_run=True):
    import os
    archive_path = os.path.join(repo, 'archive', 'STATUS-HISTORY.md')
    status_path = os.path.join(repo, 'STATUS.md')
    gdd_path = os.path.join(repo, 'GDD-VERSION-HISTORY.md')
    log_dir = os.path.join(repo, 'log')

    report = {}

    archive_paras = tokenize(archive_path)
    report['archive_in'] = len(archive_paras)
    archive_paras = classify(archive_paras, 'archive/STATUS-HISTORY.md',
                              force_section_prefix='Deep history', force_dest='pre-CS009')

    status_paras = tokenize(status_path)
    report['status_in'] = len(status_paras)
    # "## Suite baseline (CS027 P1)" is explicitly CS027 by its own heading,
    # but its paragraphs (raw counts/numbers) never restate a "CS027 P1"
    # marker of their own, so without an override they'd inherit whatever
    # changeset happened to precede the heading (CS020, wrongly).
    status_paras = classify(status_paras, 'STATUS.md',
                             force_section_prefix='Suite baseline', force_dest='CS027')
    status_kept_cs027 = [p for p in status_paras if p['dest'] == 'CS027']
    status_log_paras = [p for p in status_paras if p['dest'] != 'CS027']
    report['status_kept_cs027'] = len(status_kept_cs027)
    report['status_routed_to_log'] = len(status_log_paras)

    gdd_paras, gdd_dropped = tokenize_gdd_history(gdd_path)
    report['gdd_in'] = len(gdd_paras)
    report['gdd_dropped_front_matter'] = gdd_dropped
    gdd_paras = classify_gdd(gdd_paras, 'GDD-VERSION-HISTORY.md')

    combined = archive_paras + status_log_paras + gdd_paras
    report['combined_total'] = len(combined)
    report['unaccounted'] = (
        report['archive_in'] + report['status_in'] + report['gdd_in']
        - len(combined) - report['status_kept_cs027']
    )

    from collections import Counter
    report['dest_counts'] = Counter(p['dest'] for p in combined)

    if not dry_run:
        written = write_log_files(combined, log_dir)
        report['files_written'] = written

    return report, archive_paras, status_paras, gdd_paras


if __name__ == '__main__':
    # Smoke-test the anchors before anything else touches real files.
    assert MARKER_OPEN_RE.match('**CS027 P3 — GLOBAL COUNTS')
    assert MARKER_OPEN_RE.match('**Prior session (CS022 P3, landed):**')
    assert MARKER_OPEN_RE.match('**Headless-verified this session (CS022 P1,')
    assert not MARKER_OPEN_RE.match('**(4) THE HUD `COMBO n/24` READOUT IS REMOVED — WHICH CLOSES FLAG-CS020-i')
    assert not MARKER_OPEN_RE.match('**(1) THE RETUNE — NOTHING MOVED.** (CS020 P2, CS022 P4, CS024 P7, and now this one).')
    assert VERSION_OPEN_RE.match('**v2.0 (Phases 1–9), v3.0 (Phases 1–8)')
    assert VERSION_OPEN_RE.match('Prior session: **v3.6 Phase 1 — presentation pass')
    print("anchor smoke tests OK")

    dry = '--write' not in sys.argv
    report, archive_paras, status_paras, gdd_paras = run(dry_run=dry)
    print()
    print("=== CONSERVATION REPORT ===")
    print("archive/STATUS-HISTORY.md paragraphs in:", report['archive_in'])
    print("STATUS.md paragraphs in:                 ", report['status_in'])
    print("  of which kept as CS027 (not relocated): ", report['status_kept_cs027'])
    print("  of which routed to log/:                ", report['status_routed_to_log'])
    print("GDD-VERSION-HISTORY.md paragraphs in:     ", report['gdd_in'])
    print("  front-matter lines dropped (structural):", len(report['gdd_dropped_front_matter']))
    for ln, txt in report['gdd_dropped_front_matter']:
        print("    ", ln, txt[:70])
    print("combined paragraphs routed to log/:       ", report['combined_total'])
    print("UNACCOUNTED (must be 0):                  ", report['unaccounted'])
    print()
    print("--- destination counts ---")
    for k, v in sorted(report['dest_counts'].items(), key=lambda kv: (kv[0] != 'UNSORTED', kv[0])):
        print(f"  {k:12s} {v}")
    if not dry:
        print()
        print("--- files written ---")
        for k, v in sorted(report['files_written'].items()):
            print(f"  log/{k}.md  ({v} paragraphs)")
