# PLANNED FEATURES — CS022

**Changeset:** CS022 — Per-archetype world size + the orbit ring ramp
**Baseline:** CS021 complete, `GAME_VERSION "1.0.0.21"` → ships `"1.0.0.22"`.
**Baseline commit:** Paul's **local** CS021 P5 commit. The public repo HEAD is `390bb9f` at `"1.0.0.20"` — P5 is unpushed. Any session that re-clones from GitHub gets a P4 tree; work from the local one.
**Source:** CS021's playtest gate Q1 (the only answerable question in that round), plus Paul's ring-ramp design, both re-grounded against the real build. Where the request and the build disagree, the build wins and the disagreement is recorded in §2.

✅ **ALL FORKS RESOLVED** (§3). Implementation-ready.

---

## 1. The feature

Three changes that are one decision, and were settled as one.

### 1.1 World size is a function of the level's archetype

`WORLD_W`/`WORLD_H` stop being fixed. A **field** level runs in today's 2560×1440 torus (`size 4`); an **orbit** level runs in 5120×2880 (`size 16`). The world therefore resizes on every archetype transition — up at every 3rd level, back down at every level after one — 42 times across a 63-level run.

Size 16 is not a preference. Paul's ring spacing (§1.3) puts the outermost satellite edge at 1,334 px, and the largest wrap-clean circle in a world is `WORLD_H/2 − 20`. Size 4 allows 700, size 9 allows 1,060, size 16 allows 1,420. Four rings at this spacing fit only at size 16, and they fit from the **first** orbit level — the world size does not ramp even though the rings do.

### 1.2 The rings arrive one at a time, outermost first

Rather than all four rings appearing at level 3, one ring is added per occurrence of the archetype, from the outside in:

| Occurrence | Level | Rings present |
|---|---|---|
| 1 | 3 | ring 4 |
| 2 | 6 | rings 4, 3 |
| 3 | 9 | rings 4, 3, 2 |
| 4 | 12 | rings 4, 3, 2, 1 |
| 5+ | 15 … 63+ | all four, held |

Radii never move. Ring 4 sits at 1288 whether or not rings 1–3 exist; the ramp **selects** rings, it does not re-space them.

### 1.3 The shipped geometry

| Symbol | Value | Note |
|---|---|---|
| `ORBIT_INNER_RADIUS` | **460** | 5 × the 92 px large-satellite diameter, dock centre to ring 1 centre |
| `ORBIT_RADIUS_STEP` | **276** | 3 × 92 |
| `ORBIT_RING_COUNT` | 4 | unchanged |
| ring radii | 460 / 736 / 1012 / 1288 | outermost satellite edge **1,334 px** vs a 1,420 px budget |
| `ORBIT_DENSITY` | **[0.75, 0.45, 0.35, 0.42]** | ring 4's 0.85 → 0.42 (FORK-CS022-G) |
| radial corridor | 326 / 184 / 184 / 184 px | ring 1's figure is its clearance over the 88 px dock |
| `ORBIT_GAP_MULT` etc. | 2.5 / 1.8 / 0.1 / 8 | unchanged; the occurrence curve is untouched |
| `ORBIT_ANG_VEL` / `_FAST_MULT` / `_FAST_RING` | 6 °/s / 3.0 / 3 | unchanged, still first-pass, still gate material |

### 1.4 Orbit levels now carry a field component

An orbit level spawns, in addition to its rings, **the number of scatter satellites the previous level held** — `levelDef(n − 1).junkCount`. Since orbit levels are every 3rd, `n − 1` is never itself an orbit level, so this always reads a real field level's column. They spawn through the existing ship-relative scatter, byte-unchanged (FORK-CS022-F).

This **retires** CS021's rule that `junkCount` is not consumed on an orbit level (§2 C6). The orbit level's *own* `junkCount` column is now unread by the spawn path (FLAG-CS022-g).

### 1.5 Carried entities are re-placed, not teleported

`nextWave()` clears nothing — garbage, Hunters, saucers, powerups, the tow chain and the ship all cross every level boundary. Changing the torus period under them is the hard part of this changeset, and §4.2 is how it is handled.

### 1.6 The design frame

