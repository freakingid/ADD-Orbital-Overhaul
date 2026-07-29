# PLANNED FEATURES — CS017: Difficulty Ramp & Engagement Pass

Target `GAME_VERSION` `"1.0.0.17"` (rides the last player-visible phase).
Base build: CS016 P5, `"1.0.0.16"`. All anchors below are **grep-verified against
the live build** on the date of this planning pass.

Source: Paul's CS017 gameplay testing notes + the marked-up
`LEVER-INVENTORY-CS017.md` worksheet.

---

## 0. Shape of the changeset

Four workstreams:

| WS | Content | Depends on |
|----|---------|-----------|
| **A** | Cycle clock + sawtooth escalation (the ramp itself) | FORK-A, FORK-C |
| **B** | Time-in-level pressure axis (saucers) | FORK-B |
| **C** | Dev difficulty logging | WS-A (logs its values) |
| **D** | Three features: bonus canister, chain-guard powerup, wave-clear confirm | FORK-D, FORK-E |

WS-C should land **early**, not last — it is the instrument you'll use to
evaluate WS-A/B in playtest.

---

## 1. FORKS — genuine design decisions, not resolved here

### ⚠ FORK-CS017-A — does the sawtooth **spiral** or **plateau**? *(the load-bearing one)*

Your markings sawtooth debris count, debris speed, Hunter speed and Hunter turn
rate — each resets to its wave-1 value at the cycle boundary. Everything else in
§1–§5 of the worksheet is **Freeze**.

**Consequence, stated plainly:** the only levers that still climb monotonically
are the two frozen saucer ramps (fire rate, small-saucer chance), and they ride
`difficultyFactor` with `RAMP_WAVES = 8`, so they are ~95% saturated by wave 25
and ~99% by wave 41. **After roughly wave 20–25 the game reaches a fixed steady
state and never changes again** — every cycle is identical to the last. That
directly contradicts CS017's founding observation ("difficulty does increase over
time, but it's unclear which levers are changing"), and it contradicts your own
worked example, which ended "*…but every dangerous thing is a little bit faster*."

- **(a) Plateau** — build exactly as marked. Cycles repeat identically forever.
  Defensible if you want the game to become a pure endurance/scoring test past
  wave ~20, with all long-run difficulty coming from player fatigue.
- **(b) Spiral (RECOMMENDED)** — each cycle resets to a **higher floor** than the
  last. One new constant per lever, `CYCLE_GAIN`, applied as
  `value = ramp(floor, ceil, cycleWave) × (1 + cycle × CYCLE_GAIN)`. The player
  still *feels* the reset as relief (the sawtooth is preserved, and that
  legibility is the point), but each cycle is measurably harder. This is what the
  dashed lines in the escalation chart show at `CYCLE_GAIN = 0.12`.
- **(c) Spiral with a ceiling** — as (b), but each lever clamps at an absolute
  maximum so the spiral asymptotes rather than running away.

**Best guess: (b)**, `CYCLE_GAIN` per-lever and dev-tunable. Note that (b) and (c)
both take quantities **past their shipped baseline** — which the old
`leverScale` invariant forbade. That's fine under your broad-sense ruling, but it
means `DIFFICULTY-LEVERS.md` §2/§4 must be rewritten (see FLAG-h).

### FORK-CS017-B — how does the time-in-level axis compose with the wave axis?

Rows 5–6 (saucer aim error, saucer spawn gap) escalate with **time spent in the
current level**. There is **no wave-elapsed timer in the build today** — grep for
`waveTime`/`waveElapsed`/`waveClock` returns nothing. So `game.waveTime` is new
machinery (reset in `nextWave()`, ticked in `update()`'s playing body, frozen
while paused like every other accumulator).

- **(a) Replace** — these two levers stop reading `game.wave` entirely and read
  only `game.waveTime`. Simple, but wave 1 and wave 20 open identically.
- **(b) Compose (RECOMMENDED)** — the wave (or cycle-wave) ramp sets the level's
  **opening** value, exactly as today at `t = 0`; time-in-level then ramps from
  there toward a tighter pressure ceiling over `SAUCER_PRESSURE_SECS`. Preserves
  all current behaviour at level start and adds the "finish the level" pressure
  on top.

**Best guess: (b).** Ramp scale exposed as `DEBUG_VARS` knobs
(`saucerPressureSecs`, and one scale per lever) per your note.

