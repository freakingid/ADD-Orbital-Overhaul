# PLANNED FEATURES — CS018

## Difficulty progression system: level table replaces the cycle clock

Target version: **`1.0.0.18`** (bump lands in P10, the last player-visible phase).
Baseline: `26a6846` — CS017 P7, `GAME_VERSION "1.0.0.17"`.

All symbol references below were **grep-verified against the live build** at that
commit. Line numbers are indicative only; anchors are symbol-level.

---

## 1. Resolved forks

| Fork | Resolution |
| --- | --- |
| **FORK-CS018-A** — CS017 cycle/spiral vs. the 63-level table | **The table replaces the cycle system.** `CYCLE_LENGTH`, `CYCLE_GAIN`, `cycleValue()`, `game.cycle`, `game.cycleWave` all retire. Taken from the source document's own §Purpose ("replaces ad-hoc difficulty with an explicit, data-driven level progression"). |
| **FORK-CS018-B** — payload slots | **Level curve replaces the earned cap.** `CARGO_GROW_PER` and the `growCap` block retire; `game.cargoMax` is set from the table at `nextWave()`. `CARGO_BASE` 12 → **8 at level 1**. |
| **FORK-CS018-C** — Super Mega Delivery guaranteed set | **One of each of all six droppable types** (`rapid, triple, scoop, magnet, engine, guard`), with the `chainGuardMinTow` gate bypassed for the guaranteed set. |
| **[INVESTIGATE] §2.4** — UFO direction change | **Already interval-based.** `Saucer.update()`: `this.zigTimer = rand(0.8, 1.8)`, re-rolled per fire. Center **1.3 s**, ±38%. Anchors `normal` at 1.3 s. Levels 30 and 55 keep their step points. |
| **Hunter speed / turn rate** (gap in the source document) | **Frozen at their level-1 values for the whole game.** No clock, no lever. |
| **CS017 P4 time-in-level pressure axis** | **Removed.** `wavePressure()` and its three debug knobs retire. |
| **`high` tier calibration** | **The reduction at depth is intended.** Level 63 sitting below today's build is accepted — the observed reality is that players are not reaching level 63 on 1.0.0.17. Tier values are set by feel, not back-fitted to today's numbers. |

---

## 2. Lever audit (source document §10.2)

`normal` anchors are read out of the build, never invented.

| Lever | Symbol(s) in build | Exists? | Current value | `normal` anchor |
| --- | --- | --- | --- | --- |
| Junk count | `DEBRIS_COUNT_MAX` 12, `DEBRIS_COUNT_HARD_MAX` 24 | Yes, different shape | `min(round(cycleValue(min(3+cycleWave,12),cycle)),24)` | n/a — table supplants |
| Junk speed | `DEBRIS_SPEEDS {3:70,2:110,1:160}`, `DEBRIS_SPEED_PER_WAVE` 0.08, `DEBRIS_SPEED_CAP` 1040 | Yes | per-size base × multiplier × `rand(.7,1.3)` | **70** (size 3) |
| Payload slots | `CARGO_BASE` 12, `CARGO_CAP_MAX` 24, `CARGO_GROW_PER` 30 | Yes — delivery-driven | 12 at run start, +1 per 30 delivered | n/a — table supplants |
| Max large hunters | — | **No** | uncapped by count; `game.hunters.length === 0` gates ambient spawn | new lever |
| UFO appearance freq | `SAUCER_GAP_FLOOR_MIN/MAX` 20/30, `_CEIL_MIN/MAX` 12/16 | Yes, min/max pair | center 25 s → 14 s | **18 s** (FLAG-b) |
| UFO flight speed | `Saucer.vx = small ? 150 : 100` | Yes — hardcoded literal | 150 small / 100 big | **150** (small; FLAG-c) |
| UFO direction change freq | `Saucer.zigTimer = rand(0.8, 1.8)` | **Yes, interval** | center 1.3 s, ±38% | **1.3 s** |
| UFO firing freq | `SAUCER_FIRE_BIG [0.9,1.6]`, `_SMALL [0.7,1.1]`, `_MULT_FLOOR/CEIL` 1.8→1.0 | Yes | two ranges × 1.8→1.0 multiplier | **1.0×** (FLAG-d) |
| UFO shot accuracy | `SAUCER_AIM_ERR_FLOOR` .35 / `_CEIL` .09 rad, `SAUCER_ACCURACY_RAMP_SCALE` .5 | Yes — **small saucers only** | 20.1° → 5.2°; big fires `rand(0,TAU)` | **20°** |
| UFO shot speed | literal `380` in `new Bullet(...)` | Yes, magic number | 380 px/s | **380** |

