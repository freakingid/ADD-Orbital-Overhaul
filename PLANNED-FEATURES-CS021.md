# PLANNED FEATURES — CS021

**Changeset:** CS021 — Orbit-level archetype ("orbit levels")
**Baseline:** CS020 complete, commit `41d6ea5`, `GAME_VERSION "1.0.0.21"` will ship from `"1.0.0.20"`.
**Source:** Paul's design handoff, "Orbit-Based Level Design — Implementation Handoff" (external conversation). This spec is that handoff **re-grounded against the real build**. Where the handoff and the build disagree, the build wins and the disagreement is recorded in §2 (Corrections) or §3 (Forks).

⛔ **THIS SPEC IS NOT IMPLEMENTATION-READY UNTIL EVERY FORK IN §3 IS RESOLVED.**
The handoff was written without codebase access and several of its premises are false in this game. The forks below are genuine design decisions, not paperwork.

---

## 1. The feature

A recurring level archetype. On designated levels, instead of the normal `nextWave()` scatter (junk-cycle count of size-3 `DebrisSatellite`s in a ring 260–640 px from the ship, each with linear drift), the level's satellites are arranged in **concentric rings around a hub**, with per-ring counts computed so the gaps between satellites are always wide enough for the ship to pass — tight enough to demand timing, never below a fairness floor.

Non-orbit levels keep their existing layout logic byte-untouched. The archetype is a **spawn arrangement + motion mode**, not an invincible wall: satellites remain ordinary `DebrisSatellite`s — shootable, breakable, harvestable. Eroding a lane by shooting is a legitimate strategy; the salvage loop is unchanged.

### 1.1 The core math (per ring)

```
circumference     = 2π × radius
minRequiredGap    = max(shipDiameter + safetyMargin, shipDiameter × minGapMultiplier)
spacePerSatellite = satelliteDiameter + minRequiredGap
maxCount          = floor(circumference / spacePerSatellite)
count             = clamp(round(1 + density × (maxCount − 1)), 1, maxCount)
```

Real numbers, from the shipped constants (grep-verified this session, `41d6ea5`):

| Symbol | Value | Source |
|---|---|---|
| shipDiameter | **26 px** | `SHIP_RADIUS = 13` |
| satellite dia, size 3 | **92 px** | `DEBRIS_RADII = {3:46, 2:26, 1:13}` |
| satellite dia, size 2 | **52 px** | same |
| minRequiredGap @ 2.5× | **65 px** | 26 × 2.5 beats 26 + 8 |
| minRequiredGap @ 1.8× floor | **46.8 px** | still beats 26 + 8 = 34 |
| dock radius, wave 1 | **up to 88 px** | `DOCK_RADIUS 44` × `LEVER_DOCK_SIZE` (2× at wave 1) |
| world | **2560 × 1440, wrapping** | `WORLD_W`/`WORLD_H` |

- **`minGapMultiplier` (default 2.5)** — the fairness floor. Below ~2.5× ship diameter, passage stops being skill and starts being pixel luck. Hard absolute floor **1.8** under difficulty scaling (§5).
- **`densityByOrbit`** — per-ring dial, 0 (sparsest) → 1 (tightest safe fit). Default curve is deliberately non-uniform (tight → breather → tight → wide → tightest) so the level has rhythm.
- **`startAngle` randomized per ring** so safe lanes never align as one straight radial path.
- **Guard the handoff omits:** if `maxCount < 1` for a ring (radius too small for even one satellite plus a fair gap), the ring is unfair *by construction* — skip it or widen it; never place `count = 1` with a negative computed gap. The generator must assert `maxCount ≥ 1` per ring.
- `actualGapPx = circumference/count − satelliteDiameter` is an **arc-length** figure; the straight-line gap is marginally smaller at low counts. Acceptable approximation at these radii; the headless sweep (§8) asserts against it with the floor already conservative.

### 1.2 Motion

