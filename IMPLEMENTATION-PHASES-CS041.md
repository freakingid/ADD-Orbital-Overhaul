# IMPLEMENTATION-PHASES-CS041.md

**Reads with:** `PLANNED-FEATURES-CS041.md` (spec). Every `§` reference below points there unless it says "GDD §".
**Base:** `89662b4`, `GAME_VERSION 1.0.0.40` → **unchanged unless FORK-CS041-A says otherwise at GATE C.**

**Standing rules for every phase:**

- One Claude Code session per phase. One commit per phase. **Claude Code never pushes** — Paul commits and pushes.
- Fresh `git clone --depth 1` at the start of every session. Never trust cached state.
- **⛔ NO BUILD EDIT. `orbital-overhaul.html` appears in no phase's diff in this changeset.** (P1 edits `CLAUDE.md`; that is not the build.) A phase that finds a doc/build disagreement records it in `STATUS.md` and does **not** fix it — FLAG-CS041-d.
- **⛔ NO SECTION RENUMBER, MERGE, SPLIT OR REORDER.** 619 build-source `§` refs + 565 GDD-internal + 51 cross-doc depend on the current numbering (§1.3a). A section that empties becomes a stub; it does not vanish and its neighbours do not shift.
- **⛔ Every ⛔ and ⚠ marker survives WITH ITS REASONING.** Tightening the wording is allowed. Reducing a marker's *why* to its *what* is not.
- **⛔ Run `node scratchpad/run-all.js` before committing. 171/171, 0 skips.** A docs-only phase that moves that number has broken one of the four prose pins (§1.3b) — fix the trim, never the test.
- **⛔ Do not edit anything under `log/` or `archive/`.** Adding a *new* file to `log/` is fine (FORK-CS041-C).
- Forks are **not** resolved inside a session. **All four forks in §3 are OPEN.** If a prompt hits one, stop and report.

**⛔ The four literal prose pins — memorise these before touching the GDD (§1.3b):**

| test | must hold |
|---|---|
| `test-cs026-p2.js` | `/3-way split/` matches |
| `test-cs026-p2.js` | `/junkSplit/` matches |
| `test-cs026-p3.js` | `/2560/` matches |
| `test-cs026-p6.js` | `/plus two deliberate exceptions/i` matches; `/three deliberate exceptions/i` does not |

---

## Phase map

| phase | content | model / effort | gate |
|---|---|---|---|
| P1 | Read contract — GDD §0 index, CLAUDE.md rule, CLAUDE.md ceiling | Opus, `ultrathink` | |
| P2 | GDD §3's Constants cell → a pointer (~21 KB, no judgment call) | Sonnet, standard | |
| **GATE C** | **blocking — did Lever A work? is the trim still wanted?** | — | ⛔ |
| P3 | The trim rule + ONE worked section (GDD §2.14 Powerups) | Opus, `ultrathink` | |
| **GATE D** | **blocking — diff review: is the rule right?** | — | ⛔ |
| P4 | GDD §3 Code Architecture Map, the rest | Opus, `ultrathink` | |
| P5 | GDD §2.16 + §2.19 (menus, debug panel) | Opus, `ultrathink` | |
| P6 | GDD §2.10 + §2.5 (salvage/chain/dock, Hunters) | Opus, `ultrathink` | |
| P7 | GDD §2.8 + §2.17 (audio, achievements) | Opus, `ultrathink` | |
| P8 | GDD §2.4/§2.7/§2.11/§2.12/§2.13/§2.18/§2.21/§2.22, then §2.20 last | Opus, `ultrathink` | |
| P9 | Closing — STATUS.md, log/CS041.md, archive, §0 re-measure | Sonnet, standard | |

⛔ **P3–P8 are CONDITIONAL on GATE C.** If the gate says Lever A solved the problem, the changeset closes at P9 with them unbuilt — the same shape as CS040's no-op P7, and an equally good outcome (FORK-CS041-B).

---

## P1 — The read contract

**Commit:** `cs041 p1: GDD read index + CLAUDE.md read contract`

