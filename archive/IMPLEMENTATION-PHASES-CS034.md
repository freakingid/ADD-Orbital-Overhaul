# IMPLEMENTATION-PHASES-CS034 — Orbital Overhaul

Execution order and paste-ready per-phase prompts. **Spec is
`PLANNED-FEATURES-CS034.md`** — read it, don't re-derive from here.

**One phase per Claude Code session. One commit per phase. Claude Code never pushes.**

Baseline: `212e542`, `GAME_VERSION = "1.0.0.33"`, registry **87**, `LEVERS` **18**, suite
**130/130 on a full clone**. Nine of the shallow-clone-sensitive tests need real git history —
work from a **full clone**, not `--depth 1`.

---

## Phase order

| Phase | What | Model | Blocks on |
|---|---|---|---|
| **P1** | Delivery-ticker lab (`tools/` only, zero build changes) | sonnet | — |
| **GATE A** | Paul plays the lab, returns numbers | — | P1 |
| **P2** | Vocabulary glossary + doc/string sweep | sonnet | — |
| **P3** | Hunter Satellites shed no Debris (large/medium) | sonnet | — |
| **P4** | Leaderboard stat-key fix + Duration column | sonnet | — |
| **P5** | Level-end celebration header | sonnet | — |
| **P6** | Typed-confirm screen + achievement reset | **opus** | — |
| **P7** | Local high scores rework | **opus** | P6 |
| **P8** | Delivery-ticker port | sonnet | GATE A |
| **GATE B** | Blocking playtest | — | P8 |
| **P9** | Closing: version bump, doc sweep, log, archive | sonnet | GATE B |

P1 is first so GATE A is open while P2–P7 run. P6 and P7 are design-bearing (a shipped
input behaviour changes in P6; P7 deletes a whole UI subsystem and re-shapes a persistence
module) and want Opus. Everything else is step-specified.

---

# P1 — Delivery-ticker lab

**Tools only. Zero changes to `orbital-overhaul.html`. No test file.**

```
claude --model sonnet
```

```
ultrathink

You are implementing ONE phase of changeset CS034 for Orbital Overhaul. Read CLAUDE.md,
then STATUS.md, then PLANNED-FEATURES-CS034.md §3. Build only what this prompt scopes.

WORK FROM A FULL CLONE (not --depth 1) — nine suite files need real git history.

## Goal

Extend tools/dock-float-lab.html so Paul can dial in the Recycle-dock delivery score
readout: bigger type, a full-opacity hold before the fade, a slower fade, and visible
per-piece size growth so the chain bonus reads as a climb.

This phase touches NOTHING in orbital-overhaul.html. The lab is a design instrument
(CLAUDE.md, "Design instruments") — it duplicates whatever slice of game logic it needs, and
drift here can only ever produce a bad preview, never a bad build.

## Grep anchors (in tools/dock-float-lab.html)

- `cfg` — the config object holding anchorFrac, shipDrift, rise, life, minGap, interval,
  canisterCount, timeScale
- `anchorFrac` / `anchorX` — the existing anchor model
- `slotY` — its header records why model B as first written does not hold; leave that intact
- `configOut` / `copyBtn` — the existing "Copy constants" block
- `readout` / `sepVal` / `colVal` — the existing clearance readout

## What to add

Five new sliders, each labelled with the build symbol it will feed:

| Slider id | Label                                        | min  | max  | step | default |
|-----------|----------------------------------------------|------|------|------|---------|
| size      | size (px) — DEBUG.deliveryFloatSize           | 12   | 64   | 1    | 16      |
| sizeStep  | sizeStep (px/piece) — DEBUG.deliveryFloatSizeStep | 0 | 6  | 0.5  | 0       |
| sizeMax   | sizeMax (px) — DEBUG.deliveryFloatSizeMax     | 16   | 96   | 1    | 48      |
| hold      | hold (s) — DEBUG.deliveryFloatHold            | 0    | 3.0  | 0.05 | 0       |
| fade      | fade (s) — DEBUG.deliveryFloatFade            | 0.1  | 3.0  | 0.05 | 1.2     |

Defaults reproduce TODAY's shipped behaviour exactly: size 16 (currently hardcoded),
sizeStep 0 (no growth), hold 0 + fade 1.2 (a linear fade over the whole life, which is what
`life / life0` gives today). Opening the lab and touching nothing must look like the
shipped game.

REMOVE the existing `life` slider. Its role splits into hold + fade; the simulated ticker's
total life is `hold + fade`.

## Behavioural contract for the simulated ticker

- The ticker is PINNED for the whole visit and does not age. Its life clock starts only at
  release (the visit's last piece). This mirrors FloatText.update()'s `if (this.pinned)
  return;` early return — a long visit must never consume the hold.
- Opacity after release: `min(1, life / fade)`. So it holds at full opacity for
  `(hold + fade) - fade` = `hold` seconds, then fades over `fade` seconds.
- Font size on the Nth piece of the visit (N is 1-based):
  `min(sizeMax, size + sizeStep * (N - 1))`
- Text is `"+" + runningVisitTotal`, rewritten as each piece lands — the lab already models
  the running total; keep that.
- `rise` still governs the post-release climb. Unchanged.

## Clearance readout — this is the point of the phase

STATUS.md records that SALVAGE BONUS / MAX HAUL measured 0.0 px clearance from the delivery
ticker at anchorFrac 0.50 — zero crossing, no air. A bigger ticker font makes that worse.

The existing readout must report, at the CURRENT slider values, the measured minimum vertical
clearance in px between the delivery ticker's ink and the milestone floaters' ink. Those
milestones are born at `dock.y - 22` on FloatText's un-passed defaults (rise 30 px/s,
life 1.1 s) — the lab already models them; do not change their parameters.

Show the number, and colour it red when it is <= 0. Paul reads this number off at the gate.

## Copy block

Extend `configOut` so "Copy constants" emits a paste-ready block naming the five new symbols
plus rise and anchorFrac, in the DEBUG_VARS registry shape the build uses. Retain whatever
the block already emits for anchorFrac / rise.

## DO NOT

- Do not touch orbital-overhaul.html. Not one character.
- Do not touch any other file in tools/.
- Do not add a test file — tools/ is not shipped code and has no suite coverage.
- Do not change anchorFrac's default (0.50), the three placement models, DOCK_OFFLOAD_INTERVAL,
  or slotY()'s header comment.
- Do not remove the existing rise / interval / canisterCount / timeScale / minGap sliders.
- Do not add these knobs to the build's DEBUG_VARS registry — that is P8's job, after the gate.
- Do not push.

## DONE WHEN

- tools/dock-float-lab.html opens from file:// by double-click and runs with no console errors.
- At defaults (size 16, sizeStep 0, hold 0, fade 1.2) the simulated ticker is
  visually indistinguishable from the shipped behaviour.
- Raising sizeStep visibly grows the ticker with each piece delivered.
- The clearance readout shows a number that changes when size or anchorFrac moves.
- Suite still passes untouched, from a FULL clone:
  `node scratchpad/run-all.js` → `130 files: 130 passed, 0 failed, 0 skipped, 0 timed out`
- STATUS.md phase ledger has a one-line P1 entry (new paragraph, `\n\n` — verify it).
- Committed on main. NOT pushed.
```

---

# GATE A — delivery readout (blocking for P8 only)

Paul plays `tools/dock-float-lab.html`. **P2–P7 do not wait on this.**

Answer format is a number per line.

```
A1. size            (12–64, px)         =
A2. sizeStep        (0–6, px per piece) =
A3. sizeMax         (16–96, px)         =
A4. hold            (0–3.0, s)          =
A5. fade            (0.1–3.0, s)        =
A6. rise            (30–600, px/s)      =
A7. anchorFrac      (0–1.5)             =
A8. clearance the lab reported at those values (px) =
A9. If A8 is <= 0, which gives: milestone floaters move up / ticker stays / accept overlap
```

