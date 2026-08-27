# PLANNED-FEATURES-CS040.md

**Changeset:** CS040
**Base:** `1ee9eed` ("cs039 p4"), `GAME_VERSION 1.0.0.39`
**Theme:** Healing comes from health pickups only; the supply loop gets an escape hatch; telemetry gains the columns three analyses have asked for and moves its controls to Options.

**Evidence base:** the 2026-08-23 (waves 1–14, 46 min) and 2026-08-26 (waves 8–16, 35 min) telemetry captures, plus the simulation work in `ANALYSIS-RESPONSE.md`. Every measured number below is from those two runs, n=2.

---

## 0. Scope

**In:**

1. Milestone healing removed; the score milestone becomes a conditional health *spawn*.
2. Pity-driven ambient health cadence.
3. Health banking (cap 2, auto-spend).
4. Recycle-hub resupply weighting — the supply-starvation escape hatch.
5. Telemetry schema v3 → v4: three population columns, `scoopHits`, `hpWasted`, `healthBanked`; `scoreRepairBonus` retired; a game-over flush row; a ring-wrap flag in the header block.
6. Telemetry controls move from the debug panel to the Options screen.
7. Doc sweep, `TELEMETRY-ANALYSIS-GUIDE.md` v4 section, version bump to `1.0.0.40`.

**Explicitly out, and not to be re-proposed inside this changeset:**

- **Scoop redesign** (two new levels, side orbs, damage-weighted loss). Deferred to its own changeset — it is a second large difficulty increase and stacking it here makes the playtest gate uninterpretable.
- **`CARGO_TURN` activation.** Same reason. Deferred.
- **Sever-linked scoop loss** (FORK-S1 in `ANALYSIS-RESPONSE.md`). Open, not decided, not here.
- **Shots-fired / shot-hit telemetry.** Deferred to a weapon-tuning changeset.
- **Dock-proximity telemetry.** Deferred; the `deliveryCount === 8` finding covers the immediate need.
- **`balanceEra` in the CS033 leaderboard payload.** **Declined by Paul.** Recorded, closed. Do not re-open without a new decision record.
- **Shield instrumentation.** Declined — the shield is a deliberate Asteroids Deluxe homage with the auto-shield option covering players who want it. Zero deflects is a design outcome, not a defect.

**Prerequisite:** run `PROMPT-guide-update.md` (the standalone v3 corrections prompt) **before** this changeset. Those corrections describe v3 and should land against v3, not be tangled with the v4 schema edits in P8.

---

## 1. Healing rework

### 1.1 The problem, measured

`addScore()`'s milestone arm supplied **63% (run A) and 62% (run B)** of all healing — 1,650 and 1,525 HP against ≤950 from pickups in each run. Because a milestone is a fixed 10,000 points and score rate rises with wave, healing throughput rises with wave automatically. Nobody designed a healing system; one emerged.

Replaying each run's exact damage trace with milestone healing removed and nothing else changed:

| | actual | milestone healing removed |
|---|---|---|
| Run A | wave 14, 46.4 min | dies t=395 s, **wave 4** |
| Run B | wave 16, 56.7 min | dies 95 s into the span, **wave 9** |

⛔ **This is why the removal cannot be a deletion.** Raising `POWERUP_HEALTH_AMOUNT` does not rescue it — run B saturates at wave 13 for every value from 50 upward. The reason:

> **Run B took 485 HP of damage between two consecutive health pickups** (wave 14). Run A's worst such gap is 215 HP. Both exceed the 250-HP hull.

The ambient 18–26 s timer is uncorrelated with when damage arrives. **This is a delivery-timing problem, not a magnitude problem**, and §1.3 and §1.4 exist to fix the timing.

**Simulation caveat, to be carried into the gate:** the above replays a fixed damage trace against a changed rule. A player with scarce healing plays far more cautiously, so those death waves are an **upper bound on harshness**, not a prediction. The 485-HP gap is a measurement; the wave numbers are not.

### 1.2 Milestone becomes a conditional spawn

`REPAIR_MILESTONE` (10,000) and `game.nextRepair` **stay**. What changes is what crossing one does.

