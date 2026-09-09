# IMPLEMENTATION-PHASES-CS043.md

**Reads with:** `PLANNED-FEATURES-CS043.md` (spec). Every `§` reference below points there.
**Base:** `2532b16`, `GAME_VERSION 1.0.0.42` → **`1.0.0.43` at P5**.

## How to use this document

**Every phase below carries a `Copy-paste prompt` block.** Set the model and effort named above it in
Claude Code, then paste the block verbatim as the session's first message. It carries its own read
chain, its own scope fence and its own commit instruction — nothing has to be remembered or added.

⛔ **Model and effort are UI settings. `ultrathink` is not an effort level** — it is a per-turn lever
that only works when it appears inside the message text, which is why it sits at the bottom of the
prompt blocks that want it (`CLAUDE.md`, Model guidance). Effort levels are **Low / Medium / High /
XHigh / Max**.

⚠ **Max is deliberately unassigned.** It is the escalation for a phase that has already gone wrong
once and is being retried, not a default. If a phase at XHigh produces something that fails its own
test twice, that is the signal to raise it.

**Standing rules** (all in `CLAUDE.md`, which auto-loads — repeated here only so the phase bodies can
lean on them):

- One session per phase. One commit per phase, on `main`. **Never push** — that is Paul's.
- Navigate the single-file build with `grep -n 'symbolName'` + `sed -n 'START,ENDp'`. **Anchor by
  symbol name, never by line number** — the spec's line numbers are `2532b16` navigation aids and
  every deletion in this changeset moves the ones below it.
- ⛔ **The one fork (§8, FORK-CS043-A) IS RESOLVED — the pulse spans the whole protection window**
  (Paul, at review, 2026-09-09). P3 makes all three of its changes. Forks are not resolved inside a
  session; if a prompt seems to conflict with this, stop and report.
- **Baseline is 180/180, 0 skipped.** `test-cs035-p3.js` §F (~5%) and `test-f6.js` §F (~1.7%) are
  documented unseeded flakes — rerun before treating either as a regression.

---

## Phase map

| phase | content | model | effort | ultrathink | build? |
|---|---|---|---|---|---|
| **P0** | Five stale comments, including §7.1's find. **Kept as its own phase** (Paul, at review) | Sonnet 5 | **Medium** | no | comments only |
| **P1** | ⛔ **The deletion** — freeze, announcement, both input branches, the latch's new call (§1) | Opus 5 | **XHigh** | yes | yes |
| **P2** | The celebration panel becomes game-over-only (§2) | Opus 5 | **High** | yes | yes |
| **P3** | Banner position, grace retune, FORK-CS043-A's pulse (§3, §4) | Opus 5 | **High** | yes | yes |
| **P4** | The live spawn floor + its registry row (§5) | Sonnet 5 | **Medium** | no | yes |
| **⛔ GATE A** | **Blocking playtest. No session.** | — | — | — | — |
| **P5** | Closing: GATE A's retunes, docs, §0 re-measure, version bump, archive | Sonnet 5 | **High** | yes | yes |

### Why these settings

**XHigh on P1** — it is the only phase in this changeset that can break the shipped game *silently*.
It deletes a reduced-sim branch whose own documented failure mode is a **hard hang**, it moves the
wave-clear latch's fork, and it must delete three test files without dropping an assertion that still
has a subject. Everything it touches is heavily commented and much of that commentary has to be
rewritten rather than removed.

**High on P2 and P3** — both edit functions with dense load-bearing headers (`dismissCelebration()`,
`Ship.draw()`'s pulse block) where the risk is a *wrong* edit rather than a missed one.

**Medium on P0 and P4** — a comment sweep and a one-constant-plus-one-row change.

### Why this order

P1 is first because everything else is easier once the announcement is gone: P2's fork becomes
provably unreachable, P3's `LEVEL_BANNER_Y` gets its single reader, and P4 changes a spawn the player
can finally see. Nothing in P2, P3 or P4 makes P1 easier, and running any of them first would mean
editing code P1 then deletes.

P0 runs first because it touches comments in `nextWave()` that P1 reads. ⛔ **Paul kept it as its own
phase at review** rather than folding its five items into P5's doc sweep — P5 already re-measures ~35
GDD §0 rows and rolls `STATUS.md`, and the tree is worth cleaning before P1's surgery.

---

## P0 — Five stale comments

**Model:** Sonnet 5 · **Effort:** Medium · **ultrathink:** no · **Build byte:** comments only

**Scope (§9):** the four stale comments `STATUS.md` already lists, plus the fifth §7.1 found.

1. `orbital-overhaul.html:99` — stale `% 15` comment.
2. `scratchpad/test-f9.js:11` — the header's `% 15`; its assertions already use 16 correctly.
3. The `settings` object's comment claiming `voiceStyle`/`captions` are "NOT persisted yet (later
   phase)" — CS011 P3 shipped both.