### 2.1 Corrections to the source document

1. **§7.2 "delivering 8 pieces awards 1 powerup" — the build awards at 10, not 8.**
   `if (game.deliveryCount === 10)` emits one powerup with a "SALVAGE BONUS"
   floater. The 8/12/16/20 thresholds are therefore a **change**, not an
   extension. They map onto the existing "passes through N exactly once per
   visit" latch idiom (used by the `=== 12` Heavy Hauler and
   `=== CARGO_CAP_MAX` Maxed Out latches), awarding +1 powerup at each — which
   reproduces the §7.2 table exactly.
2. **§7.3 "the 4 powerup types" — there are six droppable types.**
   `POWERUP_DROP_WEIGHTS = { rapid: 3, triple: 3, scoop: 2, magnet: 1, engine: 1, guard: 1 }`.
   Health is ambient-only and absent from that table. Resolved as FORK-CS018-C.
3. **`guard` is conditional.** `dropPowerup` only admits it while the player tows
   ≥ `DEBUG.chainGuardMinTow` (default 5). After a 24-piece delivery the chain is
   empty, so guard is excluded from every sweep roll *and* from the guaranteed
   set unless the gate is explicitly bypassed.
4. **Large hunters already drop a powerup on death.** `destroyHunter()`:
   `if (h.size === 3) dropPowerup(h.x, h.y, h.vx, h.vy)`. A swept large therefore
   yields **two** powerups unless suppressed (FLAG-g).
5. **Dan already speaks delivery tiers at 5/10/15/20** (`VoiceSys.dockDelivery(n)`
   → `dock_5/dock_10/dock_15/dock_20`). The new reward tiers are 8/12/16/20, so
   lines and payouts land on different numbers (FLAG-h).
6. **§6 assumes coalescence is the only hunter source. It is not.** A second
   ambient spawner exists:
   `if (game.hunterTimer <= 0 && game.hunters.length === 0 && game.wave >= 2) game.hunters.push(HunterSatellite.spawnCore())`,
   `game.hunterTimer = rand(20, 32)`. The `length === 0` gate is a de facto cap of
   one lineage at a time and **must be replaced by the cap** for a cap of 7/10/12
   to mean anything.
7. **The debug panel already overflows the viewport.**
   `drawDebug()`: `h = 220 + (N + 1) * 46` = **818 px at N=12** against
   `VIEW_H = 720`, so `drawMenuHint` at `y + h - 30` = 739 renders off-screen
   today. At the CS018 count of 32 entries, `h` = 1738 px.

---

## 3. Data structure

One pure function, `levelDef(n)`, is the single source of truth. It reads no
game state and is the changeset's primary headless-test surface.

```js
const PHASE_LEN  = 21;              // levels per phase
const LEVEL_MAX  = 63;              // levels 64+ reuse level 63's definition unchanged
const JUNK_CYCLE = [3, 5, 9, 13];   // by relative level, (rel-1) % 4

// Shared step-table reader: the value of the LAST breakpoint at or below n.
// Used by the hunter cap and all seven graded levers — one helper, one behaviour.
function stepAt(table, n) {
  let v = table[0][1];
  for (const [lvl, val] of table) { if (lvl <= n) v = val; else break; }
  return v;
}

const HUNTER_CAP_STEPS = [[1,0],[5,1],[9,2],[13,3],[17,5],[21,7],
                          [22,8],[26,9],[34,10],[43,11],[59,12]];

const TIER_STEPS = {
  junkSpeed:        [[1,"low"],[22,"normal"],[43,"high"]],
  ufoAppearFreq:    [[1,"low"],[26,"normal"],[47,"high"]],
  ufoFlightSpeed:   [[1,"low"],[17,"normal"],[38,"high"]],
  ufoDirChangeFreq: [[1,"low"],[30,"normal"],[55,"high"]],
  ufoFireFreq:      [[1,"low"],[21,"normal"],[42,"high"]],
  ufoAccuracy:      [[1,"low"],[13,"normal"],[34,"high"]],
  ufoShotSpeed:     [[1,"low"],[51,"normal"],[63,"high"]],
};
```

