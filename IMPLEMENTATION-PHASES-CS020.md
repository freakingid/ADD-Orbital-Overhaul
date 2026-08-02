# IMPLEMENTATION PHASES — CS020

Spec: `PLANNED-FEATURES-CS020.md`. Base build: CS019 P2, `GAME_VERSION "1.0.0.19"`, commit `09d443f`.
Target: `"1.0.0.20"`, bumped in **P2**.

**How to use this doc.** One Claude Code session per phase, one commit per phase.
Set the model with `/model` before pasting. Paste the pre-session preamble, then
the phase's prompt, verbatim. Paul commits and pushes; Claude Code never pushes.

**Deliberate sequencing.** P1 ships the whole behavioural change with **no
version bump and no GDD edit**, so it goes straight into Paul's hands for a
playtest. P2 runs *after* that playtest, folds in whatever it found, and does the
version + doc sweep. Don't run P2 until the playtest is done.

**Line numbers below are estimates taken against commit `09d443f` — they drift.
Every prompt instructs a re-grep by symbol before editing.**

---

## Fork ledger

| Fork | Resolution |
|---|---|
| **FORK-CS020-A** | ✅ **Per-node `towed` tag**, set at capture. Not a count snapshot — the chain is LIFO and a snapshot credits the wrong pieces. |
| **FORK-CS020-B** | ✅ **Incidentals count toward nothing** — not `stats.delivered`, not `lifetime.delivered`, not `bestCombo`, not `deliveryCount`. |
| **FORK-CS020-C** | ✅ **An incidental pays flat `DOCK_BASE_SCORE` (50).** No new constant. |
| **FORK-CS020-D** | ✅ **`DOCK_OFFLOAD_INTERVAL` untouched** at 0.05 s. |
| **FLAG-CS020-a** | ✅ Incidentals do not advance `pacifistStreak` (and do not break it). |
| **FLAG-CS020-b** | ✅ Incidental points do not enter `lifetime.deliveryScore`. |
| **FLAG-CS020-c** | ⏳ `REPAIR_MILESTONE` farming residual — **playtest question**, see the gate. |
| **FLAG-CS020-d** | ✅ Incidentals keep their `FloatText`. Look-call, playtest may revisit. |
| **FLAG-CS020-e** | ✅ Incidentals call `AudioSys.deliver(1)` — flat, not combo-pitched. |
| **FLAG-CS020-f** | ✅ No grace period for a straggler hooked on the way in. Playtest decides. |

---

## Phase / model assignments

| Phase | Model | Effort | Why |
|---|---|---|---|
| **P1** | Opus 4.8 | xhigh + thinking | The LIFO ordering property, the annulus reasoning, the `!== false` default across a 22-file seeding surface, and a mutation-tested suite. Small diff, high reasoning density. |
| **P2** | Sonnet 5 | high | Retune (if any), version bump, doc sweep. Mechanical. |

---

## Pre-session preamble (paste **before** each phase prompt)

```
Session setup for CS020.

READ WHOLE, first, before any code:
  CLAUDE.md
  STATUS.md
  PLANNED-FEATURES-CS020.md
  IMPLEMENTATION-PHASES-CS020.md

GREP ONLY, never read whole (it is ~7,670 lines):
  asteroids-deluxe.html
  ORBITAL-OVERHAUL-GDD.md   (P2 only; grep to the section, then read that section)

DO NOT READ, DO NOT OPEN, AT ALL:
  GDD-VERSION-HISTORY.md    (P2 opens it ONLY to append, never to read for context)
  archive/
  PLANNED-FEATURES-CS019.md, IMPLEMENTATION-PHASES-CS019.md
  DIFFICULTY-LEVERS.md      (CS020 does not touch it — see spec §4)
  tools/                    (no voice work in this changeset)

Anchors in the phase prompt are ESTIMATES against commit 09d443f. Re-grep every
one by SYMBOL NAME before editing. Never navigate by line number.

If a genuine design decision surfaces that PLANNED-FEATURES-CS020.md does not
cover, STOP and surface it. Do not invent design and do not quietly pick an
interpretation.
```

