# IMPLEMENTATION PHASES — CS017

Spec: `PLANNED-FEATURES-CS017.md`. Base build: CS016 P5, `GAME_VERSION "1.0.0.16"`.
Target: `"1.0.0.17"`, bumped in **P7** (last player-visible phase).

**How to use this doc.** One Claude Code session per phase, one commit per phase.
Set the model with `/model` before pasting. Paste the phase's prompt verbatim.
Paul commits and pushes; Claude Code never pushes.

**Line numbers below are estimates from this planning pass — they drift. Every
prompt instructs a re-grep by symbol before editing.**

---

## Fork ledger (all resolved — do not reopen)

| Fork | Resolution |
|---|---|
| **FORK-CS017-A** | ✅ **(b) SPIRAL.** Sawtooth preserved; each cycle resets to a higher floor via `CYCLE_GAIN`. |
| **FORK-CS017-B** | ✅ **(b) COMPOSE.** Cycle-wave sets the level's opening value; time-in-level ramps from there. |
| **FORK-CS017-C** | ✅ **(a) ONE cycle boundary.** `CYCLE_LENGTH = 9` resets every sawtooth lever at once. |
| **FORK-CS017-D** | ✅ **(b) PRE-LINKED CLUMP** — confirmed by grep, see below. |
| **FORK-CS017-E** | ✅ **(a) Hostile breaks only.** `scatterChain()` (death) untouched. |
| **Wave-clear** | ✅ **Nothing to build.** Gate is already `game.debris.length === 0`. Confirmed with Paul. |
| **FLAG-CS017-a** | ✅ **Guardrail.** Debris speed clamp ships even though no current curve reaches it. |
| **FLAG-CS017-g** | ✅ **Log only.** Music intensity NOT rewired in CS017; `hunterCount` logged for the future changeset. |

### FORK-D resolution detail (grep-confirmed, saves P5 a large build)

The garbage pickup block (~L5178–5222) **already** scoops multi-piece clumps into
multiple chain nodes: `const take = Math.min(room, g.pieces)` pushes `take` nodes
at `pMass = g.mass / g.pieces`, spends magnet budget per piece, and handles the
leftover (`g.pieces -= take`, radius re-derive, `coalesceDelay` re-arm, spill
kick). **A bonus canister is therefore just a `Garbage` with a high `pieces` count
plus a visual/score marker** — the intake path needs no new branch.

### FLAG-CS017-b resolution detail (grep-confirmed, benign)

`POWERUP_DROP_TYPES` has exactly **two** live consumers: the expiry/voice loop
(~L5251) and the HUD row loop (~L6403). The **"Powered Up" achievement is safe** —
`powerUsed` is a 4-key object literal (~L3898) and its counter (~L4679) names the
four types explicitly, so a fifth entry cannot change its completion condition.
`applyPowerup`'s `game.stats.powerUsed[type] = true` will write a harmless fifth
key that nothing reads. **Decision: chain-guard does NOT count toward "Powered
Up"** — leave the counter at four.

---

# P1 — Cycle clock + wave timer (state only)

**Model:** Sonnet 5, high. **Player-visible:** no. **Version bump:** no.

Foundation phase. Introduces the two new clocks and wires *nothing* to them yet,
so it is provably byte-identical in observed gameplay.

### Anchors (re-grep by symbol)

| Symbol | Est. | Note |
|---|---|---|
| `function nextWave` | ~L4038 | `game.wave++` is the first statement |
| `game.wave = 0` | ~L4006 | in `startGame()`'s reset |
| the `game` object literal | ~L3920 | where new fields are declared |
| `update()` playing body | ~L5490 | where per-frame accumulators tick (beside floaters) |

### Paste-ready prompt

