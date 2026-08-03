# PLANNED FEATURES — CS021

**Changeset:** CS021 — Orbit-level archetype ("orbit levels") + HUD delivery-combo readout
**Baseline:** CS020 complete, commit `41d6ea5`, `GAME_VERSION "1.0.0.20"` → ships `"1.0.0.21"`.
**Source:** Paul's design handoff, "Orbit-Based Level Design — Implementation Handoff" (external conversation). This spec is that handoff **re-grounded against the real build**. Where the handoff and the build disagree, the build wins and the disagreement is recorded in §2 (Corrections).

✅ **ALL FORKS RESOLVED** (§3). Implementation-ready.

---

## 1. The feature

A recurring level archetype. On every 3rd level, instead of the normal `nextWave()` scatter (junk-cycle count of size-3 `DebrisSatellite`s in a ring 260–640 px from the ship, each with linear drift), the level's satellites are arranged in **concentric orbiting rings around the dock**, with per-ring counts computed so the gaps between satellites are always wide enough for the ship to pass — tight enough to demand timing, never below a fairness floor.

Non-orbit levels keep their existing layout logic byte-untouched. The archetype is a **spawn arrangement + motion mode**, not an invincible wall: satellites remain ordinary `DebrisSatellite`s — shootable, breakable, harvestable. Eroding a lane by shooting is a legitimate strategy; the salvage loop is unchanged.

### 1.1 The core math (per ring)

```
circumference     = 2π × radius
minRequiredGap    = max(shipDiameter + safetyMargin, shipDiameter × minGapMultiplier)
spacePerSatellite = satelliteDiameter + minRequiredGap
maxCount          = floor(circumference / spacePerSatellite)
count             = clamp(round(1 + density × (maxCount − 1)), 1, maxCount)
```

Real numbers, from the shipped constants (grep-verified at `41d6ea5`):

| Symbol | Value | Source |
|---|---|---|
| shipDiameter | **26 px** | `SHIP_RADIUS = 13` |
| satellite dia (size 3) | **92 px** | `DEBRIS_RADII = {3:46, 2:26, 1:13}` |
| minRequiredGap @ 2.5× | **65 px** | 26 × 2.5 beats 26 + 8 |
| minRequiredGap @ 1.8× floor | **46.8 px** | still beats 26 + 8 = 34 |
| dock radius, wave 1 | **up to 88 px** | `DOCK_RADIUS 44` × `LEVER_DOCK_SIZE` (2× at wave 1) |
| world | **2560 × 1440, wrapping** | `WORLD_W`/`WORLD_H` |
| wrap-clean radius budget | **~700 px** | `WORLD_H/2 − 20` |

- **`minGapMultiplier` (default 2.5)** — the fairness floor. Below ~2.5× ship diameter, passage stops being skill and starts being pixel luck. Hard absolute floor **1.8** under difficulty scaling (§5).
- **`densityByOrbit`** — per-ring dial, 0 (sparsest) → 1 (tightest safe fit). Ships at the handoff's non-uniform curve so the level has rhythm.
- **`startAngle` randomized per ring** (`rand(0, angleStep)`) so safe lanes never align as one straight radial path.
- **Guard the handoff omits:** if `maxCount < 1` for a ring, that ring is unfair by construction — the generator asserts `maxCount ≥ 1` per ring rather than placing a satellite with a negative computed gap.
- `actualGapPx = circumference/count − satelliteDiameter` is an **arc-length** figure; the straight-line gap is marginally smaller at low counts. Acceptable at these radii — the floor is already conservative — and the §8 sweep asserts against the arc figure.

### 1.2 The shipped geometry (FORK-B → 4 rings of size-3)

| Ring | Radius | Circumference | maxCount @2.5× | Density | **Count** | actualGap |
|---|---|---|---|---|---|---|
| 1 | 180 | 1131 | 7 | 0.75 | **6** | 96.5 px |
| 2 | 330 | 2073 | 13 | 0.45 | **6** | 253.6 px |
| 3 | 480 | 3016 | 19 | 0.35 | **7** | 338.9 px |
| 4 | 630 | 3958 | 25 | 0.85 | **21** | 96.5 px |

`innerRadius = 180`, `radiusStep = 150`, `spacePerSatellite = 157`, curve `[0.75, 0.45, 0.35, 0.85]`.
Outermost satellite edge = 630 + 46 = **676 px**, inside the ~700 budget. Inner ring clearance over a wave-1 dock: 180 − 46 − 88 = **46 px**.