4. `orbital-overhaul.html:54` — still calls `RAMP_WAVES` "the single knob" for difficulty; CS024 P4
   retired the ramp and renamed the constant.
5. ⛔ **NEW (§7.1):** `nextWave()`'s comment near line 10193 still describes the retired CS021/CS022
   archetype cadence — *"up at every 3rd level and back down at the level after, 42 times in a
   63-level run."* CS024 P1 removed the orbit levels. It is what made `CS043-KICKOFF.md` Q1 wrong.
   Correct it to what `worldSizeFor()` actually does: one boundary, one resize per run at the default
   `earlyWorldLevels`, none at 0.

⛔ **Comments only. Not one byte of executable code changes.** The phase's test is a `_phase-ref.js`
pin proving exactly that against the literal parent SHA.

<details><summary><b>Copy-paste prompt — P0</b></summary>

```
Read CLAUDE.md, then STATUS.md, then PLANNED-FEATURES-CS043.md §7.1 and §9, then
IMPLEMENTATION-PHASES-CS043.md's P0 section. Build only P0.

Fix the five stale comments P0 lists. Comments only — not one byte of executable code
changes.

Deliver scratchpad/test-cs043-p0.js: a _phase-ref.js phase-local pin against your own
parent SHA as a LITERAL (never HEAD) proving the extracted script is unchanged once
comments are stripped, plus assertions that each of the five stale strings is gone.
Use _harness.js. Remember execSource() is the character scanner that strips comments —
the two-regex idiom is not safe (CLAUDE.md, Test rules).

Run node scratchpad/run-all.js before committing; non-zero exit means not done.
Commit on main with the code and any doc updates in the same commit. Never push.
```
</details>

---

## P1 — ⛔ The deletion

**Model:** Opus 5 · **Effort:** XHigh · **ultrathink:** yes · **Build byte:** yes

**Scope:** §1 in full — §1.1's deletion table, §1.2's latch change, §1.3's `tickCeremony()` trim,
§1.4's consequence.

**The three traps, named so the phase does not have to find them:**

1. ⛔ **The achievement block stays at the latch and stays ABOVE the new `nextWave()` call** (§1.2). It
   reads `game.wave` as the *completed* wave. Getting this wrong silently moves three shipped
   achievement thresholds and no test the phase writes by instinct would catch it.
2. ⛔ **Both input handlers or neither** (CS030 P4). The keyboard branch and the gamepad branch are
   ~90 lines apart and a phase that deletes one and not the other leaves a controller player pressing
   A at a `levelDoneActive()` that no longer exists.
3. ⛔ **`CEREMONY_ANNOUNCE_OUT` shares its declaration line with two survivors** (§1.1). Edit the line;
   do not delete it.

**And two rules that survive the code they were written for:**

- ⛔ **`nextWave()` still must not zero the level-end fields** (§6). Two of the five names its comment
  lists cease to exist. Edit the comment down to the three that remain; **do not weaken the rule while
  editing it.**
- ⛔ **`tickLevelBanner()` survives, loses one of its two callers, and keeps its `game.levelEndSafe`
  clause and its crossing one-shot** (§6). Its "must never run twice in a frame" hazard retires —
  say so in the header rather than dropping the warning silently.