```
Read STATUS.md and CLAUDE.md first, then implement CS017 Phase 1 per
IMPLEMENTATION-PHASES-CS017.md P1. Re-grep every anchor by symbol before editing —
line numbers in the doc are estimates and drift.

This phase adds state ONLY. No existing lever may change behaviour. That is the
acceptance criterion.

(1) Add three constants near the other difficulty constants (by RAMP_WAVES):
    CYCLE_LENGTH = 9    // waves per difficulty cycle; the sawtooth reset period
    CYCLE_GAIN   = 0.12 // per-cycle escalation multiplier (FORK-CS017-A -> spiral)
    Comment both as PLAYTEST KNOBS.

(2) Add to the `game` object literal AND to startGame()'s reset (both sites — the
    CS016 P3 lesson about game.menu is the precedent; a field in one literal but
    not the other inherits a latent divergence bug):
      cycle: 0,      // 0-based difficulty cycle index
      cycleWave: 1,  // 1-based wave within the current cycle
      waveTime: 0,   // seconds elapsed in the current wave

(3) In nextWave(), immediately AFTER game.wave++, derive:
      game.cycle     = Math.floor((game.wave - 1) / CYCLE_LENGTH);
      game.cycleWave = ((game.wave - 1) % CYCLE_LENGTH) + 1;
      game.waveTime  = 0;
    game.wave itself is UNTOUCHED and stays the player-facing absolute counter —
    every achievement, the HUD LEVEL readout, high-score records and musicStateFor
    keep reading it. Add a comment saying exactly that.

(4) In update()'s playing body, beside the existing floater/accumulator ticks, add
      game.waveTime += dt;
    It must live where it FREEZES while paused and at the title — same rationale as
    game.lowHpPhase (CS010 P3). Do not put it in loop().

(5) Add a cycleValue(base, cycle) helper next to leverScale():
      return base * (1 + cycle * CYCLE_GAIN);
    Nothing calls it this phase. Comment it as the FORK-CS017-A spiral term that
    P3 will wire.

Write scratchpad/test-cs017-p1.js driving the REAL nextWave/startGame/update — no
reimplemented arithmetic. Assert: (A) node --check; (B) cycle/cycleWave for waves
1..28 match the expected sawtooth (wave 9 -> cycle 0/cw 9, wave 10 -> cycle 1/cw 1,
wave 19 -> cycle 2/cw 1); (C) both game literals carry all three fields, asserted
in SOURCE not just at runtime; (D) waveTime accumulates under update() while
playing, is zeroed by nextWave(), and does NOT advance while paused or at the
title; (E) cycleValue() spot values; (F) a byte-identity sweep — with the same
seeded RNG, wave-1..12 debris counts, debris speedMul, Hunter speed/turn samples
and saucer gaps are IDENTICAL to the pre-P1 build (this is the phase's whole
point); (G) AudioSys.ctx null smoke over startGame/update.

Run the FULL regression suite. Update GDD (§2.13 difficulty section — the new cycle
clock, explicitly noting it is inert this phase; Architecture Map game-object row),
GDD-VERSION-HISTORY.md, STATUS.md. Do NOT bump GAME_VERSION. Do NOT push.
```

**Commit:** `CS017 P1: cycle clock + wave timer (inert)`

---

# P2 — Difficulty logging + debug-panel dump

**Model:** Sonnet 5, high. **Player-visible:** no (dev-only). **Version bump:** no.

Lands early on purpose: this is the instrument for evaluating P3/P4.

### Anchors

| Symbol | Est. | Note |
|---|---|---|
| `DEBUG_VARS` | ~L2425 | registry array; six entries as of CS015 P6 |
| `menuDebug` / `drawDebug` | — | CS015 P4 panel; row list is `DEBUG_VARS.length` + Back |
| `function nextWave` | ~L4038 | snapshot site |
| `startGame()` | ~L4000 | buffer clear site |

### Paste-ready prompt

```
Read STATUS.md and CLAUDE.md first, then implement CS017 Phase 2 per
IMPLEMENTATION-PHASES-CS017.md P2. Re-grep every anchor by symbol before editing.

Dev-only difficulty logging. Nothing player-visible; nothing persisted.

(1) Add a module-level DiffLog { rows: [] } beside the DebugCode block.

(2) Add function logDifficultySnapshot() and call it from nextWave() AFTER the
    cycle/cycleWave derivation P1 added. It pushes ONE row:
      { t: performance.now(), wave, cycle, cycleWave, score,
        debrisCount, debrisSpeedMul, hunterSpeedFrac, hunterTurnFrac,
        saucerAimErr, saucerGapMin, saucerGapMax,
        hunterCount, chainLen, cargoMax, scoopLevel }
    Read every value from the SAME expressions the live code uses — do not
    reimplement any lever formula here. Where a lever is not yet repointed (P3/P4
    have not run), log today's value; the field list must not change later, only
    what feeds it. hunterCount is game.hunters.length and exists specifically to
    seed the future music-intensity changeset (FLAG-CS017-g).

(3) Cap the buffer at DIFFLOG_MAX = 2000 rows (drop oldest) so a long session
    cannot grow without bound.

(4) Clear DiffLog.rows in startGame().

(5) Add a "Dump difficulty log" action row to the debug panel. The panel currently
    renders DEBUG_VARS.length value rows plus a Back row; this adds an ACTION row
    (no value, no chevrons) between them. On confirm: build a CSV string from
    DiffLog.rows (header line from the field names, one line per row), trigger a
    Blob download named orbital-difficulty-<timestamp>.csv, THEN clear the buffer
    — clear only on a successful dump. Play AudioSys.ui(true). If the buffer is
    empty, do nothing but play the negative blip and do not download.
    Guard the download path so a headless/no-DOM environment cannot throw.

Write scratchpad/test-cs017-p2.js driving the REAL nextWave/startGame/menuDebug —
no reimplemented logging. Assert: (A) node --check; (B) one row per nextWave() with
every field present and finite/typed; (C) startGame() clears the buffer; (D) the
DIFFLOG_MAX cap drops oldest and never exceeds the cap; (E) the CSV builder emits a
header plus N lines and round-trips values; (F) the dump clears the buffer on
success and an empty-buffer dump neither downloads nor throws; (G) panel navigation
reaches the new action row and Back still works, with row indices computed from the
real DEBUG_VARS.length rather than a hardcoded literal (the CS015 P5 lesson);
(H) AudioSys.ctx null smoke.

Grep scratchpad/ for tests that hardcode the debug panel's row count or Back index
before editing — CS015 P5 found two such pins. Run the FULL regression suite.
Update GDD §2.19 (Debug Options — the new action row and the log), Architecture Map,
GDD-VERSION-HISTORY.md, STATUS.md. Do NOT bump GAME_VERSION. Do NOT push.
```