**Total: 40 size-3 satellites at first occurrence; 45 at the 1.8× floor** (maxCounts widen to 8/14/21/28, counts to 6/7/8/24). See §4.5 for what that means and why it ships anyway.

### 1.3 Motion

The handoff says "wire higher angular velocity in wherever satellite rotation is already handled." **No such place exists.** `DebrisSatellite` motion is linear drift; the only rotation in the class is per-sprite spin. Orbit levels therefore need a new movement mode: satellites carry `{orbitCenter, orbitRadius, orbitAngle, orbitAngVel}` and their update advances the angle and derives x/y — **wrap-aware** (`wrapPos` on the derived position; all distance math through the wrap helpers, per the standing rule).

---

## 2. Corrections — where the handoff is wrong about this game

The build's contract or arithmetic settles each of these; none is a design choice.

**C1 — No ES module. Ever.** The handoff delivers the generator as an `export`ed module. `CLAUDE.md` and `EXTERNAL-FILES.md` are explicit: **all game logic lives in the one `<script>` block**; external runtime files carry data/assets only, load via classic `<script src>`, and must be non-essential. The generator is inlined as a plain function beside the other spawn logic; the `export` line is dropped. (The no-build-step lift applies to future games and data files, not to logic in this build.)

**C2 — There is no fixed central hub.** The world is a 2560×1440 torus, the dock **relocates every wave** to 260–620 px from the ship (`class Dock`, `DOCK_MIN_DIST`/`DOCK_MAX_DIST`), and the ship is wherever the last wave left it. Orbit levels center on the dock and make the ship's position safe by construction (FORK-A → **(c)**).

**C3 — The handoff's default radii are ~3.6× too big for the world.** With `satelliteDiameter = 92`: `ringSpacing = 92 × 6 = 552`, `startRadius = 92 × 4 = 368`, outermost of 5 rings = **2,576 px radius** — larger than the entire 2560-wide world, whose largest wrap-clean circle is ~700 px. Even ring 2 (920 px) doesn't fit. The `× 6` / `× 4` derivations are dead on arrival; CS021 ships the explicit fitted radii in §1.2.

**C4 — `DECISIONS.md` does not exist.** This repo's continuity docs are `STATUS.md` (every phase), the GDD §2 (shipped behavior only, closing phase), `GDD-VERSION-HISTORY.md` (append-only, closing phase), and `DIFFICULTY-LEVERS.md` (living registry — CS021 **does** add a row, §5).

**C5 — "Fly from center outward, once" is not how this will play.** The dock is the delivery target and the satellites are the salvage source, so the player threads the rings **repeatedly and in both directions**, including inbound with up to `cargoMax` canisters strung behind the ship. Effective difficulty is well above the handoff's one-pass model. This is why the geometry, densities and both angular velocities are all live-tunable (§6) and why the gate (phases doc) asks about inbound passes specifically.

---

## 3. Fork ledger — ✅ ALL RESOLVED

| Fork | Question | **Resolution** |
|---|---|---|
| **FORK-CS021-A** | Hub center & ship start | **(c)** — rings center on the dock at its normal placement; the ship is never repositioned; any ring whose radius band contains the ship rerolls its `startAngle` (bounded attempts) until the nearest satellite clears the ship by ≥ `minRequiredGap`. No teleporting between waves; dock placement code untouched. |
| **FORK-CS021-B** | Ring count × satellite tier | **(a)** — 4 rings of size-3 debris, geometry per §1.2. Preserves the full 3→2→1 break cascade the salvage economy assumes. Density curve is the handoff's, minus its second entry: `[0.75, 0.45, 0.35, 0.85]` — tight → breather → wide/fast → tightest. |
| **FORK-CS021-C1** | Do rings move? | **(b)** — rings orbit slowly; ring 3 (the deliberately sparse one) is markedly faster, trading spatial tightness for timing pressure. **Both the base angular velocity and the fast-ring multiplier are debug knobs** (§6) — Paul tunes them live rather than accepting a specced guess. |
| **FORK-CS021-C2** | Children on shatter | **(i)** — children inherit the parent's instantaneous orbital tangent as vx/vy and carry **no** orbit state. The split site keeps its shape, no rail bookkeeping, no end-of-ring cleanup; the arrangement erodes naturally into a normal field as it is harvested. |
| **FORK-CS021-D** | Satellite totals | **(a)** — accept the bonanza. Orbit levels are set-pieces: 40 size-3s at first occurrence against a normal-level max of 13. Not density-scaled down. Consequences and mitigations in §4.5. |
| **FORK-CS021-E** | Which levels | **(a)** — every 3rd level: 3, 6, 9 … 63. **21 of 63 levels.** First occurrence is level 3, which is also the first `junkCount 9` level in the shipped cycle. |
| **FORK-CS021-F** | HUD combo readout (FLAG-CS020-i) | **(a)** — in scope, as its own phase (P4). Spec in §10. |