```
Fresh clone. ⛔ NO BUILD EDIT. No GDD content is deleted in this phase — this is additive plus one
rule change.

1. GDD gains "## 0. How to read this document", immediately after the title block, BEFORE §1.

   ⛔ It is an INDEX, not a summary. Its job is to let a session pick the two or three subsections
   it actually needs. One row per §2.x / §3.x subsection:
     - the section number and name (VERBATIM -- these numbers are referenced 619 times from the
       build's own comments; never paraphrase one)
     - approximate size (FORK-CS041-D says whether to include this -- if UNRESOLVED at session
       time, STOP and report; do not pick)
     - ⛔ a "read this when you are touching..." line phrased in terms of WHAT YOU MIGHT BE
       EDITING, not what the section is named.

   That last point is the whole value and the whole risk. "§2.14 Powerups -- powerups" is useless.
   "§2.14 -- any pickup, any drop roll, the recycle hub's per-visit drop, the powerup HUD rows,
   powerBudget" is what stops a phase touching the dock from missing that the hub's drop lives here.
   Cross-cutting mechanics MUST appear under every section that owns a piece of them.

   Target 3-4 KB. Do not editorialise; do not restate mechanics.

2. CLAUDE.md's document map row for the GDD: change the "Read it?" column from "§1-§3 before code"
   to a named-subsection contract -- §0 index + §1 always, then the §2.x/§3.x subsections the phase
   names. Word it so "read the whole thing" is still obviously available when a phase is broad.

   ⛔ Check the rest of CLAUDE.md for other statements of the old rule and update them together --
   grep for "§1-§3", "§1–§3", "before code", "§2 = shipped only". A contract stated two ways in one
   file is worse than either version.

3. CLAUDE.md gains a size ceiling for ITSELF, in the STATUS.md-format region where the STATUS.md
   cap already lives. CLAUDE.md is 46.6 KB, auto-loads every session, and has no ceiling while
   STATUS.md has one. The valve is the mechanism this file's own header already names -- "states
   rules, not reasons; reasons live in RATIONALE.md" -- applied to itself: past the threshold, a
   section moves its REASONING to RATIONALE.md under an anchor and keeps its RULE here.

   Pick a threshold and say plainly that it is a first guess (FLAG-CS041-b). Do NOT trim any
   CLAUDE.md section in this phase -- only add the rule.

4. STATUS.md: reset to CS041, phase ledger P1, and record under Known issues that P3-P8 are
   conditional on GATE C.

Run the full suite: 171/171, 0 skips. Report the measured GDD load a typical phase now faces
(§0 + §1 + two representative subsections) against the old ~505 KB.
```

---

## P2 — The §3 Constants cell

**Commit:** `cs041 p2: GDD §3 constants cell becomes a pointer`

```
Fresh clone. ⛔ NO BUILD EDIT. One table cell in the GDD, plus STATUS.md.

GDD "## 3. Code Architecture Map" -> the **Constants** row -> its middle cell is ONE line of
markdown holding 22,520 bytes: an append-only changelog of every tuning constant added, retired or
retuned since v1.1. Find it with:

  grep -n '| \*\*Constants\*\*' ORBITAL-OVERHAUL-GDD.md

Replace that cell with a pointer of <= 1.5 KB covering:
  - what lives in the build's constants block and how it is grouped (SHIP_/BULLET_/GARBAGE_/CHAIN_/
    CARGO_/DOCK_/HUNTER_/POWERUP_ ... -- CLAUDE.md's Build rules already state the grouping rule)
  - the standing invariants currently buried in the cell, which MOVE INTO the replacement, NOT to
    the log. At minimum: "change balance here first, never hardcode magic numbers deeper in the
    file"; WORLD_* (wrap boundary) vs VIEW_* (screen) and why the distinction matters; and the
    ⛔ "POWERUP_RADIUS is 30 / DOCK_RADIUS is 88 -- the retired size levers' 2x is BAKED IN, do not
    restore 1x" rule.
  - where the history went: log/CS0##.md per changeset, DIFFICULTY-LEVERS.md §4/§6 for the
    difficulty-relevant subset.

⛔ BEFORE deleting any line of that cell, check it against the ⛔ markers in §3 (there are 13 across
the section, several inside this cell). Anything that is a standing prohibition or a "do not
restore" rule MOVES INTO THE REPLACEMENT TEXT. Only the retune narration goes.

⛔ The retired-constant NAMES are worth one compressed line in the replacement -- a future session
grepping for GARBAGE_DECAY or POWERUP_DROP_CHANCE should learn "deleted, see log/", not find
silence. One line listing them, not a paragraph each.

The cut narration goes to log/GDD-TRIM-CS041.md (create it; FORK-CS041-C). Header: what it is, why
it exists, that it is never read by default.

⛔ /2560/ must still match somewhere in the GDD (test-cs026-p3.js). It appears in this cell AND in
§2.11; confirm §2.11's survives before trusting the pin.

Run the full suite: 171/171, 0 skips. Report bytes before/after for the cell and for the whole GDD.
```