---

# P2 — Vocabulary glossary and doc sweep

```
claude --model sonnet
```

```
ultrathink

You are implementing ONE phase of changeset CS034 for Orbital Overhaul. Read CLAUDE.md,
then STATUS.md, then PLANNED-FEATURES-CS034.md §1 and §0.2. Build only what this prompt
scopes.

WORK FROM A FULL CLONE (not --depth 1).

## Goal

Establish the canonical object vocabulary in the project's live docs and in player-facing
strings. NO code identifiers change.

## The inversion — read this before you touch anything

The build's names for two objects are INVERTED relative to the canonical terms:

  Garbage Satellite (shoot it, it splits)  -> code calls it DebrisSatellite / DEBRIS_* /
                                              game.debris / destroyDebris / debrisKills
  Debris (tow it to the dock)              -> code calls it Garbage / GARBAGE_* /
                                              game.garbage / "canister"
  Hunter Satellite                         -> HunterSatellite / HUNTER_*  (already correct)
  Recycle dock                             -> Dock / DOCK_*               (already correct)

This is not a mistake to fix in code. It is a fact to DOCUMENT so future sessions read
`game.debris` correctly.

## Part 1 — CLAUDE.md gains a Vocabulary section

Add a new top-level section (place it directly after "What this is", above "Session rules")
carrying:

- The four canonical terms and what each object is.
- The inversion map above, stated explicitly as a lookup table.
- ⛔ A marker that code identifiers are NOT to be renamed to match — the inversion is
  load-bearing history, not a cleanup target. A future session that "fixes" game.debris
  would be touching ~278 sites for zero behavioural gain.
- ⛔ A marker that achievement `id` values are SAVE DATA and are never renamed. They are keys
  inside afd_achievements_v2's lifetimeUnlocked / weeklyUnlocked / lifetimeTiers. Renaming
  one silently drops that achievement for every existing player.
- A note that the Worker's `debris_destroyed` stats key (coinless-kit) is old vocabulary,
  frozen in already-submitted rows, and is deliberately NOT renamed.
- A note that names were used inconsistently before CS034, so any doc or comment predating
  it may use either term for either object.

## Part 2 — live docs swept

Bring prose to canonical terms wherever it names one of these objects, in:
ORBITAL-OVERHAUL-GDD.md, DIFFICULTY-LEVERS.md, RATIONALE.md, EXTERNAL-FILES.md,
DECISIONS.md, STATUS.md.

⛔ DO NOT TOUCH archive/ OR log/. CLAUDE.md already carries this invariant for the CS029
name sweep and it holds identically here — those are a historical record.

Where a doc names a CODE SYMBOL, the symbol stays as written. Only prose changes. E.g.
"the game.debris array (Garbage Satellites)" is correct; "the game.garbageSatellites array"
is wrong — that array does not exist.

## Part 3 — player-facing strings

Grep anchors are the achievement `id` and DEBUG_VARS `id` values. Change ONLY the `name` /
`desc` / `label` strings.

Achievement descriptions:
- satellite_buster : "Debris Satellites" -> "Garbage Satellites"
- field_sweeper    : "Most Debris destroyed in one game (best)."
                     -> "Most Garbage Satellites destroyed in one game (best)."
- waste_not        : "no Hunters born from neglected scrap"
                     -> "no Hunter Satellites born from neglected Debris"
- Every desc reading "canister" / "canisters" -> "Debris" (count preserved, e.g.
  "Deliver 20 canisters to the dock in one game." ->
  "Deliver 20 Debris to the Recycle dock in one game."). Note "Debris" is a mass noun —
  do not write "20 Debrises".

Achievement NAMES are proper nouns and DO NOT change: Scrap Runner, Recycling Magnate,
Ton of Scrap, Salvage King, Freight Baron all stay.

DEBUG_VARS labels:
- garbageAttractRadius     : "Garbage attraction radius"    -> "Debris attraction radius"
- garbageAttractForce      : "Garbage attraction force"     -> "Debris attraction force"
- garbageSoftMax           : "Garbage soft max"             -> "Debris soft max"
- garbageHardMax           : "Garbage hard max"             -> "Debris hard max"
- debrisBounceRestitution  : "Satellite bounce restitution" -> "Garbage Satellite bounce restitution"

⚠ TRAP: menuDebug() dispatches two ACTION rows BY LABEL STRING — "Reset all debug knobs to
defaults" and "Reset saved scores". Neither names an object so neither changes, but verify
no label you edit is a dispatch key before you edit it.

Also sweep in-game HUD / menu / floater strings that name an object. Check the Dock's
"RECYCLE" label and the title screen's "BEWARE THE HUNTER SATELLITE" — both are already
correct; confirm rather than assume.

## DO NOT

- Do not rename ANY code identifier: class, const, function, field, or object key.
- Do not rename any achievement `id`. SAVE DATA.
- Do not touch archive/ or log/.
- Do not touch the Worker's debris_destroyed key (different repo, and deliberately kept).
- Do not change any behaviour. This phase is strings and prose only.
- Do not change registry COUNT (still 87) or LEVERS (still 18) — you are editing labels,
  not adding or removing rows.
- Do not push.

## DONE WHEN

- CLAUDE.md carries the Vocabulary section with both ⛔ markers.
- `grep -n "Debris Satellite" orbital-overhaul.html` returns nothing.
- Achievement ids are byte-identical to the parent commit — verify with a diff restricted to
  the WEEKLY / LIFETIME arrays.
- Suite passes from a FULL clone:
  `node scratchpad/run-all.js` → `130 files: 130 passed, 0 failed, 0 skipped, 0 timed out`
- STATUS.md phase ledger has a one-line P2 entry (new paragraph, `\n\n` — verify it).
- Committed on main. NOT pushed.
```

---

# P3 — Hunter Satellites shed no Debris

```
claude --model sonnet
```

