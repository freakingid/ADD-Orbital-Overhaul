# IMPLEMENTATION PHASES — CS018

Baseline `26a6846` (CS017 P7, `1.0.0.17`). Target `1.0.0.18`, bumped in **P10**.

**Session discipline.** One Claude Code session per phase, one commit per phase.
Set the model with `/model` **before** pasting the prompt. Paul commits and
pushes; Claude Code never pushes.

**Before the first session.** Claude Code works in the repo directory and needs
no attachments — `CLAUDE.md` is auto-loaded. Two prerequisites:

1. Commit `PLANNED-FEATURES-CS018.md` and this file to the repo root, so they are
   on disk for every session.
2. Move `PLANNED-FEATURES-CS017.md` and `IMPLEMENTATION-PHASES-CS017.md` into
   `archive/`. They are spent, and leaving them at root means a glob for
   `IMPLEMENTATION-PHASES-*.md` matches two changesets — the CS014 naming
   collision, repeated.

**Reading discipline.** Because Claude Code can read everything, each session
must be told what *not* to read. The repo holds ~1.2 MB of documentation.

| File | How to read it |
| --- | --- |
| `PLANNED-FEATURES-CS018.md`, this file | in full |
| `DIFFICULTY-LEVERS.md` (16 KB) | in full |
| `asteroids-deluxe.html` (433 KB, 7074 lines) | **grep by symbol, then ranged reads.** Never whole. |
| `STATUS.md` (566 KB) | tail only, for current build state. Never whole. |
| `ORBITAL-OVERHAUL-GDD.md` (365 KB) | only the section a prompt names. Never whole. |
| `GDD-VERSION-HISTORY.md` (231 KB), `archive/`, any CS017 planning doc | **do not read.** Instructions for a shipped changeset; they will conflict with CS018. |

**Paste this preamble at the top of every session**, before the phase prompt:

```
Read PLANNED-FEATURES-CS018.md and IMPLEMENTATION-PHASES-CS018.md in full, then
DIFFICULTY-LEVERS.md. Work phase P<N> ONLY — do not start any later phase.

Grep asteroids-deluxe.html by symbol and read ranges; do not read it whole. Read
only the tail of STATUS.md and only the GDD sections this phase names. Do not
read GDD-VERSION-HISTORY.md, anything in archive/, or any CS017 planning doc —
CS017 is shipped and its instructions conflict with CS018.

Do not commit or push. Report what you changed and the test results, and stop.
```

**Phase order rationale.** P1 lands the table inert and fully tested while
nothing reads it. P2 fixes the debug panel *before* 23 knobs arrive in it (it
already overflows today). P3–P7 repoint consumers group by group, each a clean
revert point. Old constants stay in place as documented values until P10 sweeps
them. This is the CS014 lesson made structural.

| Phase | Scope | Model | Effort | Player-visible |
| --- | --- | --- | --- | --- |
| P1 | `levelDef(n)` + tables, inert | Opus 4.8 | xhigh, thinking on | no |
| P2 | Debug panel: scroll, numeric entry, headers | Opus 4.8 | high | no (hidden panel) |
| P3 | Junk count + speed; `bonusSpawnChance` re-home | Sonnet 5 | high | **yes** |
| P4 | Hunter freeze + cap; retire cycle clock | Opus 4.8 | xhigh, thinking on | **yes** |
| P5 | Payload slots from the table | Sonnet 5 | high | **yes** |
| P6 | Saucer movement + appearance + jitter | Sonnet 5 | high | **yes** |
| P7 | Saucer weapons (fire rate, accuracy, shot speed) | Sonnet 5 | high | **yes** |
| P8 | Delivery reward tiers 8/12/16/20 | Sonnet 5 | high | **yes** |
| P9 | Super Mega Delivery sweep (silent) | Opus 4.8 | xhigh, thinking on | **yes** |
| ⛔ | **STOP — voice lab pass required** | — | — | — |
| P10 | SMD voice line, version bump, doc sweep | Sonnet 5 | high | **yes** |

---

## P1 — `levelDef(n)`, landed inert

**Goal.** The complete progression as one pure function, with headless tests, read
by nothing. Reviewable in isolation; zero observable gameplay change.

| Anchor | Symbol | Note |
| --- | --- | --- |
| Insert after | `const CYCLE_GAIN` block (difficulty-ramp constants) | keeps difficulty constants together |
| Do not touch | `nextWave`, `DebrisSatellite`, `HunterSatellite`, `Saucer`, `cycleValue` | P3+ |

**Prompt.**