**Commit:** `CS017 P2: dev difficulty log + debug-panel CSV dump`

---

# P3 — Sawtooth escalation (the ramp itself)

**Model:** Opus 4.8, xhigh, thinking on. `ultrathink` is baked into the prompt.
**Player-visible:** YES — this is the changeset's core balance change.

### Anchors

| Symbol | Est. | Note |
|---|---|---|
| debris count | ~L4057 | `const count = Math.min(3 + game.wave, 9);` in `nextWave()` |
| debris speed (spawn) | ~L4058 | `const speedMul = 1 + (game.wave - 1) * 0.08;` |
| debris speed (split) | ~L4109 | **SECOND site**, in `destroyDebris` — same literal, easy to miss |
| `DebrisSatellite` ctor | ~L3422 | `const sp = DEBRIS_SPEEDS[size] * speedMul * rand(0.7, 1.3);` — the clamp site |
| Hunter speed/turn | ~L3476–3477 | both `ramp(... , game.wave)`; stale comment above them |
| `DEBRIS_SPEEDS` | L134 | `{3: 70, 2: 110, 1: 160}` |
| `SHIP_MAX_SPEED` | L118 | 520 |

### Paste-ready prompt

```
ultrathink

Read STATUS.md and CLAUDE.md first, then implement CS017 Phase 3 per
IMPLEMENTATION-PHASES-CS017.md P3. Re-grep every anchor by symbol before editing.
This is the changeset's core balance change — the most consequential phase.

FORK-CS017-A is RESOLVED as (b) SPIRAL and FORK-CS017-C as (a) ONE cycle boundary.
Do not reopen either.

The model: within a cycle, levers ramp on game.cycleWave (P1). At the cycle
boundary they reset — but each cycle's values are multiplied by the spiral term
cycleValue(x, game.cycle) from P1, so cycle N+1 starts above where cycle N started.
The player feels the reset as relief; the game still escalates.

(1) DEBRIS COUNT. Add DEBRIS_COUNT_MAX = 12 (was the inline literal 9). Repoint:
      const count = Math.round(cycleValue(Math.min(3 + game.cycleWave,
                                                   DEBRIS_COUNT_MAX), game.cycle));
    Clamp the final count to a sane absolute ceiling (DEBRIS_COUNT_HARD_MAX = 24,
    a new PLAYTEST KNOB) so a deep run cannot spawn an unbounded field.

(2) DEBRIS SPEED. BOTH sites (nextWave AND destroyDebris's split path — grep the
    literal `0.08` to confirm you have found every one) become:
      const speedMul = cycleValue(1 + (game.cycleWave - 1) * DEBRIS_SPEED_PER_WAVE,
                                  game.cycle);
    with DEBRIS_SPEED_PER_WAVE = 0.08 hoisted from the inline literal.

(3) DEBRIS SPEED GUARDRAIL (FLAG-CS017-a, resolved: build it as a guard rail even
    though no current curve reaches it). Add DEBRIS_SPEED_CAP = 2 * SHIP_MAX_SPEED
    and clamp the RESULTING per-entity speed in the DebrisSatellite constructor:
      const sp = Math.min(DEBRIS_SPEEDS[size] * speedMul * rand(0.7, 1.3),
                          DEBRIS_SPEED_CAP);
    Clamp the resulting speed, NOT the multiplier — sizes have different bases.
    Add a comment recording that at the shipped curve the fastest small debris
    reaches ~341 px/s against a 1040 cap, so this is insurance, not a live
    constraint.

(4) HUNTER SPEED + TURN RATE. Both ramp calls take game.cycleWave instead of
    game.wave, each wrapped in cycleValue(..., game.cycle).
    ALSO: the comment above these two lines currently reads "game.wave is fixed for
    a Hunter's lifetime (Hunters block wave-clear), so sample once." That claim has
    been FALSE since CS015 P3 — Hunters carry across waves. Rewrite it to state
    that sampling is at spawn, that a carried Hunter keeps its spawn-cycle values
    for life, and that this is accepted design (Paul's explicit call).

(5) DO NOT TOUCH the frozen levers: saucer fire rate, small-saucer chance, and
    everything in the Kessler / player-ability / economy groups. They keep reading
    the ABSOLUTE game.wave. This asymmetry — monotonic background pressure under a
    cycling foreground — is deliberate; document it in the GDD rather than
    "fixing" it.

Write scratchpad/test-cs017-p3.js driving the REAL nextWave/destroyDebris/
DebrisSatellite/HunterSatellite — no reimplemented curves. Assert: (A) node --check;
(B) the sawtooth — debris count rises across a cycle, RESETS at the boundary, and
each cycle's opening value is strictly GREATER than the previous cycle's opening
value (the spiral property, which is the phase's entire point); (C) the same three
properties for debris speedMul and for Hunter speed and turn rate; (D) both debris
speed sites agree — construct via nextWave and via a real destroyDebris split at
the same wave and assert the multipliers match; (E) the guardrail — force a
CYCLE_GAIN/wave combination that would exceed the cap and assert no constructed
DebrisSatellite exceeds DEBRIS_SPEED_CAP, at every size; (F) frozen levers are
byte-identical to the pre-P3 build across waves 1..30 (saucer fire mult, small
saucer chance) — proving the asymmetry is real and intentional; (G) DEBRIS_COUNT_
HARD_MAX is never exceeded at wave 100; (H) AudioSys.ctx null smoke over a real
multi-wave run.

Grep scratchpad/ for existing pins on debris count, the 0.08 speed literal, or
Hunter speed/turn sampling BEFORE editing, and report every file you change with a
per-file rationale. Do not weaken any assertion to make the suite pass — repoint it
to the real symbols. Run the FULL regression suite. Update GDD §2.13 (the cycle
model, the sawtooth, the spiral term, the frozen-lever asymmetry, the corrected
Hunter-sampling note), §2.5, §2.7, Architecture Map Constants row, DIFFICULTY-
LEVERS.md (see P3 docs note below), GDD-VERSION-HISTORY.md, STATUS.md.
Do NOT bump GAME_VERSION. Do NOT push.
```