**Design note worth your eye:** this lever rewards *fast* clears. The bonus
canister (WS-D) rewards *lingering* to build a fat chain. Those pull against each
other — deliberately, I think, and that tension is probably good — but it's worth
naming now rather than discovering it in playtest.

### FORK-CS017-C — do all resets fire on **one** event?

You keyed the Hunter reset on "once `HUNTER_SPEED_CEILING` is reached" and the
debris reset on the debris-count cap. Two problems: (1) Hunter speed ramps on
`difficultyFactor`, which is **asymptotic — it never literally reaches the
ceiling**, so that condition needs a definition regardless; (2) two independent
reset conditions on different clocks would drift apart and be much harder to read.

- **(a) One cycle boundary (RECOMMENDED)** — a single `CYCLE_LENGTH` (naturally
  **9**, the wave at which `min(3 + cycleWave, 12)` caps) resets everything at
  once. One event, one moment of relief, trivially legible.
- **(b) Independent per-lever reset conditions** — as literally marked.

**Best guess: (a).** New state: `game.cycle` (0-based) and `game.cycleWave`
(1-based), both derived in `nextWave()`.

### FORK-CS017-D — what shape is the rare bonus canister?

- **(a) High-value single** — one canister that occupies N chain slots on scoop.
- **(b) Pre-linked clump (RECOMMENDED)** — spawns as an existing `Garbage` with a
  high `pieces` count. The clump machinery already exists (`pieces`,
  `radius = 7·√pieces`, `coalesceGarbage`, `shatterClump`), so this is likely far
  less new machinery. **Needs a grep of the scoop-intake path in the P-phase** to
  confirm whether multi-piece intake already yields multiple chain nodes — I have
  not verified that and will not assume it.

**Best guess: (b), pending that grep.** Open sub-questions: score value, visual
tell (colour? different silhouette?), audio tell, and whether it can spawn from
Hunter/debris destruction or only as a standalone field spawn.

### FORK-CS017-E — does chain-guard survive ship death?

`breakChain(i)` and `scatterChain()` are separate functions. `breakChain` is the
hostile-break choke point with exactly **two** call sites (bullet hit, Hunter
collision) — a clean single insertion point. `scatterChain()` is ship death only.

- **(a) Guard covers hostile breaks only (RECOMMENDED)** — death still scatters
  the whole load. Keeps death unambiguously terminal.
- **(b) Guard also survives death** — much stronger, and muddies the death beat.

**Best guess: (a).** Also consistent with CS011 P5's precedent that death stays
voice-silent.

---

## 2. WS-A — cycle clock & sawtooth escalation

**New state.** `game.cycle`, `game.cycleWave`, derived in `nextWave()` from
`game.wave` and `CYCLE_LENGTH`. `game.wave` itself is **untouched** — every
achievement, the HUD `LEVEL` readout, high-score records and `musicStateFor` keep
reading it. This is important: `game.wave` stays the player-facing absolute
counter; `cycleWave` is the internal difficulty clock.

| Lever | Change | Anchors (grep-verified) |
|---|---|---|
| Debris count | `min(3 + game.wave, 9)` → `min(3 + game.cycleWave, DEBRIS_COUNT_MAX)`, `DEBRIS_COUNT_MAX = 12` | one site in `nextWave()` |
| Debris speed | `1 + (game.wave − 1) × 0.08` → cycle-wave based, clamped (see FLAG-a) | **TWO** sites — `nextWave()` *and* the split path in `destroyDebris` |
| Hunter speed | `ramp(CEIL × FLOOR_FRAC, CEIL, game.wave)` → `game.cycleWave` | `HunterSatellite` ctor |
| Hunter turn rate | same | `HunterSatellite` ctor (adjacent line) |

The stale comment at the Hunter sampling site (`"game.wave is fixed for a
Hunter's lifetime (Hunters block wave-clear), so sample once"`) is **wrong as of
CS015 P3** and must be corrected in the same edit.

**Frozen levers keep reading absolute `game.wave`** — saucer fire rate, small-saucer
chance, and everything in §3–§5 of the worksheet. That's a deliberate asymmetry
(monotonic background pressure under a cycling foreground) and should be
documented as such, not silently inherited.

### FLAG-CS017-a — the debris speed cap is inert as specified

You asked for debris speed to max out at 2× ship max speed. `SHIP_MAX_SPEED` is
**520**, so the cap is **1040**. Base debris speeds are
`{large: 70, medium: 110, small: 160}`, multiplied by `speedMul` and a
`rand(0.7, 1.3)` roll.

