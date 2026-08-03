# DIFFICULTY LEVERS — living registry

This is a **living document** — it is never archived, unlike the version-suffixed
planning docs (`PLANNED-FEATURES-*.md` / `IMPLEMENTATION-PHASES-*.md`). Every
difficulty lever, present and future, gets an entry here regardless of which
changeset shipped it. Update this file in the same commit that adds, retunes, or
enables/disables a lever.

> **Rewritten in CS018 P10.** Before this rewrite the document described a
> **two-clock model** (§2.5, "the deliberate asymmetry"): a *sawtooth* group
> riding `game.cycleWave`/`game.cycle` through `cycleValue()`, reset every
> `CYCLE_LENGTH` waves, alongside a *frozen* group riding absolute `game.wave`.
> **CS018 P4 removed the sawtooth clock outright** — `cycleValue()`,
> `CYCLE_LENGTH`, `CYCLE_GAIN`, `game.cycle` and `game.cycleWave` no longer
> exist. **This reverses CS017 P3**, exactly the way P3's own header reversed
> what came before it: that text is gone rather than patched. There is now
> **one clock** for the game's core difficulty curve — the level table
> (`levelDef(n)`, CS018 P1) — plus a small surviving set of levers that were
> never on the cycle clock in the first place and still ride the original
> per-wave `ramp()`/`difficultyFactor()` curve (§2.2) or the independent
> `leverScale` mechanism (§2.1). Read §2 before adding anything.

## 1. Purpose

A **difficulty lever** is a small, named, catalogued knob that scales one
gameplay quantity as the game's difficulty progresses. Levers exist so that:

- Difficulty tuning is **discoverable in one place** instead of scattered as
  ad hoc `if (game.wave > N)` checks at call sites.
- A lever can be **built, wired, and tested while shipping inert** — landing
  the plumbing and a phase's balance change (if any) as separate, reviewable
  steps.
- Every lever's shape is written down, so reading one teaches you how to read
  the others *and* tells you which **mechanism** it uses — since CS018 there
  are three (§2), not two clocks on one mechanism.

## 2. The mechanisms

There are three mechanisms, plus one further wrinkle (frozen constants with no
lookup at all). A lever's entry in §3 must say which it uses.

### 2.1 `leverScale` — ease-in objects (v3.4 P2)

```js
// A leverScale lever eases a quantity from `start` (wave 1) toward `floor` (full difficulty)
// along the SHIPPED difficultyFactor() curve. When `enabled` is false the lever is INERT: the
// quantity is pinned at `start`, so the lever is built, wired and testable but does not ramp.
function leverScale(lever, wave) {
  const s = lever.enabled ? ramp(lever.start, lever.floor, wave) : lever.start;
  return Math.max(lever.floor, s);
}
```

A plain object: `{ enabled, start, floor }`. **Untouched by CS018** — both
shipped levers still ship `enabled: false` (§3, "leverScale levers").

- **`start`** — the value at wave 1 (and, while disabled, at every wave).
- **`floor`** — the value the lever ramps *toward* as difficulty climbs; for the
  two shipped levers this is the pre-lever shipped baseline.
- **`enabled`** — when `false`, the lever is **inert**: `leverScale` always
  returns `start`, at every wave.
- **`Math.max(lever.floor, s)` is a clamp on THIS mechanism, not a law about
  difficulty.** It bounds where a `leverScale` lever can travel; it says nothing
  about the game's overall difficulty ceiling. See §2.5.
- **Evaluated at entity construction, not per frame.** A `leverScale` lever's
  effect is baked into an entity (a `Powerup`, a `Dock`, …) once, when it is
  created. The per-frame `update()`/`draw()` paths never call `leverScale`.

### 2.2 Direct `ramp()` levers — the original mechanism (v1.5), now down to one live lever

```js
function ramp(floor, ceil, wave) {
  return floor + (ceil - floor) * difficultyFactor(wave);
}
```