**P3 docs note — `DIFFICULTY-LEVERS.md` needs real surgery this phase:**
- §2/§4's invariant ("a lever can never take a quantity below its shipped
  baseline"; "levers are not a general difficulty-increase mechanism") is
  **reversed** by the spiral. Rewrite, don't patch. *(FLAG-CS017-f)*
- §5 candidate list is stale: `POWERUP_DROP_CHANCE` never existed (v3.6 P3 made the
  emitters unconditional); `GARBAGE_DECAY` was superseded by the `garbageLifetime`
  knob in CS015 P6. *(FLAG-CS017-d)*
- Registry scope broadens to all levers, with `leverScale` documented as one
  mechanism among several. *(FLAG-CS017-e)*
- Record that `LEVER_POWERUP_SIZE` / `LEVER_DOCK_SIZE` remain `enabled: false`,
  i.e. powerups and the dock stay permanently **2×** their pre-lever size.
  *(FLAG-CS017-h — "Freeze" means keep the 2×, not restore 1×.)*

**Commit:** `CS017 P3: sawtooth cycle escalation with per-cycle spiral gain`

---

# P4 — Time-in-level saucer pressure

**Model:** Sonnet 5, high. **Player-visible:** YES.

### Anchors

| Symbol | Est. | Note |
|---|---|---|
| saucer aim error | ~L3606 | `ramp(SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL, 1 + (game.wave-1)*SAUCER_ACCURACY_RAMP_SCALE)` |
| saucer gap | ~L5352–5353 | two `ramp(...)` calls for `gapMin`/`gapMax` |
| `DEBUG_VARS` | ~L2425 | knobs appended here |

### Paste-ready prompt