At the top of a cycle (`speedMul` 1.64) the fastest possible small debris reaches
**≈ 341 px/s** — a third of the cap. Reaching 1040 needs `speedMul ≈ 5.0` for
smalls and **≈ 11.4** for larges. Even at three spiral cycles (`speedMul ≈ 2.03`)
smalls top out around 422.

**So the cap never binds under any curve currently proposed.** Two readings:

1. It's a **guard rail** — build it anyway, cheap insurance against a future
   `CYCLE_GAIN` retune. (Recommended, and my best guess.)
2. You expected debris to actually get that fast — in which case the *curve* is
   wrong, not the cap, and `0.08` per wave needs to be much steeper.

Also note: `SHIP_MAX_SPEED` is the **unloaded** ceiling; a towing ship is slower
(`SHIP_MAX_SPEED / (1 + cargo × CARGO_MAXSPD)`). "2× ship max" against the
unloaded figure is the generous reading; against a loaded ship it's tighter.
Best guess: clamp the **resulting per-entity speed** at construction (not the
multiplier), against the unloaded 520.

---

## 3. WS-B — time-in-level pressure

New `game.waveTime`; `SAUCER_PRESSURE_SECS` + per-lever scale knobs in
`DEBUG_VARS`. Applies to saucer aim error and saucer spawn gap only.

Anchors: aim error at the small-saucer aim line (currently
`ramp(FLOOR, CEIL, 1 + (game.wave − 1) × SAUCER_ACCURACY_RAMP_SCALE)` — CS012 P1's
scaled-wave trick, which this composes with rather than replaces); spawn gap at
the two `gapMin`/`gapMax` ramp calls in the saucer spawn block.

---

## 4. WS-C — dev difficulty logging

Approved design. One snapshot per `nextWave()` into an in-memory array:

```
{ t, wave, cycle, cycleWave, score,
  debrisCount, debrisSpeedMul, hunterSpeedFrac, hunterTurnFrac,
  saucerAimErr, saucerGapMin, saucerGapMax,
  hunterCount, chainLen, cargoMax, scoopLevel }
```

`hunterCount` is included specifically to seed the future music work (see
FLAG-CS017-g). Export: a **"Dump difficulty log"** row in the CS015 P4 secret
debug panel → CSV via Blob download. **Buffer cleared after a successful dump**,
and cleared on `startGame()`. Dev-only for free — the panel is already behind
`DEBUG_CODE` and nothing persists to `localStorage`.

---

## 5. WS-D — features

### 5.1 Rare bonus canister *(FORK-D)*
Spawn rate is itself a lever: **common early, rarer late** (inverse ramp — the
one lever in this changeset that eases off rather than escalating). Serves the
CS017 note's item-2 goal directly: a reward-flavoured reason to keep playing
during the low-stakes learning window.

### 5.2 Chain-guard powerup

Towed chain cannot be broken while active.

- **Insertion:** top of `breakChain(i)` — the single choke point, two call sites.
  Absorb → consume one charge (or rely on the timer) → fire voice line → `return`
  without severing. `scatterChain()` untouched *(FORK-E)*.
- **Mode:** reuses the existing dual-mode powerup pattern exactly. New
  `settings.chainGuardMode` (`"time" | "count"`), a new branch in `powerMode()`,
  a new Options → Difficulty row. **Time default 30 s** (lives in `powerFx`),
  **intercepts default 3** (lives in `powerBudget`). Both as `DEBUG_VARS` knobs
  (`chainGuardTime`, `chainGuardIntercepts`). This is a genuinely clean fit — the
  `powerMode`/`powerDuration`/`powerActive` trio already models exactly this.
- **Drop gating:** enters the `POWERUP_DROP_WEIGHTS` roll **only when
  `game.chain.length >= CHAIN_GUARD_MIN_TOW`** (default 5, dev knob); otherwise
  the roll is unchanged.
- **Render:** chain nodes glow more brightly while active.
- **Difficulty-row run-lock** (CS016 P4) applies automatically; settings are
  additive to `afd_settings_v1` with known-value-else-default loading, no schema
  bump.

**⛔ VOICE GATE.** Approved text: `Payload protected.` / `Payload armor
activated.` / `Payload shield on.` Per the standing non-negotiable, `phon`
strings must be composed and zero-error-verified by Paul in
`tools/voice-robot-lab.html` before any build session touches `VOICE_LINES`.
**The feature ships silent** in its build phase; a later phase pastes verified
pairs verbatim. Same structure as CS015 P6→P7.

