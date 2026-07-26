# DIFFICULTY LEVERS — living registry

This is a **living document** — it is never archived, unlike the version-suffixed
planning docs (`PLANNED-FEATURES-*.md` / `IMPLEMENTATION-PHASES-*.md`). Every
difficulty lever, present and future, gets an entry here regardless of which
changeset shipped it. Update this file in the same commit that adds, retunes, or
enables/disables a lever.

> **Rewritten in CS017 P3** (FLAG-CS017-d/e/f/h). Before P3 this document
> described exactly one mechanism — the `leverScale` `{enabled, start, floor}`
> object — and asserted as an invariant that *"a lever can never take a quantity
> below its shipped baseline"* and that levers are *"not a general
> difficulty-increase mechanism."* **The CS017 P3 spiral reverses that.** Both
> statements are gone rather than patched, and the registry's scope has widened
> from "`leverScale` objects" to "every catalogued difficulty knob." Read §2
> before adding anything.

## 1. Purpose

A **difficulty lever** is a small, named, catalogued knob that scales one
gameplay quantity as the game's difficulty progresses. Levers exist so that:

- Difficulty tuning is **discoverable in one place** instead of scattered as
  ad hoc `if (game.wave > N)` checks at call sites.
- A lever can be **built, wired, and tested while shipping inert** — landing
  the plumbing and a phase's balance change (if any) as separate, reviewable
  steps.
- Every lever's shape and clock is written down, so reading one teaches you how
  to read the others *and* tells you which of the game's two clocks it is on.

## 2. The mechanisms

There is no longer a single lever mechanism. There are three, and a lever's
entry in §3 must say which it uses.

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

A plain object: `{ enabled, start, floor }`.

- **`start`** — the value at wave 1 (and, while disabled, at every wave).
- **`floor`** — the value the lever ramps *toward* as difficulty climbs; for the
  two shipped levers this is the pre-lever shipped baseline.
- **`enabled`** — when `false`, the lever is **inert**: `leverScale` always
  returns `start`, at every wave. The lever is fully wired into real entity
  construction and proven-by-test to ramp correctly, but nothing about observed
  gameplay changes until someone flips it on.
- **`Math.max(lever.floor, s)` is a clamp on THIS mechanism, not a law about
  difficulty.** It bounds where a `leverScale` lever can travel; it says nothing
  about the game's overall difficulty ceiling. See §2.4.
- **Evaluated at entity construction, not per frame.** A `leverScale` lever's
  effect is baked into an entity (a `Powerup`, a `Dock`, …) once, when it is
  created. Ramping therefore only affects newly-spawned objects going forward —
  it never mutates something already on screen mid-frame, and the per-frame
  `update()`/`draw()` paths never call `leverScale`.

### 2.2 Direct `ramp()` levers — the original mechanism (v1.5)

Most difficulty in this game is not a `leverScale` object at all. It is a
`floor`/`ceil` constant pair passed through `ramp(floor, ceil, wave)` at the
call site — the saucer spawn gap, fire-rate multiplier, aim error and
small-saucer chance; the Hunter speed/turn ceilings. These are levers in every
sense that matters (named constants, catalogued, tuned in one block) and belong
in the registry even though they have no `{enabled, start, floor}` wrapper.

### 2.3 Sawtooth + spiral levers — the cycle clock (CS017 P3)

The four levers listed in §3 as *sawtooth* sample `game.cycleWave` (which resets
every `CYCLE_LENGTH` waves) and pass the result through
`cycleValue(x, game.cycle) = x × (1 + cycle × CYCLE_GAIN)`. They climb across a
cycle, drop at the cycle boundary, and each cycle opens above the last. Full
model, concrete numbers and the two ceilings: **GDD §2.13**.

### 2.4 There is no baseline invariant — a lever CAN make the game harder

**This reverses the pre-CS017-P3 rule.** The old text said a lever's `floor` was
a hard clamp, that a lever "can only ever return the game toward today's
difficulty from an easier starting point," and that making the game harder
required editing the baseline constant rather than touching a lever. The CS017
P3 spiral is a counter-example on all three counts: `cycleValue` multiplies
without bound, `DEBRIS_COUNT_MAX` raised the debris-count ceiling from 9 to 12
outright, and the shipped curve carries debris count, debris speed and Hunter
speed/turn **well past** their pre-CS017 values in every cycle after the first.