`levelDef(n)` returns, for a clamped level `L = min(n, LEVEL_MAX)`:

| Field | Derivation |
| --- | --- |
| `level` | `n` (unclamped, for display) |
| `phase` | `floor((L-1) / PHASE_LEN) + 1` → 1..3 |
| `rel` | `L - PHASE_LEN * (phase - 1)` → 1..21 |
| `junkCount` | `rel === 21 ? 13 : JUNK_CYCLE[(rel-1) % 4]` |
| `payloadSlots` | `L <= 4 ? 8 : L >= 12 ? 24 : 8 + (L-4)*2` |
| `maxLargeHunters` | `stepAt(HUNTER_CAP_STEPS, L)` |
| seven tier names | `stepAt(TIER_STEPS[k], L)` |

**Verification of the derivations against the source tables.** `rel` 1→3, 2→5,
3→9, 4→13, 5→3 (since `(5-1)%4 === 0`), 21→13 by override. Payload: 5→10, 11→22,
12→24. Cap: 20→5, 21→7, 22→8, 33→9, 34→10, 42→10, 58→11, 59→12. Tiers reproduce
§5.1's phase-1 table and §5.2/§5.3's step points exactly, and every tier sequence
is monotonic. The endgame clamp makes junk count permanently 13 from level 64.

### 3.1 Tier values — the 21 graded debug fields

`normal` is the build's current value wherever one exists (§2). `low`/`high`
derive from that anchor by feel. **All are playtest knobs.**

| Lever | Unit | low | normal | high | Step |
| --- | --- | --- | --- | --- | --- |
| Junk satellite speed | px/s (size 3) | 58 | **70** | 90 | 2 |
| UFO flight speed | px/s (small) | 120 | **150** | 190 | 2 |
| UFO shot speed | px/s | 300 | **380** | 470 | 2 |
| UFO shot accuracy | degrees, 0–60 | 30 | **20** | 10 | 5 |
| UFO appearance frequency | s | 25 | 18 | 13 | 1 |
| UFO direction change frequency | s | 2.0 | **1.3** | 0.8 | **0.1** (FLAG-e) |
| UFO firing frequency | × multiplier | 1.8 | **1.0** | 0.7 | 0.1 (FLAG-d) |

Global fields: **frequency jitter** 25 % (step 5), **coalescence pause after
sweep** 10 s (step 1). Total = 21 + 2 = **23 new fields**, matching §8.1.

`DEBUG_VARS` goes 12 − 3 (retired pressure knobs) + 23 = **32 entries**.

### 3.2 Derived quantities

- **Junk speed for sizes 2 and 1** scale by the shipped ratio:
  `DEBRIS_SPEEDS[size] * (tierPxPerSec / 70)`. Preserves the 70/110/160 tier
  spread rather than flattening it.
- **Big saucer flight speed** = `tierPxPerSec * (100 / 150)`. Preserves the
  shipped small/big spread.
- **Jitter** applies to the three frequency levers only:
  `rand(c * (1 - j), c * (1 + j))` where `j = DEBUG.freqJitter / 100`.
- **Accuracy** converts to radians at the call site: `deg * Math.PI / 180`.

---

## 4. Semantics that need stating

### 4.1 Hunter cap

- Counts **large hunters only** (`h.size === 3`), alive and not `dead`. Hard
  ceiling 12. Middle/small are uncapped and never counted.
- Governs **both** producers: the coalescence conversion **and** the ambient
  `spawnCore()` path, whose `game.hunters.length === 0` gate is replaced by
  `largeHunterCount() < cap`.
- A clump that reaches `HUNTER_COALESCE_COUNT` (12) while the cap is full
  **holds at the final coalescence stage**: it does not convert, does not grow
  past 12 pieces, and its `decay` clock keeps running so it can still age out.
  Merges into it still reset the clock, per the shipped rule.
- Cap 0 (levels 1–4) means no large hunter can appear from either source. Today
  ambient hunters begin at level 2, so **levels 2–4 lose their hunters**. This is
  a direct consequence of §4.1 of the source document and is treated as intended.

### 4.2 Super Mega Delivery sweep — snapshot semantics