**Test files (§6.1):** delete `test-cs036-p1.js`, `test-cs036-p2.js`, `test-cs036-p3.js`. ⛔ **Read all
three first for assertions whose subject SURVIVES** — the grace arm, the banner tick, the voice
drain's placement at the end of the playing body, `resetMenuNav()`'s other callers — and carry every
such assertion into `test-cs043-p1.js`. **Report what you carried.** Edit the ~18 files that reference
the deleted names incidentally.

<details><summary><b>Copy-paste prompt — P1</b></summary>

```
Read CLAUDE.md, then STATUS.md, then PLANNED-FEATURES-CS043.md (all of it), then
IMPLEMENTATION-PHASES-CS043.md's P1 section. Read GDD §0 and §1, then §2.20.1, §2.20,
§2.7, §2.9, §3. and §3.1. Build only P1.

Delete the level-end freeze and the "Level N Complete" announcement, per spec §1. The
wave-clear latch calls nextWave() directly; its achievement block stays at the latch and
stays ABOVE that call. Both input handlers or neither. Update GDD §2.20.1 (most of it
describes machinery you are deleting), §2.7's wave-advance bullet, and GDD §3's rows for
update() and draw().

Delete scratchpad/test-cs036-p1.js, -p2.js and -p3.js. FIRST read all three for
assertions whose subject SURVIVES this deletion and carry those into your own test file.
Report what you carried and what you dropped.

Deliver scratchpad/test-cs043-p1.js using _harness.js. Drive the real code: real
startGame / nextWave / update(1/60) / draw. Include a phase-local pin via _phase-ref.js
against your own parent SHA as a LITERAL, never HEAD; skip loudly if git history is
unavailable. Assert the field does NOT stop on a wave clear — drive a real clear and show
entities still moving on the next frame.

Run node scratchpad/run-all.js before committing; non-zero exit means not done.
test-cs035-p3.js §F and test-f6.js §F are documented unseeded flakes — rerun before
treating either as a regression. Commit on main, code and docs in the same commit. Never
push.

ultrathink
```
</details>

---

## P2 — The celebration panel becomes game-over-only

**Model:** Opus 5 · **Effort:** High · **ultrathink:** yes · **Build byte:** yes

**Scope:** §2 in full. `dismissCelebration()`'s `"wave"` fork, the `resume` field at all three sites
that carry it, and `drawCelebration()`'s `resume`-derived sub-line.

⛔ **Delete the fork whole, or not at all — never half.** §2 lists the four edits that make "whole."

⚠ **`celebrationOut.wave` STAYS** (§2). It is correct as written and there is no reason to make the
ghost read `game.wave` live again.

⛔ **`game.pendingAch` now spans a whole run.** Do not add a wave stamp to tidy the ordering (CS030
§0.4). Do assert the panel still scrolls a long list — that is the case this phase makes common.

**Headers are rewritten in place, not deleted.** The two-call-site reasoning on `dismissCelebration()`,
`drawCelebration()` and `killShip()`'s panel open is the historical record of why the panel is shaped
as it is; it says "there used to be two, and here is why there is now one."

<details><summary><b>Copy-paste prompt — P2</b></summary>

```
Read CLAUDE.md, then STATUS.md, then PLANNED-FEATURES-CS043.md §2 and §6, then
IMPLEMENTATION-PHASES-CS043.md's P2 section. Read GDD §0 and §1, then §2.20 and §2.17.
Build only P2.

Make the achievement celebration panel game-over-only: delete dismissCelebration()'s
unreachable "wave" fork and the `resume` field at all three sites that carry it, per
spec §2. Rewrite the affected headers in place — do not delete their two-call-site
reasoning. Update GDD §2.20.

Deliver scratchpad/test-cs043-p2.js using _harness.js, driving the real code. Assert the
panel opens at killShip() and at no other site, and that a long pendingAch list still
scrolls. Phase-local pins use _phase-ref.js with your own parent SHA as a LITERAL, never
HEAD; skip loudly if git history is unavailable.

Run node scratchpad/run-all.js before committing; non-zero exit means not done. Commit on
main, code and docs in the same commit. Never push.

ultrathink
```
</details>

---

## P3 — Banner position, grace retune, and the pulse

**Model:** Opus 5 · **Effort:** High · **ultrathink:** yes · **Build byte:** yes

**Scope:** §3 and §4. Three changes, one of them fork-gated.