```
ultrathink

You are implementing ONE phase of changeset CS034 for Orbital Overhaul. Read CLAUDE.md,
then STATUS.md, then PLANNED-FEATURES-CS034.md §2. Build only what this prompt scopes.

WORK FROM A FULL CLONE (not --depth 1).

## Goal

Large and medium Hunter Satellites stop shedding Debris on destruction. They still 3-way
split, and the large core still drops its powerup. The SMALL tier keeps its one low-mass
piece — that tier spawns no children, so the Debris is its entire payload.

## Grep anchors

- `HUNTER_GARBAGE`      — the per-tier table, currently `{ 3: 3, 2: 2, 1: 1 }`
- `HUNTER_SMALL_MASS`   — 0.5, the small tier's low-mass tint
- `destroyHunter`       — the one emission site, two branches (size 1, and everything else)
- `ACH_LINEAGE_FULL`    — 13, Hunter's Bane's threshold
- `superMegaDelivery`   — calls destroyHunter(h, true) per swept body; inherits this change

## Behavioural contract

- `HUNTER_GARBAGE` becomes `{ 3: 0, 2: 0, 1: 1 }`. KEEP THE THREE-KEY TABLE SHAPE — do not
  collapse it to a scalar or a boolean. The shape is what makes a future per-tier change a
  data edit rather than a code edit.
- The large/medium branch's Debris loop runs zero times at the new values. You may leave the
  loop in place reading the table (preferred — it is data-driven and stays correct if the
  table changes) rather than deleting it.
- Everything else in destroyHunter() is unchanged: `awardScore` gating, the achievement
  counters, boom(), the 3-way split, the large core's dropPowerup().

## ⚠ You MUST replace a comment that this change contradicts

Directly above the emission block is a comment beginning:

  "v3.3 P4 (9b, reverses v3.2 P3's FORK-B/B1): EVERY Hunter drops garbage at its tier counts"

That statement is now false. Replace it with one recording: CS034 removed large/medium
emission (Paul's call, FORK-C -> b); the small-tier pile survives because that tier spawns no
children and the Debris is its whole payload; 9a's single-decay remains the field governor;
and a full 13-body lineage now yields 9 pieces, down from 18.

Do NOT leave the old comment in place alongside the new behaviour. A comment that contradicts
its code is worse than no comment.

## ⛔ Do not touch the split

The block carrying "THREE, HARDCODED, AND IT STAYS THAT WAY — DO NOT 'FINISH THE JOB'
STARTED IN destroyDebris()" is untouched. ACH_LINEAGE_FULL = 13 depends on 1 + 3 + 9. A
2-way split makes Hunter's Bane structurally unreachable.

## Test

New file `scratchpad/test-cs034-p3.js`, using scratchpad/_harness.js (⛔ never hand-roll a
sandbox; read world dimensions from the harness, don't hardcode them). Seed with
installSeed(n) from _seeded-random.js ABOVE everything, unscoped — some nondeterminism is
spent at module load inside the factory.

Drive the REAL destroyHunter() — never inline a copy of the logic under test. Assert:

- Destroying a size-3 Hunter adds 0 to game.garbage.length, and adds exactly 3 to
  game.hunters (the children).
- Destroying a size-2 Hunter adds 0 to game.garbage.length, and adds exactly 3 to
  game.hunters.
- Destroying a size-1 Hunter adds exactly 1 to game.garbage.length, and 0 to game.hunters.
- That one piece carries HUNTER_SMALL_MASS.
- HUNTER_GARBAGE still has keys 3, 2, 1.
- A size-3 kill still drops exactly one powerup.
- ⛔ Assert ONLY what this phase owns. Do NOT assert a registry count, a lever count, or any
  global inventory — those live exclusively in scratchpad/test-registry.js.

## DO NOT

- Do not change the 3-way split or ACH_LINEAGE_FULL.
- Do not change HUNTER_SMALL_MASS.
- Do not touch dropPowerup / the large core's drop.
- Do not touch coalesceGarbage (Debris -> Hunter conversion is out of scope both directions).
- Do not add a DEBUG registry row for this — registry stays at 87 this phase.
- Do not compensate elsewhere for the reduced Debris supply. Balance is a GATE B question.
- Do not push.

## DONE WHEN

- `node --check` passes on the extracted script.
- Suite passes from a FULL clone:
  `node scratchpad/run-all.js` → `131 files: 131 passed, 0 failed, 0 skipped, 0 timed out`
- The v3.3 P4 comment is replaced, not merely appended to.
- STATUS.md phase ledger has a one-line P3 entry (new paragraph, `\n\n` — verify it).
- Committed on main. NOT pushed.
```

---

# P4 — Leaderboard stat key fix + Duration column

```
claude --model sonnet
```