| condition at the crossing | today | CS040 |
|---|---|---|
| `hp < SHIP_MAX_HP` | `hp += REPAIR_AMOUNT` (25), clamped | call `spawnHealthPowerup()` |
| `hp === SHIP_MAX_HP` | `score += REPAIR_FULL_BONUS` (2500) | **nothing** |

The full-hull gate is Paul's decision, and it matters: without it the milestone would be generous exactly when the player is safest. (Measured hull-vs-score-rate correlation is +0.005 (A) / +0.196 (B), so the coupling is weak in practice — the gate is cheap insurance, not a crisis fix.)

**Placement: ambient.** Reuse `spawnHealthPowerup()` unchanged — it already picks a random angle and a distance in `[POWERUP_HEALTH_MIN_DIST, POWERUP_HEALTH_MAX_DIST]` from the ship and wraps the result. Do not write a second placement path.

**Retired:**

- `REPAIR_AMOUNT` — no consumer left.
- `REPAIR_FULL_BONUS` — no consumer left.
- `game.stats.scoreRepairBonus` — the counter and its telemetry column (§3).

Delete them rather than leaving them dormant. `REPAIR_MILESTONE` keeps a live consumer so it stays.

**Expected effect on the score economy:** `scoreRepairBonus` was 7.0% of run A's score and 5.2% of run B's. That income disappears. Kill and delivery scoring are untouched.

### 1.3 Pity-driven ambient health cadence

`POWERUP_HEALTH_GAP` becomes a function of missing hull rather than a flat `[18, 26]`. Same shape as `guardDropWeight()` — a pressure-driven value clamped at both ends, an idiom already proven in this build.

```
frac = hp / SHIP_MAX_HP                     // 1.0 at full hull, 0.0 at death
lo   = lerp(HEALTH_GAP_LOW_HURT,  HEALTH_GAP_LOW_OK,  frac)
hi   = lerp(HEALTH_GAP_HIGH_HURT, HEALTH_GAP_HIGH_OK, frac)
game.healthTimer = rand(lo, hi)
```

Shipped defaults, all four playtest knobs:

| constant | value | meaning |
|---|---|---|
| `HEALTH_GAP_LOW_OK` / `HIGH_OK` | 22 / 30 | the roll at full hull — slightly leaner than today's 18/26 |
| `HEALTH_GAP_LOW_HURT` / `HIGH_HURT` | 6 / 10 | the roll at zero hull — roughly 3× today's rate |

Registry knobs in the POWERUPS section, `def` derived from the consts (the standing idiom). The timer is re-rolled at its existing site — do not add a second re-roll on damage, which would let a player farm spawns by tanking hits.

`POWERUP_HEALTH_GAP` is retired; the four new consts replace it.

### 1.4 Health banking

**Today a health pickup taken at full hull gives nothing at all** — `Math.min` clamps it, no HP, no score, no bank. In these two runs roughly 305 HP (A) and 205 HP (B) of healing evaporated at the cap.

New behaviour, in `applyPowerup()`'s health arm:

1. Apply as much as the hull has room for.
2. Any remainder **banks** as whole charges, up to `HEALTH_BANK_MAX = 2`. A charge is worth `POWERUP_HEALTH_AMOUNT`.
3. Overflow beyond the bank cap is discarded and counted in `game.stats.hpWasted` (§3).

Spending is automatic: at the point hull drops below max, if `game.healthBank > 0`, spend one charge immediately and clamp. **One charge per damage event, not a drain to full** — a single hit should not evaporate the whole reserve.

**Audio: a unique SFX, no voice line.** A new `AudioSys` method for the auto-spend moment, distinct from `AudioSys.powerup()` (the pickup) and `AudioSys.shieldPing()` (see FORK-A). No `VOICE_LINES` work in this changeset, so no `voice-robot-lab` gate on any build session here.

**Save/load:** `healthBank` is additive state in the existing envelope, known-value-else-default on load, **no schema bump** — `afd_settings_v1` / `afd_scores_v1` / `afd_achievements_v2` remain frozen keys.

**Reset:** `healthBank = 0` in `resetRun()`.

