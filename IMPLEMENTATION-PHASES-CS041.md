# IMPLEMENTATION-PHASES-CS041.md

**Reads with:** `PLANNED-FEATURES-CS041.md` (spec). Every `§` reference below points there unless it says "GDD §".
**Base:** `89662b4`, `GAME_VERSION 1.0.0.40` → **UNCHANGED. FORK-CS041-A resolved at GATE C: a docs-only changeset does not bump.**

**Standing rules for every phase:**

- One Claude Code session per phase. One commit per phase. **Claude Code never pushes** — Paul commits and pushes.
- Fresh `git clone --depth 1` at the start of every session. Never trust cached state.
- **⛔ NO BUILD EDIT. `orbital-overhaul.html` appears in no phase's diff in this changeset.** (P1 edits `CLAUDE.md`; that is not the build.) A phase that finds a doc/build disagreement records it in `STATUS.md` and does **not** fix it — FLAG-CS041-d.
- **⛔ NO SECTION RENUMBER, MERGE, SPLIT OR REORDER.** 619 build-source `§` refs + 565 GDD-internal + 51 cross-doc depend on the current numbering (§1.3a). A section that empties becomes a stub; it does not vanish and its neighbours do not shift.
- **⛔ Every ⛔ and ⚠ marker survives WITH ITS REASONING.** Tightening the wording is allowed. Reducing a marker's *why* to its *what* is not.
- **⛔ Run `node scratchpad/run-all.js` before committing. 171/171, 0 skips.** A docs-only phase that moves that number has broken one of the four prose pins (§1.3b) — fix the trim, never the test.
- **⛔ Do not edit anything under `log/` or `archive/`.** Adding a *new* file to `log/` is fine (FORK-CS041-C).
- Forks are **not** resolved inside a session. **All four forks in §3 are now RESOLVED** (-D at P1, -A and -B at GATE C, -C by the plan). A *new* fork surfacing mid-phase still stops the session.

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
| **GATE C** | **CLOSED — Lever A worked; Lever C re-scoped to a STALENESS SWEEP** | — | ✅ |
| P3 | The staleness rule + the identifier audit + §3's remaining rows | Opus, `ultrathink` | |
| **GATE D** | **blocking — diff review: is the sweep rule right?** | — | ⛔ |
| P4 | The §2 sections CS024/CS038/CS040 left stale | Opus, `ultrathink` | |
| P5 | The remainder the audit flags | Opus, `ultrathink` | |
| P9 | Closing — STATUS.md, log/CS041.md, archive, §0 re-measure | Sonnet, standard | |

⛔ **P6, P7 and P8 are DROPPED by GATE C.** The original P3–P8 were a 30–40% prose trim of eight
sections; GATE C replaced that with a three-session correctness sweep (below). Their prompts are in
this file's git history at `76e9810` and earlier — not restored, not partially revived.

⛔ **GATE C is CLOSED and both its forks are resolved.** FORK-CS041-B: the specced Lever C is **not**
wanted; a narrowed **staleness sweep** is (P3–P5). FORK-CS041-A: **no `GAME_VERSION` bump** — the
build stays byte-identical at `1.0.0.40` and both live version pins stay un-repointed.

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

## GATE C — CLOSED

Answered by Paul after P2. All five questions settled; both open forks resolved.

| # | question | answer |
|---|---|---|
| 1 | Did GDD §0 point at the right subsections? | **Fine.** The read contract works. |
| 2 | Was anything missed that "read §1–§3" would have caught? | **Nothing.** |
| 3 | Is the trim worth 6+ sessions (FORK-CS041-B)? | **Not as specced.** Re-scoped to a **staleness sweep** — P3–P5 below. |
| 4 | Does a docs-only changeset bump `GAME_VERSION` (FORK-CS041-A)? | **No.** Stays `1.0.0.40`; both live version pins stay un-repointed. |
| 5 | Does §0 carry per-subsection sizes (FORK-CS041-D)? | **Yes** — already resolved at P1. |

**Why the re-scope.** P2 found **three dead "standing rules"** inside §3's Constants row — a
`RAMP_WAVES` pacing rule, a "TWO clocks" rule that flatly contradicted `CLAUDE.md`'s ⛔ *"One clock.
All difficulty scaling derives from `game.wave`"*, and a `garbageLifetime` density rule whose knobs
CS024 deleted. None were narration; all three read as live tuning instructions, and the old blunt
rule shipped them to every session for sixteen changesets. **The value in §2/§3 is not bytes, it is
lies.** A 30–40% prose trim is now worth ~8–12 KB per phase and six risky sessions; a correctness
sweep is worth more and costs three.