1. **`LEVEL_BANNER_Y` 24 → -120** (§3). One edit — the registry row reads `def: LEVEL_BANNER_Y`.
2. **`DEBUG.levelEndGrace` `def` 3.00 → 1.25** (§4.2). Live protection 5.2 s → 3.45 s, which is Paul's
   "about 3.5 s."
3. **FORK-CS043-A** (§4.3) — the pulse spans the whole window. ⛔ **RESOLVED that way at review; make
   this change.** It reverses FORK-CS036-D → D1's conclusion while keeping its reasoning, so the
   header you edit says that rather than reading as a second re-decision.

**The fork's trap:** the accumulator's ramp cannot simply follow the condition.
`graceFrac` is 1 whenever `levelEndGraceT` is 0, so the banner phase would resolve to
`levelEndGracePulseEnd` — the fastest period, exactly backwards. Hold the banner phase at
`levelEndFade` and keep the ramp spanning the grace alone.

⛔ **`blink` keeps `!levelEndSafe`.** `pulsing` and `blink` become textually equal and must not be
collapsed into one variable or one name — they answer two different questions and the comment block
saying so is edited, not deleted.

<details><summary><b>Copy-paste prompt — P3</b></summary>

```
Read CLAUDE.md, then STATUS.md, then PLANNED-FEATURES-CS043.md §3, §4 and §8, then
IMPLEMENTATION-PHASES-CS043.md's P3 section. Read GDD §0 and §1, then §2.20.1, §2.1 and
§2.19. Build only P3.

Make spec §3's banner move and §4.2's grace retune. Make §4.3's pulse change — FORK-CS043-A
resolved as "span the whole window". Mind §4.3's ramp trap and keep `blink` and `pulsing`
as two named questions, textually equal but never collapsed.
Update GDD §2.20.1 and §2.19.

Deliver scratchpad/test-cs043-p3.js using _harness.js, driving the real code. Assert the
banner's absolute y, the total live protection window measured by running real frames from
a real wave clear, and that the pulse period at the start of the banner phase equals the
resting period, not the grace-end one. Assert only what this phase
owns: registry bounds for the rows it touches, never a registry total. Phase-local pins
use _phase-ref.js with your own parent SHA as a LITERAL, never HEAD.

Run node scratchpad/run-all.js before committing; non-zero exit means not done. Commit on
main, code and docs in the same commit. Never push.

ultrathink
```
</details>

---

## P4 — The live spawn floor

**Model:** Sonnet 5 · **Effort:** Medium · **ultrathink:** no · **Build byte:** yes

**Scope:** §5. `SPAWN_MIN_DIST` 220 → 380, plus a `DEBUG_VARS` row so it can be A/B'd. **Registry 117
→ 118.**

- ⛔ **One constant, one row, no branch** (§5.2). Wave 1 uses the same floor as every other level.
- ⛔ **Not a lever.** `LEVERS` is the wave-driven odometer; this is a fixed placement floor, in the
  same category as `SPAWN_MAX_DIST` and `DOCK_MAX_DIST` beside it.
- ⛔ **The total goes in `scratchpad/test-registry.js` and nowhere else.** ⚠ `test-cs029-p4.js` §B and
  `test-cs038-p5.js` §A state a total as a literal against that rule (`STATUS.md`, carried) —
  repoint both 117 → 118 as every earlier phase has. Rewriting them parent-relative is a refactor and
  is **out of scope.**
- ⚠ **GDD §2.7's "220–1100 px" is stale independently of this change** (§5.2). Correct it to the real
  band in the same edit and say in the commit that the 1100 was pre-existing.

<details><summary><b>Copy-paste prompt — P4</b></summary>

