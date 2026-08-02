# IMPLEMENTATION PHASES — CS020

Spec: `PLANNED-FEATURES-CS020.md`. Base build: CS019 P2, `GAME_VERSION "1.0.0.19"`, commit `09d443f`.
Target: `"1.0.0.20"`, bumped in **P2**.

**How to use this doc.** One Claude Code session per phase, one commit per phase.
Set the model with `/model` before pasting. Paste the pre-session preamble, then
the phase's prompt, verbatim. Paul commits and pushes; Claude Code never pushes.

**Sequence.** P1 → gate (**passed**) → **P1b** → gate → P2. P1 and P1b both ship
with no version bump and no GDD edit, so each goes straight into Paul's hands. P2
runs last and owns version + docs.

**Line numbers are estimates against `09d443f` — they drift, and P1 has already
moved them. Every prompt instructs a re-grep by symbol before editing.**

---

## Fork ledger

| Fork | Resolution |
|---|---|
| **FORK-CS020-A** | ✅ **Per-node `towed` tag**, set at capture. Not a count snapshot — the chain is LIFO. |
| **FORK-CS020-B** | ✅ **Incidentals count toward nothing** — not `stats.delivered`, not `lifetime.delivered`, not `bestCombo`, not `deliveryCount`. |
| **FORK-CS020-C** | ✅ **An incidental pays flat `DOCK_BASE_SCORE` (50).** No new constant. |
| **FORK-CS020-D** | ✅ **`DOCK_OFFLOAD_INTERVAL` untouched** at 0.05 s. |
| **FORK-CS020-E** | ✅ **One effort = one chain, delivered in one go.** Terminated by a *towed hook*, not by moving; plus a grace window, knob in **ms**. |
| **FLAG-CS020-a/b** | ✅ Incidentals touch neither `pacifistStreak` nor `lifetime.deliveryScore`. |
| **FLAG-CS020-c/d/e/f** | ✅ **All cleared at the P1 gate.** No `DOCK_INCIDENTAL_SCORE`, no floater change, no audio change, no tag grace period. |
| **FLAG-CS020-g** | ✅ `DOCK_COMBO_GRACE` ships at **4.0 s / 4000 ms**, not 2000 — spec §2.4 shows 2 s fails the case it exists for. Retune at the P1b gate. |
| **FLAG-CS020-h** | ✅ The window runs whenever outside the ring, regardless of chain contents. |
| **FLAG-CS020-i** | ⛔ No HUD combo readout. Real gap, **out of scope**, CS021. |

---

## Phase / model assignments

| Phase | Model | Effort | Why |
|---|---|---|---|
| **P1** | Opus 4.8 | xhigh + thinking | ✅ Shipped. |
| **P1b** | Opus 4.8 | xhigh + thinking | Deletes a reset and replaces it with two cooperating rules; the `deliveryCount ≤ cargoMax` guarantee has to be *proved by test*, and a wrong tag/reset interaction silently reopens the P1 exploit. Small diff, high reasoning density. |
| **P2** | Sonnet 5 | high | Retune, version bump, doc sweep. Mechanical. |

---

## Pre-session preamble (paste **before** each phase prompt)

```
Session setup for CS020.

READ WHOLE, first, before any code:
  CLAUDE.md
  STATUS.md
  PLANNED-FEATURES-CS020.md
  IMPLEMENTATION-PHASES-CS020.md

GREP ONLY, never read whole (it is ~7,700 lines):
  asteroids-deluxe.html
  ORBITAL-OVERHAUL-GDD.md   (P2 only; grep to the section, then read that section)

DO NOT READ, DO NOT OPEN, AT ALL:
  GDD-VERSION-HISTORY.md    (P2 opens it ONLY to append, never to read for context)
  archive/
  PLANNED-FEATURES-CS019.md, IMPLEMENTATION-PHASES-CS019.md
  DIFFICULTY-LEVERS.md      (CS020 does not touch it — see spec §6)
  tools/                    (no voice work in this changeset)

Anchors in the phase prompt are ESTIMATES and P1 has already moved them. Re-grep
every one by SYMBOL NAME before editing. Never navigate by line number.

If a genuine design decision surfaces that PLANNED-FEATURES-CS020.md does not
cover, STOP and surface it. Do not invent design and do not quietly pick an
interpretation.
```