CS021's spec repeatedly justifies the fairness floor as a guarantee that a skilled pilot can *thread* the rings. That is not what this archetype is for. The satellites exist to be destroyed: the game's premise is that neglected orbital junk has consequences, and an orbit level is that premise made literal — a shell of accumulated debris around the one place that recycles it. The floor's real job is **"never a solid wall,"** not "always a passable lane." Every number below is chosen against that reading.

---

## 2. Corrections — where the request or the prior docs are wrong about this build

Each is settled by the build's own contract or arithmetic; none is a design choice.

**C1 — "Threading" was never the goal, and CS021's language should stop implying it was.** Spec CS021 §1.1/§5 and the `ORBIT_GAP_MULT` comment block both frame the floor as skill-vs-pixel-luck for a pilot flying through. Per §1.6 this is a misreading of the archetype. The arithmetic does not change — the floor stays 2.5 → 1.8 — but the rationale text in the constants block, the GDD §2.13.1 paragraph and the `DIFFICULTY-LEVERS.md` row are reworded in P4.

**C2 — The dock is 88 px at every wave, not "up to 88 at wave 1."** `LEVER_DOCK_SIZE` ships `enabled: false`, and `leverScale` returns `lever.start` (2.0) in that case — so `Dock.radius` is `DOCK_RADIUS × 2 = 88` at every level, permanently. CS021 §1.2's number is right; its stated reason ("2× at wave 1", implying a ramp down) is wrong. Ring 1's clearance is therefore a flat 460 − 46 − 88 = **326 px** at every occurrence.

**C3 — `orbitRadiusStepFor()` holds the wrong thing fixed.** It redistributes a *fixed outer radius* across `count − 1` gaps. Under CS022 the **step** is the invariant — 276 px is Paul's stated spacing, not an emergent consequence of where the outer ring lands. At the shipped `orbitCount` of 4 both formulas agree bit-for-bit; at a requested 3 the current one yields 414 px, which is not the specified spacing. P2 re-derives it.

**C4 — Size 9 is not untried territory; it is a reverted state.** The v1.2 world was 3840×2160 and v3.1 P1 deliberately shrank it to 2560×1440 (~44% of the area) because the larger world "left too much dead space between spawns." Playtest ask **8a** — does the smaller world feel right — has never been answered. This is precisely why CS022 keeps **field** levels at size 4 and only grows the world where the geometry forces it: `SPAWN_MIN/MAX_DIST` and `DOCK_MIN/MAX_DIST` are flat constants that do not scale with world size, so a field level in a bigger world plays identically and simply has more empty space in it — the exact defect v3.1 P1 removed.

**C5 — `SPAWN_MAX_DIST`'s comment is now wrong.** It names the clamp `min(WORLD_W,WORLD_H)/2 − 60 = 660` "for the 2560x1440 world". At size 16 that limit is 1,380. Both constants (640 / 620) clear either figure; only the comment moves.

**C6 — CS021's "`junkCount` is not consumed on an orbit level" is retired**, in the build, in the GDD §2.13 bullet, and in every test that asserts it (§8). Orbit levels now consume the **previous** level's column.

**C7 — `ORBIT_DENSITY`'s documented rhythm no longer describes the curve.** The constants block calls it "tight → breather → wide/fast → tightest." After the halving, ring 4's lane goes 92 → 276 px, making it the second-*widest* ring. The curve now reads tight → breather → widest → wide (FLAG-CS022-c).

**C8 — There is no world-boundary line to update.** The v2.1 dashed `WORLD_W × WORLD_H` seam rectangle (`drawWorldBoundary`, `BOUNDARY_*`) does not exist in this build — grep-confirmed, zero hits. Don't go looking for a consumer.

---

## 3. Fork ledger — ✅ ALL RESOLVED