```
ultrathink

You are implementing ONE phase of changeset CS034 for Orbital Overhaul. Read CLAUDE.md,
then STATUS.md, then PLANNED-FEATURES-CS034.md §7 and §0.1. Build only what this prompt
scopes.

WORK FROM A FULL CLONE (not --depth 1).

## Goal

Two things: fix a live bug that is flagging every posted score, and add a Duration column to
the leaderboard board screen.

## Context you need — a ⛔ INVARIANT in CLAUDE.md is factually wrong

CLAUDE.md's Leaderboard block says the Worker's `statsFields` registry "is not visible from
this repo." It IS visible — github.com/freakingid/coinless-kit holds
services/leaderboard/src/registry.js. The registered keys for orbital-overhaul are:

  wave_reached, canisters_delivered, hunter_kills, saucer_kills, debris_destroyed

The build sends `garbage_satellite_kills`, which is NOT registered. Per the Worker's contract
an unrecognized key does not reject the submit — it FLAGS THE ROW, which is the same ⚑ marker
drawLeaderboard() renders next to bounds-check failures. Every score posted since CS033 P3 is
showing as flagged on the public board.

## Grep anchors

- `Leaderboard.submit` / `const Leaderboard = {` — the one call surface for window.KitLeaderboard
- `garbage_satellite_kills` — the wrong key
- `drawLeaderboard` — the board screen renderer
- `colRank` / `colName` / `colScore` / `colWave` / `colDeliv` — its hand-positioned columns
- `fmtCommas` — the existing number formatter, near the score-table renderers

## Part 1 — the key fix

In Leaderboard.submit()'s `stats` object, rename exactly one key:

  garbage_satellite_kills  ->  debris_destroyed

The VALUE SOURCE IS UNCHANGED (game.stats.debrisKills). The other three keys already match
the registry and are untouched.

⚠ `debris_destroyed` counts what CS034 calls Garbage Satellites — it is old vocabulary,
frozen in rows already submitted, and is deliberately NOT renamed server-side. Say so in the
comment above the stats object.

DO NOT add `hunter_kills`. It is registered and remains deliberately unsent. But REWRITE the
reason in CLAUDE.md's ⛔ stats block, because the current reason ("the registry is not
visible from this repo") is now false. The correct standing reason: no per-game player-only
Hunter-kill counter exists — hunterLineageKills resets per lineage and
Achievements.lifetime.hunterKills is cross-game — and none was added to serve this.

Update CLAUDE.md's stats invariant to name the real four keys sent
(wave_reached, canisters_delivered, saucer_kills, debris_destroyed) and to state that the
Worker registry IS readable from coinless-kit.

## Part 2 — fmtDuration()

Add a helper beside the existing fmtCommas():

  fmtDuration(seconds) -> "h:mm:ss" when >= 3600, else "m:ss"

Non-numeric, negative, or non-finite input returns "-". This helper is also used by P7 —
write it once, here.

## Part 3 — the Duration column

drawLeaderboard() gains a TIME column between LEVEL and DELIVERED. Header "TIME",
right-aligned like LEVEL and DELIVERED.

Value is `e.durationS`, rendered through fmtDuration(). ⛔ Crash-free the same way the two
existing stat columns are: a fetched entry may not carry durationS, so fall back to "-"
rather than assume the shape.

Six columns now share the 1000px panel at scale 1.5. Re-derive ALL SIX x-offsets from cx in
one edit so they stay balanced — do not wedge the new one into a gap. Names must not collide
with the score column at long display names (12 chars max, per the module's validateName).

## Test

New file `scratchpad/test-cs034-p4.js`, using scratchpad/_harness.js. Follow
test-cs033-p2.js's approach: inject a fake `window.KitLeaderboard` post-build and drive the
real Leaderboard object.

Assert:
- submit()'s stats object has key `debris_destroyed` and does NOT have
  `garbage_satellite_kills`.
- Its four keys are exactly wave_reached, canisters_delivered, saucer_kills, debris_destroyed.
- debris_destroyed's value tracks game.stats.debrisKills.
- fmtDuration(0) / (59) / (60) / (3599) / (3600) / (86399) render correctly.
- fmtDuration(undefined) and fmtDuration(NaN) both return "-".
- ⛔ Assert only what this phase owns. No global counts.

## DO NOT

- Do not add hunter_kills to the payload.
- Do not touch coinless-kit — different repo, out of scope (spec §7.3).
- Do not attempt the Version column or the just-me filter — both need Worker changes that do
  not exist yet (spec §0.4). If you find yourself wanting `e.gameVersion`, it is not mapped
  by the module; stop.
- Do not touch Leaderboard.eligible(), beginRun(), or either submit call site.
- Do not change the local HighScores table — that is P7.
- Do not push.

## DONE WHEN

- `grep -n "garbage_satellite_kills" orbital-overhaul.html` returns nothing.
- CLAUDE.md's stats invariant names the four real keys and the corrected reason.
- Suite passes from a FULL clone:
  `node scratchpad/run-all.js` → `132 files: 132 passed, 0 failed, 0 skipped, 0 timed out`
- STATUS.md phase ledger has a one-line P4 entry (new paragraph, `\n\n` — verify it).
- Committed on main. NOT pushed.
```

---

# P5 — Level-end celebration header

```
claude --model sonnet
```

```
ultrathink

You are implementing ONE phase of changeset CS034 for Orbital Overhaul. Read CLAUDE.md,
then STATUS.md, then PLANNED-FEATURES-CS034.md §4. Build only what this prompt scopes.

WORK FROM A FULL CLONE (not --depth 1).

## Goal

The achievement celebration panel is jolting at level end because nothing tells the player
they just cleared a level. Give the LEVEL-END panel its own header. The GAME-OVER panel is
unchanged.

## Grep anchors

- `drawCelebration`       — the renderer
- `CELEB_SUB_Y`           — the "N NEW UNLOCKS" sub-line baseline
- `game.celebration`      — `{ items, scroll, resume }`
- `dismissCelebration`    — reads `resume`; already the field that answers "why did this open"
- `celebrationMaxScroll`  — the one scroll ceiling; DO NOT TOUCH

## Behavioural contract

The panel has two open sites, already distinguished by `game.celebration.resume`:

  resume === "wave"  (wave clear, opened in update())
      panel title  : "LEVEL N COMPLETE"
      sub-line     : "During level N you earned:"

  resume === null    ("dying"->"gameover" seam, opened in updateDeath())
      panel title  : "ACHIEVEMENTS UNLOCKED"   (unchanged)
      sub-line     : "N NEW UNLOCK" / "N NEW UNLOCKS"   (unchanged)

⛔ DERIVE THE HEADER FROM `resume`, NOT FROM `game.state`. game.state is "playing" at the
level-end panel and "gameover" at the other, so it happens to agree today — but `resume` is
the field that records WHY the panel opened, and dismissCelebration() already reads it for
exactly that reason. Using game.state couples the header to an invariant maintained
elsewhere.

## ⛔ The level number needs no new field — do not stamp one

At the wave-clear open site, nextWave() is DEFERRED to dismissCelebration(). So `game.wave`
is still the COMPLETED wave when the panel opens and for its entire lifetime.
drawCelebration() reads game.wave live and gets the right number.

This does NOT conflict with CLAUDE.md's ⛔ that game.pendingAch is never filtered by
game.wave. That rule governs WHICH ITEMS ARE IN THE BUCKET. This is a title string and it
filters nothing — the bucket is still flushed whole. Do not add a `wave` field to
game.celebration.

## DO NOT

- Do not touch celebrationMaxScroll(), CELEB_ROW0_Y, CELEB_ROW_CLIP_TOP/BOTTOM, the clip
  region, or the ▲/▼ affordance.
- Do not touch dismissCelebration()'s deferred nextWave().
- Do not touch the `game.state === "playing"` guard at the wave-clear open site — its header
  explains why it is not redundant (killShip() flips state mid-frame).
- Do not touch either input handler's game.celebration gate.
- Do not add a field to game.celebration.
- Do not change the game-over panel's title or sub-line.
- Do not push.

## Test

New file `scratchpad/test-cs034-p5.js`, using scratchpad/_harness.js. Drive the real
drawCelebration() with a stubbed drawText that records its calls (the harness already stubs
the canvas context).

Assert:
- With game.celebration.resume === "wave" and game.wave === 7, a recorded drawText call
  carries "LEVEL 7 COMPLETE" and another carries "During level 7".
- With resume === null, a recorded call carries "ACHIEVEMENTS UNLOCKED" and none carries
  "COMPLETE".
- Neither path throws with items.length of 0, 1, and 6.
- game.celebration has no `wave` key after either open.
- ⛔ Assert only what this phase owns. No global counts.

## DONE WHEN

- Suite passes from a FULL clone:
  `node scratchpad/run-all.js` → `133 files: 133 passed, 0 failed, 0 skipped, 0 timed out`
- GDD §2.20 (Achievement Celebration Panel) updated to describe both headers.
- STATUS.md phase ledger has a one-line P5 entry (new paragraph, `\n\n` — verify it).
- Committed on main. NOT pushed.
```

---

# P6 — Typed-confirm screen + achievement reset

**Design-bearing. A shipped input behaviour changes, and a screen used by two live callers is
generalized. Opus.**

```
claude --model opus
```

```
ultrathink

You are implementing ONE phase of changeset CS034 for Orbital Overhaul. Read CLAUDE.md,
then STATUS.md, then PLANNED-FEATURES-CS034.md §5. Build only what this prompt scopes.

WORK FROM A FULL CLONE (not --depth 1).

## Goal

The player can reset their achievements — lifetime or weekly, for the ACTIVE PROFILE ONLY —
behind a two-stage confirmation: a yes/no modal, then typing the word "reset".

## Grep anchors

- `openNameEntry` / `closeNameEntry` / `nameEntryCommit` / `nameEntryError` /
  `nameEntryRevalidate` / `nameEntryKey` / `menuNameEntry` — the existing text field
- `NAME_CELLS` / `SCORES_CHARSET` — the character grid both pad and keyboard reach
- `openModal` / `menuModal` — the existing yes/no dialog
- `menuAchievements` / `ACH_TABS` / `achTabIndex` / `game.menu.achTab` — the viewer
- `Achievements.lifetime` / `lifetimeUnlocked` / `lifetimeTiers` / `weeklyUnlocked` /
  `weekKey` / `activeIds`
- `blankLegacyStores` — the existing "clear the four collections then save" shape to mirror
- `Profiles.nameOf` / `Profiles.activeId`

## Part 1 — generalize the typed field

⛔ A GAMEPAD CANNOT TYPE. The only pad-reachable text path in this build is the `nameentry`
character grid. A keyboard-only modal would make this feature unreachable for a pad player.
Generalize the existing screen; do not build a second one.

`openNameEntry(ctx, initial)`'s `ctx` gains two OPTIONAL fields:

- `title`      — the panel heading. When absent, the current profile-name heading is used.
- `validate(buf)` — returns "" when clean, else the inline message. When absent,
                    `nameEntryError(buf, ctx)` is used.

⛔ nameEntryError() STAYS THE ONE PLACE THE NAME RULES LIVE. Do not delete it, do not inline
it. It becomes the DEFAULT validate. The live path (nameEntryRevalidate) and the commit path
(nameEntryCommit) must both call the SAME resolved validator — they can never disagree, which
is that function's whole existing contract.

⛔ nameEntryCommit() RE-VALIDATES rather than trusting nameErr. That stays true with a
supplied validator, for the same reason it is true today: ctx comes from outside and nameBuf
can be prefilled.

Both existing callers (profile add, profile rename) pass neither new field and must be
BYTE-IDENTICAL in behaviour afterwards.

## Part 2 — resetAchievements(pool)

One function owning clear + persist, for the ACTIVE PROFILE ONLY. `pool` is "lifetime" or
"weekly".

  "lifetime" -> every Achievements.lifetime counter to 0; lifetimeUnlocked emptied;
                lifetimeTiers emptied
  "weekly"   -> weeklyUnlocked emptied

Then Achievements.save().

⛔ DO NOT CALL Achievements.init() TO REBUILD. init() reloads from storage, which would
restore exactly what you just cleared. Clear the collections directly and save — mirror
blankLegacyStores()'s existing shape.

⛔ weekKey and activeIds are NOT reset. They are calendar-derived, not progress. The player
gets this week's same five weekly challenges, all locked again.

⛔ Other profiles' stores are untouched. afd_scores_v1 is untouched (that is P7's reset).

## Part 3 — the persistence trap you must respect

Achievements.save() early-returns on `game.debugRun || game.resumedRun`. A reset fired during
a resumed run would clear memory and never persist.

The Achievements viewer is already TITLE-MENU-ONLY as of CS016 P2 (FORK-CS016-A) —
unreachable mid-run and at gameover. Placing the reset there satisfies this STRUCTURALLY.
Do not add a runtime guard; do not relax save()'s gate. Record the reasoning in a comment at
resetAchievements().

Also record in STATUS.md's Known issues: blankLegacyStores() has the same latent hole today
(it calls Achievements.save() unguarded) and is NOT fixed this changeset — it is only
reachable from profile delete, which is also title-only.

## Part 4 — the viewer row

⚠ FLAG-CS034-a — THIS IS A DESIGN CALL, FLAGGED FOR REVIEW.

menuAchievements() currently drives up/down as CONTINUOUS SCROLL with no row selection, and
handles `confirm` and `back` in ONE shared branch (both leave the screen). There is no cursor
to extend.

Resolution: split `confirm` from `back`. `back` still leaves. `confirm` now fires the reset
for whichever pool the ACTIVE TAB shows — so it is one row, one verb, no cursor, and the tab
the player is looking at is the pool they reset.

Render a single reset affordance below the tab content, labelled off game.menu.achTab:

  achTab "weekly"   -> "ENTER  Reset Weekly Achievements"
  achTab "lifetime" -> "ENTER  Reset Lifetime Achievements"

Update the screen's footer hint in the SAME edit — ENTER no longer means "leave", and a
player may have that in muscle memory. This is the flagged risk; surface it in STATUS.md's
Playtest asks for GATE B.

## Part 5 — the two stages

Stage 1: openModal(). Text names the pool AND the profile, e.g.

  "Reset LIFETIME achievements for PAUL? This cannot be undone."

Confirm label "RESET". ⛔ Do not touch openModal's `index: 1` default — CANCEL-by-default is
the safety property, not a tidy-up target.

Stage 2: on confirm, openNameEntry() with:
  - title    : "TYPE RESET TO CONFIRM"
  - validate : "" iff buf.trim().toLowerCase() === "reset", else a message
  - onCommit : calls resetAchievements(pool)
  - back / backIndex : returns to the achievements screen

⛔ menuModal() CLEARS THE MODAL BEFORE INVOKING onConfirm — its header explains why (the
callback is free to navigate). openNameEntry() navigates. That ordering already holds; do not
disturb it.

PROFILE_NAME_MAX (12) is a comfortable cap for a 5-character word. Do not change it.

## Test

New file `scratchpad/test-cs034-p6.js`, using scratchpad/_harness.js.

Assert:
- resetAchievements("lifetime") zeroes every lifetime counter, empties lifetimeUnlocked and
  lifetimeTiers, and LEAVES weeklyUnlocked, weekKey and activeIds intact.
- resetAchievements("weekly") empties weeklyUnlocked and leaves every lifetime collection
  intact.
- After a reset, a fresh Achievements load from the same store reads back the cleared state
  (i.e. it actually persisted).
- A non-active profile's stored blob is byte-unchanged across a reset.
- openNameEntry with a custom validate rejects "" / "nope" / "  " and accepts "reset",
  "RESET", "  Reset  ".
- openNameEntry with NO validate still enforces the name rules (empty / too long / taken) —
  proving the two existing callers are unregressed.
- ⛔ Assert only what this phase owns. No global counts.

## DO NOT

- Do not build a second text-entry screen.
- Do not delete or inline nameEntryError().
- Do not touch SCORES_CHARSET or NAME_CELLS (P7 depends on them surviving).
- Do not relax Achievements.save()'s debugRun/resumedRun gate.
- Do not fix blankLegacyStores() — record it, don't fix it.
- Do not reset weekKey or activeIds.
- Do not touch afd_scores_v1 or HighScores.
- Do not touch other profiles' stores.
- Do not add a localStorage key.
- Do not push.

## DONE WHEN

- Suite passes from a FULL clone:
  `node scratchpad/run-all.js` → `134 files: 134 passed, 0 failed, 0 skipped, 0 timed out`
- GDD §2.17 (Achievements) documents the reset and its two stages.
- STATUS.md carries FLAG-CS034-a under Playtest asks, and the blankLegacyStores() note under
  Known issues.
- STATUS.md phase ledger has a one-line P6 entry (new paragraph, `\n\n` — verify it).
- Committed on main. NOT pushed.
```

---

# P7 — Local high scores rework

**Design-bearing. Deletes a whole UI subsystem, re-shapes a persistence module for later
extraction, and adds a scrolling renderer. Opus. Depends on P6's generalized typed field.**

```
claude --model opus
```

```
ultrathink

You are implementing ONE phase of changeset CS034 for Orbital Overhaul. Read CLAUDE.md,
then STATUS.md, then PLANNED-FEATURES-CS034.md §6. Build only what this prompt scopes.

WORK FROM A FULL CLONE (not --depth 1). This phase depends on P6's generalized
openNameEntry() — confirm it is in the parent commit before starting.

## Goal

Five things, one coherent change to the local high score table:
1. The player's name comes from their profile. The 3-slot initials entry is DELETED.
2. Records carry the full leaderboard stat set.
3. The table holds 25, and the browsable screen can filter to the active profile.
4. The table can be reset, behind the same two-stage confirmation P6 built.
5. HighScores is shaped so a future kit-scores module extracts along a clean seam.

## Grep anchors

- `const HighScores = {` / `STORAGE_KEY: "afd_scores_v1"` / `SCORES_MAX` / `qualifies` / `add`
- `SCORES_CHARSET`      — ⛔ KEEP (see below)
- `game.entry` / `entryInput` / `commitEntry` / `drawEntrySlots` / `game.lastScoreId`
- `drawScoreTable` / `drawHighScores` / `menuHighScores` / `HS_TABLE_SCALE`
- `resetHighScores`     — exists; extend it
- `Leaderboard.submit`  — reads the same counters; both move to one object
- `fmtDuration`         — added by P4; reuse, do not re-add
- `achMaxScroll` / `ACH_SCROLL_STEP` / `celebrationMaxScroll` — the scroll idiom to follow

## Part 1 — delete the initials entry

At the "dying" -> "gameover" seam, a qualifying run's record is written IMMEDIATELY from
Profiles.nameOf(Profiles.activeId), and game.lastScoreId is set so the gameover table
highlights it exactly as today.

DELETE: game.entry (from BOTH the `game` object literal AND resetRun() — CLAUDE.md's standing
rule is that a field lands in both or neither), entryInput(), commitEntry(), drawEntrySlots(),
the keyboard handler's `if (game.entry) { ... return; }` block, the gamepad handler's `(2.5)`
block, and all seven `&& !game.entry` guards.

⛔ KEEP SCORES_CHARSET. NAME_CELLS derives from it (`SCORES_CHARSET.split("")` plus the three
verb cells) and P6's typed confirm depends on that grid. Repoint its comment from "the
initials-entry alphabet" to "the name-entry grid alphabet".

⛔ The eligibility gate is UNCHANGED:
`!game.debugRun && !game.resumedRun && HighScores.qualifies(game.score)`. CLAUDE.md requires
this and Leaderboard.eligible() be extended together. Neither is extended here.

⚠ resetMenuNav() at that seam existed for the held-stick-into-entry case. The celebration
panel's own open, immediately below, calls it for its own reason and that call STAYS. Remove
only the entry-specific call.

The gameover draw block's `if (game.entry && !game.celebration) ... else if (!game.entry)`
collapses to the table branch unconditionally.

## Part 2 — the record shape

⛔ ADDITIVE ONLY. No key rename, no migration, no rewrite of stored records.

New records write `name` (profile name at commit time) and NO `initials`. Old records keep
theirs.

HighScores.load()'s filter currently requires `typeof r.initials === "string"` — DROP that
requirement, keep only `typeof r.score === "number"`. Otherwise every new record is filtered
out on reload, which is the single worst failure mode available in this phase.

The renderer reads `r.name || r.initials || "—"`. Pre-CS034 records display their initials
forever.

⛔ A later profile rename NEVER updates existing records. Snapshot at commit, exactly as
profileName already is.

New additive fields on new records:
  durationS      <- Math.round(game.stats.gameTime)
  saucerKills    <- game.stats.saucerKills
  satelliteKills <- game.stats.debrisKills

⚠ Note the local field is `satelliteKills`, not `debrisKills` — it is new, so it takes the
canonical CS034 name (Garbage Satellites) rather than inheriting the inverted one. The runtime
counter keeps its existing name. Comment this so it does not read as a typo.

Existing fields (v, id, score, wave, delivered, ts, build, profileId, profileName) unchanged.

## Part 3 — shaping for extraction

⛔ HighScores READS NO GAME GLOBALS. Today add() reads game/Profiles/GAME_VERSION. After this
phase, `add(record)` takes a COMPLETE PLAIN OBJECT and the CALLER assembles it. HighScores
owns sorting, capping, persistence, querying. Nothing else. Same seam kit-leaderboard draws:
"never reaches into game state, never touches the DOM, never renders anything."

Assemble ONE `RunResult` object at the gameover seam and hand it to BOTH HighScores.add()
AND Leaderboard.submit(). Today those two sites read the same counters independently and can
drift; after this they read one object. That is the seam a future kit-scores extracts along.

Surface: qualifies(), add(), save(), load(), and a new filtered(profileId). That is all.

⛔ STORAGE_KEY "afd_scores_v1" is FROZEN. Extraction later carries the key; it never renames it.

## Part 4 — capacity and filter

SCORES_MAX 10 -> 25.

⚠ SETTLED (CS031 FORK-B a): afd_scores_v1 stays ONE SHARED MACHINE-WIDE TABLE. Not
re-litigated. The filter is a VIEW.

drawHighScores / menuHighScores gain a ◄/► toggle, mirroring drawLeaderboard's window cycling:

  ALL PROFILES   /   THIS PROFILE

THIS PROFILE filters on `r.profileId === Profiles.activeId`. Pre-CS031 records have no
profileId and never appear there — correct, they predate profiles.

⛔ qualifies() and add() ALWAYS operate on the UNFILTERED table. A record must not qualify
differently depending on which screen was last open.

## Part 5 — layout

GAMEOVER screen: drawScoreTable() at scale 1 keeps its CURRENT FIVE COLUMNS. Only
INITIALS -> NAME changes. It shows the top ten rows of a now-25-deep table. STATUS.md records
that table is already tight against GAMEOVER_HINT; re-flowing it is out of scope.

BROWSABLE screen: its own renderer, full column set:

  #   NAME   SCORE   LEVEL   TIME   DEBRIS   SAUCERS   SATELLITES

TIME uses P4's fmtDuration(). DEBRIS is the delivered count (canonical vocabulary: the towed
objects). Missing fields render "—".

25 rows will not fit. Scroll it — game.menu.scroll with ACH_SCROLL_STEP, the Achievements
viewer's exact idiom, clamped against a new scoresMaxScroll() that BOTH the renderer and the
input handler read (never two copies of the ceiling maths).

⚠ Per celebrationMaxScroll()'s header: measure content height FROM THE CLIP TOP, not from row
0's baseline. achMaxScroll() measures from the baseline and falls its own headroom short —
invisible there, not invisible here.

⚠ FLAG-CS034-b — DESIGN CALL, FLAGGED. HS_TABLE_SCALE is 1.8 and its header warns the offsets
are hand-computed for it. Eight columns at 1.8 will not fit 1000px. Best guess: drop the
BROWSABLE screen to 1.4 and re-derive topY / footer / panel h by hand, as that header
instructs. Surface in STATUS.md Playtest asks for GATE B.

## Part 6 — reset

Extend resetHighScores() to the SAME two-stage confirmation P6 built (openModal, then
openNameEntry with a "reset" validator). Surface it on the High Scores screen so it is
reachable without the secret debug code. The debug panel's existing "Reset saved scores" row
STAYS, now routing through the same flow.

⛔ It clears in-memory entries AND the persisted key THROUGH HighScores.save() — never
removeItem. Unchanged contract. It also clears game.lastScoreId.

## Test

New file `scratchpad/test-cs034-p7.js`, using scratchpad/_harness.js.

Assert:
- A qualifying run at the death seam writes a record with `name` === the active profile's
  name, no `initials` key, and game.lastScoreId set to it.
- A record written before a rename keeps its old name after the rename.
- load() accepts a record with `name` and no `initials` (the round-trip: add, save, reload,
  still present). ALSO accepts a legacy record with `initials` and no `name`.
- durationS / saucerKills / satelliteKills are present and match game.stats.
- SCORES_MAX is 25 and the table caps there.
- filtered(activeId) returns only that profile's records; a pre-CS031 record (no profileId)
  appears under neither profile.
- qualifies() answers identically regardless of the current filter setting.
- A debug run and a resumed run each write NO record.
- resetHighScores() empties entries, persists the empty table, and clears lastScoreId.
- game.entry no longer exists on the game object.
- ⛔ Assert only what this phase owns. No global counts.

## DO NOT

- Do not delete SCORES_CHARSET.
- Do not remove `initials` from the load filter's tolerance — legacy records must survive.
- Do not rename or version-bump afd_scores_v1. FROZEN.
- Do not route afd_scores_v1 through Profiles.keyFor() — ⚠ SETTLED, machine-wide.
- Do not switch to top-N per profile — ⚠ SETTLED, and Paul chose (a).
- Do not create a kit-scores module. Shape only.
- Do not change the gameover table's column set.
- Do not extend Leaderboard.eligible().
- Do not touch achievements — P6 owns those.
- Do not push.

## DONE WHEN

- `grep -n "game.entry\|entryInput\|drawEntrySlots\|commitEntry" orbital-overhaul.html`
  returns nothing.
- `grep -n "SCORES_CHARSET" orbital-overhaul.html` still returns its declaration and
  NAME_CELLS' use.
- Suite passes from a FULL clone:
  `node scratchpad/run-all.js` → `135 files: 135 passed, 0 failed, 0 skipped, 0 timed out`
- GDD §2.18 (High Scores) rewritten for the new shape, filter, columns and reset.
- STATUS.md carries FLAG-CS034-b under Playtest asks.
- STATUS.md phase ledger has a one-line P7 entry (new paragraph, `\n\n` — verify it).
- Committed on main. NOT pushed.
```

---

# P8 — Delivery-ticker port

**Blocked on GATE A. Do not start without A1–A9 answered.**

```
claude --model sonnet
```

```
ultrathink

You are implementing ONE phase of changeset CS034 for Orbital Overhaul. Read CLAUDE.md,
then STATUS.md, then PLANNED-FEATURES-CS034.md §3. Build only what this prompt scopes.

WORK FROM A FULL CLONE (not --depth 1).

## Gate A values — PASTE PAUL'S ANSWERS HERE BEFORE RUNNING THIS PHASE

  deliveryFloatSize      = ___
  deliveryFloatSizeStep  = ___
  deliveryFloatSizeMax   = ___
  deliveryFloatHold      = ___
  deliveryFloatFade      = ___
  deliveryFloatRise      = ___   (existing knob; may be unchanged at 160)
  DELIVERY_FLOAT_ANCHOR_FRAC = ___   (existing const; may be unchanged at 0.50)

If any line above is still blank, STOP and tell Paul. Do not guess a value.

## Grep anchors

- `class FloatText`               — constructor, update(), draw()
- `game.deliveryTicker` / `releaseDeliveryTicker`
- `DELIVERY_FLOAT_ANCHOR_FRAC`
- `DEBUG.deliveryFloatRise` / `DEBUG.deliveryFloatLife`
- `{ header: "DELIVERY" }`        — the registry section
- `game.deliveryCount`
- `scratchpad/test-registry.js`   — the ONE place global counts live

## Part 1 — FloatText gains a fade field

ONE optional trailing field, defaulting to `life`:

  constructor(text, x, y, color, size = 16, rise = 30, life = 1.1, fade = life)

draw() becomes `globalAlpha = max(0, min(1, life / fade))`.

⛔ With fade === life0 this must be BYTE-IDENTICAL to today's `max(0, life / life0)` for
every pre-existing call site. Every existing caller omits the new field. This is the same
trailing-optional pattern CS026 P4's rise/life and CS029 P4's pinned already established —
follow it exactly.

⛔ THE HOLD CLOCK ONLY RUNS AFTER RELEASE. FloatText.update() early-returns on `pinned`, and
the delivery ticker is pinned for the whole visit. A long visit must never consume the hold.
That is already true; keep it true.

## Part 2 — five new registry rows, one retired

Add to the DELIVERY section:

  deliveryFloatSize      "Delivery floater size"       px          min 12  max 64  step 1
  deliveryFloatSizeStep  "Delivery floater size/piece" px          min 0   max 6   step 0.5
  deliveryFloatSizeMax   "Delivery floater size cap"   px          min 16  max 96  step 1
  deliveryFloatHold      "Delivery floater hold"       s           min 0   max 3.0 step 0.05
  deliveryFloatFade      "Delivery floater fade"       s           min 0.1 max 3.0 step 0.05

Defaults are the Gate A values above.

RETIRE `deliveryFloatLife`. It has exactly two readers, both in the delivery ticker path,
both replaced by the hold/fade pair.

⚠ Retiring a registry row REMOVES a field from persisted settings. CLAUDE.md's standing rule
covers it: "Removing a field needs no key rename and no migration shim — a saved value for a
deleted field orphans harmlessly." DO NOT WRITE A MIGRATION SHIM.

Registry moves 87 -> 91. Section headers unchanged. LEVERS unchanged at 18.

⛔ scratchpad/test-registry.js is the ONE file that carries the new count. Do NOT add a count
assertion anywhere else, and do NOT let your own new test assert a total.

## Part 3 — the ticker

At the site that already rewrites `.text` from `.total`, also recompute size:

  size = min(deliveryFloatSizeMax,
             deliveryFloatSize + deliveryFloatSizeStep * (game.deliveryCount - 1))

Construct the ticker with:
  size  = deliveryFloatSize             (deliveryCount is 1 on the first piece)
  rise  = DEBUG.deliveryFloatRise
  life  = DEBUG.deliveryFloatHold + DEBUG.deliveryFloatFade
  fade  = DEBUG.deliveryFloatFade

The hardcoded literal 16 at the construction site goes away.

If Gate A changed DELIVERY_FLOAT_ANCHOR_FRAC, update the const and its comment. If it did
not, leave both alone. That const is NOT a knob — its header says so; keep it a const.

## Part 4 — the milestone clearance (Gate A9)

If A8 reported <= 0 clearance and A9 says "milestone floaters move up", adjust the SALVAGE
BONUS / MAX HAUL birth y (currently `game.dock.y - 22`) by the amount Gate A implies, and
record the measured clearance in a comment. If A9 says "accept overlap" or "ticker stays",
change nothing here and record the accepted overlap in STATUS.md's Balance notes.

## Test

New file `scratchpad/test-cs034-p8.js`, using scratchpad/_harness.js.

Assert:
- A FloatText constructed with no `fade` has fade === life, and its alpha at half-life
  matches the pre-CS034 formula.
- A FloatText with fade < life holds alpha 1.0 while life > fade, then falls linearly.
- alpha never exceeds 1.0 and never goes below 0.
- The delivery ticker's size grows by deliveryFloatSizeStep per piece and clamps at
  deliveryFloatSizeMax.
- The ticker's life does NOT decrease while pinned, across many update() frames.
- After releaseDeliveryTicker(), life decreases normally.
- DEBUG.deliveryFloatLife no longer exists.
- ⛔ Assert only what this phase owns. NO registry count — that belongs to test-registry.js.

## DO NOT

- Do not change DOCK_OFFLOAD_INTERVAL, DOCK_BASE_SCORE, DOCK_BONUS_STEP, or DOCK_COMBO_GRACE.
- Do not change any of the four releaseDeliveryTicker() call sites or their reasons.
- Do not make DELIVERY_FLOAT_ANCHOR_FRAC a registry knob.
- Do not add a second alpha path or a second fade curve. One formula, one place.
- Do not write a migration shim for the retired knob.
- Do not touch tools/dock-float-lab.html — P1 owns it and it is not shipped code.
- Do not push.

## DONE WHEN

- `node --check` passes on the extracted script.
- `grep -n "deliveryFloatLife" orbital-overhaul.html` returns nothing.
- test-registry.js reads 91 registry entries, 18 levers.
- Suite passes from a FULL clone:
  `node scratchpad/run-all.js` → `136 files: 136 passed, 0 failed, 0 skipped, 0 timed out`
- DIFFICULTY-LEVERS.md's registry documentation reflects the five new rows and the retired one.
- STATUS.md phase ledger has a one-line P8 entry (new paragraph, `\n\n` — verify it).
- Committed on main. NOT pushed.
```

---

# GATE B — blocking playtest

**Between P8 and P9. P9 does not run until these are answered.** Numbers where a slider is
involved; one short line otherwise.

```
B1.  Delivery ticker readability, 1–5 (5 = perfectly readable)   =
B2.  If B1 <= 3, which is wrong: size / hold / fade / growth     =
B3.  Does the per-piece growth read as "the chain is paying"?  yes / no  =
B4.  Milestone floater overlap at the shipped values: none / touching / overlapping =

B5.  Hunter Debris yield now feels: too thin / right / still too rich  =
B6.  Highest wave reached in this playtest                       =
B7.  Did delivery combos (8 / 12 / 24) still feel reachable at that wave?  yes / no =

B8.  "LEVEL N COMPLETE" header — does level end read clearly now?  yes / no =
B9.  Is the sub-line wording right, or reword it?  ok / <replacement text> =

B10. FLAG-CS034-a: ENTER on the Achievements screen now resets instead of leaving.
     Acceptable?  yes / no — if no: <where should the reset live instead> =
B11. Two-stage reset (modal, then type "reset") — too heavy / right / too light =
B12. Did you test the reset with a gamepad?  yes / no — and did it work?  =

B13. FLAG-CS034-b: browsable High Scores at scale 1.4 — readable?  yes / no
     If no, give a scale number (1.0–1.8)                         =
B14. Eight columns — any you would drop?  none / <column names>   =
B15. Profile filter (ALL / THIS PROFILE) — does the toggle read clearly?  yes / no =
B16. 25 rows — right depth, or give a number                      =

B17. Leaderboard TIME column — format right?  yes / no            =
B18. Post a real score and check the board: is the ⚑ flag gone on the new row?  yes / no =

B19. Anything broken that is not on this list?                    =
```

---

# P9 — Closing

```
claude --model sonnet
```

```
ultrathink

You are running the CLOSING phase of changeset CS034 for Orbital Overhaul. Read CLAUDE.md,
then STATUS.md, then PLANNED-FEATURES-CS034.md. This phase makes ZERO game-logic changes
except any explicitly required by the Gate B answers pasted below.

WORK FROM A FULL CLONE (not --depth 1).

## Gate B answers — PASTE PAUL'S ANSWERS HERE BEFORE RUNNING THIS PHASE

  <paste B1–B19>

If that block is empty, STOP and tell Paul.

## 1. Fold in the gate outcomes

Apply only what Gate B asks for. Each of B2, B9, B10, B13, B14, B16 may imply a small,
bounded change. If any answer implies a change larger than a constant, a string, or a column
list, STOP AND SURFACE IT rather than building it — that is a new phase, not a closing edit.

## 2. Version bump

GAME_VERSION "1.0.0.33" -> "1.0.0.34".

⚠ SETTLED (CLAUDE.md): at a version bump, a phase-local version pin flips to its STANDING
MIRROR IMAGE (`!== "1.0.0.N"`, permanently true). It is NOT re-pointed to a new literal. The
small deliberate set of LIVE pins that genuinely track HEAD's version ARE re-pointed. Know
which is which before you touch either — grep for both shapes.

## 3. STATUS.md roll

⛔ Move the WHOLE of the current STATUS.md into log/CS034.md, then reset STATUS.md to the
format CLAUDE.md specifies. Registry count and LEVERS count are READ OFF THE LIVE BUILD, not
copied from this document:

  grep -c on DEBUG_VARS' non-header entries, and LEVERS.length

Expected after P8: Registry 91, Levers 18. If the live build disagrees with 91, TRUST THE
BUILD and say so.

Header line: `Version: 1.0.0.34 · Changeset: CS034 · Phase: P9 · Registry: NN · Levers: NN`

⛔ Every entry starts on its own paragraph (`\n\n`). If you append with a shell redirect,
VERIFY the written entry actually begins a new paragraph — a missing trailing newline once
fused years of entries into a single 160 KB line.

Carry forward, still open: FLAG-CS032-a, the returnToTitleMenu() landing-row issue,
FLAG-CS031-c, FLAG-CS027-c, FLAG-CS027-d, the CS028 piece-distinctness call, the CS023
satellite-vs-satellite playtest gap, the CS029 milestone-floater clearance note (updated for
CS034's larger ticker), and P6's blankLegacyStores() save-gate note.

## 4. Corrections this changeset owes the docs

- ⛔ STATUS.md says "Ten suite files still hard-fail, not skip, on a shallow clone." THE REAL
  COUNT IS FOURTEEN: test-cs017-p6, cs019-p1, cs020-p1, cs020-p1b, cs023-p2, cs023-p3,
  cs024-p1, cs024-p2, cs024-p4, cs024-p6b, cs024-p6f, cs026-p1, cs026-p2, cs029-p1. Verify by
  running the suite in a --depth 1 clone yourself, then write the number you measured.

- CLAUDE.md's "Design instruments (tools/)" list is MISSING tools/emblem-lab.html, which
  exists on disk and appears in the GDD. Add it.

- CS033 shipped the online leaderboard with NO GDD §2 section — §2 currently ends at 2.22
  (Save/Load). ADD §2.23 Online Leaderboard, describing shipped CS033 behaviour (the module
  bridge, beginRun/submit seams, the board screen, eligibility, NAME_CHANGE_NOTICE, the queue
  indicator) PLUS CS034's changes (the corrected stats key, the TIME column). §2 is SHIPPED
  BEHAVIOUR ONLY — do not describe the deferred just-me filter or Version column there.

## 5. log/CS034.md

Per-changeset narrative log plus this changeset's version-history entry under
`## GDD version history`. ⛔ There is no central changelog and no GDD-VERSION-HISTORY.md.

Record, with reasoning: the vocabulary inversion and why code symbols were NOT renamed; the
Hunter Debris reversal and that it partially reverses v3.3 P4's own reversal; the
garbage_satellite_kills bug, how long it was live, and that already-posted rows stay flagged;
the initials-entry deletion; the RunResult seam; and every Gate A and Gate B answer.

## 6. DECISIONS.md

Currently says no open off-cycle decisions are outstanding. CS034 ran through a full planning
doc, so nothing should have accumulated there. If any phase DID record an entry, retire it
into log/CS034.md per that file's own retire rule.

## 7. Archive

Move PLANNED-FEATURES-CS034.md and IMPLEMENTATION-PHASES-CS034.md to archive/.

Nothing else is due — archive/ already ends at CS032, and CS033 deliberately produced no
planning docs (STATUS.md P4 note). Do NOT author retroactive CS033 docs.

## 8. Deferred work — record it, do not build it

Write into log/CS034.md, under a clear "Deferred to coinless-kit" heading, the exact shape of
the follow-up so a future session needs no archaeology:

- services/leaderboard/src/board.js — add game_version to the SELECT and the entries map; add
  an optional `player` query param branching to a per-player query. idx_scores_player_best
  already exists for it.
- modules/kit-leaderboard/kit-leaderboard.js — map gameVersion in fetchBoard's entry map;
  accept and forward a player/scope option.
- docs/kit-leaderboard-client-api.md — document both.
- ⚠ Design question for THAT changeset, not this one: worldwide is "top players, one row
  each"; "just me" almost certainly wants "my top N runs". Those are different queries, not
  one query with a filter.
- Then a follow-up GAME changeset renders the Version column and the scope toggle, at which
  point item 12's two-line row layout becomes necessary (six fields will not fit one line).

## DO NOT

- Do not make game-logic changes beyond what Gate B explicitly asks for.
- Do not touch coinless-kit.
- Do not author retroactive CS033 planning docs.
- Do not sweep archive/ or log/.
- Do not re-point a phase-local version pin to a new literal.
- Do not copy the registry count from any document — read it off the build.
- Do not push.

## DONE WHEN

- GAME_VERSION is "1.0.0.34".
- STATUS.md is reset, one page, header line correct, registry/levers read off the build.
- log/CS034.md exists with the narrative, the GDD version-history entry, both gates' answers,
  and the deferred-work section.
- CLAUDE.md lists emblem-lab.html. GDD has §2.23.
- Both CS034 planning docs are in archive/.
- Suite passes from a FULL clone, ZERO SKIPS:
  `node scratchpad/run-all.js` → `136 files: 136 passed, 0 failed, 0 skipped, 0 timed out`
  ⛔ A closing phase asserts zero skips. A skip here means a phase-local pin lost its history —
  investigate, do not accept it.
- Committed on main. NOT pushed. Paul pushes.
```

---

## Running totals

| After | Suite files | Registry | Version |
|---|---|---|---|
| baseline | 130 | 87 | 1.0.0.33 |
| P1 | 130 | 87 | 1.0.0.33 |
| P2 | 130 | 87 | 1.0.0.33 |
| P3 | 131 | 87 | 1.0.0.33 |
| P4 | 132 | 87 | 1.0.0.33 |
| P5 | 133 | 87 | 1.0.0.33 |
| P6 | 134 | 87 | 1.0.0.33 |
| P7 | 135 | 87 | 1.0.0.33 |
| P8 | 136 | **91** | 1.0.0.33 |
| P9 | 136 | 91 | **1.0.0.34** |

⛔ Registry moves once, at P8, and `scratchpad/test-registry.js` is the only file that
carries the number.