---

## P1 — the towed/incidental split

**Model: Opus 4.8, xhigh, thinking on.**
**Ships silent on version and docs: no `GAME_VERSION` bump, no GDD edit, no
`DIFFICULTY-LEVERS.md` edit. P2 owns all of those.**

```
CS020 Phase 1 — split dock deliveries into TOWED and INCIDENTAL.

ultrathink

THE BUG. A ship parked inside the recycling dock's neighbourhood never resets
game.deliveryCount, because the only reset in the offload block sits in the else
branch behind a distance test (dock.radius + 40). Garbage that wanders into a
parked ship therefore keeps feeding an unbounded combo whose per-canister award
is 50 + 25*(n-1). Measured at commit 09d443f: 60 seconds parked at level 1 yields
5,650,000 points from 600 canisters, versus 107,000 for 240 canisters of
legitimate level-12 play. It also fires the Super Mega Delivery at level 1, where
payloadSlots is 8 and a 24-piece tow is impossible. See PLANNED-FEATURES-CS020.md
§1 for the full measurement and §3 for the mechanism.

BEFORE ANY EDIT: independently reproduce the exploit. Write a throwaway probe
that parks a ship just inside the offload cutoff at level 1, feeds one fresh
Garbage piece every 6 frames, runs 3600 real update(1/60) frames, and prints
final score, deliveryCount, stats.delivered, and whether superMegaDelivery fired.
Confirm the numbers above before changing anything. If they disagree, STOP and
report — do not proceed on a diagnosis you could not reproduce.

RE-GREP THESE BY SYMBOL FIRST (estimates against 09d443f):
  the garbage-pickup capture gate  ~L6114   `game.chain.length < game.cargoMax`
  the single-piece push            ~L6131   `game.chain.push({`
  the clump-scoop push             ~L6149   `game.chain.push({`
  the dock-offload block           ~L6221   `--- Recycling dock offload ---`
  the pop                          ~L6227   `const node = game.chain.pop();`
  the combo reset                  ~L6295   `dock.radius + 40`
  Garbage.fromNode                          (confirm it reads only x, y, mass)
  VoiceSys.dockDelivery call site  ~L6288
  DOCK_BASE_SCORE / DOCK_BONUS_STEP / DOCK_OFFLOAD_INTERVAL

FIVE EDITS, all in asteroids-deluxe.html.

(1) Hoist the bare literal. Add, beside DOCK_BASE_SCORE / DOCK_BONUS_STEP:

      const DOCK_NEIGHBORHOOD_PAD = 40;

    with a comment saying it is px past dock.radius and that it defines the
    region in which the delivery combo survives. Repoint the existing combo-reset
    test to read it. After this edit there must be ZERO bare `dock.radius + 40`
    occurrences left in the file. The `+ 10` offload radius is a DIFFERENT number
    and stays exactly as it is — do not hoist it, do not unify them.

(2) Tag at capture. Inside the capture gate, ABOVE the pieces===1 / clump branch
    — the same placement the CS017 P5 bonus-canister award already uses, so one
    expression covers both push paths:

      const pad = game.dock ? game.dock.radius + DOCK_NEIGHBORHOOD_PAD : 0;
      const inRing = !!game.dock && dist2(game.ship, game.dock) < pad * pad;

    THE RADIUS IS LOAD-BEARING AND IT IS NOT THE OFFLOAD RADIUS. Read
    PLANNED-FEATURES-CS020.md §3.2 before you write this line. Using
    dock.radius + 10 leaves a farmable annulus: a player hovering 20px out hooks
    pieces tagged `towed` (outside +10) while never travelling far enough to
    reset the combo (inside +40), then drifts in and offloads the whole farm at
    escalating rates. +40 is the only radius under which "tagged incidental" and
    "combo not reset" are the same region.

(3) Both push sites gain `towed: !inRing` alongside `mass`. The clump-scoop loop
    pushes `take` nodes — every one of them gets the same tag; the expression is
    computed once, outside the loop, not re-evaluated per node.

(4) Split the offload block. After the pop:

      const towed = node.towed !== false;   // absent => towed

    THE `!== false` FORM IS LOAD-BEARING, NOT STYLE. 22 files under scratchpad/
    seed chain nodes as bare object literals with no `towed` field. A truthiness
    test would silently reclassify all of them as incidentals and turn most of
    the delivery suite red for no behavioural reason. Same defensive-default
    reasoning as breakChain(i, src = null) in CS019 P1. Prove it by test.

    The ENTIRE existing body of the offload block moves unchanged into
    `if (towed) { ... }`. Do not reorder, retune or "tidy" anything inside it —
    a reviewer must be able to read the diff as a pure indent plus a new else.

    ONE THING MOVES INTO THAT BRANCH THAT IS CURRENTLY AT ITS BOTTOM:

      if (game.chain.length === 0) VoiceSys.dockDelivery(game.deliveryCount);

    It must be inside the towed branch. A parked ship empties its chain on EVERY
    incidental pop (hook one, pop it, length is 0 again), so leaving it outside
    has Dan sizing up a haul twenty times a second.

    The new else branch, in full:

      } else {
        addScore(DOCK_BASE_SCORE);
        game.floaters.push(new FloatText("+" + DOCK_BASE_SCORE, node.x, node.y, COLOR.dock));
        AudioSys.deliver(1);
      }

    `game.offloadTimer = DOCK_OFFLOAD_INTERVAL;` runs for BOTH branches — put it
    after the if/else, not inside either.

(5) Nothing else. Do NOT add a deliveryCount clamp, do NOT gate the SMD trigger
    separately, do NOT touch the CS018 P8 reward latches, the Heavy Hauler ===12
    latch, the Maxed Out ===CARGO_CAP_MAX latch, superMegaDelivery(), breakChain,
    scatterChain, Garbage.fromNode, the pickup gate's cargoMax test, or
    DOCK_OFFLOAD_INTERVAL. Every one of those is already correct once incidentals
    stop advancing the counter — that is the entire point of fixing it at the
    counter. Adding a second guard anywhere would create two sources of truth.

WHAT AN INCIDENTAL DOES NOT TOUCH (FORK-CS020-B, FLAG-a, FLAG-b — assert all of
these, do not merely arrange for them):
  game.deliveryCount, game.stats.delivered, game.stats.bestCombo,
  game.stats.pacifistStreak / pacifistBest, game.stats.speedRecycler,
  Achievements.lifetime.delivered, .bestDeliveredGame, .deliveryScore,
  .fullChains, .heavyHaulerEvents, .pacifistTowEvents,
  game.stats.fullChainVisit, game.stats.maxChainVisit, game.cargoFlash.

BASELINE FIRST. Sweep every scratchpad/test-*.js at 09d443f BEFORE editing and
record the failure count. The suite has been red at HEAD more than once
(CS018 P3, CS019 P1). Expect the test-p5.js flake at roughly 1 run in 15. Any
file that fails after this phase must be diffed against that baseline before it
is called a regression.

NEW TEST: scratchpad/test-cs020-p1.js. Drive the REAL startGame / update /
pickup gate / dock-offload path. Reimplement nothing. Cover, at minimum,
PLANNED-FEATURES-CS020.md §6 items 1-12. The ones that carry the phase:

  - THE REGRESSION: the level-1 60-second park, with the pre-fix 5,650,000
    pinned against the FIXED SHA 09d443f as a permanent red control. A fixed
    SHA, never HEAD — the test-cs017-p3.js trap CS017 P6 had to repoint.
  - THE ANNULUS: hover at dock.radius + 20, hook 20 pieces, drift inside +10,
    offload — all 20 incidental, deliveryCount ends 0. This is the test that
    fails if someone later "simplifies" the tag radius to +10.
  - THE LIFO PROPERTY: arrive with a full towed load, hook one incidental DURING
    the offload window, assert the incidental (which pops FIRST) takes flat 50
    while every towed node keeps its escalating award.
  - THE LATCHES: 40 incidentals fire zero P8 reward powerups, no Heavy Hauler,
    no Maxed Out, and superMegaDelivery is never called (spy it). A real
    24-piece towed visit at level 12 still does all four.
  - BYTE-IDENTITY CONTROL: a run that never hooks inside the neighbourhood is
    bit-identical to the pre-fix build under a shared seeded RNG. The fix must be
    invisible to normal play.

MUTATION-TEST THE SUITE. Each of these must fail it, on BEHAVIOURAL assertions
and not merely on source pins: dropping the tag from the clump-scoop push; using
+10 instead of +40; using truthiness instead of !== false; leaving
VoiceSys.dockDelivery outside the towed branch; implementing the rejected
count-snapshot design (snapshot chain.length on arrival, first N pops escalate).
Report which assertion caught each.

REPOINTING. Any pre-existing test that breaks: repoint to the MIRROR-IMAGE claim
at the same strength, never weaken and never delete, with a "REPOINTED BY CS020
P1" note saying what it used to assert and why the new assertion is the same
claim. If a file breaks for a reason unrelated to this phase, check the baseline
sweep before touching it.

TRAPS:
  1. GAME_VERSION stays "1.0.0.19". P2 bumps it. Do not touch it, and do not
     touch any test's version pin.
  2. Do not edit ORBITAL-OVERHAUL-GDD.md, GDD-VERSION-HISTORY.md or
     DIFFICULTY-LEVERS.md. P2 owns the first two; CS020 never touches the third.
  3. DEBUG_VARS gains nothing. The count stays 33. Assert it.
  4. Delete the diagnostic probe before committing. It is not a test.

REPORT, in STATUS.md and in your reply:
  - the probe's pre-fix numbers and the same scenario's post-fix numbers
  - the baseline failure count vs. the post-phase failure count, per file
  - which mutants were caught by which assertion
  - anything that surprised you

Commit (do not push):
  CS020 P1: dock deliveries split into towed and incidental — kills the parked-combo exploit
```

---

## ⛔ PLAYTEST GATE — between P1 and P2

**P2 must not run until Paul has played the P1 build.** P2's whole value is
carrying what the playtest found; running it early wastes the phase.

Four questions, in priority order:

1. **FLAG-CS020-c — the repair residual.** Park at the dock with a Magnet and a
   drained hull. Does the flat 50/canister income repair you faster than combat
   damages you? `REPAIR_MILESTONE` is 10,000 points and grants 25 HP. If parking
   reads as a healing station, the answer is a new `DOCK_INCIDENTAL_SCORE`
   constant at ~10–15 — a one-line change P2 can carry.
2. **FLAG-CS020-f — the straggler.** Tow a load in with a Magnet running. Does a
   piece that gets dragged in during the final approach visibly lose its
   multiplier, and does that read as unfair or as invisible? If unfair, the fix
   is a grace window and it is *not* a P2 change — it is CS021.
3. **FLAG-CS020-d/e — the feedback.** At high incidental throughput, are the
   floaters legible or is it confetti? Does the flat `AudioSys.deliver(1)` read
   as "recycled" or as "broken"?
4. **The feel of the fix overall.** Does parking still feel like a reasonable
   thing to do — clearing the board against the Kessler loop — or does it now
   feel pointless? Pointless would be a real loss; the mechanic was a nice find
   and the goal was to bound it, not kill it.

For each: **"no change"** is a complete and useful answer. P2's standing rule is
that a line saying no change means nothing there gets touched.

---

## P2 — retune, version bump, doc sweep

**Model: Sonnet 5, high.** No new logic.

```
CS020 Phase 2 — the closing phase. Retune from playtest, bump the version, sweep
the docs. NO NEW MECHANICS.

(1) RETUNE, from Paul's playtest answers only. If a line says "no change",
    change nothing there — do not tidy, do not "improve while you're in here".
    The only tunable this phase may introduce is DOCK_INCIDENTAL_SCORE, and only
    if the playtest asked for it (FLAG-CS020-c). If it does: a named constant
    beside DOCK_BASE_SCORE, read at the one incidental addScore site, with the
    FloatText using the same constant. Not a DEBUG_VARS knob — it is a scoring
    rule, not a difficulty lever.

(2) GAME_VERSION "1.0.0.19" -> "1.0.0.20". GREP THE WHOLE REPO for the old
    literal rather than trusting any file list in this doc. This has caught an
    extra pin in every round that ran it: CS016 P5 found three where the prompt
    named two, CS017 P7 found four, CS019 P2 found seven. Bump both the
    console.log label and the assert message string in each live pin. Leave
    HEADER-COMMENT narratives alone — a comment describing what an older phase
    historically bumped to stays true.

    Repoint, do not weaken, any test asserting GAME_VERSION is "unchanged this
    phase (bumps in P2)" — including test-cs020-p1.js's own. The established
    treatment is the mirror image: assert !== the old literal, which is the same
    exact-historical-pin claim at the same strength, pointed at what is now true.

(3) GDD. Grep to each section, read that section, edit in place.
    - §2.10: the towed-vs-incidental rule. What earns the combo; what an
      incidental pays; the LIFO reasoning for tagging at capture rather than
      snapshotting a count; DOCK_NEIGHBORHOOD_PAD and why it is the combo-reset
      radius and not the offload radius.
    - §2.10.2: the payload curve is now genuinely load-bearing for the SMD and
      the CS018 P8 reward tiers, because deliveryCount can no longer be fed from
      outside a tow.
    - §2.17: Maxed Out is now effectively a level-12+ achievement; Recycling
      Magnate and Salvage King are no longer farmable at the dock.
    - Architecture Map: Constants row gains DOCK_NEIGHBORHOOD_PAD; the chain-node
      shape gains `towed`.
    - The top-of-file Current-build line. Every round-closing phase has rewritten
      it (CS017 P7, CS018 P10, CS019 P2); check one of those commits' diffs if
      the shape is unclear.
    DESCRIBE SHIPPED BEHAVIOUR ONLY. Nothing from the playtest-gate list that was
    not built enters the GDD.

(4) GDD-VERSION-HISTORY.md: ONE consolidated CS020 (P1+P2) entry, appended. This
    is the only reason to open that file — do not read it for context. Note in
    passing, do not fix: CS018 still has no entry there (CS019 P2 found the gap
    and correctly left it). Not this changeset's job either.

(5) DIFFICULTY-LEVERS.md: DO NOT EDIT. CS020 adds no lever. Confirm by grep that
    nothing in it references the delivery combo, and say so in the report.

(6) ARCHIVE. Move PLANNED-FEATURES-CS019.md and IMPLEMENTATION-PHASES-CS019.md
    to archive/. Check first whether it has already been done — CS019 P2 found
    CS018's docs already moved by CS019 P1's own prerequisite step. If they are
    already there, verify and move nothing.

(7) FULL REGRESSION, run twice consecutively for determinism. Report file count,
    assertion count and failures. Diff any failure against the P1 baseline before
    calling it a regression.

Commit (do not push):
  CS020 P2: incidental retune, version 1.0.0.20, doc sweep
```

---

## Session-setup checklist

**Attach:** `asteroids-deluxe.html`, `ORBITAL-OVERHAUL-GDD.md`, `STATUS.md`,
`CLAUDE.md`, `PLANNED-FEATURES-CS020.md`, `IMPLEMENTATION-PHASES-CS020.md`.

**Do not attach:** `GDD-VERSION-HISTORY.md`, `archive/`, the CS019 planning docs,
`DIFFICULTY-LEVERS.md`, `tools/`.

**Before P1:** commit both CS020 planning docs to repo root. Archiving the CS019
docs is P2's item (6), matching the CS017→CS018 and CS018→CS019 precedent.

**Note:** `ultrathink` appears inside P1's prompt text itself, not in a meta-note
— that is the only placement that takes effect in Claude Code.