**The evidence base, measured at GATE C** — every backticked identifier in §2/§3 checked against the
build with comments and string literals stripped by a character scanner (never a regex; see
`CLAUDE.md`'s Test rules): **156 distinct plausible build identifiers named in §2/§3 have ZERO live
occurrence.** Reproduce with the audit described in P3.

---

## P3 — The staleness rule, the audit, and §3

**Commit:** `cs041 p3: staleness rule + identifier audit + §3 sweep`

```
Fresh clone. ⛔ NO BUILD EDIT.

⛔ THIS IS A CORRECTNESS SWEEP, NOT A SIZE TRIM. The KEEP/MOVE rule in PLANNED-FEATURES-CS041.md
§2.4 is NOT in force — GATE C replaced it. Byte reduction is a side effect and is never the goal;
a phase that removes 400 bytes and is right has succeeded.

THE RULE:

  REMOVE a sentence only if it is FALSE about the current build:
    - it names a deleted identifier as though live,
    - it describes machinery that no longer exists,
    - it states a tuning rule whose knobs are gone,
    - or it contradicts a CLAUDE.md ⛔/⚠ or a later GDD section.

  KEEP everything that is merely OLD. Narration, phase attribution, multi-hop retune chains,
  "as of CSxxx", "for the first time", "still" — ALL STAY. If it is true, it stays, however
  wordy. Protective history stays, unchanged from §2.4's definition of it.

  ⛔ A STATEMENT THAT AN IDENTIFIER WAS DELETED IS TRUE AND STAYS. "GARBAGE_DECAY was removed in
  CS024 P3" is correct AND protective; the audit flags it precisely because the name has no live
  occurrence, which is the reason the sentence exists. THE AUDIT GENERATES CANDIDATES, NOT
  VERDICTS. Every hit needs a context read before anything happens to it.

  ⛔ VERIFY BEFORE REMOVING. Grep the identifier in orbital-overhaul.html; a hit only inside
  comments or string literals is dead. Record the verification alongside the cut text.

  A false statement with an obvious current-state replacement MAY be corrected inline. One
  without goes, replaced by a pointer to the section that owns the current behaviour. If the
  correction would require inventing design, DO NOT -- record it in STATUS.md (FLAG-CS041-d).

1. Write the audit as a committed tool, not a throwaway: scratchpad/gdd-audit.js (or .py) that
   extracts the classic <script> block, strips comments and string literals with a CHARACTER
   SCANNER, collects every backticked identifier per GDD section, and reports the ones with zero
   live occurrence. ⛔ NEVER a regex comment strip -- CLAUDE.md's Test rules say why, and the
   build's own line comments contain /*.

   It is a REPORTING tool. It must not edit the GDD, and it is not wired into run-all.js.

2. Apply the rule to "## 3. Code Architecture Map" -- everything EXCEPT P2's Constants row, which
   is done (~75.6 KB remaining, 13 ⛔). Expect the per-row "Notes for modification" column to be
   where both the protective content AND the staleness live. §3 is first because P2 already
   proved it carries this defect.

   ⛔ §3.1-§3.4 are NOT in this phase. §3's own table only.

3. Cut text appends to log/GDD-TRIM-CS041.md under "## GDD §3 — the rest of the Code Map", each
   entry carrying the verification that made it a removal.

4. ⛔ Write the rule you ACTUALLY applied into that file's header, including every case where you
   had to extend or narrow it. GATE D reviews the rule as much as the diff.

5. STATUS.md: bytes before/after, the audit's per-section counts, and every borderline call.

⛔ Do NOT proceed to a §2 section however well this goes. GATE D exists because the same wrong rule
applied to more sections is more damage.

Run the full suite: 171/171, 0 skips.
```

---

## GATE D — blocking. Diff review.

**Not a code phase.** Read `git show` for P3.

1. Is "remove what is FALSE, keep what is merely OLD" drawing the line in the right place?
2. Is anything **protective** missing? Did a true "X was deleted" sentence get cut as though stale?
3. Does the rule as written in `log/GDD-TRIM-CS041.md`'s header generalise to §2.19, §2.13, §2.10?
4. Is the audit tool trustworthy — are its candidates mostly real, or is the false-positive rate
   high enough that it is steering the sweep wrongly?

⛔ If the answer is "nearly right", **fix the rule and re-run P3 on §3** before unlocking P4.

---

## P4–P5 — The rest of the sweep

**Commits:** `cs041 p4: §2 staleness sweep — the CS024/CS038/CS040 fallout` · `p5: §2 staleness sweep — the remainder`

```
Fresh clone. ⛔ CONDITIONAL ON GATE D. ⛔ NO BUILD EDIT.

Apply the rule as GATE D approved it -- log/GDD-TRIM-CS041.md's header is the source of truth,
not P3's prompt, since the gate may have amended it.

P4 -- the sections the audit ranks worst, all of them CS024/CS038/CS040 fallout:
       §2.19 Debug Options (32 candidates -- retired registry rows: PHASE_LEN, TIER_STEPS, the
         ORBIT_* family, saucer*Pressure, wavePressure, and CS038 P5's twelve presentation knobs
         celebrationScrollStep/celebrationEmblemSize/deliveryFloat*/hunterPulse*)
       §2.13 Level Progression (13 -- RAMP_WAVES, difficultyFactor, levelDef, stepAt, JUNK_CYCLE,
         LEVEL_MAX, leverScale: the pre-odometer world)
       §2.14 + §2.14.1 + §2.14.2 (19 -- POWERUP_DURATION, MAGNET_DURATION, POWERUP_DROP_CHANCE,
         powerFx/powerMode/powerDuration, SCOOP_MAGNET_*)
       §2.10 + §2.10.1 + §2.10.2 (18 -- GARBAGE_DECAY/FADE/SEVER_DECAY, garbageLifetime,
         HUD_COMBO_*, DELIVERY_FLOAT_DY, LEVER_DOCK_SIZE)
       §2.5 + §2.5.1 (15 -- HUNTER_CAP_STEPS, LARGE_HUNTER_MAX, HUNTER_SMALL_GARBAGE, lerpColor,
         clumpHot, makeClumpHull, garbageAttractDelay)

       ⛔ §2.7 and §2.12 both still name REPAIR_AMOUNT / REPAIR_FULL_BONUS / POWERUP_HEALTH_GAP,
       deleted only last changeset. CLAUDE.md carries an explicit ⛔ that those two constants are
       "DELETED, not parked -- do not restore either". CHECK THE CONTEXT FIRST: a sentence saying
       they are gone is TRUE and STAYS. Do these two in P4 as well; they are small and current.

P5 -- everything else the audit flags, and §3.1-§3.4. Then re-run the audit and report what is
       left, with a one-line reason per surviving candidate. A candidate that survives because the
       sentence correctly says "this was deleted" is the EXPECTED outcome, not a miss.

Every phase:
  - cut text appends to log/GDD-TRIM-CS041.md under a per-section heading, with its verification
  - the four prose pins still match
  - full suite 171/171, 0 skips
  - STATUS.md: one ledger line, bytes before/after, borderline calls

⛔ If a phase finds its sections are accurate and removes little, SAY SO AND STOP. A phase that
reports "four false sentences, here they are, the rest is true" is doing the job correctly.
⛔ Do not pad the number. Do not trim for size. Removing a true sentence is the failure mode.
```

---

## P9 — Closing

**Commit:** `cs041 p9: doc sweep + close`

```
Fresh clone. ⛔ NO BUILD EDIT -- FORK-CS041-A resolved to "no bump" at GATE C. orbital-overhaul.html
is untouched, test-cs016-p5.js and test-cs021-p4.js keep their current version pins, and STATUS.md's
version line stays 1.0.0.40. ⛔ Do not "tidy" the version up for ritual's sake; the build is
byte-identical to CS040's and must keep saying so in every high-score record and leaderboard row.

1. ⛔ RE-MEASURE GDD §0's per-subsection sizes against the trimmed file and correct every one
   (FLAG-CS041-c) -- §0 CARRIES SIZES (FORK-CS041-D, yes), P2 already re-measured §3 by hand, and
   P3-P5 invalidate more. Re-measure ALL 35 rows; do not spot-fix. Then add the
   re-measure to CLAUDE.md's standing closing-phase checklist so this cannot silently rot.
2. CLAUDE.md: confirm the P1 read contract still describes reality after the trim. Confirm the
   size-ceiling rule's threshold still looks right against the current file (FLAG-CS041-b).
3. log/CS041.md: full narrative, both gates verbatim (GATE C's re-scope of Lever C especially --
   it is the changeset's real story), the final staleness rule, before/after byte table per
   section, and the GDD version-history entry.
4. STATUS.md rolled and reset.
5. Archive PLANNED-FEATURES-CS041.md and IMPLEMENTATION-PHASES-CS041.md.
   ⛔ log/GDD-TRIM-CS041.md is NOT archived -- it stays in log/ as the record of what was cut.
6. Report the headline number: per-session doc load before CS041 vs after, and the GDD's total
   size before vs after.

Run the full suite. ⛔ ZERO SKIPS. Report any skip with its reason.
```

---

## Model guidance

**Opus + `ultrathink` for P1 and every sweep phase (P3–P5).** The sweep is a judgment call on every flagged sentence — "is this false, or merely old?" — against a file whose whole failure mode is that the wrong answer is invisible until a future session acts on a rule that stopped being true. The audit makes the *candidates* mechanical; deciding each one is not, and must not be run as though it were. ⛔ The specific trap: an audit hit is often a sentence that is CORRECT precisely because it says the identifier is gone.

**Sonnet, standard, for P2 and P9.** P2 is a bounded replacement of one identified cell against an explicit keep-list. P9 is a checklist.

⛔ `ultrathink` must appear inside the message text itself — it is a per-turn lever, not a session setting.