### 1.5 HUD tell for the banked charge (FLAG-CS040-d — overridden, now required)

A banked charge is invisible state that spends itself. Without a tell the player cannot know whether they have a reserve, which makes the whole mechanic unreadable. Keep it **simple**.

**Recommended: segmented pips on the HULL ring's cluster, top-right.** The bank is a hull reserve, so it belongs with the hull.

- Reuse `drawRingSegments()` — the same helper the SCOOP row already uses — with `HEALTH_BANK_MAX` segments and `game.healthBank` lit.
- `POWERUP_COLOR.health` when lit, `COLOR.dim` when not.
- **Stroke only.** GDD §3.2's no-fills rule; the SCOOP row already had its fill dot removed for exactly this reason.
- Place it as a short pip row **beneath the `"HULL"` text label** at `HUD_RING_LABEL_Y`, not as a new concentric ring.

⛔ **Do not draw it as a ring outside `HUD_RING_R`.** The HULL and CARGO ring centres are 76 px apart (`HUD_HULL_CX` / `HUD_CARGO_CX`) with only 16 px of air between their edges. An outer ring eats that air from both sides and the two clusters start reading as one object.

⛔ **Do not put the tell on the ship.** CS025 P3 added a magnet-blue scoop tell on the hull and CS025 P5 backed it out whole at the playtest gate as unreadable against the hull stroke; the build carries an explicit do-not-re-add comment. The bottom-left/top-right HUD is where persistent state lives in this game. Respect that.