The build contains **both** iteration idioms over `game.hunters`:
`forEach` (spec-safe: the visited range is fixed before the first callback) and
`for (const h of game.hunters)` at the shield-ring site (**iterator-based: would
visit hunters appended during iteration and cascade without bound**).

**The sweep must not rely on either.** It captures an explicit array first:

```js
const snap = game.hunters.filter(h => !h.dead);   // the snapshot
for (const h of snap) { /* one hit + one powerup per member */ }
```

Fragments created by the sweep are not in `snap`, so they are neither hit nor
paid out. This is the changeset's most likely bug and gets a dedicated test.

Each member takes one hit via the existing choke point,
`destroyHunter(h, true)` — score and achievement counters credited exactly as a
player shot would (`awardScore = true` gates both in the shipped code).

### 4.3 Delivery reward tiers

Implemented as four independent "passes through N once per visit" latches at
`game.deliveryCount === 8 / 12 / 16 / 20`, each awarding one powerup, plus the
Super Mega Delivery at `=== 24`. Cumulative awards reproduce §7.2's 1/2/3/4.
The existing `=== 10` emitter is **replaced**, not supplemented.

---

## 5. FLAGs — best guesses needing review, not blocking

| ID | Item | Recommendation |
| --- | --- | --- |
| **a** | Hunter freeze value. "Initial" = the level-1 value, i.e. `HUNTER_SPEED_CEIL[size] * HUNTER_FLOOR_FRAC` = **40.6 / 69.6 / 101.5 px/s**, turn **0 / 0.928 / 1.508 rad/s**. | Keep the expression rather than baking literals, so the derivation stays visible. The `_CEIL` constants become the frozen value's derivation, not a ramp target. `HUNTER_LAST_STAND_SPEED` (50) stays below the frozen medium (69.6), so that comment's invariant survives. |
| **b** | UFO appearance `normal` = 18 s, between today's wave-1 (25 s) and full-difficulty (14 s). | Accept; the ramp it replaces had no single "normal". |
| **c** | Flight-speed field holds the **small** saucer's px/s; big derives at 100/150. | Accept — one field, spread preserved. |
| **d** | Firing frequency cannot be one interval centre: the build has two ranges (big 1.25 s, small 0.9 s) plus a multiplier. | Keep it as a **multiplier** on the shipped ranges (unit `×`), reusing the existing `SAUCER_FIRE_MULT` idiom. Deviates from §8.1's "seconds" unit. |
| **e** | §8.1 specifies step 1 s for all frequency levers, but the direction-change interval is ~1.3 s — step 1 is unusable. | Step **0.1 s** for that lever only. |
| **f** | `bonusSpawnChance()` reads `game.cycleWave`, which is retiring. | Re-home to the 4-level junk cycle position (`rel-1 mod 4`, 0..3), preserving its "common after a reset, rare at cycle end" intent. |
| **g** | A swept large hunter yields two powerups (its own + the sweep's). | Suppress the sweep's extra powerup for `size === 3` so every piece pays exactly one. Keeps the 48 ceiling honest. |
| **h** | Voice tiers (5/10/15/20) vs reward tiers (8/12/16/20). | Leave the voice tiers alone this changeset; they are pieces-in-visit colour commentary, not reward announcements. Revisit if it reads wrong. |
| **i** | `game.stats.hunterLineageKills` resets on ambient spawn and feeds Hunter's Bane (13). Concurrent lineages mix the counter; a sweep of 10 larges could complete it in one frame. | Reset the counter when `largeHunterCount()` transitions 0 → 1 rather than on every spawn. Accept that the achievement loosens; note it in the GDD. |
| **j** | 32 flat debug rows is hard to navigate. | Add non-selectable section headers (`— JUNK —`, `— UFO —`, `— GLOBAL —`) skipped by up/down. |
| **k** | `game.waveTime` loses its only reader when `wavePressure()` goes. | Keep the field and log it in `logDifficultySnapshot`; it costs nothing and is useful telemetry. |
| **l** | `MusicSys.setIntensity(difficultyFactor(game.wave))` — `difficultyFactor` otherwise retires. | Keep `difficultyFactor`/`RAMP_WAVES` alive **solely** as the music-intensity curve, commented as such. Do not re-derive from the table. |

---

## 6. Test plan (source document §10.3)

**Headless, in `levelDef` (P1) — the highest-value surface.**

1. `junkCount` over levels 1–63: matches §5.1's column for 1–21; `rel === 21`
   holds 13 at levels 21, 42, 63; equals 3/5/9/13 on the cycle elsewhere.
2. `payloadSlots`: 8 at 1–4; 10,12,14,16,18,20,22,24 at 5–12; 24 at 13–63.
3. `maxLargeHunters`: reproduces §5.1 including the deliberate 3→5 skip at 17,
   and §5.2/§5.3's step points; never exceeds 12; **never decreases**.
4. Every tier sequence is **monotonic** across 1–63 (no lever returns to an
   easier tier), and each matches its §5.2/§5.3 step point.
5. **Endgame:** `levelDef(64)` … `levelDef(500)` are field-identical to
   `levelDef(63)` except `level`.
6. Purity: two calls with the same argument are deep-equal; no game state read.

**Snapshot semantics (P9) — the explicit test §7.3.1 asks for.**

7. Seed N large hunters, trigger the sweep, assert: exactly N `destroyHunter`
   calls; exactly N sweep powerups (see FLAG-g); `3N` mediums exist afterwards
   and **none of them was hit**; total hunters afterwards = 3N, not 0.
8. Nested-cascade guard: with a mixed board (larges + mediums + smalls), assert
   post-sweep smalls = (pre-existing smalls destroyed) and no piece created
   during the sweep took a hit.
9. Spawn ceiling: a board large enough to imply >48 powerups spawns exactly 48.

**Debug panel (P2) — §1.1's inverted-lever trap.**

10. The panel accepts **descending** tier values for the four inverted levers
    (accuracy, and the three frequencies) without rejection, clamping or
    reordering. No validator assumes `low ≤ normal ≤ high`.
11. Every field shows its unit; the four inverted levers read correctly with
    `high` holding the smaller number.
12. All 23 fields round-trip through `afd_settings_v1.debug` across a reload.
13. Scrolling reaches the first and last rows; numeric entry sets a value
    directly and clamps to `min`/`max`.

**Regression.**

14. `afd_settings_v1`, `afd_scores_v1`, `afd_achievements_v2` keys unchanged; a
    save written by 1.0.0.17 loads without loss (known-value-else-default).
15. Level 1 is playable and materially easier than 1.0.0.17's level 1 (8 payload
    slots vs 12, 3 junk vs 4, no hunters until level 5).