```
Read CLAUDE.md, then STATUS.md, then PLANNED-FEATURES-CS043.md §5 and §6, then
IMPLEMENTATION-PHASES-CS043.md's P4 section. Read GDD §0 and §1, then §2.11, §2.7 and
§2.19. Build only P4.

Raise SPAWN_MIN_DIST 220 -> 380 and give it a DEBUG_VARS row, per spec §5. It is not a
lever. Update scratchpad/test-registry.js for the new total, and repoint the two literal
totals in test-cs029-p4.js §B and test-cs038-p5.js §A. Correct GDD §2.7's stale
"220-1100 px" ring figure to the real band and update §2.11 and §2.19.

Deliver scratchpad/test-cs043-p4.js using _harness.js, driving real nextWave() /
spawnFieldSatellites() calls: assert every spawned satellite lands at least the floor from
the ship, wrap-aware (use dist2 / shortDelta, never Math.hypot on raw coordinates — the
world is a torus). Assert the row's bounds, never the registry total; that lives in
test-registry.js. Seed with installSeed(n) from _seeded-random.js ABOVE everything,
unscoped, before the first buildGame(). Phase-local pins use _phase-ref.js with your own
parent SHA as a LITERAL, never HEAD.

Run node scratchpad/run-all.js before committing; non-zero exit means not done. Commit on
main, code and docs in the same commit. Never push.
```
</details>

---

## ⛔ GATE A — Blocking playtest. No session.

The whole changeset exists to change how the level seam **feels**, and nothing before this point has
been played. P5 does not start until Paul has answered.

⛔ **Clear "Overrides Applied" in the debug panel before answering anything numeric.** FLAG-CS036-a:
any installation that has ever saved settings is not running shipped defaults.

**The headline question**

- **A1.** Does the level boundary still feel scary — and is it *less* scary than the pause was? This
  is the changeset's only real success criterion.

**The new hazards, in the order they are most likely to bite**

- **A2. (§5)** Satellites now arrive 380–640 px out while you are flying. Does that read as the field
  refilling, or as things appearing on top of you? If it still reads badly, the floor is one registry
  row. ⚠ **Also watch the field's shape** — the band narrowed from 420 px wide to 260, so the new
  wave may read as a ring rather than a scatter.
- **A3. (§7.1, Q1)** **Once per run, at the level 5 → 6 boundary,** the world grows and your ship is
  teleported to the centre of it while every other body slides along its own bearing. This is the one
  thing that was shipped live without a mitigation. Does it read as a jolt, a glitch, or nothing at
  all?
- **A4.** The Recycle dock relocates at every boundary, live now. Do you lose track of it?

**Numbers, by outcome (§4)**

- **A5.** After a clear you are protected for **~3.45 s**, all of it real play. Too long, too short, or
  right? Answer as a feeling; P5 turns it into `levelEndGrace`.
- **A6.** The "Level N" banner now sits a third of the way down instead of centred. Out of the way
  enough? Still readable?
- **A7. (FORK-CS043-A, shipped)** The ship pulses for the whole protected window, speeding up as it
  runs out, instead of only for the last stretch. Does the pulse tell you when you are safe, or is it
  on for so long that it stops meaning anything?

**The thing that got quieter**

- **A8. (§1.4, §2)** An unlock in play is now marked only by the toast and the triad; the panel waits
  for game over. Paul answered ahead of the playtest that this is enough — **A8 is the check on that
  answer, not a re-ask.** Did you notice your unlocks?
- **A9.** A long run now opens **one** panel at game over listing every unlock of the run. Does that
  land as a payoff or as a wall of text?

**Carried from CS042, still open and now cheap to answer in the same session**

- **A10.** Does the dashed scoop read as an energy field? (`SCOOP_FIELD_DASH`/`_GAP`, both 6.)
- **A11.** Does the dock apron read as pressure or as litter? A long session against CS035 P2's
  lockout — and CS043's live boundaries make long sessions the thing you are already doing.

---

## P5 — Closing

**Model:** Sonnet 5 · **Effort:** High · **ultrathink:** yes · **Build byte:** yes

**Scope, in order:**

1. **GATE A's retunes.** A5 → `levelEndGrace`; A2 → the spawn floor row; A6 → `LEVEL_BANNER_Y`; A7 →
   revert the pulse to the grace if the wider window did not land. All are single-value edits by construction. ⛔ **A retune that
   is not a single value is not a retune** — surface it as CS044 rather than building it here.
2. ⛔ **`GAME_VERSION` → the literal `1.0.0.43`.** Not "the next integer." §9.
3. **`DECISIONS.md`** — the CS036/CS042-P5 reversal (§0), recorded as Paul's, so a future session
   cannot read the deletion as a tidy-up mistake.