```
ultrathink

Read PLANNED-FEATURES-CS018.md §3 in full before writing anything.

Add the CS018 level progression to asteroids-deluxe.html as a PURE function
levelDef(n), plus its supporting tables and the shared stepAt() helper, exactly
as specified in §3. Place them immediately after the CYCLE_GAIN constant in the
difficulty-ramp block.

Hard requirements:
- levelDef reads NO game state. It takes a level number and returns an object.
  It must be callable before startGame().
- Nothing in the build may call levelDef in this phase. Grep to confirm zero
  call sites when you are done. This phase must not change observable gameplay.
- Do not modify, remove or repoint cycleValue, CYCLE_LENGTH, CYCLE_GAIN,
  game.cycle, game.cycleWave, nextWave, DebrisSatellite, HunterSatellite or
  Saucer. They retire in later phases.
- Levels 64+ must be field-identical to level 63 except the `level` field.
- stepAt() is ONE helper used by the hunter cap and all seven tier tables. Do
  not write per-lever lookup logic.
- Comment the four-of-seven inverted-tier convention (PLANNED-FEATURES §1.1 of
  the source notes) at the tier tables, and do NOT add any validator or sanity
  check that assumes low <= normal <= high numerically.

Then write a headless test that runs in node and covers test items 1-6 of
PLANNED-FEATURES-CS018.md §6. Put it in scratchpad/ (not repo root, not the
game file). Extract levelDef by reading the HTML and evaluating the relevant
block, or by whatever mechanism is least invasive. Print a pass/fail summary
with the count of assertions run.

Expected results: junkCount at levels 1-21 is 3,5,9,13,3,5,9,13,3,5,9,13,3,5,
9,13,3,5,9,13,13. payloadSlots at 1-13 is 8,8,8,8,10,12,14,16,18,20,22,24,24.
maxLargeHunters at 1-21 is 0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,5,5,5,5,7. Level 22
maxLargeHunters is 8, level 34 is 10, level 43 is 11, level 59 is 12.
ufoShotSpeed tier is "low" through level 50, "normal" at 51-62, "high" at 63.

Report the assertion count and any mismatch. Do not change the spec to make a
test pass — if a spec derivation is wrong, say so and stop.
```

**Commit.** `CS018 P1: levelDef progression table + stepAt helper (inert, tested)`

---

## P2 — Debug panel: scrolling, numeric entry, section headers

**Goal.** Make the panel usable at 32 rows. Fixes a live overflow bug. No new
knobs yet.

| Anchor | Symbol | Current |
| --- | --- | --- |
| Panel render | `drawDebug()` | `h = 220 + (N + 1) * 46`; 818 px at N=12 vs `VIEW_H` 720 |
| Panel input | `menuDebug(a)` | action-based: `up/down/left/right/confirm/back` |
| Panel open | `openDebug()`, `gotoScreen("debug")` | sets `game.menu.index = 0` |
| Registry | `DEBUG_VARS` | 12 entries, each `{id, label, unit, def, min, max, step, toNative?}` |
| Raw keys | the `keydown` listener holding `DebugCode` | where numeric entry must hook |

**Work.** Clamp panel height to a viewport-safe maximum and render a scrolling
window of rows with the selection kept in view. Add non-selectable section
headers (FLAG-j) skipped by `up`/`down`. Add keyboard direct numeric entry on the
selected value row, clamped to `min`/`max`, committed on Enter and cancelled on
Escape. `left`/`right` stepping, d-pad and arrow navigation all keep working
unchanged and none is a fallback for another.

**Prompt.**

```
ultrathink

The hidden debug panel in asteroids-deluxe.html must support 32 registry
entries in CS018. It currently cannot: drawDebug() computes
h = 220 + (N + 1) * 46, which is 818px at N=12 against VIEW_H 720, so the panel
already overflows and drawMenuHint at y + h - 30 renders off-screen. Verify
that before you start.

Do three things, and add NO new DEBUG_VARS entries in this phase:

1. SCROLLING. Clamp the panel to a viewport-safe height and render a scrolling
   window of value rows. Keep the selected row visible (scroll to follow the
   selection, both directions, including wraparound from last to first). Show a
   position indicator so it is obvious more rows exist. The Dump and Back rows
   must remain reachable.

2. SECTION HEADERS. Support an optional non-selectable header row in
   DEBUG_VARS, e.g. { header: "JUNK" }. up/down must skip headers entirely so
   they never become the selection. Derive all row indices from the registry;
   never hardcode a row count or an offset. Add headers for the CURRENT 12
   entries so the mechanism is exercised and reviewable now.

3. KEYBOARD NUMERIC ENTRY. On a selected value row, typing digits (and "." and
   "-") builds a pending value shown in place of the current one; Enter commits
   it through the same applyDebug + saveSettings path as arrow stepping; Escape
   cancels. Clamp to the entry's min/max on commit. While an entry is pending,
   left/right must not step and back must not leave the screen.

   menuDebug(a) receives abstract actions, not raw keys, so numeric entry needs
   a hook in the keydown listener. Gate it strictly on being on the debug
   screen with a value row selected, and make sure it cannot interfere with the
   DebugCode secret-sequence capture.

Constraints:
- Gamepad d-pad and keyboard arrows must both still navigate and adjust. All
  input methods coexist; none replaces another.
- Persistence stays exactly as it is: display units in afd_settings_v1.debug
  via the existing generic path. Do not rename or version the key.
- Do not add any validation that assumes one field's value must be <= or >=
  another's. CS018 ships four levers whose values DECREASE as difficulty rises.

Test manually and report: the row count, the panel height, that the first and
last rows are reachable, and that a typed value round-trips across a reload.
```