### Flags (best-guess, review at the playtest gate)

| Flag | Note |
|---|---|
| **FLAG-CS021-a** | **`orbitCount` slider 3–7 cannot be honored as specced.** At size-3 with fair spacing, 5 rings need 180 + 4×150 = 780 px (edge 826) against a ~700 budget; auto-deriving `radiusStep` to fit gives 118.5, below the `satelliteDiameter + 40 = 132` floor. **Slider range 3–5, hard-clamped by geometry — the effective max at size-3 is 4.** The panel shows the clamped value. |
| **FLAG-CS021-b** | **5 density sliders, variable ring count.** Store all 5, consume the first `orbitCount`. No dynamic slider count. Ring 4's slider is the climax value at the shipped count of 4. |
| **FLAG-CS021-c** | **"Reroll start angles" has no button idiom to copy** — the debug panel is canvas-drawn, keyboard-driven, registry-derived rows. Ships as a **keybind** active while the panel is open on an orbit level, documented on the panel footer. No new row kind. Reroll regenerates `startAngle`s only (counts/radii/densities/velocities untouched) and re-runs the spawn-safety pass. |
| **FLAG-CS021-d** | The occurrence-scaled `minGapMultiplier` (§5) is a genuine difficulty lever and gets a row in `DIFFICULTY-LEVERS.md` — unlike CS020's `dockComboGrace`, which was a feel knob. |
| **FLAG-CS021-e** | **No voice lines in CS021.** An orbit-level announcement from Dan is tempting, but the voice gate is non-negotiable: ARPAbet must be composed and zero-error-verified in `tools/voice-robot-lab.html` first. The archetype ships silent; a line can land later. |
| **FLAG-CS021-f** | `Math.random()` (via `rand()`) is unseeded. Headless tests stub it deterministically per the CS020 suite pattern; the shipped game keeps `rand()`. |
| **FLAG-CS021-g** | **Fractional debug steps are already supported** — verified against `chainGuardCooldown` (`def: 0.75, min: 0.1, max: 3, step: 0.05`). The new float knobs use plain floats; no ×10 display-unit workaround needed. Angular velocity uses **degrees/second** in the panel with `toNative: v => v * Math.PI / 180`, following the `unit: "ms"` + `toNative` precedent. |
| **FLAG-CS021-h** | **Entity-count pressure under FORK-D(a) is untested at this scale.** 40 size-3s fully harvested is up to ~80 size-2, ~160 size-1, plus the garbage cascade and its coalescence — several times any load the build has run. P1's tests include a frame-budget probe (§8 item 7); if it regresses, the density curve is the dial and it is already live-tunable. |

---

## 4. The mechanism

### 4.1 The generator (inlined, adapted from the handoff)

`generateOrbitLayout({satelliteDiameter, shipDiameter, centerX, centerY, orbitCount, innerRadius, radiusStep, safetyMargin, minGapMultiplier, densityByOrbit, baseAngVel, fastRingIndex, fastRingMult})` lands as a plain function in the `<script>` block, with these deltas from the handoff text:

1. `export` removed (C1).
2. The `satelliteDiameter × 6` / `× 4` default derivations removed (C3); `innerRadius`/`radiusStep` are supplied by the call site from §1.2.
3. `satelliteDiameter` read as `DEBRIS_RADII[3] * 2` at the call site — **never a new constant** (handoff requirement 3, kept).
4. Per-ring `maxCount ≥ 1` assertion (§1.1 guard).
5. Returned satellites carry `{angle, x, y}` **post-`wrapPos`**; each ring carries its `angVel` (base, × `fastRingMult` for `fastRingIndex`).
6. `startAngle` uses `rand(0, angleStep)` (house helper), not raw `Math.random()`.
7. Ring 4's `actualGapPx` is returned for the debug/QA readout as the handoff intended.