```
Read STATUS.md and CLAUDE.md first, then implement CS017 Phase 4 per
IMPLEMENTATION-PHASES-CS017.md P4. Re-grep every anchor by symbol before editing.

FORK-CS017-B is RESOLVED as (b) COMPOSE. Time-in-level ADDS pressure on top of the
existing wave-based value; it does not replace it. Design intent: pressure the
player to finish the level rather than farm it.

(1) Add a pressure helper beside difficultyFactor():
      function wavePressure() {
        return Math.min(1, game.waveTime / DEBUG.saucerPressureSecs);
      }
    game.waveTime comes from P1.

(2) Append three DEBUG_VARS entries following the CS015 P4/P5 registry idiom
    exactly (id/label/unit/def/min/max/step, toNative only if units differ):
      saucerPressureSecs   (s,  def 90,  [10, 300], step 5)
      saucerAimPressure    (unitless, def 0.5, [0, 1], step 0.05)
      saucerGapPressure    (unitless, def 0.5, [0, 1], step 0.05)
    These are the dev-tunable ramp scales Paul asked for.

(3) SAUCER AIM ERROR. The value keeps its current wave-based expression as the
    level's OPENING value, then tightens toward the ceiling with time-in-level:
      const base = ramp(SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL,
                        1 + (game.wave - 1) * SAUCER_ACCURACY_RAMP_SCALE);
      const err  = base + (SAUCER_AIM_ERR_CEIL - base)
                        * wavePressure() * DEBUG.saucerAimPressure;
    Note SAUCER_AIM_ERR_CEIL is the TIGHTER value (error shrinks toward it) —
    verify the direction against the constants before trusting this expression, and
    say in your report which direction you confirmed.

(4) SAUCER SPAWN GAP. Same composition for gapMin and gapMax, each tightening from
    its wave-based opening value toward its own _CEIL, scaled by
    wavePressure() * DEBUG.saucerGapPressure.

(5) These two levers keep reading the ABSOLUTE game.wave for their opening value,
    not cycleWave — they are in the FROZEN group for the sawtooth and only gain the
    time axis. Do not repoint them to cycleWave.

Write scratchpad/test-cs017-p4.js driving the REAL Saucer/spawn path — no
reimplemented formulas. Assert: (A) node --check; (B) at game.waveTime === 0 every
value is byte-identical to the pre-P4 build at the same wave (the composition
property — a level opens exactly as it does today); (C) as waveTime grows, aim
error tightens monotonically and the spawn gap shortens monotonically; (D) both
saturate at waveTime >= saucerPressureSecs and never overshoot past their _CEIL;
(E) setting saucerAimPressure/saucerGapPressure to 0 reproduces pre-P4 behaviour at
ALL waveTime values (the knobs genuinely disable the feature); (F) nextWave()
resets the pressure by resetting waveTime; (G) the fired-bullet aim error is read
off a REAL Saucer shot via the real angleTo, the test-cs012-p1.js idiom, not
recomputed; (H) AudioSys.ctx null smoke.

Grep scratchpad/ for existing pins on saucer aim error and spawn gaps before
editing — test-f4.js and test-cs012-p1.js both assert on these and will likely need
repointing (not weakening). Run the FULL regression suite. Update GDD §2.13/§2.19,
Architecture Map, GDD-VERSION-HISTORY.md, STATUS.md. Do NOT bump GAME_VERSION.
Do NOT push.
```

**Commit:** `CS017 P4: time-in-level saucer pressure axis`

---

# P5 — Rare bonus canister

**Model:** Opus 4.8, xhigh. **Player-visible:** YES.

FORK-D is resolved: the clump intake path already handles this. The build is a
spawn source + a visual/score marker, not new intake machinery.

### Anchors

| Symbol | Est. | Note |
|---|---|---|
| garbage pickup / clump intake | ~L5178–5222 | `take = Math.min(room, g.pieces)` loop — **do not restructure** |
| `class Garbage` ctor | ~L3685 | `this.pieces = 1; this.radius = 7 * Math.sqrt(this.pieces);` |
| `Garbage.draw` | ~L3730 | `const color = (this.mass/this.pieces) < 1 ? COLOR.garbageLight : COLOR.garbage;` |
| `nextWave()` | ~L4038 | spawn site |
| `COLOR` block | ~L2748 | new palette key |

### Paste-ready prompt