What survives from the old rule is only this, and it is a property of §2.1's
mechanism alone: **a `leverScale` lever with `enabled: false` is pinned at
`start` and observably does nothing but hold that constant.**

Two things now bound difficulty instead, and both are explicit constants rather
than a structural guarantee:

- **`DEBRIS_COUNT_HARD_MAX`** (24) — the absolute ceiling on spawned debris after
  the spiral gain, so a deep run cannot grow an unbounded field.
- **`DEBRIS_SPEED_CAP`** (`2 × SHIP_MAX_SPEED` = 1040 px/s) — a guard rail on the
  resulting per-entity debris speed. It does not bind at the shipped curve
  (~423 px/s peak over waves 1–30); it is insurance against a retune.

**If you add a lever that can grow without bound, add its ceiling in the same
commit and record it here.**

### 2.5 Which clock is a lever on? — the deliberate asymmetry

Since CS017 P3 the game runs two difficulty clocks at once, and **the split is a
design decision, not an inconsistency to be tidied away**:

- **Sawtooth group** (`game.cycleWave` + `cycleValue`): debris count, debris
  speed (both sites), Hunter speed, Hunter turn rate. These breathe — they reset
  at each cycle boundary. **CS017 P5 adds a fifth member on the same clock but
  NOT through `cycleValue`: the bonus-canister spawn chance.** It reads
  `game.cycleWave` (so it resets at the boundary like the rest) but takes no
  spiral gain — a probability that grew every cycle would eventually pin at 1.
  It is also the only member that eases off rather than climbing (§2.7).
- **Frozen group** (absolute `game.wave`): everything else — the whole saucer
  group, the two `leverScale` levers, and the Kessler / player-ability / economy
  knobs. These only ever get harder.

The intent is **monotonic background pressure under a cycling foreground**, so a
cycle rollover reads as *relief* rather than as *the game got easier*. Before
retuning any lever, check which group it is in; before moving one between
groups, read GDD §2.13.

### 2.6 Levers ramp on the SHIPPED curve — never a private one

Every mechanism above interpolates with `difficultyFactor`/`ramp` (GDD §2.13).
`RAMP_WAVES` is the one knob governing the whole game's pacing, and
`CYCLE_LENGTH`/`CYCLE_GAIN` the one pair governing the cycle. A lever piggybacks
on those rather than duplicating them, so tuning them retunes every lever at
once, consistently. **No lever gets its own curve.**

**One documented exception: the bonus-canister spawn chance (CS017 P5).**
`bonusSpawnChance()` interpolates **linearly** across `game.cycleWave` rather
than through `ramp()`. The reason is specific and does not generalize: its two
constants are defined as the **cycle's exact endpoints** — `_EARLY` at
`cycleWave` 1, `_LATE` at `cycleWave === CYCLE_LENGTH` — and `difficultyFactor`
is asymptotic. Over the 9 waves of a cycle it only reaches
`1 − e^(−8/8) ≈ 0.632`, so a `ramp()` version would bottom out around **0.25**
and `BONUS_SPAWN_CHANCE_LATE = 0.1` would never be the number it says it is. A
playtest knob that lies about its own value is worse than a private curve. This
is also the only lever whose value **decreases** with difficulty by design (see
§2.7), so it shares nothing with `RAMP_WAVES`'s pacing intent anyway. **Do not
take this as license for a second private curve** — a new lever that wants one
should first be re-specified in terms of `ramp()`'s asymptotic endpoints.

### 2.7 One lever eases OFF (CS017 P5)

Every other entry in the registry makes the game harder as it climbs. The
**bonus-canister spawn chance** is deliberately inverted: it is highest right
after a cycle reset and lowest at the cycle's end. It is not a threat lever at
all — it governs how often a *reward* appears — and it is registered here
because it reads the same cycle clock as the sawtooth group and will be retuned
alongside them. Its intent (GDD §2.10.1) is to concentrate the temptation in the
window where the player can afford to take it: the reward is six extra cargo
nodes, which is itself a liability, so the lever tunes **how often the game
offers a greedy line**, not how hard the game is.

## 3. Lever registry