### FLAG-CS017-b — adding a 5th powerup type has ripples

`POWERUP_DROP_TYPES` is currently `["rapid","triple","magnet","engine"]` and is
read by the HUD row loop **and** (I believe, unverified) the `powerUsed[]`
achievement gating for "Powered Up". Before the build phase, grep every consumer
of `POWERUP_DROP_TYPES` and decide per-consumer whether chain-guard belongs.
Getting this wrong silently changes an achievement's completion condition.

### FLAG-CS017-c — HUD gains a 6th row

Rows sit at `HUD_FX_BASE_Y − (i+1) × HUD_FX_ROW_H` = `640 − 40i`. Row 0 is Scoop
(640); the four timed types occupy 600–480. A 6th row lands at **440** — pushing
the stack further up the left edge. Also: the CS010 P3 low-HP corner glow was
tuned against a 5-row footprint. Playtest ask, not headless-testable.

### 5.3 Wave-clear — ❓ open question carried forward

You wrote: *"Hunters should NOT block wave-clear. Only garbage satellites block
wave clear."* Since CS015 P3 the gate is literally `game.debris.length === 0`
and nothing else — Hunters and loose canisters both carry over.

**If "garbage satellites" means the wave's spawned junk field (`game.debris`),
the live build already does exactly what you want and there is nothing to build.**
If you meant loose canister garbage (`game.garbage`) should *also* block
wave-clear, that's a real change and I'll spec it. Please confirm which.

---

## 6. Remaining flags

- **FLAG-CS017-d — registry doc is stale.** `DIFFICULTY-LEVERS.md` §5 lists
  `POWERUP_DROP_CHANCE` (never existed; the three emitters became unconditional in
  v3.6 P3) and `GARBAGE_DECAY` (superseded by the `garbageLifetime` knob in
  CS015 P6). Both need correcting whatever else happens.
- **FLAG-CS017-e — registry scope.** Under your broad-sense ruling, most CS017
  levers won't use `leverScale` at all. Best guess: `DIFFICULTY-LEVERS.md`
  becomes the registry for **all** levers, with `leverScale` documented as one
  mechanism among several.
- **FLAG-CS017-f — `leverScale` invariant.** Spiral (FORK-A b/c) pushes past
  shipped baselines. §2/§4's "a lever can never take a quantity below its shipped
  baseline / levers are not a difficulty-increase mechanism" must be rewritten.
- **FLAG-CS017-g — music intensity.** `MusicSys.setIntensity(difficultyFactor(game.wave))`
  is called **only** from `nextWave()`. Your call — intensity should read Hunter
  count up to a max — needs a **live** update path (on Hunter spawn/death, or
  change-detected per frame), which is new machinery. Recommendation: **do not
  rewire in CS017** — there are no gated layers to drive, so it would be
  untestable-by-ear. Instead, log `hunterCount` (WS-C) so the music changeset
  starts with real data about how Hunter population actually moves.
- **FLAG-CS017-h — `LEVER_POWERUP_SIZE` / `LEVER_DOCK_SIZE` stay Frozen**, i.e.
  still `enabled: false`, i.e. powerups and the dock remain permanently **2×**
  their pre-lever size (`start` pinned). Recording this because "Freeze" here
  means "keep the 2× oddity", not "restore 1×".
- **Deferred by Paul:** Dan ambient/idle barks. **Parked:** background set pieces.

---

## 7. Suggested phase order

| Phase | Content | Model |
|---|---|---|
| P1 | Cycle clock + `game.waveTime` (state only, no lever repoints) | Sonnet 5 high |
| P2 | Difficulty log + debug-panel dump row | Sonnet 5 high |
| P3 | WS-A lever repoints + sawtooth + spiral gain | Opus xhigh, `ultrathink` |
| P4 | WS-B saucer pressure axis | Sonnet 5 high |
| P5 | Bonus canister | Opus xhigh (FORK-D shape) |
| P6 | Chain-guard powerup (ships silent) | Opus xhigh, `ultrathink` |
| P7 | ⛔ voice-gated chain-guard lines + version bump | Sonnet 5 high |

Version bump rides **P7**, the last player-visible phase.

**Before P3 runs, FORK-A must be resolved** — every curve in the changeset
depends on it.