```
Read STATUS.md and CLAUDE.md first, then implement CS017 Phase 5 per
IMPLEMENTATION-PHASES-CS017.md P5. Re-grep every anchor by symbol before editing.

A rare BONUS CANISTER: a pre-linked salvage clump that fills several tow-chain
slots at once. Design intent (Paul): a reward-flavoured reason to keep playing
during the low-stakes early waves. It invites greed — a fat chain is riskier to
protect — without making survival itself harder.

FORK-CS017-D is RESOLVED as (b) PRE-LINKED CLUMP, and the intake path ALREADY
supports it: the garbage pickup block scoops a multi-piece clump into `take` chain
nodes. DO NOT restructure that block. Verify by grep before you start, and report
what you found.

(1) Add a `bonus` flag to Garbage (default false) and constants:
      BONUS_CANISTER_PIECES = 6    // chain slots it fills (PLAYTEST KNOB)
      BONUS_CANISTER_SCORE  = 250  // bonus paid when scooped (PLAYTEST KNOB)
      BONUS_SPAWN_CHANCE_EARLY = 0.5  // per-wave spawn probability at cycleWave 1
      BONUS_SPAWN_CHANCE_LATE  = 0.1  // ... at the end of a cycle
    The spawn chance is the ONE lever in this changeset that EASES OFF rather than
    escalating — common early to reward the learning window, rarer late. Ramp it
    across game.cycleWave.

(2) Spawn in nextWave(): roll the chance; on success push one Garbage with
    pieces = BONUS_CANISTER_PIECES, bonus = true, mass and radius derived by the
    SAME expressions the existing clump code uses (7 * sqrt(pieces)) — do not
    hardcode a radius. Place it using the same ring-around-the-ship placement the
    debris spawn uses, so it is reachable but not on top of the player.

(3) Visual tell: add COLOR.garbageBonus to the COLOR block and branch Garbage.draw
    on this.bonus. Keep it a STROKE-based tell consistent with the no-fills rule
    (GDD §3.2) — do not add a new fill exception.

(4) Score: when a bonus clump is scooped, award BONUS_CANISTER_SCORE via addScore
    and push a FloatText. Award it ONCE per clump, at the scoop, regardless of how
    many pieces actually fit the chain — a chain-full player still gets the bonus
    for reaching it. Route through addScore normally (this is not the auto-shield
    bypass case).

(5) Audio: reuse AudioSys.pickup() — do NOT invent a new sound this phase. Voice
    lines are deliberately out of scope (they would need a lab pass).

Write scratchpad/test-cs017-p5.js driving the REAL nextWave/pickup path/Garbage —
no reimplemented intake. Assert: (A) node --check; (B) a bonus clump exists with
the right pieces/bonus/radius after a forced-successful roll, and none spawns on a
forced-failed roll; (C) spawn chance genuinely eases off across a cycle (early >
late), asserted off the real ramp; (D) scooping one with an EMPTY chain adds
exactly BONUS_CANISTER_PIECES nodes and pays the bonus exactly once; (E) scooping
with a nearly-full chain adds only `room` nodes, leaves a correctly re-derived
leftover (pieces, mass, radius, re-armed coalesceDelay), and STILL pays the bonus
once; (F) a bonus clump still participates normally in coalescence and shatter (it
is a Garbage, not a new entity type) — including that it can still reach the
Hunter-coalesce threshold; (G) the draw path emits no ctx.fill() (the no-fills
rule); (H) AudioSys.ctx null smoke.

Run the FULL regression suite. Update GDD §2.10/§2.10.1 (the bonus canister and its
easing-off spawn lever), §3.2 (confirm no new fill exception), DIFFICULTY-LEVERS.md
(register the spawn-chance lever), Architecture Map, GDD-VERSION-HISTORY.md,
STATUS.md. Do NOT bump GAME_VERSION. Do NOT push.
```

**Commit:** `CS017 P5: rare bonus canister with easing-off spawn lever`

---

# P6 — Chain-guard powerup (ships SILENT)

**Model:** Opus 4.8, xhigh, thinking on. `ultrathink` baked in.
**Player-visible:** YES. Voice lines deliberately absent — P7 adds them.

### Anchors

| Symbol | Est. | Note |
|---|---|---|
| `function breakChain` | ~L4951 | **the single choke point**; 2 call sites (~L5424 bullet, ~L5480 Hunter) |
| `function scatterChain` | ~L4963 | **DO NOT TOUCH** (FORK-E) |
| `powerMode` / `powerDuration` / `powerActive` | ~L4230 | the dual-mode trio to extend |
| `POWERUP_DROP_TYPES` | L428 | 2 live consumers (expiry loop ~L5251, HUD loop ~L6403) |
| `POWERUP_DROP_WEIGHTS` | L433 | the roll table |
| `dropPowerup` | ~L4250 | where the gate goes |
| `DIFFICULTY_ROWS` / `menuDifficulty` / `drawDifficulty` | — | CS012 P5 + CS016 P4 lock |
| `powerFx` / `powerBudget` | ~L3930 | seed literals |
| `drawLink` / chain node render | ~L4970 | the glow |

### Paste-ready prompt