---

## GATE C — blocking. Did Lever A work? Is the trim still wanted?

**Not a code phase.** Nothing after this starts until Paul signs off.

Questions:

1. **Run one real, normal phase of other work under the new read contract.** Did GDD §0 point at the right subsections? This is the gate's central question and it needs a genuine phase, not a hypothetical — a dry read does not test whether §0's "when you are touching…" phrasing actually catches a cross-cutting mechanic.
2. Did anything get **missed** that the old blunt "read §1–§3" rule would have caught?
3. Is the remaining per-session load acceptable — **is the trim still worth 6+ sessions** (FORK-CS041-B)?
4. **FORK-CS041-A:** does a docs-only changeset bump `GAME_VERSION`? Needed before P9 either way.
5. FORK-CS041-D, if P1 had to defer it: does §0 carry per-subsection sizes?

⛔ **A "no, the trim is not needed" answer closes the changeset at P9 with P3–P8 unbuilt.** That is a good outcome, not a failure.

---

## P3 — The trim rule, and one worked section

**Commit:** `cs041 p3: trim rule + GDD §2.14 worked example`

```
Fresh clone. ⛔ CONDITIONAL ON GATE C -- if the gate did not greenlight Lever C, this phase does not
run. ⛔ NO BUILD EDIT.

⛔ ONE SECTION ONLY: GDD §2.14 Powerups (44,904 bytes, 10 ⛔, 2 ⚠). Do not touch §2.14.1 or §2.14.2
-- they are their own subsections and belong to a later phase. Do not touch any other section, no
matter how obviously trimmable it looks while you are in the file.

§2.14 is the deliberate choice of worked example: large, marker-dense, heavily cross-referenced
(38 inbound § refs), and it contains both kinds of history in the same bullets.

1. Apply the KEEP/MOVE rule in PLANNED-FEATURES-CS041.md §2.4, in full. Read it before editing.
   The one-line test for a borderline sentence: DOES A SESSION THAT HAS NEVER READ log/ MAKE A
   WORSE DECISION WITHOUT THIS? Yes -> keep. No -> move.

   ⛔ PROTECTIVE HISTORY IS NOT NARRATION. A record of a decision that was made, reversed, or
   re-decided, whose purpose is to stop it being re-opened, STAYS. §2.14's own "THERE IS NO ON-SHIP
   TELL FOR ANY OF THIS, AND THAT IS A DECISION RATHER THAN AN OMISSION" bullet is exactly this
   shape -- it reads as history and is load-bearing. Deleting that class of sentence is the single
   worst thing this changeset could do.

2. Cut narration appends to log/GDD-TRIM-CS041.md under a "## GDD §2.14" heading, with enough
   context that a reader can tell what it was attached to.

3. ⛔ Write the rule you actually applied into the top of log/GDD-TRIM-CS041.md, including any case
   where you had to extend or narrow §2.4's rule to make a real decision. GATE D reviews THAT as
   much as the diff -- the rule is the deliverable, the section is the evidence.

4. Record in STATUS.md: bytes before/after, and every borderline call you made, so GATE D can check
   the judgment rather than just the size.

⛔ Do NOT proceed to a second section however well this goes. GATE D exists because the same wrong
rule applied to eight more sections is eight sections of damage.

Run the full suite: 171/171, 0 skips.
```

---

## GATE D — blocking. Diff review.

**Not a code phase.** A **diff review, not a playtest** — read `git show` for P3.

1. Is the KEEP/MOVE rule drawing the line in the right place?
2. Is anything **protective** missing from the trimmed §2.14?
3. Is the size reduction worth the reading loss?
4. Does the rule as written in `log/GDD-TRIM-CS041.md` generalise to §2.16, §2.10, §2.20?

⛔ This is the only thing between a correct rule and eight more sections trimmed wrongly. If the answer is "nearly right", **fix the rule and re-run P3 on the same section** before unlocking P4.

---

## P4–P8 — Bulk trim

**Commits:** `cs041 p4: GDD §3 trim` · `p5: §2.16 + §2.19` · `p6: §2.10 + §2.5` · `p7: §2.8 + §2.17` · `p8: remaining §2.x`