| Lever | Constant(s) | Scales | Mechanism | Clock | Shape / range | Enabled? | Shipped | Playtest status |
|---|---|---|---|---|---|---|---|---|
| Powerup size | `LEVER_POWERUP_SIZE` | `Powerup.radius` (baseline `POWERUP_RADIUS` = 15) | `leverScale` | absolute `game.wave` | start 2.0 → floor 1.0 | **false** | v3.4 P2 | Not playtested — ships disabled (tooling only). **Frozen at CS017 P3 (FLAG-CS017-h).** |
| Dock size | `LEVER_DOCK_SIZE` | `Dock.radius` (baseline `DOCK_RADIUS` = 44) | `leverScale` | absolute `game.wave` | start 2.0 → floor 1.0 | **false** | v3.4 P2 | Not playtested — ships disabled (tooling only). **Frozen at CS017 P3 (FLAG-CS017-h).** |
| Debris count | `DEBRIS_COUNT_MAX` (12), `DEBRIS_COUNT_HARD_MAX` (24) | debris spawned per wave in `nextWave()` | sawtooth + spiral | `game.cycleWave` / `game.cycle` | `min(round(cycleValue(min(3+cw, 12), c)), 24)` | **yes** | CS017 P3 | **Live, unplaytested.** Cycle openings 4,4,5,5,6…; tops 12,13,15,16,18… |
| Debris speed | `DEBRIS_SPEED_PER_WAVE` (0.08), `DEBRIS_SPEED_CAP` (1040) | `DebrisSatellite` drift speed, **two** derivation sites | sawtooth + spiral | `game.cycleWave` / `game.cycle` | `cycleValue(1 + (cw−1)×0.08, c)`, result clamped at the cap | **yes** | CS017 P3 | **Live, unplaytested.** 1.00→1.64, 1.12→1.84, 1.24→2.03 per cycle. Cap does not bind. |
| Hunter speed | `HUNTER_SPEED_CEIL`, `HUNTER_FLOOR_FRAC` (0.58) | `HunterSatellite.speed`, sampled once at spawn | direct `ramp` + spiral | `game.cycleWave` / `game.cycle` | `cycleValue(ramp(CEIL×0.58, CEIL, cw), c)` | **yes** | v1.6; put on the cycle clock CS017 P3 | **Live, unplaytested.** A carried Hunter keeps its spawn cycle's value for life (accepted design). |
| Hunter turn rate | `HUNTER_TURN_CEIL`, `HUNTER_FLOOR_FRAC` | `HunterSatellite.turnRate`, sampled once at spawn | direct `ramp` + spiral | `game.cycleWave` / `game.cycle` | same shape; large core's ceiling is 0, so it never turns | **yes** | v1.6; put on the cycle clock CS017 P3 | **Live, unplaytested.** |
| Saucer spawn gap | `SAUCER_GAP_FLOOR_MIN/MAX`, `SAUCER_GAP_CEIL_MIN/MAX` | seconds between saucers | direct `ramp` | **absolute `game.wave`** | rand(20,30)s → rand(12,16)s | **yes** | v1.5 | Shipped. **FROZEN group** — deliberately not on the cycle clock. |
| Saucer fire rate | `SAUCER_FIRE_MULT_FLOOR/CEIL` | between-shot interval multiplier | direct `ramp` | **absolute `game.wave`** | 1.8× → 1.0× | **yes** | v1.5 | Shipped. **FROZEN group.** |
| Small-saucer aim error | `SAUCER_AIM_ERR_FLOOR/CEIL`, `SAUCER_ACCURACY_RAMP_SCALE` (0.5) | aimed-shot spread (rad) | direct `ramp`, scaled wave argument | **absolute `game.wave`** | ±0.35 → ±0.09 | **yes** | v1.5; scale knob CS012 P1 | Shipped. **FROZEN group.** |
| Small-saucer chance | `SAUCER_SMALL_CHANCE_FLOOR/CEIL` | odds the spawned saucer is the aimed one | direct `ramp` | **absolute `game.wave`** | 15% → 60% | **yes** | v1.5 | Shipped. **FROZEN group.** |
| **Bonus-canister spawn chance** | `BONUS_SPAWN_CHANCE_EARLY` (0.5), `BONUS_SPAWN_CHANCE_LATE` (0.1) | per-wave probability that `nextWave()` spawns a bonus canister | **linear** across the cycle (`bonusSpawnChance()`, §2.6 exception) | `game.cycleWave` | **50% → 10%, EASES OFF** (0.50, 0.45, 0.40, 0.35, 0.30, 0.25, 0.20, 0.15, 0.10) | **yes** | CS017 P5 | **Live, unplaytested.** The only lever that decreases (§2.7). Resets to 50% at every cycle boundary. |