```
ultrathink

Read STATUS.md and CLAUDE.md first, then implement CS017 Phase 6 per
IMPLEMENTATION-PHASES-CS017.md P6. Re-grep every anchor by symbol before editing.

A CHAIN-GUARD powerup: while active, the towed salvage chain cannot be broken by
hostile hits. FORK-CS017-E is RESOLVED as (a): it covers HOSTILE breaks only.
scatterChain() (ship death) is NOT touched — death still scatters the whole load.

THIS PHASE SHIPS SILENT. Paul's approved voice text exists but its phon strings
require his voice-lab pass; P7 adds them. Do NOT author, derive or guess any phon
string, and do NOT add a chain_guard entry to VOICE_LINES this phase.

(1) NEW TYPE. Add "guard" to POWERUP_DROP_TYPES and a weight to
    POWERUP_DROP_WEIGHTS. Grep every consumer of POWERUP_DROP_TYPES first and
    report the list — planning found two live ones (the expiry/voice loop and the
    HUD row loop). "Powered Up" is SAFE: powerUsed is a 4-key literal and its
    counter names the four types explicitly. Chain-guard does NOT count toward
    "Powered Up" — leave that counter at four. Add POWERUP_COLOR.guard and
    POWERUP_LABEL.guard.

(2) DUAL MODE, reusing the existing pattern exactly:
      settings.chainGuardMode: "time" | "count"  (default "time")
      powerMode(): return settings.chainGuardMode for "guard"
      powerDuration(): DEBUG.chainGuardTime for "guard"
      count mode seeds powerBudget.guard with DEBUG.chainGuardIntercepts
    Add powerFx.guard and powerBudget.guard to their seed literals (BOTH the game
    literal and startGame()'s reset).

(3) DEBUG_VARS: chainGuardTime (s, def 30, [5,120], step 5) and
    chainGuardIntercepts (unitless, def 3, [1,10], step 1).

(4) THE INTERCEPT — at the TOP of breakChain(i), before any node is severed:
      if (powerActive("guard")) {
        if (powerMode("guard") === "count") game.powerBudget.guard =
            Math.max(0, game.powerBudget.guard - 1);
        // TODO CS017 P7: VoiceSys.say("chain_guard") once phon is lab-verified
        <a visual/audio tell that the break was absorbed>
        return;
      }
    breakChain has exactly TWO call sites and both route through this one function,
    so a multi-node hit in a single frame is absorbed once. Verify that by grep and
    say so in your report. In TIME mode the timer alone governs — do not decrement
    anything per intercept.

(5) DROP GATING. In dropPowerup, "guard" enters the weighted roll ONLY when
    game.chain.length >= DEBUG.chainGuardMinTow (new knob, def 5, [0,24], step 1).
    Otherwise the roll runs over the other types exactly as today — renormalise
    rather than leaving a dead slot. Assert the un-gated roll is byte-identical to
    the pre-P6 distribution.

(6) OPTIONS ROW. Add a "Chain guard" row to DIFFICULTY_ROWS with a left/right
    toggle between Time and Intercepts, a per-row help line, saveSettings() on
    change, and the CS016 P4 mid-run LOCK behaviour inherited automatically.
    Persist chainGuardMode additively into afd_settings_v1 with known-value-else-
    default loading. NO schema bump, NO key rename.

(7) HUD. The stack gains a 6th row at y = HUD_FX_BASE_Y - 6*HUD_FX_ROW_H = 400.
    The fixed-row CS012 P2 loop handles this automatically once the type is in
    POWERUP_DROP_TYPES — verify, don't assume.

(8) CHAIN GLOW. While guard is active, chain nodes/links render more brightly.
    Reuse the existing stroke/glow idiom; add no new fill (GDD §3.2).

Write scratchpad/test-cs017-p6.js driving the REAL breakChain/scatterChain/
dropPowerup/applyPowerup/menuDifficulty/saveSettings/loadSettings/drawHUD — no
reimplemented logic. Assert: (A) node --check; (B) with guard active, a REAL bullet
hit and a REAL Hunter collision on a mid-chain node leave the chain byte-identical
and deliveryCount untouched; without it, both still sever exactly as today;
(C) count mode decrements once per intercept, absorbs exactly N breaks, then the
N+1th severs; (D) time mode absorbs indefinitely until expiry and decrements no
budget; (E) scatterChain() STILL scatters the full load with guard active (FORK-E);
(F) the drop gate — below the tow threshold "guard" never appears in many rolls and
the other weights are byte-identical to pre-P6; at/above it, guard can appear;
(G) the Difficulty row toggles, persists, round-trips through afd_settings_v1, and
is LOCKED mid-run per CS016 P4; a missing or invalid stored value falls back to the
default without locking the player out; (H) the HUD renders 6 rows at the fixed
offsets and no row moved; (I) NO VOICE — assert VoiceSys.say is never called with a
guard-related event and that VOICE_LINES has no chain_guard key this phase;
(J) AudioSys.ctx null smoke.

Grep scratchpad/ for pins on POWERUP_DROP_TYPES length, HUD row counts, DIFFICULTY_
ROWS indices and the drop-weight distribution BEFORE editing — CS012 P5 and CS016 P4
both found several. Report every file changed with a per-file rationale; repoint,
never weaken. Run the FULL regression suite. Update GDD §2.14/§2.14.1 (the new
powerup), §2.16 (the Difficulty row), Architecture Map, CLAUDE.md (frozen-keys
bullet gains chainGuardMode), GDD-VERSION-HISTORY.md, STATUS.md.
Do NOT bump GAME_VERSION. Do NOT push.
```