The handoff says "wire higher angular velocity in wherever satellite rotation is already handled." **No such place exists.** `DebrisSatellite` motion is linear drift; the only rotation in the class is per-sprite spin. Orbit levels therefore need a new movement mode on `DebrisSatellite`: satellites carry `{orbitCenter, orbitRadius, orbitAngle, orbitAngVel}` and their update advances the angle and derives x/y — **wrap-aware** (`wrapPos` on the derived position; all distance math through the wrap helpers, per the standing rule). Motion fork details in FORK-CS021-C.

---

## 2. Corrections — where the handoff is wrong about this game

These are not forks. The build's contract or arithmetic settles each one.

**C1 — No ES module. Ever.** The handoff delivers the generator as an `export`ed module. `CLAUDE.md` and `EXTERNAL-FILES.md` are explicit: **all game logic lives in the one `<script>` block**; external runtime files carry data/assets only, load via classic `<script src>`, and must be non-essential. The generator is inlined as a plain function beside the other spawn logic. The `export` line is dropped. (The "no build step" lift in the memory of prior planning applies to *future games and data files*, not to logic in this build — the contract in `EXTERNAL-FILES.md` §1 is unambiguous.)

**C2 — There is no fixed central hub.** The handoff assumes a recycling hub at the center of the play area with the player flying outward. In the shipped game the world is a **2560×1440 torus**, the dock **relocates every wave** to 260–620 px from the ship (`class Dock`, `DOCK_MIN_DIST`/`DOCK_MAX_DIST`), and the ship is wherever the last wave left it. Orbit levels must *choose* a center — that's FORK-CS021-A. (The torus is homogeneous, so any center works geometrically as long as every placement and update goes through the wrap helpers.)

**C3 — The handoff's default radii are ~3.6× too big for the world.** With `satelliteDiameter = 92`: `ringSpacing = 92 × 6 = 552`, `startRadius = 92 × 4 = 368`, outermost of 5 rings = 368 + 4×552 = **2,576 px radius** — larger than the entire 2560-wide world, in a world whose largest wrap-clean circle is **~720 px radius** (half of `WORLD_H`). Even ring 2 (920 px) doesn't fit. The `satelliteDiameter × 6` / `× 4` derivations are dead on arrival; CS021 ships explicit radii chosen for fit (FORK-CS021-B carries the arithmetic).

**C4 — `DECISIONS.md` does not exist.** The handoff instructs updating it. This repo's continuity docs are `STATUS.md` (every phase), the GDD §2 (shipped behavior only, closing phase), `GDD-VERSION-HISTORY.md` (append-only, closing phase), and `DIFFICULTY-LEVERS.md` (living registry — and CS021 **does** touch it, see §5).

**C5 — "Fly from center outward, once" is not how this level will play.** The dock is the delivery target and the satellites are the salvage source. Whatever center is chosen, the player will thread the rings **repeatedly and in both directions** while hauling a physics-simulated tow chain — including on the way *in* with up to `cargoMax` canisters strung behind the ship. Effective difficulty is well above the handoff's one-pass mental model. This argues for erring sparse on first ship and tuning up, and it is why the debug knobs (§6) exist.

---

## 3. Fork ledger — ⛔ ALL UNRESOLVED, Paul's sign-off required