| Fork | Question | **Resolution** |
|---|---|---|
| **FORK-CS022-A** | How is "5 large satellites out" measured? | **(a) centre-to-centre.** Ring 1 radius 460, step 276. The edge-to-edge readings (ring 1 at 548 or 594) put the outer edge at 1,422 or 1,744 — the first misses size 16 by 2 px, the second needs size 25. |
| **FORK-CS022-B** | General per-level size mechanism, or narrow fix? | **A general seam, two values wired.** `worldSizeFor(level)` returns from a small size table; only `field → 4` and `orbit → 16` are reachable today. The per-level scheme Paul floated for later becomes a data change, not a re-plumb. |
| **FORK-CS022-C** | Which levels get the big world? | **Archetype.** Not a level-table column. Field levels stay at 2560×1440 for the reason in C4. |
| **FORK-CS022-D** | Carried entities when the torus period changes | **(b) re-place relative to the ship, direction preserved, distance clamped.** Full mechanism in §4.2. Rejected: bare `wrap()` re-homing (a carried Hunter can materialise 200 px away on the shrink) and clearing the field at a transition (retires CS015 P3's carried-pressure design on 42 transitions). |
| **FORK-CS022-E** | Ring introduction order and pace | **Outermost first, one per occurrence, complete at occurrence 4 (level 12).** `activeRings = [3], [3,2], [3,2,1], [3,2,1,0]`. Occurrence is CS021 P2's existing `level / ORBIT_LEVEL_EVERY` — no second clock. |
| **FORK-CS022-F** | The field component on an orbit level | **`levelDef(n − 1).junkCount`, spawned through the existing scatter loop unchanged.** Ship-relative 220–640 px ring, same as a field level. |
| **FORK-CS022-G** | Ring 4's satellite count | **Halved.** `ORBIT_DENSITY[3]` 0.85 → **0.42**: 44 → 22 at level 3, 49 → 25 at the 1.8 floor — an exact halving at both ends. Peak level total 108 → 84. Taken on frame budget, not on fairness. |

### Flags (best-guess, review at the playtest gate)

| Flag | Note |
|---|---|
| **FLAG-CS022-a** | **Field satellites may spawn overlapping a ring satellite.** There is no debris-vs-debris collision pass anywhere in the build — debris meets only bullets, the ship and the chain — so the overlap is cosmetic and self-resolves as the ring rotates. No avoidance pass is specced. If it reads badly, a rejection-sample against the ring radii is the fix and it is a spawn-site change, not a geometry one. |
| **FLAG-CS022-b** | **There is no fast ring at occurrence 1.** `ORBIT_FAST_RING` is ring 3, which does not exist until level 6 — so level 3 is one slow shell and level 6 introduces motion as a second surprise. Emergent, not designed; Paul has confirmed he wants it kept. |
| **FLAG-CS022-c** | **Ring 4's character changed with the halving** (C7). It was the tightest ring at 92 px and the level's climax; it is now a sparse outer shell at 276 px. If the level wants a climax ring back, ring 1 at 101 px is the only tight one left and its density is a live slider. |
| **FLAG-CS022-d** | **Starfield strategy: generate once for the largest size, filter per world.** §4.3. Chosen over per-transition regeneration because it keeps the sky *stable* — a size-4 sky is literally a sub-region of the size-16 sky — and gets correct density for free from the uniform distribution. |
| **FLAG-CS022-e** | **`levelDef` calls itself once** to read `levelDef(n − 1).junkCount`. Terminating by construction (n − 1 is never an orbit level when n is). `test-cs018-p1.js` §B evaluates the `levelDef` block in a bare context — the phase must verify the recursion survives that slice, exactly as `ORBIT_LEVEL_EVERY` had to live inside the block for the same reason. |
| **FLAG-CS022-f** | **The frame-budget probe becomes a GATE, and gates on a deterministic work counter, not wall time.** CS021 reported-but-didn't-gate because headless Node timing is GC-noisy. Counting `coalesceGarbage`'s inner-loop iterations is machine-independent and is exactly the quantity at risk. Wall time is still reported. §8 item 9. |
| **FLAG-CS022-g** | **`logDifficultySnapshot` still reports `levelDef(n).junkCount` on orbit levels, and that number is now unread by the spawn.** Left as-is this changeset — the DiffLog column means "what the table says," and changing it would move a CSV schema several tests read. Worth a line in the GDD so a future reader isn't misled. |
| **FLAG-CS022-h** | **The ramp counts down from the *effective* ring count**, so a debug `orbitCount` of 3 gives `[2], [2,1], [2,1,0]` and completes at occurrence 3. The knob and the ramp compose rather than fighting; no new knob is added for the ramp itself. |
| **FLAG-CS022-i** | **No voice lines.** The gate is non-negotiable: ARPAbet must be composed and zero-error-verified in `tools/voice-robot-lab.html` first. A "the shell is closing" line for the ramp is tempting and can land later. |
| **FLAG-CS022-j** | **The ramp completes at level 12, which is exactly where `payloadSlots` maxes at 24.** Nobody designed this; it falls out. Full rings arrive the same level as full tow capacity. Worth preserving if either curve is ever retuned. |
| **FLAG-CS022-k** | **The shrink transition parks over-range carried bodies in a shell at exactly `dmax`.** §4.2. Monotone compression of the over-range band is the fix if it clumps visibly or triggers mass coalescence; it is a one-expression change at the same site. |

---

## 4. The mechanism

> Line numbers below are **estimates from a CS021-P4 tree** and drift between sessions. Re-grep every anchor by symbol name before editing.

### 4.1 World size (≈ the `WORLD_W` declaration, line 102, and `nextWave`, ≈ line 5290)

```
const VIEW_W = 1280, VIEW_H = 720;        // unchanged
const WORLD_SIZE_FIELD = 4;               // 2560 x 1440 — today's world
const WORLD_SIZE_ORBIT  = 16;             // 5120 x 2880 — what four rings at 276 px spacing need
let   WORLD_W = 2560, WORLD_H = 1440;     // was const

function worldDims(size)     { const k = Math.sqrt(size); return [VIEW_W * k, VIEW_H * k]; }
function worldSizeFor(level) { return levelDef(level).archetype === "orbit" ? WORLD_SIZE_ORBIT : WORLD_SIZE_FIELD; }
```

`applyWorldSize(size)` sets `WORLD_W`/`WORLD_H`, `game.worldSize`, and rebuilds the active starfield (§4.3). It does **not** move anything — that is `resizeWorld`'s job.

**Ordering inside `nextWave()` is load-bearing.** The resize must run *after* `game.wave++` (so `worldSizeFor` reads the new level) and *before* `game.dock = new Dock()` (dock placement is ship-relative and wrap-aware, so it needs the new period). The re-homing pass measures with the **old** period and places with the **new** one, so it straddles the assignment and cannot be split.

`game.worldSize` is a new field and goes in **both** the `game` object literal and `startGame()`'s reset — the standing rule from CS016 P3, recorded in STATUS.md's Known issues, is that a field landing in only one of the two is `undefined` for a whole run.

### 4.2 Carried-entity re-homing (FORK-CS022-D)

`resizeWorld(newSize)`:

1. **Snapshot**, using the current (old) `WORLD_W`/`WORLD_H`, each carried body's wrap-aware offset from the ship via `shortDelta`. Bodies: `game.debris`, `game.hunters`, `game.saucers`, `game.garbage`, `game.powerups`, `game.particles`, `game.floaters`.
2. **Apply** the new dimensions.
3. **Centre the ship** at `WORLD_W/2, WORLD_H/2`. Absolute world coordinates are imperceptible — the camera follows the ship and the only absolute reference, the starfield, is being rebuilt in the same call — and centring guarantees maximum clearance in the new world in both directions.
4. **Re-place each body** at `wrapPos(centre + offset)`, where the offset keeps its **bearing** exactly and its **magnitude** is `min(d, dmax)` with `dmax = min(WORLD_W, WORLD_H)/2 − 60` — the same clamp v3.1 P1 derived for spawn rings, for the same reason. On the grow transition almost nothing is clamped (old max reach 1,468 px against a new 1,380 px limit). On the shrink transition a great deal is, and it is pulled *along its own bearing to the edge of the new world* rather than teleported by one period. See FLAG-CS022-k.
5. **Translate the chain** by the same delta the ship moved — never scaled, never clamped, because a chain is rigid relative to the ship. Each node's `px`/`py` shift by the **identical** delta as its `x`/`y` so implied verlet velocity survives the move; this is `wrapNode`'s own contract from v3.1 P2 and the phase must assert it directly rather than assume it.
6. **Sync the camera** to the ship, so a draw landing between the resize and the next update can't show a stale view.

Orbit satellites are not a special case here: an archetype transition always destroys the previous level's rings (wave-clear requires debris to reach zero), so there is never a live `orbitCenter` to re-home.

### 4.3 Starfield (FLAG-CS022-d)

`STAR_COUNT`, `stars` and `starsNear` are currently `const`, populated by top-level loops. `stars` is generated **once**, at module load, for the largest world size in the table (`STAR_DENSITY × 16 = 1,280` far stars over 5120×2880). `applyWorldSize` rebuilds a `starsActive` array holding those stars with `x < WORLD_W && y < WORLD_H`; `drawStarfield`'s far loop iterates that instead.

Because the distribution is uniform, the size-4 subset is ~320 stars — exactly the area-derived count — so on-screen density is preserved with no scaling, and the sky is *stable* across transitions rather than re-rolling every level. The filter runs once per transition, not per frame.

The **near parallax layer is untouched**: it is screen-space tiled at `VIEW_W × VIEW_H` and has no world dependency at all.

### 4.4 The generator gains a ring filter

`generateOrbitLayout` takes one new optional field, `activeRings` (array of 0-based indices; absent or `null` = all). The skip happens **after** `radius` is computed and **before** `maxCount`, so an inactive ring's radius is still known:

```
const radius = innerRadius + i * radiusStep;
if (activeRings && activeRings.indexOf(i) === -1) { inactive.push({ index: i, radius }); continue; }
```

`inactive` is a **new** returned array, deliberately not folded into the existing `rejected` — `rejected` means "this ring is unfair by construction" and several tests read it with that meaning. `radius`, `density`, `angVel` and `fastRingIndex` all keep their original indices, so ring 4 is ring 4 whether or not rings 1–3 exist.

`activeRingsFor(level)` is a pure helper beside `orbitGapMult`:

```
occurrence = level / ORBIT_LEVEL_EVERY
n          = clamp(floor(occurrence), 1, effective ring count)
returns    = [count-1, count-2, … ] taking n entries   // outermost first
```

### 4.5 `levelDef` gains two columns

```
orbitRings: archetype === "orbit" ? Math.min(n / ORBIT_LEVEL_EVERY, ORBIT_RING_COUNT) : 0,
fieldCount: archetype === "orbit" ? levelDef(n - 1).junkCount : junkCount,
```

Both derive from the **unclamped** `n`, like `archetype` and `level` — the every-3rd rhythm has to keep going past the level-63 plateau. `levelDef(Infinity)` still yields `archetype: "field"` (`NaN % 3 !== 0`), so the recursion is never entered at the extreme. Past level 63 the internal `L` clamp means `fieldCount` is always `levelDef(63).junkCount` = 13, consistent with the plateau.

### 4.6 `nextWave()` wiring

The existing scatter body is extracted verbatim into `spawnFieldSatellites(n, speedMul)` and called from **both** branches — `git diff -w` on the field branch should read as a pure extraction, and a source pin proves it. The orbit branch becomes:

```
game.orbitLayout = spawnOrbitWave(speedMul, orbitEffectiveGapMult(game.wave), activeRingsFor(game.wave));
spawnFieldSatellites(levelDef(game.wave).fieldCount, speedMul);
```

Everything else in `nextWave()` — voice, music intensity, `cargoMax`, the bonus-canister roll, stats, `logDifficultySnapshot` — runs identically for both archetypes, unchanged.

### 4.7 Living with the totals

| Level | Occ | gapMult | Rings | Orbit | Field | **Total** | Lanes (px) |
|---|---|---|---|---|---|---|---|
| 3 | 1 | 2.5 | r4 | 22 | 5 | **27** | 276 |
| 6 | 2 | 2.4 | r3,4 | 37 | 3 | **40** | 332 / 276 |
| 9 | 3 | 2.3 | r2,3,4 | 52 | 13 | **65** | 238 / 332 / 260 |
| 12 | 4 | 2.2 | all | 67 | 9 | **76** | 101 / 238 / 332 / 260 |
| 15 | 5 | 2.1 | all | 70 | 5 | **75** | 101 / 216 / 305 / 245 |
| 18 | 6 | 2.0 | all | 70 | 3 | **73** | 101 / 216 / 305 / 245 |
| 21 | 7 | 1.9 | all | 71 | 13 | **84** | 101 / 216 / 305 / 232 |
| 24 + | 8+ | 1.8 | all | 71 | 3–13 | **74–84** | 101 / 216 / 305 / 232 |

From level 24 the orbit half is frozen at 71 and the total simply breathes with the junk cycle — 74 / 76 / 80 / 84 — inheriting the same 4-level rhythm field levels have. **Peak is 84**, at levels 21, 30, 42, 51 and 63 (each preceded by a `junkCount 13` level).

- **Level 3 is 27 satellites against a shipped field level's 9.** Three times a normal level, but well under CS021's flat 40, and it is one slow shell around an otherwise ordinary level.
- **Frame budget.** Extrapolating CS021 P1 §K's measured figures (1,233 standing canisters at the death-detonation peak on 40 satellites), 84 projects to ~2,590 canisters and ~3.4M `coalesceGarbage` pair-checks per frame — roughly 2.7× the case CS021 measured, down from 7× before the halving. This is what §8 item 9 gates.
- **The dial is already in the panel.** All four densities are live sliders from CS021 P3. If the gate says grind, no code changes.

---

## 5. Difficulty scaling across the game

Two new registry rows in `DIFFICULTY-LEVERS.md`, plus a correction to an existing one.

- **Orbit world size** — archetype-keyed, not ramped. `worldSizeFor(game.wave)` via `levelDef().archetype`. Still a pure function of `game.wave`, so the one-clock rule holds. Binary: 4 on field levels, 16 on orbit levels, at every depth.
- **Orbit ring ramp** — occurrence-scaled, same coarse tick of `game.wave` that CS021 P2 introduced. 1 ring at occurrence 1 → 4 at occurrence 4 (level 12), held through 63 and past the plateau. **This is the changeset's main escalation curve.**
- **Orbit gap multiplier** (existing row) — the curve itself is untouched at 2.5 → 1.8. Its satellite-total figures change from "40 → 45" to the §4.7 table, its rationale text loses the threading framing per C1, and its "still unanswered in the hands" note stands until the CS022 gate closes.

Consistent with CS018: one variable scales per mechanism. Densities and both angular velocities stay fixed across occurrences; the ramp is what moves.

---

## 6. Debug panel

**No new registry entries.** The registry stays at 44 and no test's count pin moves — the ramp is derived, not dialled, and its one composable input (`orbitCount`) already exists (FLAG-CS022-h).

Two existing entries change behaviour without changing shape:

- `orbitCount` — its `clampShown` floor is re-derived against the new step (P2). At 460/276 the fixed-step rule gives 276 px at every count, which clears the 132 px `ORBIT_RADIUS_STEP_PAD` floor at 3, 4 **and 5** — so a requested 5 no longer walks back down. Ring 5 would sit at 1,564 with an edge at 1,610, past the 1,420 budget, so the clamp must now be **budget-derived rather than step-derived**. This is a real change of rule, not a re-tuned constant.
- `orbitDensity4` — its `def` follows `ORBIT_DENSITY[3]` to 0.42 automatically (the registry derives `def` from the shipped const, which is exactly why that convention exists).

---

## 7. What CS022 does NOT touch

- The field-level spawn path (extracted, not modified — provable by `git diff -w`), `JUNK_CYCLE`, `PHASE_LEN`, `LEVEL_MAX`, or any existing level-table column.
- `SPAWN_MIN/MAX_DIST`, `DOCK_MIN/MAX_DIST` — flat constants, unchanged at 220/640 and 260/620, and they clear the size-16 clamp (1,380) as easily as the size-4 one (660). Only C5's comment moves.
- Hunters (frozen at level-1 speed/turn per CS018), coalescence rules, the SMD, the one-effort delivery rule, `cargoMax`/`payloadSlots`, scoring, the HUD.
- The near parallax starfield layer; `MusicSys` beyond the existing per-wave intensity call; `VOICE_LINES` (FLAG-CS022-i).
- The three frozen `localStorage` keys and their schemas. `GDD-VERSION-HISTORY.md` and `archive/` (closing-phase append/move only).
- The occurrence curve's arithmetic (2.5 → 1.8 at 0.1/occurrence, floor at level 24).

---

## 8. Test plan (headless, `scratchpad/`, per-phase files)

Beyond per-phase source pins and behavioural drives:

1. **The ramp table.** Every orbit level 3 → 63 reproduces §4.7 exactly, via a **real `nextWave()` spawn** grouped by `orbitRadius`, not only via the pure generator. Ring identity asserted by radius, not by array position.
2. **The field component.** At every orbit level, satellites carrying no orbit state number exactly `levelDef(n − 1).junkCount`, and every one of them lands in `[SPAWN_MIN_DIST, SPAWN_MAX_DIST]` of the ship by the real wrap-aware `dist2`.
3. **The halving, pinned both ways.** Ring 4's count is exactly half its value under `ORBIT_DENSITY[3] = 0.85` at level 3 (22 vs 44) and at the floor (25 vs 49) — computed against the old density, not restated as a literal, so a future density retune fails loudly rather than silently.
4. **World size.** `WORLD_W`/`WORLD_H` are 5120/2880 on every orbit level and 2560/1440 on every field level, driven through real `nextWave()` transitions. A grow-then-shrink round trip returns them to **exactly** 2560/1440 — no accumulated drift.
5. **Re-homing.** Across a real transition in both directions: every carried body's bearing from the ship is preserved to float epsilon; its distance is `min(oldDistance, dmax)`; no body ends outside the new world after `wrapPos`. Every chain node's `x − px` and `y − py` are **bit-identical** before and after (implied velocity survives). A naive-`wrap()` control must fail this.
6. **Starfield.** The active star count equals the area-derived value for the current world at both sizes; the size-4 active set is a strict **subset** of the size-16 set (sky stability); the near layer's arrays are untouched by any resize.
7. **Geometry guards, at the orbit world size.** Outermost satellite edge ≤ `WORLD_H/2 − 20` at every occurrence; every ring's `actualGapPx ≥ shipDiameter × gapMult(level)`; `1 ≤ count ≤ maxCount`; ring 1's clearance over an 88 px dock ≥ 0. The C3 failure can never regress in.
8. **Wrap correctness at 5120×2880.** CS021 §8 item 8 re-run at the new period with docks at edges and corners: every satellite's toroidal distance to centre equals its ring radius, with a naive-arithmetic control that would be off by thousands of px.
9. **⛔ FRAME-BUDGET GATE (FLAG-CS022-f).** At level 21 (the peak), drive a real progressive full harvest and then a real death detonation. Gate on a **deterministic counter** — `coalesceGarbage`'s inner-loop iterations in the worst single frame — with a hard ceiling, since headless wall time is GC-noisy and machine-dependent. Report median/p95/p99/worst `update(dt)` and peak simultaneous entities alongside, as CS021 did. If the counter ceiling is breached, the changeset does not proceed to the gate: the density sliders are the first lever, a spatial hash for coalescence is the second and is its own changeset.
10. **Field levels untouched.** All 42 of them spawn exactly `junkCount`, carry no orbit state, run at 2560×1440, and are behaviourally identical to the pre-CS022 build.
11. **Determinism.** `rand()` stubbed per the CS020/CS021 suite pattern; the full sweep run twice, byte-identical.

**The repoint surface is known and wide.** Five files compute orbit totals via an `orbitTotalAt` helper added in CS021 P2 (`test-cs017-p1.js`, `-p2`, `-p3`, `test-cs018-p3.js`, `test-cs021-p1.js`) — every one now needs the ramp *and* the field component. `test-cs021-p1.js` §D and `test-cs017-p2.js` §B assert orbit levels do **not** consume `junkCount` and now assert the opposite. `test-v31-world.js` §A asserts `WORLD_W === 2560` as a literal and §D asserts the area-derived `STAR_COUNT`; `test-cs018-p9.js:338` uses bare `2560`/`1440` in a wrap computation. **Sweep the whole suite rather than trusting this list** — CS020 P1b and CS021 P2/P3 each found the surface wider than predicted, three times running.

---

## 9. Retirement ledger

- **CS021's "`junkCount` is not consumed on an orbit level"** — retired (C6). The rule, its GDD bullet, and its assertions.
- **`orbitRadiusStepFor`'s fixed-outer-edge derivation** — retired (C3), replaced by fixed-step. The function survives; its rule does not.
- **`orbitEffectiveCount`'s step-derived clamp** — retired (§6), replaced by a budget-derived one. At 276 px spacing the step floor no longer binds at any count, so the padding constant `ORBIT_RADIUS_STEP_PAD` loses its only reader and becomes historical.
- **The threading rationale** (C1) — retired as *language*, in the constants block, GDD §2.13.1 and the `DIFFICULTY-LEVERS.md` row. No arithmetic changes.
- **`WORLD_W`/`WORLD_H` as compile-time constants** — retired. Anything that cached a value derived from them at module load is now a bug; `STAR_COUNT` was the only one and §4.3 handles it.

Nothing else. Every CS018–CS021 mechanism remains shipped behaviour.