**Commit:** `CS017 P6: chain-guard powerup (ships silent, voice deferred to P7)`

---

# P7 — Chain-guard voice lines + version bump

**Model:** Sonnet 5, high. **Player-visible:** YES. **Version bump: YES.**

## ⛔ STOP — GATE FOR PAUL

**Do not run P7 until the voice-lab pass is done.** Per the standing
non-negotiable, Claude Code never authors, derives or edits `phon` strings.

Approved text (Paul's, locked — do not reword):

1. `Payload protected.`
2. `Payload armor activated.`
3. `Payload shield on.`

**Paul's step:** open `tools/voice-robot-lab.html`, compose the `phon` for each of
the three lines, verify **zero errors** through `parsePhonTokens`, and hand back
the three `{text, phon}` pairs. P7 pastes them **verbatim**.

If the gate is unmet when a session opens P7: **do not run it.** Report the gate as
unmet and stop — exactly as the CS015 P7 session correctly did.

### Paste-ready prompt

```
Read STATUS.md and CLAUDE.md first, then implement CS017 Phase 7 per
IMPLEMENTATION-PHASES-CS017.md P7. Re-grep every anchor by symbol before editing.

GATE CHECK FIRST. This phase requires Paul's lab-verified phon strings for the
three chain-guard lines. If he has not supplied them in this session, STOP and
report the gate as unmet — do not author, derive, guess or transliterate any phon
string, and do not touch VOICE_LINES.

Independently RE-VERIFY the supplied pairs before pasting: build the extracted
<script> headlessly and run every phon through the REAL parsePhonTokens, asserting
errs.length === 0 for each. Do not simply trust the claim. If any line fails,
report it and stop.

(1) Add VOICE_LINES.chain_guard with the three verified {text, phon} pairs,
    verbatim. Add VOICE_PRIORITY.chain_guard = 2 (the tier shared by chain_broken,
    level and the health milestones — an intercept is a milestone-class event).

(2) Replace P6's TODO comment in breakChain's intercept branch with
    VoiceSys.say("chain_guard"). It is the same single choke point, so a multi-node
    hit speaks once, collapsed by the standard cooldown/priority gate.

(3) VERSION BUMP: GAME_VERSION "1.0.0.16" -> "1.0.0.17". Grep scratchpad/ for the
    old literal and bump EVERY live pin — CS016 P5 found three where the prompt
    named two, so trust the grep, not this instruction. Leave archive/ and the
    planning docs alone.

Write scratchpad/test-cs017-p7.js driving the REAL parsePhonTokens/buildUtterance/
VoiceSys.say/breakChain. Assert: (A) the three entries match the approved text AND
phon exactly, both pinned so a later hand-edit is caught; (B) every phon parses and
builds with zero unknown tokens; (C) VOICE_PRIORITY.chain_guard === 2; (D) a real
guard-absorbed break fires exactly one chain_guard line, and a real un-absorbed
break still fires chain_broken (not chain_guard); (E) scatterChain still fires
nothing; (F) VoiceSys.say("chain_guard") is headless-safe with AudioSys.ctx null;
(G) GAME_VERSION === "1.0.0.17" pin; (H) node --check + a startGame/update smoke.

Run the FULL regression suite. Update GDD §2.8 (the voice-line set and the priority
ladder), the top-of-file Current build line -> CS017 P7 / "1.0.0.17", and
CONSOLIDATE the CS017 P1–P7 entries in GDD-VERSION-HISTORY.md into one round-closing
CS017 entry per the CS012/CS013/CS015/CS016 precedent. Update STATUS.md.
Do NOT push.
```

**Commit:** `CS017 P7: chain-guard voice lines + version 1.0.0.17`

---

## Round checklist

- [ ] P1 cycle clock (inert)
- [ ] P2 difficulty log + dump
- [ ] P3 sawtooth + spiral ← **the balance change; playtest hard before P4**
- [ ] P4 time-in-level pressure
- [ ] P5 bonus canister
- [ ] P6 chain-guard (silent)
- [ ] ⛔ voice-lab pass — Paul
- [ ] P7 voice lines + `"1.0.0.17"`

**Playtest asks no headless test can answer:** whether the cycle reset reads as
*relief* or as *the game got easier and that felt wrong*; whether `CYCLE_GAIN 0.12`
is too steep or too shallow over a 30-wave run (the P2 CSV is the instrument);
whether the time-in-level pressure genuinely changes how you play a level or just
feels like punishment for exploring; whether the bonus canister's greed pull
survives contact with the P4 finish-fast pressure; and whether the 6-row HUD stack
crowds the CS010 P3 low-health corner glow.