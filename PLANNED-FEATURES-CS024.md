# PLANNED FEATURES — Changeset 024 (THE SIMPLIFICATION)

**Status:** design complete, forks resolved except where noted. Companion:
`IMPLEMENTATION-PHASES-CS024.md`.

**Baseline:** commit `4eb6493` ("cs-23 phase 4c progress interrupted"),
`GAME_VERSION` `"1.0.0.22"`. CS023 landed P1–P4c and was interrupted before P5,
so **the version was never bumped and no doc was ever updated for any part of
CS023** — the GDD, `GDD-VERSION-HISTORY.md` and `DIFFICULTY-LEVERS.md` all still
describe the CS022 build. See §0.

---

## 0. CS023 is superseded, not completed

CS024 deletes most of what CS023 P1/P4/P4b/P4c landed (the orbit shell retune,
the inward drift, the drift's speed cap). Back-filling CS023's documentation
would be paying to describe a system this changeset removes in the same breath.

**Decision:** CS023 is declared **partially landed and superseded**. One
`GDD-VERSION-HISTORY.md` entry records what shipped (P1–P4c) and that P5 never
ran; the GDD's §2 is brought straight to the post-CS024 state in this
changeset's own doc sweep. `GAME_VERSION` goes **`1.0.0.22` → `1.0.0.24`**,
skipping `.23` deliberately — CS023 never closed, and a version it never
carried should not be invented for it retroactively.

**What survives from CS023:** mutual collision damage (P3) and the
`debrisBounce()` satellite-vs-satellite elastic bounce (P2), both of which are
archetype-independent and stay. `DEBRIS_MASS = {3:9, 2:3, 1:1}` stays.

---

## 1. What is being removed

### 1.1 Orbit levels, entirely (§4.1)

The orbit archetype was introduced in CS021 and retuned twice (CS022, CS023 P1,
CS023 P4c). It is removed outright and **will not be reintroduced**. This
includes the tooling.

### 1.2 The bonus canister (§4.2)

CS017 P5's rare pre-linked clump — one roll per `nextWave()` on an easing-off
curve, spawning a 6-piece `Garbage` worth 250 points at the scoop. It is the
"occasional level-start payload" and it goes.

### 1.3 The ambient Hunter producer (§4.3)

`HunterSatellite.spawnCore()` and its `rand(20, 32)` timer. **Hunters may now
arise from exactly one source: garbage coalescing to `HUNTER_COALESCE_COUNT`
pieces.** This is the game's thesis made mechanical — neglected debris is the
*only* thing that becomes a hunter.

### 1.4 Garbage decay (§4.4)

`DEBUG.garbageLifetime`, `Garbage.decay`, `GARBAGE_FADE` and the blink-out
render. **Loose garbage is now permanent** — it is removed from the world only
by being scooped, by coalescing, or by the new density ceiling. This is what
makes §1.3 survivable: without decay, the coalescence pipeline actually runs.

### 1.5 The CS023 inward drift (§4.1)

`DEBRIS_DRIFT_TRIGGER_R` / `_TARGET_R` / `_ACCEL`, `updateDebrisDrift()`,
`maxOrbitSpeed()`, the `drifting` field, its four disarm sites, and the
`debrisDriftAccel` knob. Both its radii were derived from ring geometry and its
speed cap was justified entirely as "no faster than a satellite on a rail" —
neither has a source once the rails are gone. It never reached its playtest
gate, so nothing is being un-shipped that was ever validated in the hands.

### 1.6 The whole pre-CS024 difficulty apparatus (§4.5)

| Removed | Was |
|---|---|
| `levelDef()`, `stepAt()`, `TIER_STEPS` | The level table + seven graded tier tables |
| `PHASE_LEN` (21), `LEVEL_MAX` (63), `JUNK_CYCLE` | Three-phase / 63-level structure + junk sawtooth |
| 21 tier knobs (low/normal/high × 7) | The tier values |
| `ramp()`, `difficultyFactor()`, `RAMP_WAVES` | The v1.5 ramp mechanism |
| `leverScale()`, `LEVER_POWERUP_SIZE`, `LEVER_DOCK_SIZE` | The v3.4 P2 ease-in mechanism (never enabled) |
| `HUNTER_CAP_STEPS` | The 11-breakpoint large-Hunter cap |
| `SAUCER_SMALL_CHANCE_FLOOR/CEIL` | The 15%→60% small-saucer ramp |

**`difficultyFactor()` is not simply deleted.** Its only live caller is
`MusicSys.setIntensity()`. It is **renamed `musicIntensity(wave)`** and
`RAMP_WAVES` → `MUSIC_INTENSITY_WAVES`, curve byte-identical. Music intensity
was never a difficulty lever and should stop being implemented as one.

**On the two `leverScale` levers:** both have shipped `enabled: false` since
v3.4 P2, so their only observable effect has always been that powerups and the
dock are permanently **2×**. The mechanism is deleted and the 2× is **baked in**:
`POWERUP_RADIUS` 15 → **30**, `DOCK_RADIUS` 44 → **88**. Do **not** "restore"
1× as a cleanup — that would be a silent, unrequested balance change.

### 1.7 Timed powerup expiry (§4.7)

`powerMode()`, `powerDuration()`, `game.powerFx`, `POWERUP_DURATION`,
`MAGNET_DURATION`, `DEBUG.chainGuardTime`, and the `shotPowerupMode` /
`magnetMode` / `chainGuardMode` settings. **Every powerup is now count-based.**

### 1.8 Dead constants with zero live readers

Grep-confirmed, declaration-and-comment only:
`CARGO_GROW_PER` · `DEBRIS_SPEED_PER_WAVE` · `DEBRIS_COUNT_MAX` ·
`DEBRIS_COUNT_HARD_MAX` · `SAUCER_GAP_FLOOR_MIN/MAX` · `SAUCER_GAP_CEIL_MIN/MAX` ·
`SAUCER_FIRE_MULT_FLOOR/CEIL` · `SAUCER_AIM_ERR_FLOOR/CEIL` ·
`SAUCER_ACCURACY_RAMP_SCALE` · `ORBIT_RADIUS_STEP_PAD` · `GARBAGE_DECAY` ·
`GARBAGE_CLUMP_MAXSPD` (an "off-by-default clamp" set to `Infinity`, never on).

`DEBRIS_SPEED_CAP` (1040 px/s) **stays** — it is cheap insurance and, with junk
speed now a live lever with a debug knob, it is the guard rail that stops a
retune producing an unplayable field.

---

## 2. The odometer — the ONE difficulty mechanism

### 2.1 Shape

Every scaling quantity in the game is a **lever**. A lever is:

```js
{
  id,            // stable string id; also the DEBUG knob prefix
  floor, ceil,   // the two endpoints, linearly interpolated
  steps,         // how many discrete positions (step 0 === floor, step steps-1 === ceil)
  everyNLevels,  // driver levers only: advance one step every N levels (default 1)
  carriesTo,     // ARRAY of lever ids bumped one step when this lever WRAPS (default [])
}
```

A lever is a **driver** if it has `everyNLevels` — it advances on the level
clock. Otherwise it advances **only** by carry. When a driver passes its top
step it **resets to step 0** and bumps every lever in its `carriesTo` list by
one step. A carried lever that passes its own top likewise resets and bumps its
own list. **A lever with an empty `carriesTo` that reaches its top PLATEAUS**
— it pins at `ceil` and stops the chain there. There is no wrap at the end of a
chain and no `LEVEL_MAX`; the ceiling is emergent.

**`carriesTo` is an ARRAY, and that is load-bearing.** A single-successor
odometer is multiplicatively deep: `junkCount → speedLarge → speedMedium →
speedSmall` would not move small-satellite speed until roughly level 96. With an
array, one `junkCount` wrap bumps all three speed levers simultaneously, each
with its own floor/ceil/step count, so they saturate at different levels while
remaining genuinely independent.

### 2.2 The one-clock rule survives

`leverState(wave)` is **pure** — it reads no game state, takes a level number,
returns a plain object mapping every lever id to its current numeric value. It
is callable before `startGame()` and is this changeset's primary headless-test
surface, exactly as `levelDef()` was. Consumers call it **at the point of use**
(next wave's spawn, next saucer construction), never per frame, so a debug knob
change takes effect at the next relevant event rather than retroactively.

### 2.3 No `low <= normal <= high` validator, ever

The retired tier tables carried a standing prohibition on ordering validators
because four of seven levers descended as difficulty rose. **That prohibition
carries forward unchanged and is if anything stronger here:** several levers
have `floor > ceil` (a shorter delay, a smaller aim error, is harder). Tier
order is by *difficulty*, never by magnitude. Nothing — not the debug panel, not
a call site, not a future validator — may assert `floor <= ceil`.

### 2.4 The three chains

Every number below is a **playtest starting point, not a decision.** Gate B
exists to move them.

**JUNK chain** — driver `junkCount`, sawtooth, carries to all three speeds:

| Lever | floor | ceil | steps | everyN | carriesTo |
|---|---|---|---|---|---|
| `junkCount` | 3 | 12 | 10 | 1 | `[junkSpeedLarge, junkSpeedMedium, junkSpeedSmall]` |
| `junkSpeedLarge` | 60 | 110 | 5 | — | — |
| `junkSpeedMedium` | 95 | 165 | 5 | — | — |
| `junkSpeedSmall` | 140 | 240 | 5 | — | — |

`junkCount` wraps every 10 levels; the three speeds reach `ceil` at level 40 and
plateau. Speed floors are near the shipped `DEBRIS_SPEEDS` (70/110/160) so
level 1 is recognisable. **The three sizes no longer derive from a shared
ratio** — each is an independent lever with an independent knob (FORK resolved).

**HUNTER chain** — driver `coalescePause`, **INVERTED** (shorter is harder):

| Lever | floor | ceil | steps | everyN | carriesTo |
|---|---|---|---|---|---|
| `coalescePause` | 5.0 | 1.5 | 8 | 1 | `[hunterSpeedMedium, hunterSpeedSmall]` |
| `hunterSpeedMedium` | 60 | 110 | 5 | — | — |
| `hunterSpeedSmall` | 90 | 160 | 5 | — | — |

`coalescePause` is the seconds a fresh piece stays inert before it attracts or
merges (the constant formerly `GARBAGE_COALESCE_DELAY` / knob
`garbageAttractDelay`). It wraps every 8 levels; the two pursuit speeds top out
at level 32. Speed floors bracket the retired frozen values (69.6 / 101.5 px/s).

**Large Hunters do not pursue** and have no speed lever — they keep the frozen
`HUNTER_SPEED_CEIL[3] × HUNTER_FLOOR_FRAC` = **40.6 px/s** drift. **All Hunter
turn rates stay frozen** (0 / 0.928 / 1.508 rad/s) — resolved, not a lever.

**UFO chain** — driver `ufoAppearFreq`, **INVERTED**, two carry generations:

| Lever | floor | ceil | steps | everyN | carriesTo |
|---|---|---|---|---|---|
| `ufoAppearFreq` | 25 | 12 | 8 | 1 | `[ufoFlightSpeedBig, ufoFlightSpeedSmall, ufoFireFreqBig, ufoFireFreqSmall]` |
| `ufoFlightSpeedBig` | 100 | 150 | 4 | — | `[ufoDirChangeBig, ufoShotSpeedBig]` |
| `ufoFlightSpeedSmall` | 150 | 210 | 4 | — | `[ufoDirChangeSmall, ufoShotSpeedSmall, ufoAccuracySmall]` |
| `ufoFireFreqBig` | 1.8 | 0.7 | 4 | — | — |
| `ufoFireFreqSmall` | 1.8 | 0.6 | 4 | — | — |
| `ufoDirChangeBig` | 2.2 | 1.0 | 4 | — | — |
| `ufoDirChangeSmall` | 1.8 | 0.7 | 4 | — | — |
| `ufoShotSpeedBig` | 300 | 430 | 4 | — | — |
| `ufoShotSpeedSmall` | 320 | 470 | 4 | — | — |
| `ufoAccuracySmall` | 30 | 8 | 4 | — | — |

**There is exactly ONE UFO appearance timer** (resolved) — per-size spawn
timers are *not* built. Which size spawns is a flat **20% chance of small**,
constant for the whole game, exposed as `DEBUG.smallUfoChance` and **not a
lever**. This is what retires `SAUCER_SMALL_CHANCE_FLOOR/CEIL` and with it the
last consumer of `ramp()`.

**`ufoAccuracySmall` is small-only. Big saucers stay genuinely unaimed** —
`rand(0, TAU)`, no accuracy lever, resolved. Do not add one.

`ufoFireFreq*` remain **multipliers** on the shipped `SAUCER_FIRE_BIG` /
`SAUCER_FIRE_SMALL` per-size ranges, not intervals.

### 2.5 Levers outside every chain

Not everything scales. These are **frozen constants or fixed curves**, and the
plan says so explicitly so nobody re-levers them on a cleanup pass:

- **`payloadSlots`** — a fixed curve, deliberately outside the odometer:
  `8` at levels 1–4, `+2` per level thereafter, `24` at level 12, **flat
  forever after**. Level 12 is therefore the first level at which a Super Mega
  Delivery is possible at all.
- **`smallUfoChance`** — 20%, knob, not a lever.
- **`freqJitter`** — **frozen at 25%**. It applies to the four frequency-shaped
  levers (`ufoAppearFreq`, `ufoDirChangeBig/Small`) via `jitteredInterval()`.
  `ufoFireFreq*` deliberately does **not** jitter — it multiplies two ranges
  that already draw their own random value, and a second pass would double the
  entropy. The knob is removed; the constant stays.
- **`HUNTER_COALESCE_COUNT`** (12), **`GARBAGE_MAGNET_RANGE`** (180 px),
  **`GARBAGE_MAGNET_PULL`** (40 px/s²) — resolved as **not levers**. The first
  is a frozen constant; the latter two remain **debug knobs** (`garbageAttractRadius`,
  `garbageAttractForce`) as they are today.
- **`DEBRIS_GARBAGE`, `HUNTER_GARBAGE`** — the per-kill garbage emission rates.
  Resolved as **frozen constants, not levers**, despite now being the sole input
  to the only Hunter producer.
- **`HUNTER_LAST_STAND_SPEED`** — 50 px/s, with a **new debug knob**
  (`lastStandSpeed`). Not a lever.

---

## 3. Gameplay changes (as distinct from removals)

### 3.1 Permanent garbage + a deterministic density ceiling

With decay gone, `nextWave()` clears nothing and wave-clear triggers on
debris-empty alone, so loose canisters carry across levels indefinitely.
`coalesceGarbage()` is an O(n²) pair walk (~44,500 checks/frame at the CS023
peak). Unbounded growth is not acceptable.

**Two-tier deterministic ceiling. No frame-rate-reactive culling** — it would be
nondeterministic (breaking the suite's byte-identical-across-runs discipline), a
lagging indicator, and would let unrelated background load silently delete the
player's salvage.

- `GARBAGE_SOFT_MAX = 220` — above this, **one** piece is culled per frame:
  the **oldest** (highest cumulative age), and never a piece with `pieces > 1`
  if a single exists. Smooth, invisible, deterministic.
- `GARBAGE_HARD_MAX = 300` — a backstop; above it, cull down to the soft
  ceiling in one pass. Should never fire; exists so a pathological case fails
  loudly-ish rather than melting the frame.

Culling is silent — **no blink-out tell**. §1.4 removed the fade deliberately,
and the ceiling is set high enough that a player should never observe it.

⛔ **This carries a frame-budget gate** (§6, Gate A), measured with the existing
deterministic counter-based method — never wall time.

### 3.2 The Hunter cap becomes a single ceiling with a defined overflow

`HUNTER_CAP_STEPS` goes. **`LARGE_HUNTER_MAX = 100`**, one constant, no clock.

**Resolved overflow rule:** when a clump reaches `HUNTER_COALESCE_COUNT` while
`LARGE_HUNTER_MAX` large Hunters already exist, **the clump is destroyed** — it
does not hold at its final stage (the retired behaviour, which stalls the
pipeline), and it does not convert. It simply vanishes, with a `boom()` in the
garbage hue. `awardScore = false` semantics apply: no score, no achievement
counters.

### 3.3 Large-Hunter last stand, formalised

Kept as a **documented exception** to "the large Hunter does not pursue."
The shipped implementation already matches the intent almost exactly and stays:
while `game.debris.length === 0` and the ship is alive, a large core steers
toward the ship at `DEBUG.lastStandSpeed`; the moment debris reappears the block
stops executing and the core **retains whatever `vx`/`vy` it had at that
instant**, resuming a straight drift. `this.homing` is never flipped (that would
swap the silhouette and freeze the tumble). Only change: the hardcoded
`HUNTER_LAST_STAND_SPEED` becomes a debug knob.

### 3.4 Every powerup is count-based; Engine becomes fuel

`powerMode()` / `powerDuration()` / `game.powerFx` are deleted and
`powerActive(type)` reduces to `game.powerBudget[type] > 0`. Budgets, all
unchanged from today's count-mode values:

| Type | Budget | Unit |
|---|---|---|
| Rapid | 40 | trigger pulls |
| Triple | 30 | trigger pulls (a 3-fan is ONE pull) |
| Magnet | 40 | canisters hooked |
| Guard | 3 | intercepts (`DEBUG.chainGuardIntercepts`) |
| **Engine** | **5.0** | **seconds of forward thrust** (NEW) |

**Engine as fuel (resolved):** `ENGINE_BURN_SECONDS = 5.0`, a debug knob.
`game.powerBudget.engine` is decremented by `dt` **only on frames where forward
thrust is applied**. Rotation and reverse burn nothing. Magnitude stays the flat
`ENGINE_MASS_MULT = 0.5` (halves effective towed mass while any fuel remains),
now with a **debug knob** — it does **not** taper with remaining fuel.

Banking is preserved for every type: a same-type pickup **adds** budget rather
than refreshing, and arms the HUD bank badge. Health (instant) and Scoop
(persistent) are unchanged and remain outside `POWERUP_DROP_TYPES`.

The HUD's active-effect rows lose their dual time/count shape and render the
count form only. `POWERUP_DROP_TYPES` order stays load-bearing (it fixes each
type's HUD row index) — **append-only, never insert.**

### 3.5 Chain Guard: four knobs become three

`chainGuardTime` is deleted with timed mode. `chainGuardIntercepts` (3),
`chainGuardMinTow` (5) and `chainGuardCooldown` (0.75 s) all survive unchanged,
as does the conditional drop-weight entry (`"guard"` only enters the roll while
`game.chain.length >= DEBUG.chainGuardMinTow`) and the both-total-and-walk
renormalisation rule that goes with it.

### 3.6 World size

`WORLD_SIZE_FIELD` is already **4** (2560×1440 — two screens by two). Every
level now runs at that size. **`worldSizeFor()`, `resizeWorld()`, `worldDims()`,
the size table and `WORLD_SIZE_MAX` all stay** — `worldSizeFor()` simply returns
`WORLD_SIZE_FIELD` unconditionally and loses its archetype key. This keeps the
**9× path (3840×2160) live and testable** at near-zero cost, per the standing
"reserve the ability" requirement. `STAR_COUNT` continues to derive from
`WORLD_SIZE_MAX`, so the starfield stays generated at the largest table size and
filtered per world.

### 3.7 The Difficulty menu shrinks to one row

`DIFFICULTY_ROWS` goes from `["shot", "magnet", "autoshield", "chainguard",
"back"]` to `["autoshield", "back"]`. The screen is kept (resolved), not folded
elsewhere. `settings.autoShield` persists exactly as today; the three removed
mode fields are orphaned keys on `afd_settings_v1` and are **ignored** under the
standing known-value-else-default rule — **no schema bump, no rename, no
migration shim.**

---

## 4. Implementation notes by area

### 4.1 Orbit + drift excision

Remove: the `ORBIT_*` constants block; `generateOrbitLayout`, `placeOrbitRing`,
`nearestOrbitDist`, `spawnSafeOrbitLayout`, `orbitTangent`, `orbitSyncVelocity`,
`orbitGapMult`, `orbitRadiusStepFor`, `orbitEffectiveCount`,
`orbitEffectiveGapMult`, `spawnOrbitWave`, `rerollOrbitStartAngles`,
`activeRingsFor`, `maxOrbitSpeed`, `updateDebrisDrift`; `game.orbitLayout`; the
`r` reroll keybind; the 11 ORBIT debug knobs; `tools/orbit-lab.html`.

**Three consequences that are not obviously "orbit":**

1. **`debrisBounce()` simplifies.** Its `aFixed`/`bFixed` dispatch is
   `!!x.orbitCenter || x instanceof Saucer`. With no rails it reduces to the
   Saucer test alone, and the **rail/rail no-op branch becomes unreachable and
   is deleted**. The mass-weighted free/free exchange and the free/fixed
   (Saucer-as-immovable-wall) branch both stay, byte-unchanged in behaviour.
2. **`DebrisSatellite` loses its orbit fields** — `orbitCenter`, `orbitRadius`,
   `orbitAngle`, `orbitAngVel` and the rail motion mode. Free-body motion only.
3. **`nextWave()` loses its archetype branch.** `spawnFieldSatellites()` is the
   only spawn path and is called unconditionally.

### 4.2 Bonus canister excision

Remove `BONUS_CANISTER_PIECES`, `BONUS_CANISTER_SCORE`,
`BONUS_SPAWN_CHANCE_EARLY/LATE`, `BONUS_RING_PAD`, `bonusSpawnChance()`, the
`nextWave()` spawn block, `Garbage.bonus`, `drawBonusRing()`, the
`COLOR.garbageBonus` branch in `Garbage.draw()`, and the one-shot payout +
flag-clear in the scoop intake path.

### 4.3 Ambient Hunter excision

Remove `HunterSatellite.spawnCore()`, `game.hunterTimer`, its `startGame` reset,
and the `update()` spawn block including the `game.wave >= 2` gate.
`noteLargeHunterSpawn()` **stays** — it still arms the Hunter's Bane achievement
on the 0→1 transition, now driven solely by coalescence conversion.

### 4.4 Garbage permanence

Remove `Garbage.decay`, the `decay -= dt` / `dead` block, `GARBAGE_FADE`, both
blink-out render branches, and the `garbageLifetime` knob. Add
`GARBAGE_SOFT_MAX` / `GARBAGE_HARD_MAX` and the cull pass (§3.1), placed with
the end-of-frame cleanup filters, **after** every pass that can mark a piece
dead. `Garbage.fromNode` (severed chain nodes) is unchanged and its output is
now permanent too — that is intended.

Age tracking: `Garbage` gains a monotonically increasing `age` (ticked in
`update`), used **only** by the cull ordering. A merge does **not** reset it —
the retired decay clock reset on merge, but a clump that has been sitting around
is exactly what the cull should prefer to take.

### 4.5 The odometer

New section in the constants block: `LEVERS` (the table from §2.4) and
`leverState(wave)`. `leverState` must be **evaluable alone in a bare context** —
the CS018 `levelDef` test convention slices the source from the section banner to
the function's closing brace and runs nothing else, and that test is being
rewritten for this function. **Anything `leverState` reads must be inside that
slice.**

Consumers, all reading through `leverState(game.wave)` at the point of use:
`nextWave()` (junk count and all three speeds), `destroyDebris()` (split-child
speeds), `coalesceGarbage()`'s inert-delay gate, `HunterSatellite`'s constructor
(medium/small pursuit speed), the saucer spawn block, and `Saucer`'s constructor
and `update()`.

Every lever value is additionally exposed as a **debug knob** so it can be
overridden live — same "constant supplies the `def`, consumer reads `DEBUG.*` at
the site" convention every ORBIT knob already followed.

### 4.6 UFO per-size independence

`ufoFlightSpeedPx(small)` currently derives big as `small × (100/150)`. That
derivation goes: big and small each read their own lever. Same for direction
change, fire frequency and shot speed — each helper takes `small` and selects
the matching lever. `ufoAccuracyRad()` is small-only and keeps no size
parameter. The spawn site's `ramp(SAUCER_SMALL_CHANCE_FLOOR, ...)` becomes
`Math.random() < DEBUG.smallUfoChance`.

### 4.7 Powerup expiry

`applyPowerup()`'s three-way branch (scoop / health / timed / count) collapses to
three arms: scoop, health, count. `powerBudgetAmount(type)` becomes the single
source of grant size. The engine decrement goes in `Ship.update()`'s thrust
branch, gated on thrust actually being applied that frame — **not** in the main
`update()` timer block, or rotation would burn fuel.

---

## 5. Debug registry

The registry goes **46 → ~44 entries**, but almost none of them are the same
entries. Registry order fixes row index, so this is a **deliberate rebuild**, not
an append. Removal is safe under the standing rule: orphaned keys in
`afd_settings_v1.debug` are ignored by known-value-else-default loading. **No
schema bump. No rename of `afd_settings_v1` / `afd_scores_v1` /
`afd_achievements_v2` — all three stay frozen.**

Sections, in order: **SHIP · GARBAGE · CHAIN GUARD · DELIVERY · JUNK · HUNTER ·
UFO · POWERUPS · GLOBAL**.

**Removed:** 11 ORBIT knobs · `debrisDriftAccel` · `garbageLifetime` ·
`chainGuardTime` · `freqJitter` · all 21 tier knobs.

**Kept:** `autoShieldRegenPause` · `scoopHitsPerLevel` · `garbageAttractRadius` ·
`garbageAttractForce` · `chainGuardIntercepts` / `MinTow` / `Cooldown` ·
`dockComboGrace` · `sweepCoalescePause` · `debrisBounceRestitution`.

**New:** one knob per lever (17) · `smallUfoChance` · `lastStandSpeed` ·
`engineBurnSeconds` · `engineMassMult` · `garbageSoftMax` · `garbageHardMax`.

---

## 6. Playtest gates

⛔ **Both gates BLOCK.** **The questions themselves live in `IMPLEMENTATION-PHASES-CS024.md`'s gate
sections** — that is the single source, so they cannot drift between two docs,
and it is the doc open in front of you at gate time. That file also explains the
full handoff under "How a playtest gate works." What follows here is the design
rationale for *why* each gate exists.

### Gate A — after P3 (the removals with gameplay consequences)

1. **Do Hunters still appear at all?** Play at least 6 levels without
   deliberately farming. Roughly how many levels before the first one? If the
   answer is "never," the coalescence numbers need a retune and that is what P4
   inherits.
2. **Is the field readable?** With garbage permanent, does a level-6 screen read
   as salvage-rich or as visual noise?
3. **Does the cull ever visibly fire?** You should never see a canister vanish.
   If you do, `GARBAGE_SOFT_MAX` is too low.
4. **Frame rate**, subjectively, at the worst moment you can produce.
5. **Does removing the bonus canister leave the early levels flat?** It was
   explicitly a reason-to-keep-playing for low-stakes waves.
6. **Last stand:** does a large Hunter resuming its old vector when debris
   reappears read as intentional, or as a bug?

### Gate B — after P6 (the full ramp)

7. **Play levels 1 → 20 at minimum.** Does the sawtooth read as *breathing*, or
   as the game repeatedly getting easier?
8. **Is the carry legible?** When `junkCount` resets to 3 and the satellites are
   visibly faster, does that land as an escalation?
9. **Chain lengths:** `junkCount` wraps every 10 levels, `coalescePause` every
   8, `ufoAppearFreq` every 8. Do three chains breathing on different periods
   feel rich, or arrhythmic?
10. Each of the 17 levers is a live slider. **Retune in-session and report the
    number you landed on, not a yes/no.**
11. **Engine-as-fuel:** does 5 seconds of thrust feel like a powerup or like a
    tease?
12. **Count-only powerups:** does losing the timed mode make Magnet (40 hooks)
    or Rapid (40 shots) feel meaningfully different?
13. **Level 12 and the Super Mega Delivery** — now that 24 slots is the first
    moment an SMD is possible, does hitting it land as the payoff it should be?

---

## 7. Forks and flags

**FORK-CS024-A — chain composition and step counts (§2.4).** Every number in
those three tables is a starting point. Resolved *structurally* (three chains,
array carries, plateau at top); the *values* are Gate B's job. Do not treat the
tables as tuned.

**FLAG-CS024-b — `coalescePause` as the HUNTER chain's driver.** It is the only
hunter-side quantity that varies per level, so it is the only candidate driver.
Best guess, not a decision: if the sawtooth on it reads badly (hunters arriving
in waves), the fallback is to make it a plain monotone ramp and give the chain
no driver, with the two pursuit speeds ramping on their own `everyNLevels`.

**FLAG-CS024-c — `GARBAGE_SOFT_MAX = 220`.** A pure guess. Gate A question 3 is
its A/B.

**FLAG-CS024-d — two-generation UFO carry.** `ufoAppearFreq` bumps four levers,
which each bump two or three more. This is the deepest chain in the changeset
and the most likely to feel arrhythmic. Flattening it to one generation is a
one-line table edit.

**FLAG-CS024-e — the cull's ordering rule** ("oldest, preferring singles") is
invented here. It has no precedent in the build.

**Not in scope, recorded for a future changeset:** a **spatial grid for
`coalesceGarbage()`**. If Gate A shows the O(n²) pass is what actually binds
`GARBAGE_SOFT_MAX` — rather than screen readability — a uniform grid would let
the ceiling rise by an order of magnitude. That is a CS025 conversation, not a
CS024 phase.

---

## 8. Standing rules this changeset must not break

- **Wrap-aware math is mandatory** — `dist2`, `angleTo`, `shortDelta`. The
  single most common source of subtle bugs here.
- **Entity lifecycle:** dead flag + end-of-frame `.filter()`, never mid-loop
  splice. The new cull pass obeys this.
- **`awardScore = false`** excludes score and achievement counters while keeping
  drops. The cap-overflow clump destruction (§3.2) rides it.
- **Route all scoring through `addScore()`** — one sanctioned bypass exists
  (`AUTO_SHIELD_SCORE_PENALTY`); do not add another.
- **Three frozen `localStorage` keys**, additive-only, known-value-else-default.
- **GDD §2 describes shipped behaviour only.**
- **Tests drive the real `startGame`/`nextWave`/`update(1/60)` paths**, never a
  reimplementation. Frame-budget gates use deterministic counters, never wall
  time.
- **Grep before speccing.** Every symbol anchor in this document is an estimate
  that drifts the moment a phase lands. Re-grep by symbol at the start of every
  session.