**On the two `leverScale` levers (FLAG-CS017-h).** Both remain
`enabled: false` after CS017 P3 — that was reviewed and deliberately left alone.
**"Freeze" here means keep the 2×, not restore 1×:** while disabled, `start` is
pinned, so the shipped, player-visible reality is that **powerups and the
recycling dock are permanently 2× their pre-lever size**, and have been since
v3.4 P2. Enabling either lever would instead make wave 1 spawn at 2× and shrink
toward the familiar 1× baseline as difficulty ramps — an "ease players in with a
bigger target/dock" knob, not yet turned on. Do not "restore" 1× as a cleanup.

## 4. Assumptions & Decisions

- **No lever gets its own curve.** Every mechanism interpolates through the
  shipped `difficultyFactor`/`ramp`, and the sawtooth ones additionally through
  `cycleValue`. `RAMP_WAVES` and `CYCLE_LENGTH`/`CYCLE_GAIN` are the pacing knobs
  (GDD §2.13); a second, independent per-lever curve would make the game's
  difficulty progression illegible across systems.
- **A lever's entry must name its clock.** Since CS017 P3 there are two, and
  "which clock" is now the first question when reading or retuning any lever
  (§2.5).
- **`leverScale` levers are evaluated at ENTITY CONSTRUCTION, not per frame.**
  Ramping affects newly-spawned objects only, and the per-frame update/render
  paths never touch `leverScale`. The sawtooth levers follow the same discipline:
  debris speed is baked at construction, and a Hunter samples its speed/turn once
  at spawn and never re-samples.
- **A lever CAN raise difficulty past its historical baseline** (§2.4). This
  reverses the pre-CS017-P3 rule. Anything unbounded needs an explicit ceiling
  constant, added in the same commit and recorded here.
- **Both v3.4 `leverScale` levers still ship disabled** — tooling for a future
  playtest round, not a balance change. Their observable effect remains the
  permanent 2× size (FLAG-CS017-h).

## 5. Candidate levers not yet built

A running list for future rounds — not yet implemented, not yet named
constants. *(Audited and corrected in CS017 P3, FLAG-CS017-d — two entries here
had gone stale and named constants that no longer exist.)*

- **`HUNTER_GARBAGE` counts** — the per-tier garbage-drop table `{3:3, 2:2, 1:1}`
  (GDD §2.5/§2.5.1). A lever could ease the Hunter-side garbage amplifier in
  earlier waves. *Constant still exists; candidate still valid.*
- **`CARGO_GROW_PER`** — the per-delivery tow-cap growth rate (GDD §2.10.2). A
  lever could make the cap grow faster early on, easing the greed-vs-safety
  tension before the game reaches full intensity. *Constant still exists;
  candidate still valid.*
- **`DEBUG.garbageLifetime`** — *replaces the old `GARBAGE_DECAY` entry, which
  was stale.* `GARBAGE_DECAY` (22) survives in the source only as a commented
  historical reference; since **CS015 P6** the live garbage-decay governor is the
  `garbageLifetime` debug var (default 10 s, `DEBUG_VARS`), applied to every
  piece rather than singles only. A lever would have to wrap the debug var, not
  the dead constant — and would need to respect the `garbageLifetime` ≫
  `garbageAttractDelay` relationship or nothing clumps (GDD §2.10.1).
- ~~**`POWERUP_DROP_CHANCE`**~~ — **removed from this list (FLAG-CS017-d).** The
  constant no longer exists: **v3.6 P3** replaced the per-kill drop roll with
  three deterministic, unconditional emitters, so there is no chance gate left to
  ease. A powerup-economy lever would now have to target `POWERUP_DROP_WEIGHTS`
  or the emitter cadence instead (GDD §2.14).
- **Saucer levers onto the cycle clock** — moving any of the four frozen saucer
  levers into the sawtooth group is a live design option, not a bug fix. It would
  change the "monotonic background pressure" intent of §2.5, so it is a
  conversational decision, not an implementation one.