| Fork | Question | Options | Recommendation |
|---|---|---|---|
| **FORK-CS021-A** | Where is the hub, and where does the ship start? | **(a)** Rings center on the dock, wherever `Dock`'s normal placement puts it; ship stays where it is (it will land somewhere in or near the ring band, 260–620 px out). **(b)** On orbit levels only, dock placement overridden to sit at the ring center *and* ship is repositioned outside the outermost ring at wave start. **(c)** As (a), but with spawn-safety: any ring whose radius band contains the ship rerolls its `startAngle` until the nearest satellite clears the ship by ≥ `minRequiredGap`. | **(a)+(c)**. No teleporting the ship between waves (jarring, unprecedented in the build); dock code untouched; spawn-safety costs a bounded reroll loop. (b) is the handoff's fiction but the biggest behavioral change for the least gain. |
| **FORK-CS021-B** | Ring count × satellite tier — what actually fits? | With fairness gap 65 px, dock clearance (wave-1 dock radius 88 → inner radius ≥ ~180), and outermost satellite edge ≤ ~700 px: **(a)** **4 rings of size-3** (dia 92): radii 180/330/480/630, `spacePerSat` 157, maxCounts 7/13/19/25. **(b)** **5 rings of size-2** (dia 52): radii 180/300/420/540/660, `spacePerSat` 117, maxCounts 9/16/22/29/35. **(c)** Mixed: size-2 inner rings, size-3 outer. | **(a)**, 4 rings of size-3. Preserves the size-3 → size-2 → size-1 break chain (the whole salvage economy assumes size-3 spawns; see FORK-D totals). The 5-ring default density curve becomes a 4-entry curve: tight → breather → wide/fast → tightest, e.g. `[0.75, 0.45, 0.35, 0.85]`. |
| **FORK-CS021-C** | Do rings move, and what happens to children? | **(a)** Static rings (pure spatial puzzle; `startAngle` randomization is the whole variety). **(b)** Rings orbit slowly, one designated "sparse" ring markedly faster (the handoff's ring-4 trade of spatial tightness for timing pressure). Either way: when a satellite is shot, do children **(i)** inherit tangential velocity and go ballistic (ring erodes as harvested), or **(ii)** stay on-rail? | **(b) + (i)**. Static rings make `startAngle` a solved puzzle after one look; slow orbital motion is what makes threading a *timing* skill. Ballistic children keep `DebrisSatellite` split code byte-untouched (children just take vx/vy = tangent) and mean the arrangement naturally decays into a normal field as it's harvested — no special-case cleanup, no end-of-level rail bookkeeping. |
| **FORK-CS021-D** | Satellite totals vs. the difficulty table. | At default densities, option B(a) places **~36** size-3 satellites; B(b) places **~74** size-2. `levelDef().junkCount` maxes at **13**. Every size-3 breaks 3→2→1 into the full garbage cascade; garbage coalescence spawns Hunters. 36 size-3s is roughly **3–5× the garbage economy of the densest normal level**, with knock-on Hunter pressure, SMD availability, and score-ceiling effects. Options: **(a)** accept it — orbit levels are set-piece bonanzas. **(b)** scale the density curve down so totals land near ~2× junkCount (≈ 18–26 satellites). **(c)** replace only *some* of the level's satellites with rings and spawn the rest normally. | **(b)**. First ship should perturb the CS018 difficulty table as little as possible; the density curve is exactly the dial for it and it's live-tunable from the debug panel. (a) can be revisited at the playtest gate with data. |
| **FORK-CS021-E** | Which levels are orbit levels? | Handoff: every 3rd (3, 6, 9, … 63) = **21 of 63 levels — a third of the game**. Alternatives: **(a)** every 3rd as written. **(b)** fixed slots within each 21-level phase (e.g. rel ∈ {6, 13, 20} = 9 total), keeping the archetype special. **(c)** every 3rd but starting later (first at level 6 or 9), so the opening levels teach the normal loop first. | Surface only — this is pure game-design taste and Paul's call. Note: level 3 is the first `junkCount 9` level in the shipped cycle; making it also the first-ever orbit level front-loads two novelties. Whatever resolves, it lives in `levelDef()` as `archetype: "orbit" | "field"` so `game.wave` stays the **one difficulty clock** (CS018 P4 invariant). |
| **FORK-CS021-F** | Is FLAG-CS020-i (the HUD delivery-combo readout, explicitly deferred "CS021") in this changeset? | **(a)** Yes — small, orthogonal, one extra phase. **(b)** No — CS021 stays single-subject; the flag moves to CS022. | Surface only. The phases doc reserves an optional slot; nothing else in CS021 depends on it either way. |

### Flags (best-guess, review at planning sign-off or playtest)

| Flag | Note |
|---|---|
| **FLAG-CS021-a** | **`orbitCount` slider 3–7 cannot be honored as specced.** Seven rings do not fit the torus at any fair spacing (size-3: 180 + 6×150 = 1,080 px ≫ 720). Proposal: slider range **3–5**, and `radiusStep` auto-derived as `(maxOuterRadius − innerRadius) / (orbitCount − 1)` with a hard floor of `satelliteDiameter + 40` — if the floor can't be met, the count is clamped down and the panel shows the clamped value. |
| **FLAG-CS021-b** | **`densityByOrbit` is 5 sliders but ring count varies (3–5).** Store all 5, consume the first `orbitCount`. No dynamic slider count. |
| **FLAG-CS021-c** | **"Reroll start angles" button has no idiom to copy.** The debug panel is canvas-drawn, keyboard-driven, registry-derived rows — there are no buttons. Options: a new `{ action: … }` row kind in the `DEBUG_ROWS` machinery (more panel surgery), or a keybind active while the panel is open on an orbit level (cheap, zero registry impact). Proposal: **keybind**, documented on the panel footer. Reroll regenerates `startAngle`s only — counts, radii, densities untouched. |
| **FLAG-CS021-d** | **Difficulty scaling belongs in the lever registry.** The occurrence-scaled `minGapMultiplier` (§5) is a genuine difficulty lever and gets a row in `DIFFICULTY-LEVERS.md` (unlike CS020's `dockComboGrace`, which was a feel knob). |
| **FLAG-CS021-e** | **No voice lines in CS021.** An orbit-level announcement from Dan is tempting, but the voice-line gate is non-negotiable: ARPAbet strings must be composed and zero-error-verified by Paul in `tools/voice-robot-lab.html` first. The archetype ships silent; a line can land in any later changeset once validated. |
| **FLAG-CS021-f** | `Math.random()` (via `rand()`) is unseeded. The headless tests stub it deterministically, per the established pattern in the CS020 suite; the shipped game keeps `rand()`. |

---

## 4. The mechanism

### 4.1 The generator (inlined, adapted from the handoff)

The handoff's `generateOrbitLayout({satelliteDiameter, shipDiameter, centerX, centerY, orbitCount, innerRadius, radiusStep, safetyMargin, minGapMultiplier, densityByOrbit})` lands as a plain function in the `<script>` block, with these deltas from the handoff text:

1. `export` removed (C1).
2. The `satelliteDiameter × 6` / `× 4` default derivations removed (C3); `innerRadius`/`radiusStep` are required at the call site, computed per FLAG-CS021-a from the fit budget.
3. `satelliteDiameter` read from `DEBRIS_RADII[tier] * 2` at the call site — **never a new constant** (handoff requirement 3, kept).
4. Per-ring `maxCount ≥ 1` assertion (§1.1 guard).
5. Returned satellites carry `{angle, x, y}` **post-`wrapPos`**, plus the ring's `angVel` once FORK-C resolves.
6. `startAngle` uses `rand(0, angleStep)` (house helper), not raw `Math.random()`.

### 4.2 Wiring into `nextWave()`

`levelDef(n)` gains `archetype`. In `nextWave()`, after the dock is placed, the spawn block branches: `"field"` runs the existing loop **byte-untouched**; `"orbit"` calls the generator with the resolved-fork parameters and pushes one `DebrisSatellite` per returned satellite, in the orbit motion mode (FORK-C). `junkCount` is not consumed on orbit levels (FORK-D governs totals). Everything else in `nextWave()` — voice, music intensity, `cargoMax` grant, bonus-canister roll, stats — runs identically for both archetypes.

### 4.3 The motion mode

`DebrisSatellite` gains optional orbit state (absent on field levels — `undefined` fields, zero cost to the existing path). When present, `update(dt)` advances `orbitAngle += orbitAngVel * dt` and derives position around `orbitCenter` (wrap-aware). On split, children are constructed exactly as today with velocity set to the parent's instantaneous tangent (FORK-C(i)) — the split site itself does not change shape.

The dock relocates per wave, so `orbitCenter` is captured at generation and never re-read — if a future changeset ever moves the dock mid-wave, rings do not follow.

---

## 5. Difficulty scaling across the game

Orbit levels recur; each occurrence tightens. Per the handoff, adapted to the archetype schedule from FORK-E:

```
occurrence = ordinal of this orbit level among orbit levels (1st, 2nd, …)
gapMult    = max(1.8, 2.5 − (occurrence − 1) × 0.1)
```

- With every-3rd scheduling, the 1.8 floor is reached at occurrence 8 (level 24) and holds to 63. At 1.8×, `minRequiredGap` = 46.8 px — still comfortably above the additive floor (34 px) and above zero-skill territory.
- **One variable scales.** Density curves do **not** also scale per occurrence in CS021 — the handoff's own "change one variable at a time" rule. A density ramp is a future lever if playtests want it.
- The sparse ring's angular-velocity compensation (FORK-C(b)) is a fixed per-ring multiplier in CS021, not occurrence-scaled, same reasoning.
- Registered in `DIFFICULTY-LEVERS.md` (FLAG-CS021-d). Consistent with the CS018 principle that depth-difficulty reductions are acceptable if honest: the floor is a *fairness* clamp, deliberately reached mid-game.

---

## 6. Debug panel

New `{ header: "ORBIT" }` section in `DEBUG_VARS`, standard registry idiom (`def` derives from the shipped consts so panel and code cannot disagree):

| id | label | range | step | notes |
|---|---|---|---|---|
| `orbitGapMult` | Orbit gap multiplier | 1.5–4.0 | 0.1 | overrides the occurrence-scaled value while set ≠ def |
| `orbitSafetyMargin` | Orbit safety margin | 0–32 px | 2 | |
| `orbitCount` | Orbit ring count | 3–5 | 1 | clamped range per FLAG-CS021-a |
| `orbitDensity1`…`orbitDensity5` | Ring 1–5 density | 0–1 | 0.05 | first `orbitCount` consumed, per FLAG-CS021-b |

Eight value entries: registry **34 → 42**. Persistence is the existing additive `afd_settings_v1.debug` path, known-value-else-default — **no schema bump, no new key, no frozen key touched**. `returnToDefaults()` continues to reset bindings only. The live-registry count is pinned by **four** test files (`test-cs018-p4.js` §H, `test-cs018-p6.js` §I, `test-cs018-p7.js` §H, `test-cs020-p1.js` TRAP 3) — all four get the established repoint treatment: new count plus the ids of the entries that moved it. Reroll per FLAG-CS021-c.

Changed layout takes effect on the **next orbit level** (or via reroll on the current one); no mid-wave regeneration from slider drag.

---

## 7. What CS021 does NOT touch

- The field-level spawn loop, `junkCount`, `JUNK_CYCLE`, the 63-level table's existing columns.
- Hunters (frozen at level-1 speed/turn per CS018), coalescence, the SMD, the one-effort delivery rule, `cargoMax`/payload slots.
- `VOICE_LINES` (FLAG-CS021-e), `MusicSys` beyond the existing per-wave intensity call.
- Frozen localStorage keys/schemas. `GDD-VERSION-HISTORY.md`, `archive/` (closing phase append/move only, per convention).

## 8. Test plan (headless, `scratchpad/`, per-phase files)

Beyond per-phase source pins and behavioral drives (specced in the phases doc), the changeset-level sweep the handoff asks for, strengthened:

For **every orbit level from first occurrence through 63**, at shipped defaults *and* at both gap-mult extremes of the debug range:

1. Every ring: `actualGapPx ≥ shipDiameter × gapMult(level)` — the fairness floor, per level.
2. Every ring: `1 ≤ count ≤ maxCount`, and `maxCount ≥ 1` (the §1.1 guard never fires at shipped values).
3. Outermost satellite edge ≤ the wrap-clean budget (`WORLD_H/2 − margin`) — the C3 failure can never regress in.
4. Ring band vs. wave-1 dock radius (88): `innerRadius − satRadius ≥ dockRadius + clearance`.
5. Field levels: spawn path byte-identical behavior (satellite count == `junkCount`, no orbit state present).
6. Determinism: the sweep stubs `rand()` and runs twice, byte-identical.

If any assertion fails, the scaling has passed the fairness floor and needs clamping — the clamp is the fix, never the assertion.

## 9. Retirement ledger

Nothing retired. The field archetype and every CS018–CS020 mechanism remain shipped behavior. (The handoff's ES-module packaging and its default radius derivations are retired *from the handoff*, per §2 — they never enter the build.)