**Commit.** `CS018 P2: debug panel scrolling, section headers, numeric entry`

---

## P3 — Junk count and speed on the table

| Anchor | Symbol | Current |
| --- | --- | --- |
| Count | `nextWave()` | `Math.min(Math.round(cycleValue(Math.min(3 + game.cycleWave, DEBRIS_COUNT_MAX), game.cycle)), DEBRIS_COUNT_HARD_MAX)` |
| Speed site 1 | `nextWave()` | `const speedMul = cycleValue(1 + (game.cycleWave - 1) * DEBRIS_SPEED_PER_WAVE, game.cycle)` |
| Speed site 2 | `destroyDebris()` split branch | **byte-identical expression** — both must move together |
| Consumer | `DebrisSatellite` ctor | `Math.min(DEBRIS_SPEEDS[size] * speedMul * rand(0.7, 1.3), DEBRIS_SPEED_CAP)` |
| Re-home | `bonusSpawnChance()` | reads `game.cycleWave` (FLAG-f) |

**Prompt.**

```
Repoint junk (debris) count and speed onto levelDef() from CS018 P1. Read
PLANNED-FEATURES-CS018.md §3.1, §3.2 and FLAG-f first.

1. Add three DEBUG_VARS entries for the junk satellite speed tiers (low 58,
   normal 70, high 90; unit "px/s", step 2, min 20, max 400) under a JUNK
   section header. normal 70 is the shipped DEBRIS_SPEEDS[3] value and is the
   single source of truth for that default.

2. nextWave(): replace the debris count expression with
   levelDef(game.wave).junkCount. Remove the DEBRIS_COUNT_MAX and
   DEBRIS_COUNT_HARD_MAX clamps from this site (the table is already bounded).
   Leave both constants defined for now with a comment marking them retired.

3. Replace the speedMul derivation at BOTH sites with a single named helper
   that returns the tier px/s divided by 70, so DebrisSatellite's existing
   DEBRIS_SPEEDS[size] * speedMul expression scales sizes 2 and 1 by the
   shipped 70/110/160 ratio. There are exactly TWO derivation sites — nextWave
   and the destroyDebris split branch — and they must stay byte-identical, as
   the existing comment demands. Grep to confirm you found both.

4. Keep DEBRIS_SPEED_CAP as the guard rail in the DebrisSatellite ctor and keep
   the rand(0.7, 1.3) per-entity roll. Do not change either.

5. bonusSpawnChance() reads game.cycleWave, which retires in P4. Re-home it to
   the junk cycle position now: use levelDef(game.wave).rel, taking
   (rel - 1) % 4 as a 0..3 position so it stays "common right after a reset,
   rare at the cycle's end". Keep the documented linear interpolation and both
   endpoint constants hitting their exact values. Update the comment.

Do NOT touch hunters, saucers, cargo, cycleValue, game.cycle or game.cycleWave
in this phase — they are P4.

Headless test: assert debris count at levels 1-21 is 3,5,9,13 cycling with 13
at level 21, and that the two speedMul sites produce identical values for the
same level. Report the numbers.
```

**Commit.** `CS018 P3: junk count + speed on levelDef; bonus canister re-homed`

---

## P4 — Hunter freeze, hunter cap, cycle clock retirement

The subtlest phase. Two spawn sources, an achievement interaction, and the clump
hold-at-final-stage edge case.

