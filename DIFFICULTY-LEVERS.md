# DIFFICULTY LEVERS — living registry

A **living document** — never archived, unlike the changeset-numbered planning
docs. Update it in the same commit that adds, retunes or removes a lever.

**Rewritten from scratch in CS024 P7.** The previous version described three
coexisting mechanisms (`leverScale`, direct `ramp()`, CS018's level table), a
frozen-constant wrinkle, and two clocks that had already been retired. CS024
deleted all of it. **There is now exactly one mechanism — the odometer — and
one clock, `game.wave`.** Nothing in that older text is patched forward; if you
need it, it is in the git history and in `log/CS024.md`.

## 1. What a lever is

A **lever** is a named, catalogued quantity that scales with the level number.
Levers exist so difficulty tuning is discoverable in one place instead of
scattered as ad hoc `if (game.wave > N)` checks at call sites, and so every
number's shape is written down where it can be read next to its siblings.

A lever is a plain record in the `LEVERS` table:

```js
{ id, floor, ceil, steps, everyNLevels?, carriesTo? }
```

`steps` discrete positions: **step 0 IS `floor`, step `steps-1` IS `ceil`**
(both returned verbatim, not interpolated to), everything between linearly
interpolated. Values are read **at the point of use** — the next wave's spawn,
the next saucer's construction — never per frame and never cached, so a debug
override lands on the next relevant event rather than retroactively on what is
already flying.

## 2. The odometer

**The driver.** A lever with `everyNLevels` is a **driver**: it advances one
step every N levels off the level number. A lever without one never advances on
the clock at all.

**The carry.** When a driver passes its top step it **resets to step 0** and
bumps every lever in its `carriesTo` array up one step. That is the whole
mechanism, and it is what makes this an odometer rather than a bundle of ramps:
`junkCount` sawtooths 3 → 12 every ten levels, and each reset leaves the
satellites permanently faster than they were before it.

**`carriesTo` is an ARRAY, and that is load-bearing.** A single-successor
odometer is multiplicatively deep — `junkCount → speedLarge → speedMedium →
speedSmall` would not move small-satellite speed until roughly level 96. One
wrap bumping all three at once lets them saturate at different levels while
staying genuinely independent levers.

**Only drivers may wrap** (CS024 P6b). A lever may declare `carriesTo` **only
if** it also declares `everyNLevels`; the load-time guard in `buildLeverOrder()`
throws otherwise. Every carried lever therefore **plateaus** — pinned at `ceil`
forever — and the graph is exactly one driver deep. Consequences worth knowing:
there is no `LEVEL_MAX` and the ceiling is emergent (levels past it are flat
because every lever has run out of chain, not because a clamp caught them);
nothing can get **easier** as levels rise except through a deliberately inverted
floor/ceil pair; and the closed form collapses to two flat passes with no
ordering requirement at all.

**Why the rule exists is recorded in `archive/PLANNED-FEATURES-CS025-old.md` §0**,
and it is worth reading before relaxing it. The evidence came from **plotting
the tables level by level, not from reading them**: the unrestricted semantics
shipped a visible regression — `ufoFlightSpeedSmall` climbing 150 → 210 px/s
across levels 1–25 and then **resetting to 150 at level 33**, a UFO genuinely
slower at 33 than at 25 — plus a dead zone where four levers sat two carry
generations deep, moved twice in 64 levels, and did not reach their ceilings
until level 97. Neither was visible in the table. Plot before you trust.

**⛔ NOTHING MAY VALIDATE, CLAMP, REORDER OR ASSERT `floor <= ceil`** — not in
the table, not in the debug panel, not at a call site, not in a future
"tidy-up". **Seven levers are INVERTED** (`coalescePause`, `ufoAppearFreq`, both
`ufoFireFreq*`, both `ufoDirChange*`, `ufoAccuracySmall`), because a shorter
delay and a smaller aim error are *harder*. `floor > ceil` is normal and
correct. An inverted lever's floor is its EASY end. This prohibition carries
forward unbroken from the retired tier tables, where four of seven descended for
exactly the same reason; the debug panel's three-knobs-per-lever rows are
deliberately wide enough to drag either endpoint **past** the other, and that is
a supported configuration.

**Purity.** `leverState(wave)` reads no game state — not `game.wave`, not
`DEBUG` — so it is callable before `startGame()` and is the headless suite's
primary test surface (sliced from its section banner and evaluated alone).
`liveLevers(wave)` is the same derivation over a DEBUG-overridden copy of the
table and is what every consumer actually calls; it lives **outside** the slice
on purpose. `leverState` has no in-game caller and is not vestigial — it is what
`liveLevers` is defined against.

## 3. The shipped levers

Eighteen levers, three chains. Every one carries three debug rows —
`<id>Floor`, `<id>Ceil`, `<id>Steps` — so a ramp's start, end and length are all
tunable live (CS024 P6c). **Setting Floor equal to Ceil pins a lever flat at
every level.**

| # | Lever | Floor → ceil | Steps | everyN | carriesTo |
|---|---|---|---|---|---|
| 1 | `junkCount` | 3 → 12 | 10 | 1 | **DRIVER** → `junkSpeedLarge`, `junkSpeedMedium`, `junkSpeedSmall` |
| 2 | `junkSpeedLarge` | 60 → 110 px/s | 5 | — | — (plateaus L41) |
| 3 | `junkSpeedMedium` | 95 → 165 px/s | 5 | — | — (plateaus L41) |
| 4 | `junkSpeedSmall` | 140 → 240 px/s | 5 | — | — (plateaus L41) |
| 5 | `junkSplit` | 2 → 3 children | 2 | — | — (↳ carried by `junkCount`; **2 through L10, 3 from L11 on, forever**) |
| 6 | `coalescePause` **(inv)** | 5.0 → 1.5 s | 8 | 1 | **DRIVER** → `hunterSpeedMedium`, `hunterSpeedSmall` |
| 7 | `hunterSpeedMedium` | 60 → 110 px/s | 5 | — | — (plateaus L33) |
| 8 | `hunterSpeedSmall` | 90 → 160 px/s | 5 | — | — (plateaus L33) |
| 9 | `ufoAppearFreq` **(inv)** | 25 → 12 s | 8 | 1 | **DRIVER** → all nine UFO levers below |
| 10 | `ufoFlightSpeedBig` | 100 → 150 px/s | 5 | — | — (plateaus L33) |
| 11 | `ufoFlightSpeedSmall` | 150 → 210 px/s | 5 | — | — (plateaus L33) |
| 12 | `ufoFireFreqBig` **(inv)** | 1.8 → 0.7 × | 6 | — | — (plateaus L41) |
| 13 | `ufoFireFreqSmall` **(inv)** | 1.8 → 0.6 × | 6 | — | — (plateaus L41) |
| 14 | `ufoDirChangeBig` **(inv)** | 2.2 → 1.0 s | 7 | — | — (plateaus L49) |
| 15 | `ufoDirChangeSmall` **(inv)** | 1.8 → 0.7 s | 7 | — | — (plateaus L49) |
| 16 | `ufoShotSpeedBig` | 300 → 430 px/s | 8 | — | — (plateaus L57) |
| 17 | `ufoShotSpeedSmall` | 320 → 470 px/s | 8 | — | — (plateaus L57) |
| 18 | `ufoAccuracySmall` **(inv)** | 30 → 8 ° | 9 | — | — (plateaus L65) |

Four notes on that table, each of which will otherwise look like a mistake:

- **The nine UFO step counts are UNEVEN ON PURPOSE (CS024 P6b) — do not "tidy"
  them into one number.** One driver wrap every 8 levels feeds all nine, so a
  larger step count simply takes longer, staging them in a deliberate order:
  speed (L33) → rate of fire (L41) → evasiveness (L49) → shot velocity (L57) →
  **accuracy last (L65)**. The UFOs get faster before they get accurate.
- **`ufoAppearFreq` cycles forever and never permanently tightens** — level 100
  reads exactly as level 1. Deliberate: it is the driver, and a driver that
  stopped cycling would freeze all nine levers under it. UFO *pressure*
  escalates through those nine; UFO *rhythm* stays constant.
- **`junkSplit` (CS026 P2, FORK-CS026-A) is a TWO-STATE lever and the table's
  only one — floor 2, ceil 3, steps 2 means it takes exactly one step, ever.**
  It is `↳`-carried by `junkCount`, so it advances on that driver's wrap: 2-way
  splits through level 10, 3-way from level 11 on, and then flat forever. That
  makes level 1 a **21-body** tree instead of 39 — the changeset's central
  pacing bet — while a 2-way level 10 (84 bodies) is still busier than a 3-way
  level 1 ever was, so nothing sags in the middle. **It is consumed by
  `destroyDebris()` only.** `destroyHunter()` carries its own, separate,
  hardcoded 3-way loop and is deliberately NOT levered: `ACH_LINEAGE_FULL = 13`
  (1 + 3 + 9) is an achievement built on that number, so levering the Hunter
  split would silently make an achievement unreachable at some levels. **⛔ The
  CS026 gate (Q1) confirmed this one: "none are wrong. Pacing is much better."**
- **`junkCount` is the one integer-valued lever, and it is rounded at the
  consumer** — `nextWave()` spawns `Math.round(lv.junkCount)`. Round, not floor:
  it is the nearest achievable count to the authored curve, it returns both
  authored endpoints exactly when they are whole, and flooring would shave every
  interior step of every retune downward while the difficulty log lied in the
  same direction.

## 4. What is deliberately NOT a lever

Recorded so nobody re-levers one on a cleanup pass. Each of these is a frozen
constant, a fixed curve or a flat debug knob — a quantity that does not scale
with the level, on purpose.

| Not a lever | What it is | Why not |
|---|---|---|
| `payloadSlots(n)` | Fixed curve: 8 at L1–4, +2/level, 24 at L12, flat forever | A capability grant on a schedule the player learns, not a difficulty dial — and an odometer sawtooth would **take slots back** at a wrap. |
| `smallUfoChance` | Flat 20% knob | There is exactly ONE appearance timer; which size spawns is a constant coin, not a ramp. Retired `SAUCER_SMALL_CHANCE_FLOOR/CEIL` and with them `ramp()`. |
| `FREQ_JITTER` | Frozen 0.25 (was a knob) | Cosmetic anti-metronome on the frequency-shaped levers via `jitteredInterval()`. `ufoFireFreq*` deliberately does not jitter — it multiplies ranges that already roll their own value. |
| `HUNTER_COALESCE_COUNT` | Frozen 12 | The pipeline's defining number. Moving it per level would make the one Hunter producer illegible. |
| `garbageAttractRadius` / `garbageAttractForce` | Flat knobs (160 px / 30 px/s²) | Gate A tuned both by feel and they shipped as answered; the *delay* is the levered quantity (`coalescePause`), not the geometry. |
| `DEBRIS_GARBAGE` (4), `HUNTER_GARBAGE` (`{3:3, 2:2, 1:1}`) | Frozen constants | Resolved as frozen despite being the sole input to the only Hunter producer. |
| `lastStandSpeed` | Flat knob (50 px/s) | A documented exception to "large Hunters do not pursue," not an axis. |
| **All Hunter turn rates** | Frozen `HUNTER_TURN_CEIL[size] × HUNTER_FLOOR_FRAC` = 0 / 0.928 / 1.508 rad/s | Resolved, not an oversight. Large's ceiling is 0, so it never turns. |
| **Large-Hunter speed** | Frozen `HUNTER_SPEED_CEIL[3] × HUNTER_FLOOR_FRAC` = 40.6 px/s | Large Hunters do not pursue, so there is nothing for a speed ramp to mean. Only medium and small are levered. |
| `hunterCapMax` / `hunterCapLevelsPerStep` / `heldClumpMax` | Flat knobs (6 / 2 / 4) | See §5 — a **ceiling**, and a ceiling on concurrent threats is a stability guarantee, not a difficulty axis. The player should never feel it move. |
| `magnetResumeDelay` / `magnetPushKick` / `magnetPushSpread` | Flat knobs (250 ms / 120 px/s / 45°), CS025 P1/P2, **POWERUPS** section | **Knobs on a POWERUP'S BEHAVIOUR, not difficulty axes.** They tune how the Magnet behaves when the tow chain is full — how long the pull stays suppressed after a slot opens, and how hard/wide the full-cargo repulsion burst throws the gathered cloud. None of them describes a quantity that should get harder as the player gets deeper: the Magnet is the player's own tool, and scaling its recovery by level would make a powerup **worse the further you get**, which is backwards. All three are flat by construction — **no floor/ceil/steps triple, no `▼`/`↳`, no `carriesTo`, no `LEVERS` entry** — and none has a shipped constant behind its default (a resume delay has no meaning outside the knob), so the registry entry *is* the source of truth, the `chainGuardIntercepts` idiom. |
| `deliveryFloatRise` / `deliveryFloatLife` | Flat knobs (160 px/s / 1.2 s), CS026 P4 shape + P6 tuning, **DELIVERY** section | **A floater's speed and fade are look-calls on a REWARD, not pressure axes.** They tune how the per-Debris `"+pts"` column at the dock reads; nothing about how hard the level plays. Scaling them by level would be backwards twice over — the delivery payoff is the player's own reward, and a deeper level pays *more*, so a level-scaled fade would make the biggest numbers the hardest to read. Both flat by construction — **no floor/ceil/steps triple, no `▼`/`↳`, no `carriesTo`, no `LEVERS` entry** — and both knob-only, with no shipped constant behind them (the `magnetResumeDelay` idiom, not the `debrisBounceRestitution` one). `DELIVERY_FLOAT_DY` (22 px, the floaters' offset above the ship) is a **frozen constant and not even a knob**: it is a fixed nudge clear of the hull. ⛔ `DOCK_OFFLOAD_INTERVAL` (0.05 s) is likewise NOT a knob and was deliberately left alone at the CS026 gate — see §6. |
| `earlyWorldLevels` | Flat knob (5), CS026 P3, **GLOBAL** section | **A world SIZE boundary, not a difficulty ramp.** It says how many levels run in the small 1920×1080 torus before the 2560×1440 one takes over — one resize per run, at the 5→6 seam. It is not levered because it is not a quantity that should scale: it names a fixed early-game window, and there is nothing for "more of it per level" to mean. 0 turns the feature off entirely for a same-session A/B, which is the other reason it must stay a plain knob. **No combat number depends on it** — see §5's note on why it changes no ceiling. |
| `levelBannerTime` / `levelBannerFade` / `levelBannerSize` / `levelBannerY` | Flat knobs (2.2 s / 0.5 s / 72 px / 24 px), CS025 P5 constants promoted to knobs CS026 P5, **GLOBAL** section | **A banner's size and duration are look-calls, not pressure axes.** They tune how the centre-screen "Level N" announcement looks and how long it holds — nothing about how hard the level plays. Scaling any of them by level would be meaningless: the banner reads the same at level 1 as at level 90. All four are flat by construction — **no floor/ceil/steps triple, no `▼`/`↳`, no `carriesTo`, no `LEVERS` entry** — and each stays anchored to its own shipped constant as the row's `def` (`LEVEL_BANNER_TIME`/`FADE`/`SIZE`/`Y`), the `debrisBounceRestitution` idiom, not the knob-only one directly above. |

## 5. Explicit ceilings

**Standing rule: anything that can grow without bound gets its ceiling recorded
here, in the same commit that can grow it.**

- **`largeHunterCap(wave) = min(ceil(wave / hunterCapLevelsPerStep),
  hunterCapMax)`** — the maximum number of concurrent **large** Hunters. At the
  shipped defaults (2 and 6): **1 at levels 1–2, one more every two levels,
  plateauing at 6 from level 11.** CS024 P6f replaced the flat
  `LARGE_HUNTER_MAX = 100` with this after Gate B's own playtest found levels
  1–3 accumulating too many; that constant's own comment called it "a runaway
  backstop that play should never reach," and play never did, which was
  precisely the defect. It is a pure function of `game.wave` like everything
  else but sits **outside** the odometer, and it is **not** a breakpoint table —
  two knobs and one `ceil`, so it does not quietly restore the
  `HUNTER_CAP_STEPS` shape CS024 P3 deleted.
- **`heldClumpMax` (4)** — the anti-stall backstop on the cap's overflow rule. A
  saturated 12-piece clump at a full cap **holds** rather than vanishing; past
  this many held clumps the destroy behaviour returns. Sized against
  `GARBAGE_SOFT_MAX`: unbounded holding would let ~18 clumps consume the whole
  Debris budget and starve the field.
- **`GARBAGE_SOFT_MAX` (220) / `GARBAGE_HARD_MAX` (300)** — the density ceiling
  that makes permanent Debris tractable. Above the soft max one piece is culled
  per frame (oldest, never a clump while a single exists, never a held clump);
  above the hard max the field drains back to the soft max in one pass. Both
  deterministic, both silent by design. The binding cost is
  `coalesceGarbage()`'s O(n²) pair walk: 24,090 pair visits/frame at 220 and
  44,850 at 300, measured with a deterministic counter. **Quadratic in the
  ceiling** — ~99,900/frame at 450, ~500,000 at 1,000 — so raising to ~300–350
  is affordable and beyond that wants a spatial grid, not a bigger number.
  **⛔ RE-CHECKED AND HELD AT THE CS026 GATE (Q4), WHICH IS THE POINT** — CS026
  P2's split lever moved the shed volume by roughly half at every level, so a
  ceiling tuned against the old volume had to be re-read against the new one in
  the same session or neither reading meant anything. It was, and Paul reported
  *"garbage density is fine"* with no Debris ever seen to vanish. **Both
  numbers stand at 220 / 300, now playtested against the post-split volume
  rather than the pre-split one.** They have not moved since CS024 and
  FLAG-CS024-c is discharged.
- **⛔ THE EARLY-WORLD SHRINK (CS026 P3) CHANGES NO CEILING, and that is worth
  stating rather than leaving to inference.** Levels 1–5 run in a 1920×1080
  torus (56% of the 2560×1440 area), which raises Debris *density* per unit
  area without raising any *count*: `GARBAGE_SOFT_MAX`/`HARD_MAX` are absolute
  piece counts, not areal densities, so the O(n²) pair-walk budget above is
  unchanged. Nothing here grew a new unbounded quantity.
- **`SWEEP_POWERUP_CAP` (48)** — the Super Mega Delivery's fixed spawn ceiling:
  at most 48 powerups from one sweep, counting the guaranteed type set plus
  every per-piece payout. Deliberately **not** a debug knob.
- **`DEBRIS_SPEED_CAP`** = `2 × SHIP_MAX_SPEED` = **1040 px/s** — a guard rail on
  the resulting per-entity junk speed. It does not bind at the shipped lever
  values; it is insurance against a retune, and with junk speed now a live lever
  with three knobs it is the thing that stops a slider producing an unplayable
  field.

## 6. Retune log

- **CS026 P6 (the CS026 gate). ⛔ NOT a clean gate — but NO LEVER MOVED, and
  nothing on this document's subject moved either.** Six of the eight questions
  came back clean: **Q1 pacing** *"none are wrong. Pacing is much better."* —
  which is this changeset's central bet confirmed and the `junkSplit` lever
  (§3, row 5) validated at its shipped 2/3 shape; **Q2** the smaller early world
  *"is fine"*; **Q3** the score curve *"is fine"*, which is the answer that
  clears FORK-CS026-C's accepted risk (halving the Garbage Satellite score
  curve also halves how often the fixed 10,000-point `REPAIR_MILESTONE` repairs
  the hull — the one place this changeset could have made the early game
  *harder*, and it did not); **Q4** Debris density fine (see §5 — re-checked
  against the new volume and held at 220/300); **Q6** the incidental delivery
  fine; **Q7** the
  level banner *"looks great"*, so all four of its knobs stand unmoved at their
  CS025 first guesses, now playtested.
  **`LEVERS` and `leverState` are pinned byte-identical at every level 1..200
  against this phase's own parent commit** (`test-cs026-p6.js` §G) — the retune
  this gate did return touched no lever, no floor, no ceiling, no step count and
  no chain composition.
  **The two questions that returned work were both look-calls, and both were put
  to Paul before a line of code was written** (the standing rule, and the CS025
  P5 precedent). **Q5** asked for the delivery floaters to be *"closer to the
  ship"*, to *"fade more slowly"* and to *"travel upwards more slowly"* —
  applied as `deliveryFloatRise` 300 → **160**, `deliveryFloatLife` 0.55 → **1.2**
  and a move of both delivery branches' origin from the popped chain node to the
  ship. **He was offered a third knob and declined it:** a single origin makes
  floater separation purely `rise × DOCK_OFFLOAD_INTERVAL`, so the tighter rise
  costs separation (8 px nominal, ~10.7 px on screen after frame quantisation,
  against 15 px nominal before), and buying it back meant slowing the offload
  cadence to 0.10 s and doubling a 24-Debris dock visit to 2.4 s. **He chose
  to hold delivery pacing and accept the tighter column, so the registry did not
  grow at all this phase** — no new knob, the count holds at 85. **Q8** returned
  four named Achievements-screen layout defects, fixed at look-call constants;
  his own first suggestion there (an alternating row background) was **not**
  built, because it would have been a fill and therefore a third named GDD §3.2
  exception — shown the trade, he chose a dotted leader run instead, which is
  `drawText` and adds no exception.
  **The one number in the whole gate that Paul declined to give was Q4's**
  (*"I do not know what number to report"*), and the correct handling was to
  change nothing — see the standing instruction at the top of every gate.

- **CS025 P5 (the CS025 gate).** **A completely clean gate — not one number
  moved, and no lever moved.** All three of CS025's new knobs came back
  confirmed at their shipped defaults: `magnetResumeDelay` **250 ms** (Q1,
  *"seems good as a default"*), `magnetPushKick` **120 px/s** and
  `magnetPushSpread` **45°** (Q2, *"seems good... but give me debug knobs"* —
  all three already existed as POWERUPS rows, so nothing was added either). Q3,
  the changeset's central bet, reported the Hunter-on-top-of-you problem *"has
  mostly gone away"*; Q5 reported the defensive fill loop reads fine. The
  `LEVERS` table ships exactly as CS024 P6b left it, and `leverState` is pinned
  **byte-identical at every level 1..200, every lever**, against CS025's own
  phase parents (`test-cs025-p1.js` §H, `-p2.js` §L, `-p5.js` §G).
  **This is the fourth clean-gate closing phase on record** (CS020 P2, CS022
  P4, CS024 P7, CS025 P5). The two changes the gate *did* return were not
  numbers and not difficulty: **Q4 backed out the CS025 P3 scoop tell**
  outright, and **Q6 asked for the level announcement to be made critical and
  given a centre-screen banner**. Neither touches this document's subject.

- **CS024 P7 (Gate B).** Seven of the gate's eight questions came back "fine"
  and moved nothing. **No lever moved** — no floor, no ceiling, no step count,
  no chain composition. The single number the gate returned was **not a lever**:
  `ENGINE_BURN_SECONDS` 5.0 → **10.0 s** of forward thrust (Q11), the value
  FLAG-CS024-f had already flagged as a conversational example rather than a
  design call. The `LEVERS` table ships exactly as CS024 P6b left it.