### 4.2 Wiring into `nextWave()`

`levelDef(n)` gains `archetype: n % 3 === 0 ? "orbit" : "field"` — derived from `game.wave`, so it remains the **one difficulty clock** (CS018 P4 invariant); no second clock, no cycle math.

In `nextWave()`, after `game.dock = new Dock();`, the spawn block branches. `"field"` runs the existing loop **byte-untouched**. `"orbit"` calls the generator centered on the dock and pushes one `DebrisSatellite` per returned satellite in orbit motion mode. `junkCount` is not consumed on orbit levels. Everything else in `nextWave()` — voice, music intensity, `cargoMax` grant, bonus-canister roll, stats, `logDifficultySnapshot` — runs identically for both archetypes.

### 4.3 The motion mode

`DebrisSatellite` gains optional orbit state (absent on field levels — `undefined` fields, zero cost to the existing path). When present, `update(dt)` advances `orbitAngle += orbitAngVel * dt` and derives position around `orbitCenter`, wrap-aware. Sprite spin is unchanged and independent.

`orbitCenter` is captured at generation and never re-read — if a future changeset ever moves the dock mid-wave, rings do not follow.

### 4.4 The split

On shatter, children are constructed exactly as today with vx/vy set to the parent's instantaneous orbital tangent (`speed = orbitAngVel × orbitRadius`, direction perpendicular to the center ray) and **no** orbit state. The split site's shape does not change.

### 4.5 Living with FORK-D(a)

The bonanza is deliberate, and these are the knock-ons it is accepted with:

- **Garbage/Hunter pressure.** Every size-3 cascades into the garbage economy, and neglected garbage coalesces into Hunters. Orbit levels will run hot. Hunters remain frozen at level-1 speed/turn (CS018), which is the existing brake.
- **Score ceiling.** A fully harvested orbit level pays far more than a field level of the same depth. Nothing in the scoring path changes; the one-effort delivery rule (CS020) still caps a combo at `cargoMax` structurally, so the ceiling rises through *volume*, not through combo inflation.
- **Frame budget.** FLAG-CS021-h — probed in P1's tests, not assumed.
- **The dial is already in the panel.** If the gate says grind rather than set-piece, the four density sliders take it down without a code change; the retune phase then bakes whatever Paul lands on.

---

## 5. Difficulty scaling across the game

```
occurrence = levelNumber / 3                      // 1st orbit level, 2nd, …
gapMult    = max(1.8, 2.5 − (occurrence − 1) × 0.1)
```