```
Fresh clone. ⛔ CONDITIONAL ON GATE D. ⛔ NO BUILD EDIT.

Each phase: apply the rule as GATE D approved it (log/GDD-TRIM-CS041.md's header is the source of
truth for the rule, NOT the original §2.4 -- the gate may have amended it) to that phase's named
sections and NOTHING ELSE.

P4 -- GDD §3 Code Architecture Map, everything except P2's Constants cell (~72 KB remaining,
       13 ⛔). Same table-of-sections shape throughout; expect the per-row "Notes for modification"
       column to be where the protective content lives.
P5 -- §2.16 Pause Menu/Options/Rebinding (47.0 KB) + §2.19 Debug Options (31.6 KB).
P6 -- §2.10 Salvage/Tow Chain/Dock (41.5 KB, 16 ⛔ -- the densest prohibition set in §2) + §2.5
       Hunter Satellites (30.8 KB).
P7 -- §2.8 Audio (41.3 KB) + §2.17 Achievements (28.5 KB).
       ⛔ §2.8 carries the voice/music contracts CLAUDE.md also pins. Where the GDD merely restates
       a CLAUDE.md ⛔, the GDD copy may go -- but VERIFY the CLAUDE.md pin actually says it first.
       ⛔ §2.17: achievement `id` values are SAVE DATA. Never reword one, even in prose.
P8 -- §2.4, §2.7, §2.11, §2.12, §2.13, §2.18, §2.21, §2.22 (~85 KB combined), THEN §2.20
       Achievement Celebration Panel LAST.
       ⛔ §2.20 is 21.8 KB carrying 27 ⛔ markers -- the highest density in the file. It may be
       almost entirely protective. A SMALL reduction there is the CORRECT outcome (FLAG-CS041-e);
       do not manufacture a bigger one.

Every phase:
  - cut narration appends to log/GDD-TRIM-CS041.md under a per-section heading
  - the four prose pins still match (they live in §2.4/§2.11/§3.2 -- P8 and P4 are the risky ones)
  - full suite 171/171, 0 skips
  - STATUS.md: one ledger line, bytes before/after, borderline calls

⛔ If a phase finds its sections are mostly protective and trims little, SAY SO AND STOP. A phase
that reports "12% and here is why the rest must stay" is doing the job correctly. Do not pad the
number.
```

---

## P9 — Closing

**Commit:** `cs041 p9: doc sweep + close`

```
Fresh clone. ⛔ NO BUILD EDIT unless FORK-CS041-A resolved to "bump" at GATE C -- in which case the
ONLY build edit is GAME_VERSION, plus the two live version pins (test-cs016-p5.js,
test-cs021-p4.js). If FORK-CS041-A resolved to "no bump", the build and both pins stay untouched
and the version line in STATUS.md stays 1.0.0.40.

1. ⛔ RE-MEASURE GDD §0's per-subsection sizes against the trimmed file and correct every one
   (FLAG-CS041-c) -- if FORK-CS041-D put sizes in §0, P4-P8 invalidated all of them. Then add the
   re-measure to CLAUDE.md's standing closing-phase checklist so this cannot silently rot.
2. CLAUDE.md: confirm the P1 read contract still describes reality after the trim. Confirm the
   size-ceiling rule's threshold still looks right against the current file (FLAG-CS041-b).
3. log/CS041.md: full narrative, both gates verbatim, the final trim rule, before/after byte
   table per section, and the GDD version-history entry.
4. STATUS.md rolled and reset.
5. Archive PLANNED-FEATURES-CS041.md and IMPLEMENTATION-PHASES-CS041.md.
   ⛔ log/GDD-TRIM-CS041.md is NOT archived -- it stays in log/ as the record of what was cut.
6. Report the headline number: per-session doc load before CS041 vs after, and the GDD's total
   size before vs after.

Run the full suite. ⛔ ZERO SKIPS. Report any skip with its reason.
```

---

## Model guidance

**Opus + `ultrathink` for P1 and every trim phase (P3–P8).** The trim is a judgment call on every sentence — "is this protective or narrative?" — made a few thousand times, against a file whose whole failure mode is that the wrong answer is invisible until a future session re-litigates a settled decision. This is not a mechanical pass and must not be run as one.

**Sonnet, standard, for P2 and P9.** P2 is a bounded replacement of one identified cell against an explicit keep-list. P9 is a checklist.

⛔ `ultrathink` must appear inside the message text itself — it is a per-turn lever, not a session setting.