4. **`log/CS043.md`** — the narrative for every phase and the gate, the same reversal entry, and the
   changeset's `## GDD version history` section. ⛔ There is no central changelog.
5. **GDD sweep**, then ⛔ **re-measure every §0 size row** against the finished GDD
   (`scratchpad/gdd-sizes.py --check`) — §2.20.1 alone loses most of its 17.6 KB — and ⛔ **re-read the
   GDD's own build stamp on line 3** (version / registry / `LEVERS`).
6. **`STATUS.md`** — roll the whole of CS042's into `log/CS042.md`'s place in history, reset to CS043,
   carry every still-live Known issue forward. ⛔ **Measure `CLAUDE.md` and report the delta** (§9):
   CS043 deletes rules as well as adding them and should come out ahead of the 50 KB ceiling, but
   FLAG-CS041-b stays open until Paul rules on it.
7. **Archive both planning docs** to `archive/`.
8. ⛔ **Assert zero skips.** A closing phase does.

⚠ **`CS042-GATE-A.md` stays at the repo root.** Three CS042 phases are pinned byte-for-byte against it
and those pins must keep resolving. It is not archived by this changeset.

<details><summary><b>Copy-paste prompt — P5</b></summary>

```
Read CLAUDE.md, then STATUS.md, then PLANNED-FEATURES-CS043.md (all of it), then
IMPLEMENTATION-PHASES-CS043.md's GATE A and P5 sections. Read GDD §0 and §1, then every
§2.x/§3.x this changeset edited. Build only P5.

Close CS043: apply GATE A's retunes (single-value edits only — surface anything larger as
CS044), bump GAME_VERSION to the literal 1.0.0.43, write DECISIONS.md's reversal entry and
log/CS043.md, sweep the GDD, re-measure every §0 size row with
scratchpad/gdd-sizes.py --check, re-read the GDD's build stamp on line 3, roll STATUS.md,
and archive both planning docs. Leave CS042-GATE-A.md at the repo root.

Measure CLAUDE.md and report the byte delta against the 50 KB ceiling. A phase may not
silently drop a rule to fit nor silently valve an under-size section; FLAG-CS041-b stays
open until Paul rules on it.

Deliver scratchpad/test-cs043-p5.js using _harness.js. Assert the version literal, the
retuned values, and ZERO SKIPS across the suite. At the version bump, any phase-local
version pin flips to its standing mirror image (!== "1.0.0.N") — it is NOT re-pointed to a
new literal; the small set of live pins that genuinely track HEAD's version ARE re-pointed.

Run node scratchpad/run-all.js before committing; non-zero exit means not done. Commit on
main, code and docs in the same commit. Never push.

ultrathink
```
</details>

---

## Risks this changeset carries into its phases

- ⛔ **P1 is a deletion, and a deletion's failure mode is silence.** The suite cannot fail for code
  that no longer exists. The mitigation is §6.1's rule — read the three dying test files for
  assertions whose subject survives, carry them, and report what was carried — plus P1's own positive
  assertion that the field keeps moving through a wave clear.
- ⚠ **Twenty-one suite files reference the deleted names.** Eighteen are incidental, but any of them
  can turn a green phase red late. Expect P1's test run to be the changeset's longest.
- ⚠ **`execSync`'s default 1 MiB `maxBuffer` is a live tripwire and the build is 1,081,177 bytes**
  (`STATUS.md`). Any new suite site shelling out `git show <sha>:orbital-overhaul.html` needs the
  standing 64 MB `maxBuffer`. Nothing sweeps for the next one. **CS043 shrinks the file**, which moves
  the tripwire further off — it does not remove it.
- ⚠ **Four moving-`HEAD` pins survive** (`STATUS.md`). None is in CS043's path: `test-cs024-p6.js` §H
  TRAP 2 diffs `damageShip`, which no phase here touches. **If it goes red, a phase is out of scope.**
- ⚠ **A fixed-ref pin reaching back past CS029 has a latent rename-threshold failure** (`STATUS.md`).
  Every CS043 pin is against a `2532b16`-or-later parent, so none is exposed.