- Level 3 = occurrence 1 = 2.5×. The **1.8 floor is reached at occurrence 8 (level 24)** and holds through 63. At 1.8×, `minRequiredGap` = 46.8 px — comfortably above the additive floor (34 px).
- Tightening raises maxCounts, so satellite totals rise from **40 to 45** across the scaling range at fixed densities.
- **One variable scales.** Densities and both angular velocities stay fixed across occurrences (the handoff's own "change one variable at a time" rule). A density or velocity ramp is a future lever if the gate wants it.
- Registered in `DIFFICULTY-LEVERS.md` (FLAG-CS021-d). Consistent with the CS018 principle that the floor is a *fairness* clamp, deliberately reached mid-game rather than at 63.

---

## 6. Debug panel

New `{ header: "ORBIT" }` section in `DEBUG_VARS`, standard registry idiom (`def` derives from the shipped consts so panel and code cannot disagree):

| id | label | unit | min–max | step | notes |
|---|---|---|---|---|---|
| `orbitGapMult` | Orbit gap multiplier | — | 1.5–4.0 | 0.05 | overrides the occurrence-scaled value while ≠ def |
| `orbitSafetyMargin` | Orbit safety margin | px | 0–32 | 2 | |
| `orbitCount` | Orbit ring count | — | 3–5 | 1 | geometry-clamped, FLAG-CS021-a |
| `orbitDensity1`…`orbitDensity5` | Ring 1–5 density | — | 0–1 | 0.05 | first `orbitCount` consumed, FLAG-CS021-b |
| `orbitAngVel` | Orbit angular velocity | °/s | 0–60 | 0.5 | `toNative: v => v * Math.PI / 180` |
| `orbitFastMult` | Fast-ring multiplier | × | 1.0–6.0 | 0.1 | applied to `fastRingIndex` (ring 3) |

**Ten value entries: registry 34 → 44.** Persistence is the existing additive `afd_settings_v1.debug` path, known-value-else-default — **no schema bump, no new key, no frozen key touched**. `returnToDefaults()` continues to reset bindings only.

The live-registry count is pinned by **four** known test files (`test-cs018-p4.js` §H, `test-cs018-p6.js` §I, `test-cs018-p7.js` §H, `test-cs020-p1.js` TRAP 3) — all get the established repoint treatment: new count plus the ids that moved it. **Sweep for a fifth**; CS020 P1b found this surface wider than predicted.

Changed values take effect on the **next orbit level**, or immediately on the current one via reroll (FLAG-CS021-c). No mid-wave regeneration from slider drag.

---

## 7. What CS021 does NOT touch

- The field-level spawn loop, `junkCount`, `JUNK_CYCLE`, the 63-level table's existing columns.
- Hunters (frozen at level-1 speed/turn per CS018), coalescence, the SMD, the one-effort delivery rule, `cargoMax`/payload slots, scoring math.
- `VOICE_LINES` (FLAG-CS021-e); `MusicSys` beyond the existing per-wave intensity call.
- Frozen localStorage keys/schemas. `GDD-VERSION-HISTORY.md`, `archive/` (closing-phase append/move only).

---

## 8. Test plan (headless, `scratchpad/`, per-phase files)

Beyond per-phase source pins and behavioral drives, the changeset-level sweep, strengthened from the handoff's ask. For **every orbit level 3 → 63**, at shipped defaults *and* at both extremes of the gap-mult debug range:

1. Every ring: `actualGapPx ≥ shipDiameter × gapMult(level)` — the fairness floor, per level.
2. Every ring: `1 ≤ count ≤ maxCount`, and `maxCount ≥ 1` (the §1.1 guard never fires at shipped values).
3. Outermost satellite edge ≤ `WORLD_H/2 − 20` — the C3 failure can never regress in.
4. Inner ring vs. a wave-1 dock (radius 88): `innerRadius − satRadius ≥ dockRadius`.
5. Field levels: spawn path behaviorally identical (satellite count == `junkCount`, no orbit state on any satellite, `levelDef` unchanged in every other column).
6. Determinism: `rand()` stubbed, sweep run twice, byte-identical.
7. **Frame-budget probe (FLAG-CS021-h):** drive a level-3 orbit wave through real `update(1/60)` frames with progressive full harvest; record peak simultaneous entity count and per-frame update cost against a field-level control. Reported, not gated on a magic threshold — the number is what P4's retune argues from.
8. **Wrap correctness:** generate with the dock near a world edge; every satellite's toroidal distance to center equals its ring radius. Naive arithmetic must fail this if substituted.

If a fairness assertion fails, the scaling has passed the floor and the **clamp** is the fix — never the assertion.

---

## 9. Retirement ledger

Nothing retired. The field archetype and every CS018–CS020 mechanism remain shipped behavior. (The handoff's ES-module packaging and its size-derived radius defaults are retired *from the handoff* per §2 — they never enter the build.)

---

## 10. HUD delivery-combo readout (FORK-F → in scope, P4)

Closes **FLAG-CS020-i**, which CS020 deferred to CS021 by name.

**The gap:** `game.deliveryCount` has no HUD representation anywhere. It is visible only through floaters and Dan's line at the end of a haul. Since CS020 P1b the combo survives across trips within the one-effort window, which makes its invisibility worse — the player cannot see what they are protecting.

**The readout:** a HUD element showing the live effort, `deliveryCount / cargoMax`, drawn whenever `deliveryCount > 0`. It is a **display of existing state only** — no scoring, capping, or delivery logic is touched, and the readout must never become a second source of truth for the counter.

**Behavior it must show:** counts up as towed nodes offload; holds through the `DOCK_COMBO_GRACE` window while the ship is outside the ring; vanishes when the effort ends (towed hook outside the ring, window expiry, or ship death via `scatterChain`). Incidental offloads do not advance it (CS020 P1) and must not advance the readout.

**Open detail, P4's call within the established HUD idiom:** whether the grace window itself is indicated (e.g. the element dimming while the countdown runs). Ships as **plain, no countdown indicator** unless the gate asks for it — the readout's job is to make the number visible, and a timer visualization is a second feature.

**Placement/style:** follows the existing HUD's drawing conventions and color roles; no new HUD system, no layout reflow of existing elements.