A `floor`/`ceil` constant pair passed through `ramp(floor, ceil, wave)` at the
call site, riding absolute `game.wave` via the shipped `difficultyFactor()`
curve. **Before CS018 this mechanism covered four "saucer" levers plus the two
`leverScale` levers' curve; CS018 P6/P7 moved three of the four saucer levers
onto the level table (§2.3) as graded tiers.** The one survivor:

- **Small-saucer chance** (`SAUCER_SMALL_CHANCE_FLOOR/CEIL`) — untouched by
  CS018, still `ramp(0.15, 0.60, game.wave)` at the saucer-spawn call site.
  It is now the **only** lever besides the two dormant `leverScale` levers
  still riding `ramp()`/`difficultyFactor()` directly.

### 2.3 [RETIRED CS018 P4] Sawtooth + spiral levers — the cycle clock (was CS017 P3)

The four levers that used to sample `game.cycleWave` (reset every
`CYCLE_LENGTH` waves) through `cycleValue(x, game.cycle) = x × (1 + cycle ×
CYCLE_GAIN)` — junk (debris) count, junk speed, Hunter speed, Hunter turn —
**no longer exist as a mechanism.** `cycleValue()`, `CYCLE_LENGTH`,
`CYCLE_GAIN`, `game.cycle` and `game.cycleWave` are removed outright, not
retired-in-place. Their four consumers moved as follows (§2.4, §3):

- Junk count and junk speed → the level table, as a direct field and a graded
  tier respectively (CS018 P3).
- Hunter speed and Hunter turn rate → **frozen constants, no clock at all**
  (CS018 P4) — see the wrinkle below.