---

## P1 — the towed/incidental split ✅ SHIPPED

Spec §4. Committed and playtested. Gate result: FLAG-c, -d, -e and -f all cleared;
the parking exploit is dead in play. The gate also surfaced the §2 defect, which
is what P1b exists for.

---

## P1b — the one-effort rule

**Model: Opus 4.8, xhigh, thinking on.**
**No `GAME_VERSION` bump, no GDD edit, no `DIFFICULTY-LEVERS.md` edit. P2 owns those.**

```
CS020 Phase 1b — make a delivery run ONE EFFORT: one chain, delivered in one go.

ultrathink

THE BUG. game.deliveryCount is reset by DISTANCE — the dock block's else branch
zeroes it once the ship passes dock.radius + 40. So a ship that skirts the dock,
delivers part of its load and swings back out loses the whole run even though the
SAME chain is still in tow. Measured at 09d443f: an 8-piece load delivered as
3-then-5 scores 725 instead of 1100, and at level 12 a full 24-piece load
delivered across one skirt reaches 21, so the Super Mega Delivery NEVER FIRES.
The cliff is exact and unhysteretic: exit to radius+39 keeps the run, radius+41
destroys it. This predates CS020 — P1 did not cause it.

Read PLANNED-FEATURES-CS020.md §2 and §5 in full before touching anything.

BEFORE ANY EDIT: independently reproduce. Write a throwaway probe that seeds an
8-node chain, holds the ship at dock.radius-20 for 12 frames, holds it at
dock.radius+200 for 30 frames, then returns for 40 frames, and prints
deliveryCount and score. Confirm 5 / 725 against a clean pass of 8 / 1100. Then
do the same at level 12 with a 24-node chain and confirm the SMD does not fire.
If the numbers disagree, STOP and report — do not proceed on a diagnosis you
could not reproduce.

WHY THE OBVIOUS FIX IS WRONG. Swapping the reset for a grace timer and cancelling
it on re-entry REOPENS THE P1 EXPLOIT at a wider radius. MAGNET_RANGE is 380px
and the ring is 128px from dock center, so a player hovering at 130px is OUTSIDE
the ring (their pickups tag `towed`) while reaching garbage out to 510px. Fill,
dip inside 98px, offload at escalating rates, drift out, and the timer carries the
combo across trips without bound. THE TIMER CANNOT BE THE SAFETY MECHANISM.

TWO COOPERATING RULES. Neither works alone.

RE-GREP THESE BY SYMBOL FIRST:
  the pickup capture gate + the `inRing` const P1 added
  the dock block            `--- Recycling dock offload ---`
  the else branch           `game.offloadTimer = 0;`
  the distance reset        `dock.radius + 40`  (or DOCK_NEIGHBORHOOD_PAD post-P1)
  DOCK_NEIGHBORHOOD_PAD, DEBUG_VARS, the `{ header: "CHAIN GUARD" }` entry
  the game object literal   `deliveryCount: 0, offloadTimer: 0,`
  startGame's reset of the same
  autoShieldRegenPause / garbageAttractDelay   (the ms + toNative idiom to copy)

RULE 1 — THE HOOK RESET. This is the one that makes the counter safe. In the
pickup capture gate, beside the `towed` tag P1 added, using the SAME `inRing`
const (do not recompute it, do not use a different radius):

  // CS020 P1b: gathering again starts a NEW effort. An INCIDENTAL never does this —
  // it is neutral to the counter in both directions (FORK-CS020-B).
  if (!inRing) game.deliveryCount = 0;

THE `!inRing` GUARD IS LOAD-BEARING. Resetting on EVERY hook would mean a magnet
grab at the dock kills a player's own run mid-offload — the exact unfairness this
phase exists to remove.

This yields a guarantee the build has never had, and you must ASSERT it, not
assume it: between any two resets only nodes already in the chain can be counted,
and the pickup gate bounds the chain at game.cargoMax, therefore
deliveryCount <= cargoMax STRUCTURALLY. Maxed Out at 24 becomes reachable only at
level 12+ because it CANNOT be reached otherwise.

RULE 2 — THE GRACE WINDOW. Delete the distance-based reset entirely. Add:

  const DOCK_COMBO_GRACE = 4.0;  // sec a delivery run survives outside the dock neighbourhood

  (beside DOCK_BASE_SCORE / DOCK_BONUS_STEP / DOCK_NEIGHBORHOOD_PAD)

New run state `comboGrace: 0` in the game object literal beside
`deliveryCount: 0, offloadTimer: 0,` and zeroed in startGame alongside them.

HOIST the window logic to the TOP of the `if (game.dock) {` block, so it evaluates
every frame independent of the offload branch — NOT inside the else, or it will
not run while the ship is actively delivering:

  const npad = game.dock.radius + DOCK_NEIGHBORHOOD_PAD;
  if (!game.ship.dead && dist2(game.ship, game.dock) > npad * npad) {
    game.comboGrace -= dt;
    if (game.comboGrace <= 0) game.deliveryCount = 0;
  } else {
    game.comboGrace = DEBUG.dockComboGrace;   // inside the ring: run safe, window re-armed
  }

The offload block's else branch is then only `game.offloadTimer = 0;`.

RE-ARM AT THE RING (dock.radius + DOCK_NEIGHBORHOOD_PAD), NOT the offload radius
(+10). Once back inside the neighbourhood the run is safe indefinitely and the
player can take their time closing the last 30px. Loitering there is harmless —
pickups are incidentals, nothing advances.

THE DEBUG KNOB. The `unit: "ms"` + toNative idiom ALREADY EXISTS
(autoShieldRegenPause, garbageAttractDelay). Copy it exactly. Add a new section
header after CHAIN GUARD:

  { header: "DELIVERY" },
  { id: "dockComboGrace", label: "Delivery one-effort window", unit: "ms",
    def: DOCK_COMBO_GRACE * 1000, min: 0, max: 10000, step: 100, toNative: v => v / 1000 },

DEBUG_VARS count 33 -> 34. DOCK_COMBO_GRACE stays in place as the documented
shipped value (CS015 P5 registry idiom). Persistence is the EXISTING additive
afd_settings_v1.debug path with known-value-else-default validation. NO SCHEMA
BUMP — afd_settings_v1 / afd_scores_v1 / afd_achievements_v2 are frozen keys.

WHY 4.0 s AND NOT 2.0. Simulating Ship.update's real integrator, a 180-degree turn
at SHIP_TURN 4.2 costs 0.75 s before thrust can even begin; a sharp pilot exiting
at 100 px/s with a light load is outside for 1.9-2.1 s, and a normal pilot exiting
at 200-300 px/s with a real load is outside for 2.8-3.8 s. A 2,000 ms window would
fail almost every real skirt — the exact case this phase exists to fix. Since
Rule 1 is what bounds the counter, a generous window costs nothing. Paul retunes
at the gate; do not second-guess the default here.

DO NOT: add a deliveryCount clamp, gate the SMD trigger separately, touch the
CS018 P8 reward latches, Heavy Hauler ===12, Maxed Out ===CARGO_CAP_MAX,
superMegaDelivery(), breakChain, scatterChain (both still zero the counter and
both are correct), the `towed` tag radius, DOCK_OFFLOAD_INTERVAL, or the pickup
gate's cargoMax test. Every consumer is already correct once the counter is right.

NEW TEST: scratchpad/test-cs020-p1b.js. Drive the REAL startGame / update /
pickup gate / offload path. Reimplement nothing. Cover
PLANNED-FEATURES-CS020.md §8.2 items 1-13. The ones that carry the phase:

  - THE BUG CLOSED: 8 towed, deliver 3, out to 200px for 1 s, return -> 8 / 1100,
    identical to a clean pass. Pin the pre-fix 5 / 725 against the FIXED SHA
    09d443f as a permanent red control. A fixed SHA, never HEAD.
  - THE LEVEL-12 HEADLINE: 24 load, one skirt inside the window -> reaches 24,
    SMD FIRES (spy it). Pre-fix control: 21, no SMD.
  - THE CAP: across a long randomized session under a SEEDED RNG (hooks at random
    distances, random excursions, random offloads), assert
    deliveryCount <= game.cargoMax ON EVERY FRAME. This is the guarantee; assert
    it, do not argue it.
  - THE 130px FARM IS DEAD: hover just outside the ring, hook to capacity, dip
    inside 98px, offload, repeat x5 all within the grace window -> peak combo
    never exceeds cargoMax, total score equals five honest full loads.
  - THE WINDOW IS THE KNOB: drive DEBUG.dockComboGrace, not the constant. At 0,
    expiry is immediate; at 10 s, a 9-second excursion preserves the run.
  - P1 NOT REGRESSED: re-run the P1 park scenario — still bounded, zero latches,
    no SMD.

MUTATION-TEST THE SUITE. Each must fail it on a BEHAVIOURAL assertion, not merely
a source pin: dropping the hook reset; resetting on every hook including
incidentals; re-arming at the offload radius instead of the ring; making the grace
timer the only guard (must fail the 130px farm test); toNative returning v instead
of v/1000. Report which assertion caught each. If dropping the hook reset leaves
the cap test green, THE TEST IS WRONG — fix the test.

REPOINTING. The P1 suite pinned DOCK_NEIGHBORHOOD_PAD at ONE reader; it now has
two. Repoint to the mirror-image claim, never weaken, with a "REPOINTED BY CS020
P1b" note. No existing test hardcodes radius+40, so the surface is small. Baseline
sweep at the P1 commit BEFORE editing; diff any failure against it before calling
it a regression.

TRAPS:
  1. GAME_VERSION stays "1.0.0.19". P2 bumps it. Do not touch it or any version pin.
  2. Do not edit the GDD, GDD-VERSION-HISTORY.md, or DIFFICULTY-LEVERS.md.
  3. returnToDefaults() resets BINDINGS ONLY — it must not touch dockComboGrace.
     Assert this.
  4. Delete the diagnostic probe before committing. It is not a test.

REPORT, in STATUS.md and in your reply:
  - the probe's pre-fix and post-fix numbers for both scenarios
  - the baseline vs post-phase failure count, per file
  - which mutants were caught by which assertion
  - the observed maximum deliveryCount across the randomized cap test
  - anything that surprised you

Commit (do not push):
  CS020 P1b: a delivery run is one effort — towed-hook reset plus a tunable grace window
```

---

## ⛔ PLAYTEST GATE — between P1b and P2

Four questions:

1. **FLAG-CS020-g — the window.** Skirt the dock at speed with a real load, several
   times, at different exit velocities. Does 4,000 ms cover a normal overshoot-and-
   return? Drag `Delivery one-effort window` in the debug panel until it feels
   right and report the number. This is the one value P2 exists to carry.
2. **The one-effort rule in play.** Does losing the run when you *gather again*
   mid-delivery (spec §5.4) ever read as unfair, or is it invisible?
3. **The cap.** Does the combo ceiling now reading as exactly the payload capacity
   change how a full 24-load feels at level 12 — better, or anticlimactic?
4. **P1 still good.** Does the parking behaviour still feel right after P1b, or did
   the one-effort rule make in-ring cleanup feel pointless?

**"No change" is a complete and useful answer.** P2's standing rule: a line saying
no change means nothing there gets touched.

---

## P2 — retune, version bump, doc sweep

**Model: Sonnet 5, high.** No new logic.

```
CS020 Phase 2 — the closing phase. Retune from playtest, bump the version, sweep
the docs. NO NEW MECHANICS.

(1) RETUNE from Paul's gate answers only. If a line says "no change", change
    nothing there — do not tidy, do not improve while you are in here. Realistically
    this is one number: DOCK_COMBO_GRACE and the matching DEBUG_VARS `def`. THEY
    MUST MOVE TOGETHER — def is DOCK_COMBO_GRACE * 1000, and a mismatch means the
    panel shows a default the code does not use. Assert they agree.

(2) GAME_VERSION "1.0.0.19" -> "1.0.0.20". GREP THE WHOLE REPO for the old literal
    rather than trusting any file list in this doc. This has caught an extra pin in
    every round that ran it: CS016 P5 found three where the prompt named two,
    CS017 P7 found four, CS019 P2 found seven — and CS020 has added two test files
    since. Bump both the console.log label and the assert message string in each
    live pin. Leave HEADER-COMMENT narratives alone.

    Repoint, do not weaken, any test asserting GAME_VERSION is "unchanged this
    phase (bumps in P2)" — including test-cs020-p1.js's and test-cs020-p1b.js's
    own. The established treatment is the mirror image: assert !== the old literal.

(3) GDD. Grep to each section, read that section, edit in place.
    - §2.10: the delivery run as ONE EFFORT. What earns the combo; what an
      incidental pays; the LIFO reasoning for tagging at capture rather than
      snapshotting a count; the towed-hook terminator; the grace window; and the
      deliveryCount <= cargoMax guarantee that falls out of it.
    - §2.10.2: the payload curve is now the HARD CEILING on the combo, and is
      load-bearing for the SMD and the CS018 P8 reward tiers.
    - §2.17: Maxed Out is a level-12+ achievement BY CONSTRUCTION; Recycling
      Magnate and Salvage King are no longer farmable at the dock.
    - §2.19: the Debug Options section gains the DELIVERY section and the
      one-effort knob (34 knobs).
    - Architecture Map: Constants gain DOCK_NEIGHBORHOOD_PAD and DOCK_COMBO_GRACE;
      run state gains comboGrace; the chain-node shape gains `towed`.
    - The top-of-file Current-build line. Every round-closing phase rewrites it
      (CS017 P7, CS018 P10, CS019 P2) — check one of those diffs for the shape.
    DESCRIBE SHIPPED BEHAVIOUR ONLY. Nothing from the gate lists that was not built
    enters the GDD — in particular NOT the HUD combo readout (FLAG-CS020-i, CS021).

(4) GDD-VERSION-HISTORY.md: ONE consolidated CS020 (P1 + P1b + P2) entry, appended.
    This is the only reason to open that file — do not read it for context. Note in
    passing, do not fix: CS018 still has no entry there (CS019 P2 found the gap and
    correctly left it). Not this changeset's job either.

(5) DIFFICULTY-LEVERS.md: DO NOT EDIT. dockComboGrace is a feel knob on a scoring
    rule, not a difficulty lever — it scales with nothing. Confirm by grep that
    nothing in it references the delivery combo, and say so in the report.

(6) ARCHIVE. Move PLANNED-FEATURES-CS019.md and IMPLEMENTATION-PHASES-CS019.md to
    archive/. Check first whether it has already been done — CS019 P2 found CS018's
    docs already moved by CS019 P1's own prerequisite step. If already there,
    verify and move nothing.

(7) FULL REGRESSION, run twice consecutively for determinism. Report file count,
    assertion count and failures. Diff any failure against the P1b baseline before
    calling it a regression.

Commit (do not push):
  CS020 P2: one-effort window retune, version 1.0.0.20, doc sweep
```

---

## Session-setup checklist

**Attach:** `asteroids-deluxe.html`, `ORBITAL-OVERHAUL-GDD.md`, `STATUS.md`,
`CLAUDE.md`, `PLANNED-FEATURES-CS020.md`, `IMPLEMENTATION-PHASES-CS020.md`.

**Do not attach:** `GDD-VERSION-HISTORY.md`, `archive/`, the CS019 planning docs,
`DIFFICULTY-LEVERS.md`, `tools/`.

**Before P1b:** commit the updated CS020 planning docs to repo root, so the P1b
session reads the §2 / §5 / §8.2 material rather than the P1-era version.

**Note:** `ultrathink` appears inside P1b's prompt text itself, not in a meta-note
— that is the only placement that takes effect in Claude Code.