| Anchor | Symbol | Current |
| --- | --- | --- |
| Speed/turn | `HunterSatellite` ctor | `cycleValue(ramp(HUNTER_SPEED_CEIL[size] * HUNTER_FLOOR_FRAC, HUNTER_SPEED_CEIL[size], game.cycleWave), game.cycle)` and the turn twin |
| Ambient spawn | saucer/hunter timer block | `game.hunterTimer <= 0 && game.hunters.length === 0 && game.wave >= 2` → `HunterSatellite.spawnCore()`, `rand(20, 32)` |
| Coalescence | `coalesceGarbage()` | converts at `HUNTER_COALESCE_COUNT` (12) |
| Lineage stat | same spawn block | `game.stats.hunterLineageKills = 0` (Hunter's Bane, `ACH_LINEAGE_FULL` 13) |
| Clock | `nextWave()`, `startGame()` | `game.cycle`, `game.cycleWave` assignments |
| Log | `logDifficultySnapshot()` | logs `cycle`, `cycleWave`, `hunterSpeedFrac`, `hunterTurnFrac` |

**Prompt.**

```
ultrathink

Read PLANNED-FEATURES-CS018.md §4.1, FLAG-a, FLAG-i, FLAG-k, FLAG-l and §7
before writing anything.

1. FREEZE HUNTER SPEED AND TURN. In the HunterSatellite constructor, replace
   both cycleValue(ramp(...)) expressions with the level-1 value, frozen for
   the whole game: HUNTER_SPEED_CEIL[size] * HUNTER_FLOOR_FRAC and
   HUNTER_TURN_CEIL[size] * HUNTER_FLOOR_FRAC. Keep the expression rather than
   baking literals so the derivation stays visible. Update the comment to say
   these are frozen with no clock, and that the _CEIL constants are now the
   frozen value's derivation, not a ramp target. Confirm in your report that
   HUNTER_LAST_STAND_SPEED (50) is still below the frozen medium speed (69.6),
   which an existing comment asserts.

2. ADD THE HUNTER CAP. A helper returns the count of live LARGE hunters
   (size === 3, not dead). The cap is levelDef(game.wave).maxLargeHunters.
   It governs BOTH producers:
   - The ambient spawner: replace the game.hunters.length === 0 gate with
     largeHunterCount() < cap. This is the change that lets multiple lineages
     coexist, which a cap of 7/10/12 requires. Keep the game.wave >= 2 gate and
     the rand(20, 32) timer.
   - Coalescence: a clump reaching HUNTER_COALESCE_COUNT while
     largeHunterCount() >= cap must NOT convert. It holds at the final
     coalescence stage: it does not convert, does not grow past 12 pieces, and
     its decay clock keeps running so it can still age out. Merges into it still
     reset the clock per the shipped rule.

   The cap counts SPAWN SLOTS, not objects. Middle and small hunters must never
   be counted and are never capped. Destroying a large frees a slot.

3. Cap 0 at levels 1-4 means no large hunter from either source. Ambient
   hunters currently start at level 2, so levels 2-4 lose their hunters. That is
   intended — note it in your report, do not work around it.

4. FIX THE LINEAGE COUNTER (FLAG-i). game.stats.hunterLineageKills currently
   resets on every ambient spawn, which breaks once lineages can coexist. Reset
   it when largeHunterCount() transitions 0 -> 1 instead.

5. RETIRE THE CYCLE CLOCK. Remove cycleValue(), CYCLE_LENGTH, CYCLE_GAIN,
   game.cycle and game.cycleWave, and their assignments in nextWave() and
   startGame(). Grep first and confirm every reader is gone — after P3 the
   remaining ones are the HunterSatellite ctor and logDifficultySnapshot. Keep
   game.waveTime (it loses its only reader when P6/P7 remove wavePressure; log
   it instead). Rewrite logDifficultySnapshot to log level, phase, relative
   level, junkCount, maxLargeHunters and the seven tier names instead of
   cycle/cycleWave/hunterSpeedFrac/hunterTurnFrac.

6. Keep difficultyFactor(), RAMP_WAVES and ramp() alive — MusicSys.setIntensity
   still calls difficultyFactor(game.wave) and that is now their ONLY purpose.
   Comment them as the music-intensity curve.

Report: the frozen speed/turn values per size, that the cap governs both
sources, that no cycleValue/cycle/cycleWave references remain, and what a
12-piece clump does when the cap is full.
```

**Commit.** `CS018 P4: hunter speed/turn frozen, large-hunter cap, cycle clock retired`

---

## P5 — Payload slots from the table

| Anchor | Symbol | Current |
| --- | --- | --- |
| Growth | dock offload block | `const growCap = Math.min(CARGO_CAP_MAX, CARGO_BASE + Math.floor(game.stats.delivered / CARGO_GROW_PER))` + `TOW +1` / `+1 CAP` floaters + `game.cargoFlash` |
| Init | `startGame()` | `game.cargoMax = CARGO_BASE` |
| Field | `game` object | `cargoMax: CARGO_BASE` |

**Prompt.**

```
FORK-CS018-B is resolved: payload capacity is now granted by LEVEL, not earned
by deliveries. Read PLANNED-FEATURES-CS018.md §3 and §1 first.

1. Set game.cargoMax = levelDef(game.wave).payloadSlots in nextWave(), so
   capacity updates at every level including level 1 (startGame calls
   nextWave). Level 1 becomes 8 slots, down from the current 12.

2. Remove the growCap block in the dock offload path entirely: the
   CARGO_GROW_PER derivation, the game.cargoMax assignment, the "TOW +1" and
   "+1 CAP" floaters, and the game.cargoFlash arm that accompanied a cap-up.
   Do NOT remove game.cargoFlash itself or the HUD_CAP_FLASH constant — the
   Maxed Out celebration still uses them.

3. Retire CARGO_GROW_PER. Keep CARGO_BASE and CARGO_CAP_MAX defined as the
   documented bounds, commented as no longer driving growth. Note that
   CARGO_BASE is 12 and is now historical — the level-1 value is 8 and comes
   from the table.

4. Leave the achievement latches alone. Heavy Hauler (deliveryCount === 12),
   The Long Haul, Freight Baron and Maxed Out (=== CARGO_CAP_MAX) are
   deliberately decoupled from cargoMax and must stay that way. They will
   simply become reachable later in a run: 12 needs level 6, 24 needs level 12.
   Confirm in your report that none of them reads cargoMax.

5. Check the HUD cargo ring: the fraction denominator reads game.cargoMax and
   should keep working unchanged, now stepping at level boundaries rather than
   on deliveries. Verify and report.

Headless test: cargoMax equals 8 at levels 1-4, 10,12,14,16,18,20,22,24 at
levels 5-12, and 24 at every level from 13 to 63 and beyond.
```

**Commit.** `CS018 P5: payload slots granted by level, earned tow-cap growth retired`

---

## P6 — Saucer movement, appearance interval, global jitter

| Anchor | Symbol | Current |
| --- | --- | --- |
| Flight speed | `Saucer` ctor | `this.vx = (this.fromLeft ? 1 : -1) * (small ? 150 : 100)` |
| Direction change | `Saucer.update()` | `this.zigTimer = rand(0.8, 1.8)` (also in ctor) |
| Appearance gap | saucer spawn block | `ramp(SAUCER_GAP_FLOOR_MIN, SAUCER_GAP_CEIL_MIN, game.wave)` + `gapPressure` twin |

**Prompt.**

```
Read PLANNED-FEATURES-CS018.md §3.1, §3.2, FLAG-b, FLAG-c and FLAG-e first.

Add nine DEBUG_VARS entries under a UFO MOVEMENT section header plus the two
GLOBAL fields, and repoint three saucer levers onto levelDef tiers.

Fields:
- UFO flight speed low/normal/high: 120 / 150 / 190 px/s, step 2, min 20,
  max 600. normal 150 is the shipped small-saucer vx.
- UFO appearance frequency low/normal/high: 25 / 18 / 13 s, step 1, min 1,
  max 60. NOTE: this lever DESCENDS as difficulty rises.
- UFO direction change frequency low/normal/high: 2.0 / 1.3 / 0.8 s, step 0.1,
  min 0.1, max 10. normal 1.3 is the centre of the shipped rand(0.8, 1.8).
  This lever DESCENDS.
- GLOBAL frequency jitter: 25 percent, step 5, min 0, max 90.
- GLOBAL coalescence pause after sweep: 10 s, step 1, min 0, max 60. Wire the
  field only; its consumer arrives in P9.

Work:
1. Flight speed: Saucer ctor vx uses the tier px/s for the SMALL saucer and
   tier * (100/150) for the big one, preserving the shipped spread. Do not
   touch the vy zig magnitude rand(40, 110).
2. Direction change: replace rand(0.8, 1.8) at BOTH sites (ctor and update)
   with a jittered interval around the tier centre. Grep for zigTimer to find
   both.
3. Appearance interval: replace the two ramp() gap derivations with a single
   jittered interval around the tier centre, and REMOVE the gapPressure lines
   and DEBUG.saucerGapPressure. Retire SAUCER_GAP_FLOOR_MIN/MAX and
   SAUCER_GAP_CEIL_MIN/MAX.
4. Add ONE shared jitter helper used by all three frequency levers:
   rand(c * (1 - j), c * (1 + j)) with j = DEBUG.freqJitter / 100. A percentage,
   not an absolute, so it scales as intervals shorten. Do not write a second
   jitter implementation in P7.

Do NOT add any validator asserting low <= normal <= high. Two of the three
levers here descend; a naive check would reject valid configuration.

Report the panel's new row count and the resulting interval ranges at each tier
with jitter at 25%.
```

**Commit.** `CS018 P6: saucer flight speed, appearance + direction-change intervals on tiers`

---

## P7 — Saucer weapons: fire rate, accuracy, shot speed

| Anchor | Symbol | Current |
| --- | --- | --- |
| Fire interval | `Saucer.rollFireTimer(range)` | `rand(range[0], range[1]) * ramp(SAUCER_FIRE_MULT_FLOOR, SAUCER_FIRE_MULT_CEIL, game.wave)` |
| Accuracy | `Saucer.update()` small branch | `ramp(SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL, 1 + (game.wave - 1) * SAUCER_ACCURACY_RAMP_SCALE)` then `+ (...) * wavePressure() * DEBUG.saucerAimPressure` |
| Shot speed | `Saucer.update()` | `new Bullet(this.x, this.y, Math.cos(a) * 380, Math.sin(a) * 380, true)` |

**Prompt.**

```
Read PLANNED-FEATURES-CS018.md §3.1, §3.2 and FLAG-d first.

Add nine DEBUG_VARS entries under a UFO WEAPONS section header and repoint
three levers.

Fields:
- UFO firing frequency low/normal/high: 1.8 / 1.0 / 0.7, unit "x", step 0.1,
  min 0.1, max 4. This is a MULTIPLIER on the shipped SAUCER_FIRE_BIG and
  SAUCER_FIRE_SMALL ranges, not an interval in seconds — the build has two
  ranges (big 1.25s centre, small 0.9s centre) that a single centre cannot
  represent. normal 1.0 is the shipped full-difficulty multiplier. DESCENDS.
- UFO shot accuracy low/normal/high: 30 / 20 / 10 degrees, step 5, min 0,
  max 60 (hard cap 60). normal 20 is the shipped SAUCER_AIM_ERR_FLOOR of
  0.35 rad. DESCENDS. 0 means perfectly accurate.
- UFO shot speed low/normal/high: 300 / 380 / 470 px/s, step 2, min 50,
  max 1200. normal 380 is the current magic number in the Bullet call.

Work:
1. rollFireTimer: replace the ramp(SAUCER_FIRE_MULT_*) multiplier with the
   tier multiplier. Keep SAUCER_FIRE_BIG and SAUCER_FIRE_SMALL as the shipped
   per-size ranges. Retire SAUCER_FIRE_MULT_FLOOR and _CEIL.
2. Accuracy: replace the whole base + pressure expression with the tier value
   converted from degrees to radians at the call site. REMOVE the wavePressure
   term and DEBUG.saucerAimPressure. Retire SAUCER_AIM_ERR_FLOOR,
   SAUCER_AIM_ERR_CEIL and SAUCER_ACCURACY_RAMP_SCALE. The big saucer keeps
   firing rand(0, TAU) — accuracy applies to small (aimed) saucers ONLY. Do not
   make the big saucer aim.
3. Shot speed: replace both 380 literals with the tier value.
4. Now that both pressure consumers are gone, remove wavePressure() itself and
   the DEBUG_VARS entries saucerPressureSecs, saucerAimPressure and
   saucerGapPressure. Grep to confirm no readers remain. KEEP game.waveTime and
   its increment — it is logged by logDifficultySnapshot.
5. Update logDifficultySnapshot's saucer rows to log the tier-derived values
   rather than the retired ramp() mirrors.

Do NOT add a validator asserting low <= normal <= high — two of these three
levers descend.

Report the final DEBUG_VARS count (should be 32) and the aim error in degrees
and radians at each tier.
```

**Commit.** `CS018 P7: saucer fire rate, accuracy, shot speed on tiers; pressure axis removed`

---

## P8 — Delivery reward tiers

| Anchor | Symbol | Current |
| --- | --- | --- |
| Emitter | dock offload block | `if (game.deliveryCount === 10) { dropPowerup(game.dock.x, game.dock.y, ...) }` + `SALVAGE BONUS` floater |
| Speed | `DOCK_POWERUP_SPEED` | launch speed off the dock |
| Latch idiom | same block | `=== 12` Heavy Hauler, `=== CARGO_CAP_MAX` Maxed Out |

**Prompt.**

```
Read PLANNED-FEATURES-CS018.md §4.3 and correction 1 in §2.1 first.

Replace the single === 10 powerup emitter in the dock offload path with four
threshold latches at game.deliveryCount === 8, 12, 16 and 20, each awarding ONE
powerup. Cumulatively this yields 1 powerup for 8-11 pieces, 2 for 12-15, 3 for
16-19, 4 for 20-23 — the CS018 reward table — because deliveryCount passes
through each threshold exactly once per visit. Use the same "passes through N
exactly once per visit" idiom the === 12 Heavy Hauler and
=== CARGO_CAP_MAX Maxed Out latches already use; do not add per-visit flags.

- Each award uses dropPowerup from the dock position on a fresh random vector
  at DOCK_POWERUP_SPEED, exactly as the current === 10 emitter does.
- Keep the "SALVAGE BONUS" floater on the FIRST award (8) only, so the dock
  does not spam identical text four times. Report if you think a per-tier
  floater reads better.
- Fewer than 8 pieces awards nothing. Do not add a consolation drop.
- Do NOT touch the === 12 or === CARGO_CAP_MAX achievement latches.
- Do NOT touch VoiceSys.dockDelivery — its 5/10/15/20 tiers are colour
  commentary and stay as they are this changeset (FLAG-h).
- Leave === 24 alone entirely. The Super Mega Delivery is P9.

Report the powerup count awarded for deliveries of 7, 8, 11, 12, 19, 20 and 23
pieces.
```

**Commit.** `CS018 P8: delivery reward tiers at 8/12/16/20`

---

## P9 — Super Mega Delivery sweep (ships silent)

The highest-risk phase. Snapshot semantics per source document §7.3.1.

| Anchor | Symbol | Note |
| --- | --- | --- |
| Trigger | dock offload block, `game.deliveryCount === 24` | alongside the Maxed Out latch |
| Hit path | `destroyHunter(h, awardScore = true)` | the choke point; `awardScore` gates score **and** achievement counters |
| Cascade risk | `destroyHunter` pushes children into `game.hunters` | see §4.2 |
| Powerups | `dropPowerup(x, y, vx, vy)`, `POWERUP_DROP_WEIGHTS` (6 types) | `guard` gated on `DEBUG.chainGuardMinTow` |
| Pause knob | `DEBUG.sweepCoalescePause` | wired in P6, consumed here |
| Coalescence | `coalesceGarbage()` | must respect the pause |

**Prompt.**

```
ultrathink

Read PLANNED-FEATURES-CS018.md §4.2, FLAG-g, and source-document sections 7.3
and 7.3.1 in full before writing anything. Snapshot semantics are the single
most likely bug in this changeset.

Implement the Super Mega Delivery, triggered when game.deliveryCount reaches 24
in one dock visit. It ships SILENT — no voice line this phase.

PART 1 — guaranteed award at the dock. Spawn one of EACH of the six droppable
powerup types (rapid, triple, scoop, magnet, engine, guard) at the recycle dock,
on fresh random vectors at DOCK_POWERUP_SPEED. This is a guaranteed set, not six
weighted rolls — bypass POWERUP_DROP_WEIGHTS entirely, and bypass the
DEBUG.chainGuardMinTow gate that would otherwise exclude guard (the chain is
empty at this moment, so the gate would always exclude it).

PART 2 — the sweep. THIS IS THE CRITICAL PART.

Capture an explicit snapshot BEFORE doing anything:
    const snap = game.hunters.filter(h => !h.dead);
Then iterate snap, not game.hunters. Do NOT rely on Array.forEach's fixed
visited range and do NOT use for...of over game.hunters — the build contains a
for...of over game.hunters at the shield-ring site, and that idiom WOULD visit
hunters appended during iteration and cascade until the board is destroyed in
one frame. That cascade is exactly what this design must avoid.

For each member of the snapshot, exactly once:
  - Apply one hit via destroyHunter(h, true). Score and achievement counters
    are credited as if the player shot it — awardScore=true gates both in the
    shipped code, which is the behaviour we want. Normal split counts and
    scatter apply: large -> 3 mediums, medium -> 3 smalls, small -> destroyed.
  - Spawn one randomly-chosen powerup at the piece's position, rolled
    independently per piece. Include Health in the pool for these sweep-spawned
    powerups (it is normally ambient-only and absent from POWERUP_DROP_WEIGHTS).
  - EXCEPTION (FLAG-g): destroyHunter already drops a powerup for size === 3.
    Suppress the sweep's extra powerup for large hunters so every swept piece
    pays exactly one, keeping the spawn ceiling honest.

Fragments created BY the sweep must not be hit and must not spawn powerups.
They are not in the snapshot, so this follows automatically — but assert it.

Spawn ceiling: at most 48 powerups may spawn simultaneously from a sweep,
counting the guaranteed six and the per-piece drops. Fixed value, hardcode it,
do not expose it in the panel.

Sweep-spawned powerups use the level's normal float lifetime. No special casing.

PART 3 — coalescence pause. After a sweep, pause coalescence for
DEBUG.sweepCoalescePause seconds (default 10, wired in P6). Without it, every
large becoming a medium frees the whole cap at once and fresh larges form while
the player is still handling the fragment swarm. Pause the CONVERSION and the
merging; do not freeze the decay clocks (pieces should still age out).

This is NOT a board clear. It converts a few large threats into many small ones
while paying out heavily. Total threat does not fall, so no cooldown is needed
and there is no farming incentive.

Headless tests — items 7, 8 and 9 of PLANNED-FEATURES-CS018.md §6:
- Seed N large hunters, sweep, assert exactly N destroyHunter calls, exactly N
  powerups from the sweep (large suppression means N from destroyHunter itself),
  3N mediums alive afterwards, and that NO medium was hit.
- Mixed board (larges + mediums + smalls): assert no piece created during the
  sweep took a hit and the board is not empty afterwards.
- A board implying more than 48 powerups spawns exactly 48.

Report the assertion count, the hunter count before and after for a 10-large
board, and the total powerups spawned.
```

**Commit.** `CS018 P9: Super Mega Delivery sweep with snapshot semantics (silent)`

---

## ⛔ STOP — voice lab pass required before P10

P10 adds a Dan line for the Super Mega Delivery. **Paul must compose and
zero-error-verify the `phon` string in `tools/voice-robot-lab.html` before that
session runs.** Claude Code never derives, authors or edits `phon` strings.

Source document §7.3 suggests *"Super Mega Delivery at your service."* The
existing `dock_20` line is `"I'm not sure I can count that high."`, so the new
line should read as an escalation above that.

Deliver to P10: the final `text` string, the lab-verified `phon` string, and the
event key (recommended: `dock_24`, matching the existing `dock_N` convention in
`VOICE_LINES`).

---

## P10 — Voice line, version bump, documentation sweep

| Anchor | Symbol | Note |
| --- | --- | --- |
| Line table | `VOICE_LINES` → `dock_20` block | insert `dock_24` after it |
| Tier map | `VoiceSys.dockDelivery(n)` | `n >= 20 ? "dock_20" : ...` chain |
| Version | `const GAME_VERSION = "1.0.0.17"` | → `"1.0.0.18"` |

**Prompt.**

```
Final CS018 phase. Paul supplies the lab-verified text and phon strings for the
Super Mega Delivery voice line — use them EXACTLY as given. Do not derive,
edit, re-spell or "improve" the phon string; it was composed and zero-error
verified in tools/voice-robot-lab.html.

1. Add a dock_24 entry to VOICE_LINES immediately after dock_20, using the
   supplied text and phon verbatim.

2. Fire it from the Super Mega Delivery trigger added in P9 — NOT from
   VoiceSys.dockDelivery's threshold chain. The SMD is a distinct event, not a
   fifth delivery tier, and dockDelivery fires on the pop that empties the
   chain, which is a different moment. Leave dockDelivery's 5/10/15/20 chain
   untouched.

3. Bump GAME_VERSION to "1.0.0.18".

4. Update STATUS.md with the CS018 phase log.

5. Rewrite DIFFICULTY-LEVERS.md. Its own section 1 requires updating it in the
   same commit as any lever change, and CS018 changes or retires nine of its
   eleven registry rows. Required content:
   - The two-clock model (section 2.5) is GONE. There is one clock: the level
     table. Say so explicitly and say it reverses CS017 P3, the way P3's own
     header reversed what came before it. Do not patch around the old text.
   - Remove the sawtooth + spiral mechanism (2.3) and the cycleValue references.
   - Registry rows: debris count, debris speed, hunter speed, hunter turn rate
     and the four saucer levers all move to the level-table mechanism or freeze.
     Hunter speed and turn are now FROZEN CONSTANTS with no clock. The bonus
     canister now reads the junk cycle position.
   - The two leverScale levers (powerup size, dock size) are UNCHANGED and still
     ship enabled: false, meaning powerups and the dock remain permanently 2x.
     Do not "restore" 1x.
   - New rows for the seven graded tier levers, the hunter cap, and the payload
     curve. Note the four-of-seven inverted-tier convention and the standing
     prohibition on any low <= normal <= high validator.
   - Record the 48-powerup spawn ceiling and the hunter cap of 12 as the
     changeset's explicit bounds.

6. Update ORBITAL-OVERHAUL-GDD.md section 2 for SHIPPED behaviour only: the
   level progression and its phases, the payload curve, the hunter cap, the
   delivery reward tiers, and the Super Mega Delivery. Note the Hunter's Bane
   loosening from FLAG-i. Do not document anything deferred: hunter behaviours
   A/B/C, jump-to-level, or force-SMD.

Report the version string, the new line's event key, and a summary of the
DIFFICULTY-LEVERS.md rewrite.
```

**Commit.** `CS018 P10: Super Mega Delivery voice line + version 1.0.0.18`