---

## 7. Retirement ledger

Removed outright: `CYCLE_LENGTH`, `CYCLE_GAIN`, `cycleValue()`, `game.cycle`,
`game.cycleWave`, `DEBRIS_COUNT_MAX`, `DEBRIS_COUNT_HARD_MAX`,
`DEBRIS_SPEED_PER_WAVE`, `CARGO_GROW_PER`, `wavePressure()`,
`DEBUG.saucerPressureSecs`, `DEBUG.saucerAimPressure`, `DEBUG.saucerGapPressure`,
`SAUCER_GAP_FLOOR_MIN/MAX`, `SAUCER_GAP_CEIL_MIN/MAX`, `SAUCER_FIRE_MULT_FLOOR`,
`SAUCER_FIRE_MULT_CEIL`, `SAUCER_AIM_ERR_FLOOR`, `SAUCER_AIM_ERR_CEIL`,
`SAUCER_ACCURACY_RAMP_SCALE`.

Retained deliberately: `difficultyFactor`, `RAMP_WAVES`, `ramp` (music intensity
only — FLAG-l); `DEBRIS_SPEED_CAP` (guard rail); `DEBRIS_SPEEDS`;
`HUNTER_SPEED_CEIL`, `HUNTER_TURN_CEIL`, `HUNTER_FLOOR_FRAC` (frozen-value
derivation — FLAG-a); `CARGO_BASE`, `CARGO_CAP_MAX` (documented bounds);
`GARBAGE_DECAY` (historical reference, already dead).

Out of scope, per source document: hunter flight behaviours A/B/C (§3.3);
powerup float and effect lifetimes (§3.2); jump-to-level and force-SMD debug
utilities (§Deferred).

`DIFFICULTY-LEVERS.md` requires a full rewrite in the same commit as P10 — its
own §1 rule. Nine of its eleven registry rows change mechanism or retire.