**FLAG-CS040-f** — always-drawn (dim track at zero, matching the SCOOP row's always-shown-muted convention) versus drawn only when `healthBank > 0`. Spec'd as **always drawn** for consistency with the SCOOP row; GATE T decides whether that is clutter.

Pick the exact pip geometry against the running build, not by eye in the spec.

### 1.6 Combined expectation

Simulated, with banking at cap 2 and 25 HP per pickup and *without* the pity cadence (which the simulation cannot model, since it would change when pickups spawn):

| | outcome |
|---|---|
| Run A | dies wave 4 |
| Run A, banking at 50 HP/pickup | dies wave 10 |
| Run A, banking + 1.5× rate + 40 HP | survives, final HP 50 |

The pity cadence is the piece that does the work the simulation can't show. **Expect the first playtest to need a tuning pass on the four gap constants.** They are knobs; that is the point.

---

## 2. Recycle-hub resupply — the supply-starvation escape hatch

### 2.1 The problem, measured

Both near-death spirals in both runs had the same shape, and it is not "damage went up":

> dry weapons → no kills → no powerup drops (**drops are kill-gated**) → still dry

Damage per minute does not trend with wave at all (Spearman +0.022 A, −0.043 B). The dry-weapon split is the strongest single-variable finding in three consecutive analyses and it survives the within-wave check in 11 of 13 waves: median Δscore per 5 s was 650 vs 1,100 (A) and **300 vs 1,250** (B). Run B spent 23.4% of its logged time with both weapons at zero.

### 2.2 The change

The recycle hub already drops exactly one powerup per visit, at `game.deliveryCount === 8`. That call to `dropPowerup()` gains a bias toward whatever the player is out of.

**FORK-CS040-C — RESOLVED: c1, weighted.**

In the hub's call only, multiply the weight of any type whose `game.powerBudget[type] === 0` by `HUB_DRY_WEIGHT_MULT` (**4**, a registry knob). The roll stays a roll — a dry player is very likely but not certain to get relief.

Rationale for c1 over c2 (guaranteed): c2 would make the hub a vending machine and remove the tension from the delivery decision, which is the one decision the cargo loop is built around. c1 relieves starvation without making it free.

⛔ Whichever is chosen, the bias applies **only at the hub call site**. `destroyHunter()`'s large-core drop and `destroySaucer()`'s drop stay unweighted — those are kill-gated, and biasing them would defeat the entire point (a dry player isn't killing anything).

⛔ Guard's eligibility gate (`chain.length >= chainGuardMinTow`) and `guardDropWeight()`'s pity substitution both still apply, unchanged, composed with whatever this adds. Guard is not a budget in the "dry" sense — do not include it in the dry set.

**On-theme note:** this makes the recycling hub literally resupply you, which is the fiction the game already tells.

---

## 3. Telemetry v4

`TELEMETRY_FIELDS` goes 44 → **49** columns.

### 3.1 Added — instantaneous

| column | source | why |
|---|---|---|
| `hunterCount` | `game.hunters.length` | Every Kessler-loop claim in three analyses is inferred from kill deltas |
| `debrisCount` | `game.debris.length` | Garbage Satellites alive — the wave-clear gate's own quantity |
| `garbageCount` | `game.garbage.length` | Towable Debris on the board — the coalescence feedstock |
| `healthBanked` | `game.healthBank` | 0…2; directly tunes `HEALTH_BANK_MAX` |

⛔ **Vocabulary is inverted on purpose and must survive into the column comments.** `game.debris` holds **Garbage Satellites** (enemies); `game.garbage` holds towable **Debris** (salvage). `debrisCount` therefore counts *Garbage Satellites*, consistent with the existing `debrisKills` and `dmgDebris*`. Do not "fix" this.

### 3.2 Added — cumulative

| column | source | why |
|---|---|---|
| `hpWasted` | new `game.stats.hpWasted` | Healing discarded at the cap **with the bank also full**. Distinguishes "health is scarce" from "health arrived at the wrong time" — the exact confusion that hid the 485-HP gap until it was simulated. Near zero means bank cap 2 is sufficient; large means the pity cadence is over-firing in calm stretches. |

### 3.3 Added — ⛔ NEITHER. A SECOND SAWTOOTH.

| column | source |
|---|---|
| `scoopHits` | `game.scoopHits` |

⛔⛔ **`scoopHits` RESETS TO 0 every time a scoop level is lost.** It counts hits *since the last level loss*, exactly the way `cargoDamageEvents` counts severs since the last guard drop. **It is the second sawtooth in this schema and it must be documented as one at all three sites** — the `TELEMETRY_FIELDS` comment block, the CS040 test, and `TELEMETRY-ANALYSIS-GUIDE.md` §3.

This is not a hypothetical trap. `cargoDamageEvents` was documented as cumulative in the guide, in the build's own comment and in the P2 test simultaneously, for the whole of CS039, and the first real capture showed 7 decreases in 53 rows. **Do not repeat it.** Any monotonicity check must exclude both columns by name.

The column ships now (Paul approved all four instrumentation items) even though the scoop retune is a later changeset; it becomes the loss-cadence readout when that lands, and renames to a damage tally at that time.

### 3.4 Removed

`scoreRepairBonus` — its counter has no consumer after §1.2.

### 3.5 Game-over flush

Both captures end 5 seconds before the run ends, with the killing blow unrecorded. At the site that sets `game.stats.gameEnded = true`, push one final `Telemetry` row unconditionally (subject only to the existing `telemetryCapture` gate). Mark it in the header block, not in a column — see §3.6.

⛔ The flush must not double-push if a scheduled snapshot lands on the same frame. Reset `Telemetry.acc` after the flush.

### 3.6 Header block

The `#` provenance block goes from seven lines to nine:

```
# orbital-overhaul telemetry v4
# build=1.0.0.40
# overrides=OFF
# telemetryInterval=15
# rows=196
# ringWrapped=false          <-- NEW
# finalRowIsGameOver=true    <-- NEW
# source=this run
# levers=none
```

`ringWrapped` is true when the buffer ever hit `TELEMETRY_MAX` and dropped a row. **The 2026-08-26 capture wrapped and lost its first 21.5 minutes and waves 1–7 silently**; noticing it took arithmetic on `t[0]`. One boolean removes the single most misleading failure mode in the format.

### 3.7 Ring capacity and persist cadence — FORK-CS040-D **RESOLVED**

At `telemetryInterval = 5` the 400-row ring held 33 minutes, and the 08-26 run overran it.

**Resolved: `TELEMETRY_MAX` 400 → 800, and persist every 4th snapshot.**

New ring coverage, which every derived label in §4.4 must compute rather than hardcode:

| interval | coverage at 800 rows |
|---|---|
| 5 s | 67 min |
| 10 s | 133 min |
| 15 s | 200 min |

**Persist cadence.** `Telemetry` currently writes the whole ring to `afd_telemetry_v1` on *every* snapshot. CS037's benchmark measured draw and update, not this — it is an untested surface, not a known problem. Doubling the ring doubles the payload, so the two changes together would have quadrupled write volume per snapshot at 5 s. Writing every 4th snapshot instead nets out at **half of today's write volume per unit of game time**, at a risk of losing at most 3 rows on a hard crash.

⛔ The every-4th rule must not interact with the game-over flush (§3.5) — the flush **always** persists, whatever the counter is standing at. That is precisely the row you cannot afford to lose.

---

## 4. Options-screen telemetry controls

### 4.1 The row

`MENU_OPTIONS` is `["Sound / Music", "Controls", "Difficulty", "Credits", "Back"]`, and **every consumer addresses rows by label via `MENU_OPTIONS.indexOf(...)`** — verified by grep, and the reason CS038 P1 could insert "Credits" safely. Insert **"Telemetry"** before "Back": 5 rows → 6.

⛔ Re-grep every `MENU_OPTIONS.indexOf(` call site at the insert and confirm each still resolves. Positional addressing anywhere is a bug to report, not to work around.

### 4.2 The submenu

Three rows plus Back:

| row | behaviour |
|---|---|
| **Capture** | ON / OFF. **Session-only.** |
| **Sample rate** | preset cycle: `5 s — Detail (67 min)` / `10 s — Balanced (133 min)` / `15 s — Full run (200 min)` |
| **Copy log** | action row; calls the existing `copyTelemetry()` |

### 4.3 Capture stays session-only — do not persist it

⛔ CS038 P3 made `telemetryCapture` **opt-in per session**, defaulting OFF at every launch, and made it a `sessionSwitch` knob **exempt from the `overridesOn` master toggle** (CS038 C6 — so it can never show ON while capturing nothing). **Paul has confirmed this behaviour is unchanged.** The Options row is a more convenient place to flip it, nothing more. It must **not** be written to `afd_settings_v1`.

"Session" here means one page load. A refresh turns capture off.

### 4.4 Sample rate presets

The preset ring is `[5, 10, 15]`. **`DEBUG.telemetryInterval`'s registry `def` stays 15**, so a stock run still reports `levers=none` and the provenance header stays honest; picking 5 or 10 correctly shows up as `levers=telemetryInterval=5`.

Why these three, measured by downsampling both captures:

| | 5 s | 10 s | 15 s |
|---|---|---|---|
| Run A lowest HP visible | **5** | 5 | 30 |
| Run B lowest HP visible | 30 | 30 | **80** |
| Run A full-cargo episodes | **89** | 55 | 32 |
| dry-weapon share | 14.0% | 13.7% | 14.5% |

Cumulative columns are rate-insensitive; **instantaneous columns (`hp`, `chainLen`, `speed`, `scoopLevel`, every `*Left`) degrade sharply.** At 15 s the near-death troughs that anchor this whole changeset's evidence would have been invisible.

The rate may be changed mid-run — `Telemetry.tick()` already handles a lowered interval by draining `acc` one row per frame rather than bursting. Verify that still holds.

### 4.5 Debug panel

The debug panel's telemetry rows — `telemetryCapture`, `telemetryInterval`, and the `"Copy telemetry log"` action row — are **removed**. Options is the only home.

⛔ `copyTelemetry()` itself stays exactly where it is. The build comment at `Telemetry.tick()` is explicit that the export must keep working while capture is off — that is precisely the state you are in the morning after a capture session. Moving the *control* must not gate the *export*.

---

## 5. Forks — ALL RESOLVED

Resolved by Paul before P1. **A resolved fork cannot be re-opened without a new decision record.**

| id | question | resolution | rationale |
|---|---|---|---|
| **FORK-CS040-A** | The milestone currently rings `AudioSys.shieldPing()`. Keep it, or silent? | **Keep, gated on the spawn actually happening.** | It becomes a "supply drop incoming" tell. A silent milestone is a reward the player cannot perceive, and at full hull nothing happens so nothing should sound. |
| **FORK-CS040-B** | `REPAIR_MILESTONE` stays at 10,000? | **Yes, 10,000.** | Ship it and let GATE T decide. ⛔ Watch item: at late-game score rates a milestone lands every 15–23 s, which is *faster* than the ambient timer's healthy-hull roll of 22–30 s. If the gate finds health abundant past wave 10, **this is the first knob to raise, before the gap constants** — otherwise the milestone quietly becomes the primary late-game health source and re-creates the score→health coupling this changeset exists to remove, just with a fetch step. |
| **FORK-CS040-C** | Hub resupply: weighted or guaranteed? | **c1, weighted, `HUB_DRY_WEIGHT_MULT = 4`.** | c2 would make the hub a vending machine and remove the tension from the delivery decision. |
| **FORK-CS040-D** | `TELEMETRY_MAX`? Persist cadence? | **800 rows; persist every 4th snapshot.** | Doubles coverage (67 min at 5 s) and still halves today's write volume per unit game time. §3.7. |

---

## 6. Flags — ALL RESOLVED

| id | item | resolution |
|---|---|---|
| **FLAG-CS040-a** | `healthBanked` telemetry column | **Include.** With `hpWasted` it is how `HEALTH_BANK_MAX` gets tuned. |
| **FLAG-CS040-b** | Auto-spend: one charge per damage event, not a drain to full | **Confirmed.** |
| **FLAG-CS040-c** | Gap constants 22/30 at full hull, 6/10 at zero | **Ship as specified.** Expect P7 to move them. |
| **FLAG-CS040-d** | HUD tell for a banked charge | ⚠️ **OVERRIDDEN — a simple HUD tell IS required.** No longer deferred; see §1.5. This makes P3 structural rather than audio-only. |
| **FLAG-CS040-e** | `HUB_DRY_WEIGHT_MULT = 4` | **Confirmed** as the starting point. |
| **FLAG-CS040-f** | HUD pips always drawn (dim at zero) vs only when non-zero | **New, opened by d.** Spec'd as always-drawn for consistency with the SCOOP row; GATE T decides. |

---

## 7. Gate

**GATE T — one blocking playtest gate**, between P6 and P7. Nothing after it starts until Paul signs off.

Questions the gate must answer:

1. Does healing feel earned rather than accrued, or merely scarce?
2. Do the four gap constants need a pass? (Expect yes.)
3. Is the banked-charge auto-spend perceptible from the SFX alone (FLAG-d)?
4. Does the hub resupply read as relief or as a vending machine (FORK-C)?
5. Does the run end earlier than before, and does that feel like difficulty or like a wall?
6. Options telemetry flow: can a capture session be started, sized and exported without the debug panel?

**Capture telemetry during the gate playtest at `5 s — Detail`,** and export it. That log is the changeset's own evidence, and `hpWasted` / `healthBanked` / `hunterCount` are all new and unvalidated against real play.

---

## 8. Suite

Suite must pass at **zero skips** before close. New coverage:

- `addScore()` milestone: spawns at `hp < max`, does nothing at `hp === max`, advances `nextRepair` in both cases.
- Pity cadence: gap at full hull, gap at zero hull, gap at a midpoint; monotone in `hp`.
- Banking: fill-then-bank, bank cap at 2, overflow lands in `hpWasted`, auto-spend fires once per damage event, `healthBank` survives save/load and resets on `resetRun()`.
- Hub weighting: applies at the hub call only; `destroyHunter` / `destroySaucer` drops unchanged; guard still gated and still pity-weighted.
- Telemetry: 49 columns matching `TELEMETRY_FIELDS` order; `scoreRepairBonus` gone; **`scoopHits` asserted to be a sawtooth, not cumulative**; game-over flush pushes exactly one row and does not double-push; `ringWrapped` true only after a real wrap.
- HUD: pip row renders at bank 0/1/2; stroke-only; does not overlap the CARGO ring cluster.
- Options: "Telemetry" row present, every `MENU_OPTIONS.indexOf()` consumer still resolves, capture does not persist across a simulated reload, preset cycle wraps, `copyTelemetry()` works with capture off.