The full pre-CS018 model (concrete numbers, the two ceilings, the "monotonic
background pressure under a cycling foreground" design intent) is history now;
if you need it, read the CS017-era `GDD-VERSION-HISTORY.md` entries or the git
log for `asteroids-deluxe.html` around the CS017 P3/CS018 P4 commits. Do not
resurrect this mechanism for a new lever — use the level table instead.

**The wrinkle: frozen constants.** Hunter speed and turn rate are not on any
clock, table or ramp — `HunterSatellite`'s constructor samples
`HUNTER_SPEED_CEIL[size] * HUNTER_FLOOR_FRAC` / `HUNTER_TURN_CEIL[size] *
HUNTER_FLOOR_FRAC` once, and that value is identical at level 1 and level 63.
`HUNTER_FLOOR_FRAC` (0.58) is kept as the frozen value's *derivation*, not a
ramp target — the `_CEIL` constants no longer describe where a Hunter ramps
*to*, only what its frozen speed/turn is computed *from*. Concrete frozen
values: large 70×0.58=**40.6 px/s** (turn 0, never turns), medium
120×0.58=**69.6 px/s** (turn 1.6×0.58=**0.928 rad/s**), small
175×0.58=**101.5 px/s** (turn 2.6×0.58=**1.508 rad/s**). `HUNTER_LAST_STAND_SPEED`
(50 px/s) stays below the frozen medium speed (69.6), preserving the invariant
an existing in-code comment asserts.

### 2.4 The level table — the ONE clock (CS018 P1, wired P3–P9)

```js
function levelDef(n) {
  const L     = Math.min(n, LEVEL_MAX);       // LEVEL_MAX = 63; levels 64+ reuse level 63 verbatim
  const phase = Math.floor((L - 1) / PHASE_LEN) + 1;  // PHASE_LEN = 21; three phases, 1..3
  const rel   = L - PHASE_LEN * (phase - 1);          // 1..21, position within the phase
  // junkCount, payloadSlots, maxLargeHunters, and the seven graded tier names all derive from L/rel
  // via stepAt() (a shared step-table reader) or the fixed JUNK_CYCLE = [3, 5, 9, 13].
}
```

One **pure** function (`levelDef`, reads no game state) plus one shared
step-table reader (`stepAt(table, n)`: the value of the last breakpoint at or
below `n`). Called with `game.wave` at every consuming site — junk spawn
(`nextWave()`, `destroyDebris()`), the Hunter cap check, the payload-slot
assignment (`nextWave()`), and the three saucer helper groups
(`ufoFlightSpeedPx`/`ufoAppearInterval`/`ufoZigInterval`,
`ufoFireMult`/`ufoAccuracyRad`/`ufoShotSpeedPx`) — so a table change takes
effect at the next relevant event (next wave's junk count, next saucer spawn),
same "baked at the point of use" discipline as `leverScale` and the old
sawtooth levers before it.

Three kinds of field come out of `levelDef(n)`:

- **A direct value** — `junkCount` (3/5/9/13 cycling every 4 levels within a
  21-level phase; a phase's *last* level, `rel === 21`, holds 13 rather than
  restarting the cycle) and `payloadSlots` (8 through level 4, +2/level to 24
  at level 12, flat after — replaces the old delivery-earned `growCap` curve).
- **A step count** — `maxLargeHunters`, via `stepAt(HUNTER_CAP_STEPS, L)`.
- **A tier name** (`"low"`/`"normal"`/`"high"`) for each of **seven graded
  levers**, via `stepAt(TIER_STEPS[k], L)` — never a number. The actual
  low/normal/high value for each tier lives in a `DEBUG_VARS` playtest knob
  (§3), so `levelDef` stays a pure schedule and the numbers stay tunable
  without touching it.

**Four of the seven graded levers are INVERTED** — the number goes *down* as
difficulty rises (a shorter delay, less aim error, is *harder*):
`ufoAppearFreq` (25→18→13 s), `ufoDirChangeFreq` (2.0→1.3→0.8 s), `ufoFireFreq`
(1.8→1.0→0.7×) and `ufoAccuracy` (30→20→10°). The other three climb:
`junkSpeed` (58→70→90 px/s), `ufoFlightSpeed` (120→150→190 px/s),
`ufoShotSpeed` (300→380→470 px/s). **This is a standing, load-bearing
convention: nothing anywhere — not the debug panel, not a call site, not a
future validator — may assert `low <= normal <= high`.** Tier order is by
*difficulty*, never by magnitude. The debug panel (CS018 P2) was built before
these knobs existed specifically so this convention would have nowhere to
sneak in a numeric-order check.

Two frequency-shaped tiers (`ufoAppearFreq`, `ufoDirChangeFreq`) additionally
pass through a shared jitter helper, `jitteredInterval(center)` =
`rand(center × (1 − j), center × (1 + j))` with `j = DEBUG.freqJitter / 100`
(a GLOBAL field, default 25%). **`ufoFireFreq` deliberately does NOT** — it is
a multiplier on the shipped `SAUCER_FIRE_BIG`/`SAUCER_FIRE_SMALL` per-size
ranges (FLAG-d), not a single jittered interval, so a second jitter pass would
double up on entropy already in those ranges.

## 2.5 Explicit bounds recorded by CS018

Two more explicit ceilings joined the pre-existing `DEBRIS_SPEED_CAP` guard
rail (§2.6):

- **`HUNTER_CAP_STEPS`'s hard ceiling is 12** (from level 59 on) — the
  absolute maximum number of *large* (size 3) Hunters that may exist at once,
  governing both producers (ambient `spawnCore()` and coalescence conversion).
- **`SWEEP_POWERUP_CAP = 48`** — the Super Mega Delivery's (P9) fixed spawn
  ceiling: at most 48 powerups may spawn from one sweep, counting the
  guaranteed six-type set plus every per-piece payout. Deliberately **not** a
  `DEBUG_VARS` knob (source doc: "Fixed value, not configurable") — hardcoded
  in the powerup constants block, not tunable from the panel.

`DEBRIS_COUNT_HARD_MAX` (24), the old sawtooth-era absolute debris ceiling, is
now dead — `junkCount` tops out at 13 forever via the table, well under it,
and nothing reads the constant any more (retired-in-place, CS018 P3).

## 2.6 There is no baseline invariant — a lever CAN make the game harder

**This still holds, post-CS018, on fresh examples.** The old pre-CS017-P3 rule
— that a lever's `floor` was a hard clamp and could only ever return the game
toward "today's difficulty" from an easier starting point — stays reversed.
The level table is a counter-example on the same terms the CS017 spiral was:
its tier values are chosen **by feel**, not back-fit to any pre-CS018
baseline (PLANNED-FEATURES-CS018.md §1, "`high` tier calibration" — level 63
sitting below the old CS017 endgame numbers is accepted, not a bug), and
`maxLargeHunters` climbs to 12 concurrent large Hunters, well past anything
the pre-CS017 game ever produced.

What survives from the old rule is only this, and it is still a property of
§2.1's mechanism alone: **a `leverScale` lever with `enabled: false` is pinned
at `start` and observably does nothing but hold that constant.**

Two explicit ceilings still bound difficulty rather than a structural
guarantee (§2.5 adds two more): `DEBRIS_SPEED_CAP` (`2 × SHIP_MAX_SPEED` =
1040 px/s, a guard rail on the resulting per-entity junk speed — it does not
bind at the shipped tiers, insurance against a retune) and the two new CS018
ceilings above.

**If you add a lever that can grow without bound, add its ceiling in the same
commit and record it here.**

## 2.7 Which mechanism is a lever on? — no longer a two-way split

Since CS018 P4 there is no sawtooth/frozen split to check. Instead, ask which
of three mechanisms (§2.1–§2.4) a lever uses, plus whether it is one of the
frozen constants (§2.3's wrinkle) that use none of them:

- **Level table** (`levelDef`): junk count, junk speed, the large-Hunter cap,
  payload slots, and all seven graded UFO/junk-speed tier levers. The large
  majority of the game's difficulty curve now lives here.
- **Frozen constant, no clock**: Hunter speed, Hunter turn rate.
- **Direct `ramp()` on absolute `game.wave`**: small-saucer chance (the one
  survivor — §2.2).
- **`leverScale`, independent per-object curve**: powerup size, dock size
  (both still disabled).
- **Linear across the level table's junk-cycle position, not `ramp()`**: the
  bonus-canister spawn chance (§2.8's documented exception, re-homed off the
  retired cycle clock onto `levelDef(wave).rel` in CS018 P3).

There is no longer a "which clock" design intent to preserve across groups —
the level table IS the game's core difficulty curve now, and the handful of
survivors outside it (small-saucer chance, the two `leverScale` levers) are
outside it because nobody has moved them, not because of a deliberate
foreground/background split. Read §5 before assuming that's permanent for
small-saucer chance specifically.

## 2.8 Levers ramp on the SHIPPED curve — never a private one

Still true for every lever outside the level table: `leverScale` and
small-saucer chance both interpolate with `difficultyFactor`/`ramp` (never a
private curve), and `RAMP_WAVES` is still the one knob governing that curve's
pacing. **Inside the level table, the equivalent rule is that all seven
graded tier levers, the Hunter cap and the payload curve share the ONE
`levelDef`/`stepAt` mechanism** — no per-lever lookup logic, no second
step-table reader. Don't add either kind of private curve.

**One documented exception, carried forward with an updated clock source: the
bonus-canister spawn chance (CS017 P5, re-homed CS018 P3).**
`bonusSpawnChance()` interpolates **linearly**, not through `ramp()`, across
the level table's **junk-cycle position** — `(levelDef(game.wave).rel - 1) %
JUNK_CYCLE.length`, a 0..3 position that resets every 4 levels the same way
`game.cycleWave` used to reset every `CYCLE_LENGTH` waves. The reason is
unchanged: `BONUS_SPAWN_CHANCE_EARLY`/`_LATE` are defined as the **cycle's
exact endpoints**, and `difficultyFactor` is asymptotic, so a `ramp()` version
would never actually reach `_LATE`'s stated value. **Do not take this as
license for a second private curve** — a new lever that wants one should
first be re-specified in terms of `ramp()`'s asymptotic endpoints, or in
terms of the level table's own `stepAt` mechanism.

## 2.9 One lever eases OFF (CS017 P5, unchanged in kind)

The **bonus-canister spawn chance** is still the one inverted-by-intent lever
in the registry that isn't a graded tier — highest right after a junk-cycle
reset, lowest at the cycle's end, because it governs how often a *reward*
appears, not a threat. Its intent (GDD §2.10.1) is unchanged: concentrate the
temptation in the window where the player can afford to take it.

## 3. Lever registry

| Lever | Constant(s) | Scales | Mechanism | Clock/source | Shape / range | Enabled? | Shipped | Playtest status |
|---|---|---|---|---|---|---|---|---|
| Powerup size | `LEVER_POWERUP_SIZE` | `Powerup.radius` (baseline `POWERUP_RADIUS` = 15) | `leverScale` | absolute `game.wave` | start 2.0 → floor 1.0 | **false** | v3.4 P2 | Untouched by CS018 — still ships disabled, permanently 2×. |
| Dock size | `LEVER_DOCK_SIZE` | `Dock.radius` (baseline `DOCK_RADIUS` = 44) | `leverScale` | absolute `game.wave` | start 2.0 → floor 1.0 | **false** | v3.4 P2 | Untouched by CS018 — still ships disabled, permanently 2×. |
| Small-saucer chance | `SAUCER_SMALL_CHANCE_FLOOR/CEIL` | odds the spawned saucer is the aimed one | direct `ramp()` | absolute `game.wave` | 15% → 60% | n/a | v1.5 | **Untouched by CS018** — the one old "saucer" row CS018 left alone; now the only lever besides the two `leverScale` rows still on `ramp()`. |
| Junk (debris) count | `levelDef(n).junkCount`; `JUNK_CYCLE` | debris spawned per wave, `nextWave()` | **level table** | `game.wave` via `levelDef` | `JUNK_CYCLE` [3,5,9,13] cycling per 4 levels within a 21-level phase; phase's last level (`rel===21`) holds 13 | n/a | CS018 P3 | **Replaced** the sawtooth+spiral mechanism. `DEBRIS_COUNT_MAX`/`_HARD_MAX` retired, no readers. |
| Junk (debris) speed | `DEBUG.junkSpeedLow/Normal/High` (58/70/90 px/s); `junkSpeedMul()` | `DebrisSatellite` drift speed, **two** derivation sites | **level table** (graded tier) | `levelDef(wave).junkSpeed` → `DEBUG_VARS` knob | low 58 (L1) → normal 70 (L22) → high 90 (L43) | n/a | CS018 P3 | Scales sizes 2/1 by the shipped 70/110/160 ratio. `DEBRIS_SPEED_CAP` guard rail unchanged. |
| Hunter speed | `HUNTER_SPEED_CEIL`, `HUNTER_FLOOR_FRAC` (0.58) | `HunterSatellite.speed`, sampled once at spawn | **FROZEN CONSTANT** | none — no clock | `HUNTER_SPEED_CEIL[size] × 0.58`: 40.6 / 69.6 / 101.5 px/s (large/medium/small) | n/a | v1.6; frozen CS018 P4 | Identical at level 1 and level 63. A carried Hunter keeps this value for life (unchanged from the sawtooth era's per-spawn sampling, just no longer varies by level at all). |
| Hunter turn rate | `HUNTER_TURN_CEIL`, `HUNTER_FLOOR_FRAC` | `HunterSatellite.turnRate`, sampled once at spawn | **FROZEN CONSTANT** | none — no clock | 0 / 0.928 / 1.508 rad/s; large's ceiling is 0, so it never turns | n/a | v1.6; frozen CS018 P4 | Same as above. |
| Large-hunter cap | `HUNTER_CAP_STEPS` | max concurrent LARGE (size 3) Hunters, from EITHER producer | **level table** (step function) | `levelDef(wave).maxLargeHunters` | 0 (L1–4) → 1 (L5) → 2 (L9) → 3 (L13) → 5 (L17, deliberate 3→5 skip) → 7 (L21) → 8 (L22) → 9 (L26) → 10 (L34) → 11 (L43) → **12 (L59, hard ceiling)** | n/a | CS018 P4 | New lever. Governs the ambient `spawnCore()` gate AND coalescence conversion; a clump at `HUNTER_COALESCE_COUNT` while the cap is full holds at its final stage rather than converting. Levels 2–4 have zero large Hunters — intended. |
| Payload (tow-cap) curve | `levelDef(n).payloadSlots` | `game.cargoMax`, set every `nextWave()` | **level table** | `levelDef(wave).payloadSlots` | 8 (L1–4) → +2/level → 24 at L12 → flat to L63+ | n/a | CS018 P5 | **Replaces** the delivery-earned `growCap` curve (`CARGO_GROW_PER`, now retired/historical — see §5). Capacity is granted by LEVEL, not deliveries; level-1 dropped 12 → 8. |
| UFO flight speed | `DEBUG.ufoFlightSpeedLow/Normal/High` (120/150/190 px/s) | `Saucer.vx` (small); big derives ×100/150 | **level table** (graded tier) | `levelDef(wave).ufoFlightSpeed` | low 120 (L1) → normal 150 (L17) → high 190 (L38) | n/a | CS018 P6 | **New lever** — pre-CS018 this was a hardcoded, non-scaling literal (150 small / 100 big), not a difficulty lever at all. |
| UFO appearance frequency | `DEBUG.ufoAppearFreqLow/Normal/High` (25/18/13 s) | seconds between saucers, `ufoAppearInterval()` | **level table** (graded tier) + global jitter | `levelDef(wave).ufoAppearFreq` → `jitteredInterval()` | low 25 s (L1) → normal 18 s (L26) → high 13 s (L47) — **INVERTED** | n/a | CS018 P6 | Replaces `SAUCER_GAP_*`/`ramp()`; the retired time-in-level pressure axis's `DEBUG.saucerGapPressure` knob retired alongside it. |
| UFO direction-change frequency | `DEBUG.ufoDirChangeFreqLow/Normal/High` (2.0/1.3/0.8 s) | `Saucer.zigTimer`, both sites (ctor + `update()`) | **level table** (graded tier) + global jitter | `levelDef(wave).ufoDirChangeFreq` → `jitteredInterval()` | low 2.0 s (L1) → normal 1.3 s (L30) → high 0.8 s (L55) — **INVERTED** | n/a | CS018 P6 | **New lever** — pre-CS018 this was a flat `rand(0.8,1.8)` roll, not wave-scaling at all. |
| UFO firing frequency | `DEBUG.ufoFireFreqLow/Normal/High` (1.8/1.0/0.7×) | multiplier on `SAUCER_FIRE_BIG`/`_SMALL` ranges, `rollFireTimer()` | **level table** (graded tier) | `levelDef(wave).ufoFireFreq` | low 1.8× (L1) → normal 1.0× (L21) → high 0.7× (L42) — **INVERTED** | n/a | CS018 P7 | Replaces `SAUCER_FIRE_MULT_FLOOR/CEIL`. Deliberately does NOT go through `jitteredInterval()` (FLAG-d) — it's a multiplier on two fixed per-size ranges, not a single interval. |
| UFO shot accuracy | `DEBUG.ufoAccuracyLow/Normal/High` (30/20/10°) | aimed-shot spread, small saucers ONLY | **level table** (graded tier) | `levelDef(wave).ufoAccuracy`, deg→rad at call site | low 30° (L1) → normal 20° (L13) → high 10° (L34) — **INVERTED** | n/a | CS018 P7 | Replaces `SAUCER_AIM_ERR_FLOOR/CEIL` + `SAUCER_ACCURACY_RAMP_SCALE` + the retired pressure term. Big saucers still fire `rand(0,TAU)`, unaimed, untouched. |
| UFO shot speed | `DEBUG.ufoShotSpeedLow/Normal/High` (300/380/470 px/s) | `Bullet` velocity out of a saucer | **level table** (graded tier) | `levelDef(wave).ufoShotSpeed` | low 300 (L1) → normal 380 (L51) → high 470 (L63) | n/a | CS018 P7 | **New lever** — pre-CS018 this was a bare magic number (380), not scaling at all. |
| Bonus-canister spawn chance | `BONUS_SPAWN_CHANCE_EARLY` (0.5), `BONUS_SPAWN_CHANCE_LATE` (0.1) | per-wave probability `nextWave()` spawns a bonus canister | **linear** across the level table's junk-cycle position (§2.8 exception) | `levelDef(wave).rel` → `(rel−1) % 4` | 50% → 10%, **EASES OFF** (0.50, 0.45, …, 0.10) | n/a | CS017 P5; re-homed CS018 P3 | Re-homed off the retired `game.cycleWave` onto the level table's junk-cycle position; same linear interpolation, same two endpoint constants, unchanged values. The only lever that decreases (§2.9). |
| Orbit gap multiplier | `ORBIT_GAP_MULT` (2.5), `ORBIT_GAP_MULT_FLOOR` (1.8), `ORBIT_GAP_MULT_STEP` (0.1); `orbitGapMult()` | `minRequiredGap` fed into `generateOrbitLayout()` on an orbit level — the fairness floor between adjacent satellites | **occurrence-scaled formula** (new mechanism, CS021 P2) | `game.wave` → `occurrence = wave / ORBIT_LEVEL_EVERY` (every 3rd level is an occurrence) | 2.5× at occurrence 1 (level 3) → decays 0.1×/occurrence → hard floor 1.8× at occurrence 8 (level 24), held through level 63 | n/a | CS021 P2 | New lever, new mechanism (occurrence, not `game.wave` directly — one clock, but a coarser tick of it). ONE variable scales: `ORBIT_DENSITY` and both `ORBIT_ANG_VEL`/`ORBIT_FAST_MULT` stay fixed across occurrences. Tightening the multiplier widens each ring's `maxCount`, so total orbit-level satellites climb from 40 (occurrence 1) to 45 (at and past the floor) — FORK-CS021-D's bonanza, stepping up further. Still the first-pass curve — **CS021 P5 retuned nothing here**. The P4→P5 playtest gate could not judge the floor: gate Q1 came back "the orbits are too tight and too close to the dock," which is a *geometry* answer (`ORBIT_INNER_RADIUS`/`ORBIT_RADIUS_STEP`), and the spacing it asks for needs a larger world than this one — deferred to CS022 along with a second gate iteration. Whether 2.5→1.8 is the right curve is therefore **still unanswered in the hands**, and should be re-asked once the geometry is settled, since a wider ring changes what a given multiplier feels like. |

**On the two `leverScale` levers.** Both remain `enabled: false` — untouched
by CS018, exactly as they were left after CS017 P3. **"Freeze" here means keep
the 2×, not restore 1×:** while disabled, `start` is pinned, so the shipped,
player-visible reality is that **powerups and the recycling dock are
permanently 2× their pre-lever size**, and have been since v3.4 P2. Do not
"restore" 1× as a cleanup.

**Explicit bounds, recorded per §2.5:** large-hunter cap hard ceiling **12**
(from level 59); Super Mega Delivery spawn ceiling **48**
(`SWEEP_POWERUP_CAP`, fixed, not a `DEBUG_VARS` knob); `DEBRIS_SPEED_CAP`
**1040 px/s** (pre-existing guard rail, still in force, still not binding at
the shipped tiers).

## 4. Assumptions & Decisions

- **A lever's entry must name its MECHANISM.** Since CS018 there are three
  (`leverScale`, direct `ramp()`, the level table) plus the frozen-constant
  wrinkle — "which clock" alone no longer distinguishes a lever the way it did
  under the pre-CS018 two-clock model (§2.7).
- **No lever gets its own curve.** Outside the level table, every lever
  interpolates through the shipped `difficultyFactor`/`ramp`; `RAMP_WAVES` is
  the one pacing knob for that curve. Inside the level table, every graded
  tier lever, the Hunter cap and the payload curve share the ONE
  `levelDef`/`stepAt` mechanism — no per-lever lookup logic. A second,
  independent curve of either kind would make the game's difficulty
  progression illegible across systems.
- **Table-driven levers are evaluated at the POINT OF USE, not per frame** —
  same discipline the old sawtooth levers and `leverScale` already followed.
  A `DEBUG_VARS` tier knob's new value takes effect at the next relevant
  event (next wave's junk count/speed, next saucer spawn), not retroactively
  on entities already on screen.
- **`leverScale` levers are evaluated at ENTITY CONSTRUCTION, not per frame** —
  unchanged from before CS018.
- **A lever CAN raise difficulty past its historical baseline** (§2.6). Still
  true post-CS018, now illustrated by the level table's by-feel tier values
  and its uncapped-relative-to-history Hunter count, rather than by the
  retired cycle spiral. Anything unbounded needs an explicit ceiling constant,
  added in the same commit and recorded here (§2.5).
- **Four of the seven graded tier levers DESCEND as difficulty rises**
  (`ufoAppearFreq`, `ufoDirChangeFreq`, `ufoFireFreq`, `ufoAccuracy`) — a
  standing, load-bearing prohibition on any `low <= normal <= high` validator,
  anywhere (§2.4).
- **Both `leverScale` levers still ship disabled** — tooling for a future
  playtest round, not a balance change. Their observable effect remains the
  permanent 2× size.

## 5. Candidate levers not yet built

A running list for future rounds — not yet implemented, not yet named
constants (unless noted otherwise).

- **`HUNTER_GARBAGE` counts** — the per-tier garbage-drop table `{3:3, 2:2, 1:1}`
  (GDD §2.5/§2.5.1). A lever could ease the Hunter-side garbage amplifier in
  earlier levels. *Constant still exists; candidate still valid; untouched by
  CS018.*
- ~~**`CARGO_GROW_PER`**~~ — **retired from this list (CS018 P5).** The
  per-delivery tow-cap growth rate it named no longer exists as a mechanism:
  CS018 P5 replaced the whole earned-growth model with the level table's
  `payloadSlots` curve, and `CARGO_GROW_PER` itself is now historical
  (defined, unread). A future payload-pacing lever would have to target the
  table's own curve (`L <= 4 ? 8 : L >= 12 ? 24 : 8 + (L-4)*2`), not this
  constant.
- **`DEBUG.garbageLifetime`** — *replaces the old `GARBAGE_DECAY` entry, which
  was stale.* `GARBAGE_DECAY` (22) survives in the source only as a commented
  historical reference; since **CS015 P6** the live garbage-decay governor is
  the `garbageLifetime` debug var (default 10 s, `DEBUG_VARS`), applied to
  every piece rather than singles only. A lever would have to wrap the debug
  var, not the dead constant — and would need to respect the
  `garbageLifetime` ≫ `garbageAttractDelay` relationship or nothing clumps
  (GDD §2.10.1). *Untouched by CS018.*
- ~~**`POWERUP_DROP_CHANCE`**~~ — **removed from this list (FLAG-CS017-d).** The
  constant no longer exists: **v3.6 P3** replaced the per-kill drop roll with
  three deterministic, unconditional emitters, so there is no chance gate left
  to ease. A powerup-economy lever would now have to target
  `POWERUP_DROP_WEIGHTS` or the emitter cadence instead (GDD §2.14).
- **Small-saucer chance onto the level table** — the live design option that
  replaces the old "saucer levers onto the cycle clock" entry (struck below):
  small-saucer chance is now the *only* graded UFO quantity still on the
  original `ramp()` mechanism (§2.2) rather than a level-table tier, having
  watched its three former `ramp()` siblings (spawn gap, fire rate, aim error)
  all move in CS018 P6/P7. Moving it too — an eighth graded tier — is a live
  option, not a bug fix; it would change nothing about *when* it varies
  (still every wave), only *how* its low/normal/high anchors are chosen and
  tuned. A conversational decision, not an implementation one.
- ~~**Saucer levers onto the cycle clock**~~ — **moot (CS018 P4).** The cycle
  clock this candidate proposed moving levers *onto* no longer exists; three
  of the four levers it named (spawn gap, fire rate, aim error) moved to the
  level table instead in CS018 P6/P7. Superseded by the entry above.
