# IMPLEMENTATION PHASES — CS022

**Spec:** `PLANNED-FEATURES-CS022.md` (all forks resolved).
**Baseline:** local CS021 P5 commit, `GAME_VERSION "1.0.0.21"`. **The public repo is a phase behind** (`390bb9f`, `"1.0.0.20"`) — P5 is unpushed. Work from the local tree.
**Ships:** `"1.0.0.22"` (bumped in P4 only).

Four phases and one blocking playtest gate. One session per phase, one commit per phase, on `main`. Paul commits and pushes himself — Claude Code never pushes.

**Dependency order is strict.** P1 makes the world mutable; P2 fixes the geometry helper whose rule P3 depends on; P3 lands the ramp and does the single count-pin repoint sweep. Running P3 before P2 means repointing the same test files twice.

---

## Session preamble — paste before every phase prompt

> Read in full: `CLAUDE.md`, `STATUS.md`, `PLANNED-FEATURES-CS022.md`, and this phase's section of `IMPLEMENTATION-PHASES-CS022.md`.
>
> Grep only, by symbol name, never by line number — every anchor in the spec is an estimate from a CS021-P4 tree and has drifted: `asteroids-deluxe.html`, `ORBITAL-OVERHAUL-GDD.md` (§2.13, §2.13.1, §2.11 and the Architecture Map Constants row), `DIFFICULTY-LEVERS.md`.
>
> Do **not** read: `GDD-VERSION-HISTORY.md`, `archive/`, `PLANNED-FEATURES-CS021.md`, `IMPLEMENTATION-PHASES-CS021.md`, or any `tools/` file. They are context bloat and drift risk. `tools/orbit-lab.html` is a design instrument, not shipped code — it is never edited by a build session and never read for the real math.
>
> Measure the full test-suite baseline (file count, per-file stdout, exit codes) **before** editing anything, and re-run it twice consecutively after. Deliver tests with the code; a phase is not done until its own test file passes and the suite is green.
>
> If a genuine design decision surfaces that the spec does not cover, **stop and surface it** — flag it in `STATUS.md` and say so in your response. Do not invent design.

---

## Phase 1 — World size by archetype

**Goal:** make the torus period a function of the level's archetype, and move carried entities safely when it changes. No orbit-geometry change, no ramp, no constant retune.

**Model:** Opus 4.8, xhigh effort, thinking on. This is the phase where a wrong ordering decision is invisible until level 4.

### Paste-ready prompt

> Implement CS022 Phase 1 per `PLANNED-FEATURES-CS022.md` §4.1, §4.2, §4.3 and FORK-CS022-B/C/D. Scope is the world-size mechanism and carried-entity re-homing **only** — do not touch `ORBIT_*` constants, `generateOrbitLayout`, `levelDef`, or the orbit spawn path.
>
> 1. **Make the world mutable.** `WORLD_W`/`WORLD_H` become `let`. Add `WORLD_SIZE_FIELD = 4`, `WORLD_SIZE_ORBIT = 16`, `worldDims(size)`, and `worldSizeFor(level)` reading `levelDef(level).archetype`. Add `game.worldSize`, in **both** the `game` object literal and `startGame()`'s reset block — a field that lands in only one is `undefined` for a whole run (the CS016 P3 rule, recorded in STATUS.md's Known issues).
>
> 2. **`applyWorldSize(size)`** sets the dimensions, `game.worldSize`, and rebuilds the active starfield. It moves nothing.
>
> 3. **`resizeWorld(newSize)`** — the six steps in spec §4.2, in that order. The snapshot must use the OLD period and the placement the NEW one, so the two cannot be reordered around the dimension assignment. Clamp is `dmax = min(WORLD_W, WORLD_H)/2 − 60` on the new dimensions. The chain is translated by the ship's own delta, never scaled and never clamped, and each node's `px`/`py` shift by the identical delta so implied verlet velocity survives — this is `wrapNode`'s contract from v3.1 P2; assert it directly rather than assuming it.
>
> 4. **Wire into `nextWave()`** after `game.wave++` and **before** `game.dock = new Dock()`. Call `resizeWorld` only when the size actually changes.
>
> 5. **`startGame()` must reset the world to `WORLD_SIZE_FIELD` before `game.ship.reset()`** — otherwise a fresh run started after dying on an orbit level places the ship at the stale 5120-wide world's centre. TRAP: `Ship.reset()` reads `WORLD_W/2` directly.
>
> 6. **Starfield per spec §4.3 / FLAG-CS022-d.** Generate `stars` once at module load for the largest size in the table; `applyWorldSize` rebuilds a `starsActive` array filtered to the current world; `drawStarfield`'s far loop reads that. The near parallax layer is screen-space tiled and must not be touched at all.
>
> 7. **Fix `SPAWN_MAX_DIST`'s comment** (spec C5) — it names the 2560×1440 clamp. The constants themselves do not move.
>
> **Tests** — new `scratchpad/test-cs022-p1.js`, driving the REAL `startGame`/`nextWave`/`update(1/60)`/`resizeWorld`/`drawStarfield`, nothing reimplemented. Cover spec §8 items 4, 5, 6 in full, plus: a grow-then-shrink round trip returning `WORLD_W`/`WORLD_H` to exactly 2560/1440; a naive-`wrap()` control that must FAIL the bearing assertion; a resize with the ship near a world seam; and a resize with several hundred garbage bodies to prove nothing is lost or duplicated.
>
> **Repoints:** `test-v31-world.js` §A pins `WORLD_W === 2560` / `WORLD_H === 1440` as literals and §D pins the area-derived `STAR_COUNT` — both need repointing to the field-level values and the new max-size derivation. `test-cs018-p9.js:338` uses bare `2560`/`1440` in a wrap computation. **Sweep the whole suite rather than trusting this list** — 29 test files reference `WORLD_W`/`WORLD_H`, and any that compute from them at module scope now read a value that can change underneath.
>
> **TRAP 1:** `GAME_VERSION` stays `"1.0.0.21"` this phase. **TRAP 2:** the GDD, `GDD-VERSION-HISTORY.md` and `DIFFICULTY-LEVERS.md` are untouched — P4 owns all three. **TRAP 3:** do not change any `ORBIT_*` constant or the orbit spawn; at this phase an orbit level simply runs in a bigger world with its CS021 geometry, which is a valid intermediate state.
>
> ultrathink about step 3's ordering and about which module-scope values are now stale.

**Commit:** `CS022 P1: world size by archetype — mutable WORLD_W/H, resizeWorld with carried-entity re-homing, filtered starfield`

---

## Phase 2 — Geometry helper re-derivation

**Goal:** `orbitRadiusStepFor` holds the **step** fixed instead of the outer edge, and `orbitEffectiveCount`'s clamp becomes budget-derived instead of step-derived. Small, mechanical, and a precondition for P3's numbers meaning what the spec says.

**Model:** Sonnet 5, high effort.

### Paste-ready prompt

> Implement CS022 Phase 2 per `PLANNED-FEATURES-CS022.md` Correction C3, §6 and §9. Scope is two functions and their tests. Do **not** change any `ORBIT_*` constant value, the ramp, `levelDef`, or `nextWave` — those are P3.
>
> 1. **`orbitRadiusStepFor(count)`** returns `ORBIT_RADIUS_STEP` regardless of `count`. The ring spacing is the specified invariant; where the outer ring lands is the consequence, not the other way round. At the shipped `orbitCount` of 4 this is bit-identical to the current behaviour — verify that, do not assume it.
>
> 2. **`orbitEffectiveCount(requested)`** clamps against the **wrap-clean budget** instead of the step-pad floor: walk `count` down while `ORBIT_INNER_RADIUS + (count − 1) × ORBIT_RADIUS_STEP + DEBRIS_RADII[3] > WORLD_H/2 − 20`, evaluated against `worldDims(WORLD_SIZE_ORBIT)` — the size an orbit level actually runs at, **not** the live `WORLD_H`, which is 1440 whenever a field level is on screen and would clamp the knob to nonsense mid-run. This is the one place in the changeset where a world dimension must be read from the table rather than from the live variable; say so in a comment.
>
> 3. **`ORBIT_RADIUS_STEP_PAD` loses its only reader.** Leave it defined and mark it retired-with-no-readers, following the `DEBRIS_COUNT_MAX` precedent from CS018 P3. Grep-confirm zero remaining readers.
>
> **Tests** — new `scratchpad/test-cs022-p2.js`: `orbitRadiusStepFor` returns `ORBIT_RADIUS_STEP` at counts 1–5 and is bit-identical to the pre-P2 value at count 4; `orbitEffectiveCount` accepts every count whose outer edge fits the orbit-size budget and rejects the first that does not, at both the CS021 and CS022 geometries; `ORBIT_RADIUS_STEP_PAD` has zero readers.
>
> **Repoints:** `test-cs021-p3.js` §F pins `orbitRadiusStepFor(3) === 225` and the count-5 walk-down — both are now wrong. Repoint to the new rule with a note; do not weaken the count-4 bit-exactness claim, which still holds and is what protects P3's geometry.
>
> **TRAP:** `GAME_VERSION` unchanged; GDD / version history / difficulty levers untouched.

**Commit:** `CS022 P2: orbitRadiusStepFor holds the step fixed; orbitEffectiveCount clamps on the wrap-clean budget`

---

## Phase 3 — The ring ramp

**Goal:** the new geometry constants, the outermost-first ring ramp, the field component on orbit levels, and the frame-budget gate. The changeset's centre of gravity.

**Model:** Opus 4.8, xhigh effort, thinking on.

### Paste-ready prompt

> Implement CS022 Phase 3 per `PLANNED-FEATURES-CS022.md` §1.2, §1.3, §1.4, §4.4, §4.5, §4.6, §4.7 and FORK-CS022-E/F/G. This phase changes what an orbit level contains; P1 and P2 have already made the world and the geometry helper ready for it. Re-grep every P1/P2 anchor by symbol — both phases moved things.
>
> 1. **Constants.** `ORBIT_INNER_RADIUS` 180 → **460**, `ORBIT_RADIUS_STEP` 150 → **276**, `ORBIT_DENSITY` → **[0.75, 0.45, 0.35, 0.42]**. `ORBIT_RING_COUNT`, both gap-multiplier constants, `ORBIT_SAFETY_MARGIN` and all three motion constants are unchanged. Rewrite the block's comments: the fitted-radii paragraph now describes size 16 and the 1,334-vs-1,420 budget, and the density curve's "tight → breather → wide/fast → tightest" rhythm line is wrong after the halving (spec C7) — the curve now reads tight → breather → widest → wide.
>
> 2. **`generateOrbitLayout` gains `activeRings`** per spec §4.4 — optional, 0-based indices, skip **after** `radius` is computed and **before** `maxCount`, pushing `{index, radius}` to a NEW returned `inactive` array. Do not fold this into `rejected`: that array means "unfair by construction" and several tests read it with that meaning.
>
> 3. **`activeRingsFor(level)`** — a pure helper beside `orbitGapMult`, outermost-first, length `clamp(floor(level / ORBIT_LEVEL_EVERY), 1, effective ring count)`. It composes with the `orbitCount` debug knob rather than ignoring it (FLAG-CS022-h). No new constant, no new clock: occurrence is CS021 P2's existing derivation.
>
> 4. **`levelDef` gains `orbitRings` and `fieldCount`** per spec §4.5, both from the **unclamped** `n` like `archetype`. `fieldCount` calls `levelDef(n − 1)` — one level deep, terminating because `n − 1` is never an orbit level when `n` is. **TRAP (FLAG-CS022-e):** `test-cs018-p1.js` §B slices the `levelDef` block and evaluates it in a bare context with nothing else in scope. Verify the recursion survives that slice before you finish, exactly as `ORBIT_LEVEL_EVERY` had to be placed inside the block for the same reason.
>
> 5. **Extract `spawnFieldSatellites(n, speedMul)`** from `nextWave()`'s existing scatter loop, verbatim, and call it from **both** branches. `git diff -w` on the field branch must read as a pure extraction — pin that with a source assertion, not just by eye. Then wire the orbit branch per spec §4.6.
>
> 6. **`spawnOrbitWave` gains a third parameter**, `activeRings`, passed through to the generator. Keep the P2 seam intact: the generator stays pure and still knows nothing about occurrence.
>
> **Tests** — new `scratchpad/test-cs022-p3.js`, covering spec §8 items 1, 2, 3, 7, 8, 10, 11 in full. The load-bearing ones: the §4.7 table reproduced at **every** orbit level 3 → 63 by a real `nextWave()` spawn grouped by `orbitRadius`; ring 4's count asserted as exactly half its value under the old 0.85 density, **computed** against that density rather than restated as a literal; the field component equal to `levelDef(n − 1).junkCount` with every one of those satellites inside the real ship-relative spawn ring and carrying no orbit state; wrap correctness re-run at 5120×2880 with a naive-arithmetic control.
>
> **⛔ FRAME-BUDGET GATE (spec §8 item 9, FLAG-CS022-f).** At level 21 — the peak, 84 satellites — drive a real progressive full harvest and then a real death detonation. Gate on a **deterministic counter**: instrument `coalesceGarbage`'s inner-loop iteration count and assert the worst single frame stays under a ceiling you derive and document from the CS021 P1 §K measurement (1,233 standing canisters at 40 satellites, ~760k pair-checks). Wall time is GC-noisy in headless Node and is **reported, not asserted** — median, p95, p99, worst, plus peak simultaneous entities, in the CS021 §K table format. If the counter ceiling is breached, STOP and report rather than tuning around it: the density sliders are the first lever and a spatial hash for coalescence is a separate changeset.
>
> **Repoints — the single sweep for the whole changeset.** Five files compute orbit totals through an `orbitTotalAt` helper added in CS021 P2: `test-cs017-p1.js`, `test-cs017-p2.js`, `test-cs017-p3.js`, `test-cs018-p3.js`, `test-cs021-p1.js`. Every one now needs the ramp AND the field component, and each must compute its expectation from the same `generateOrbitLayout` + `activeRingsFor` + `levelDef` the shipped code uses — a wiring check, never a restated literal. Separately, `test-cs021-p1.js` §D and `test-cs017-p2.js` §B assert that orbit levels do NOT consume `junkCount`; those now assert the opposite (spec C6). **Sweep the whole suite rather than trusting this list.** CS020 P1b, CS021 P2 and CS021 P3 each found the surface wider than the phase doc predicted — three times running.
>
> **TRAP 1:** `GAME_VERSION` unchanged. **TRAP 2:** GDD / version history / difficulty levers untouched — P4 owns them. **TRAP 3:** do not add a debug knob for the ramp; the registry stays at 44 and no count pin moves.
>
> ultrathink about the `levelDef` recursion under the bare-context slice, and about the repoint sweep.

**Commit:** `CS022 P3: orbit ring ramp — 460/276 geometry, ring-4 density halved, outermost-first ramp, field component on orbit levels`

---

## ⛔ PLAYTEST GATE — blocking, P4 must not run until answered

Write answers into `STATUS.md`'s Playtest asks section before P4's session. P4 retunes from actual answers only, never an invented interpretation (the CS020 P2 precedent).

Play through at minimum levels 3, 6, 9 and 12 — one full pass of the ramp — and ideally one level past the 1.8 floor at 24.

1. **The ramp.** Does one ring at level 3, two at 6, three at 9, four at 12 read as the shell closing in, or as four unrelated levels? This is the whole bet of FORK-CS022-E.
2. **Level 3 specifically.** 22 satellites in one sparse outer shell plus 5 ordinary scatter, in a world four times today's. Does the shell read as a *place* — something you're inside — or as distant scenery you can ignore until the field is clear?
3. **The world change itself.** You cross from a normal level into one four times the size and back again, twice every three levels. Is the transition perceptible? Should it be? Right now nothing announces it.
4. **Carried junk after a transition (FLAG-CS022-k).** Fly an orbit level with a lot of standing garbage, clear it, and watch what the next field level looks like. Everything beyond 660 px got pulled to that radius along its own bearing — does that read as a shell of debris at arm's length, or as an obvious artefact? Does it trigger a wave of coalescence?
5. **Ring 4 after the halving (FLAG-CS022-c).** 276 px lanes where CS021 had 92. Too sparse to register as a ring at all?
6. **The fast ring at level 6 (FLAG-CS022-b).** Ring 3 is the first moving ring the player ever meets. Does motion arriving one occurrence late land as a second surprise, or just as inconsistency?
7. **Frame rate in a browser.** This is the one the headless gate cannot answer: `draw()` is not in the measured loop and `shadowBlur` scales with exactly these counts. Watch for hitching during a full harvest at level 21+, and especially at the moment of death on a part-harvested orbit level — that is where the standing-garbage peak lands.
8. **Everything CS021's gate never got to ask.** Q2–Q8 of that round are still open and are answerable for the first time: the shield bounce off a rail (`SHIELD_BOUNCE_RESTITUTION` 1.0, `SHIELD_BOUNCE_MIN` 120), `ORBIT_ANG_VEL` 6 °/s and `ORBIT_FAST_MULT` 3.0, inbound passes with a full tow, and whether the `COMBO n/N` readout reads at a glance mid-haul.

**The values P4 exists to carry:** the four densities, `ORBIT_ANG_VEL`, `ORBIT_FAST_MULT`, the two shield-bounce knobs, and — if the ramp's shape is wrong rather than its numbers — the ramp itself. All four densities and both velocities are live sliders in the hidden Debug panel's ORBIT section; retune in-session and report the numbers you landed on rather than a yes/no.

---

## Phase 4 — Retune, version bump, doc sweep

**Goal:** the closing phase. Carry the gate's numbers, bump the version, and move every doc to describe what shipped. No new logic.

**Model:** Sonnet 5, high effort.

### Paste-ready prompt

> Implement CS022 Phase 4 — the closing phase. **No new logic.** Read the gate answers in `STATUS.md`'s Playtest asks section and retune from those only; if an answer is "no change," change nothing. If an answer asks for something that is a FEATURE rather than a constant move, **surface it and stop** — that is what happened at CS021's own gate and it was the right call.
>
> 1. **Retune** whatever the gate settled: densities, `ORBIT_ANG_VEL`, `ORBIT_FAST_MULT`, `SHIELD_BOUNCE_RESTITUTION`, `SHIELD_BOUNCE_MIN`. Registry `def`s derive from the shipped consts, so a const move carries the knob automatically — verify, don't assume.
>
> 2. **`GAME_VERSION` `"1.0.0.21"` → `"1.0.0.22"`.** Grep the repo whole rather than trusting any list: CS021 P5 predicted eight-plus-four pins and found **eleven**, and CS020 P2 undercounted before it. Live pins that track HEAD get both their console label and their assert message bumped; this changeset's own test files get the standing mirror-image repoint (`assert GAME_VERSION !== "1.0.0.21"`) with a `REPOINTED BY CS022 P4` note. Leave historical header-comment narratives alone (the CS018 P10 / CS020 P2 precedent).
>
> 3. **GDD — shipped behaviour only.** A new **§2.11.1** for per-archetype world size: the two sizes, why field levels stay at 2560×1440 (spec C4 — the v3.1 P1 shrink was deliberate and asking 8a is still unanswered), the resize ordering inside `nextWave()`, the carried-entity re-homing rule and its clamp, and the starfield's generate-once-filter-per-world strategy. **§2.13.1** gains the ramp, the new geometry with the 1,334-vs-1,420 budget, the field component, and the halved ring 4. **§2.13**'s level-table bullets gain `orbitRings`/`fieldCount` and lose the "`junkCount` is not consumed on an orbit level" note (spec C6). Architecture Map: Constants row gains the `WORLD_SIZE_*` block and the retired `ORBIT_RADIUS_STEP_PAD`; Flow functions row gains `worldSizeFor`/`applyWorldSize`/`resizeWorld`/`activeRingsFor`/`spawnFieldSatellites`; game object row gains `game.worldSize`.
>
> 4. **Rewrite the threading language** (spec C1) in the `ORBIT_GAP_MULT` constants block, GDD §2.13.1 and the `DIFFICULTY-LEVERS.md` orbit row. The floor's job is "never a solid wall," not "always a passable lane for a skilled pilot." The arithmetic does not move.
>
> 5. **`DIFFICULTY-LEVERS.md`** — two new rows per spec §5 (orbit world size; orbit ring ramp), and the existing orbit-gap-multiplier row updated: totals go from "40 → 45" to the spec §4.7 table, and its gate-status clause finally records an answer.
>
> 6. **`GDD-VERSION-HISTORY.md`** — one consolidated CS022 (P1–P4) entry appended. Open only to append; never read for context.
>
> 7. **Also fix the doc debt CS021 P5 flagged and deliberately left:** the GDD's "Companion documents" block still describes the **v3.4** planning cycle as being built now and points at `PLANNED-FEATURES-v3.4.md`. It has been stale since at least CS009. Two lines, and this phase is already in that block.
>
> 8. **Archive check:** `PLANNED-FEATURES-CS021.md` and `IMPLEMENTATION-PHASES-CS021.md` move to `archive/` if Paul has not already done it. Verify first; do not move blind.
>
> Full regression run twice consecutively, diffed against the pre-phase baseline line by line — the only expected differences are the four files whose console output echoes the version string, plus the already-documented RNG/wall-clock noise files.

**Commit:** `CS022 P4: gate retune, version 1.0.0.22, GDD/levers/history sweep`

---

## Model and effort summary

| Phase | Model | Effort | Why |
|---|---|---|---|
| P1 | Opus 4.8 | xhigh + thinking + `ultrathink` | Ordering is invisible if wrong; 29 files touch `WORLD_*`; the re-homing pass is new physics-adjacent code |
| P2 | Sonnet 5 | high | Two functions, one rule change, one test repoint |
| P3 | Opus 4.8 | xhigh + thinking + `ultrathink` | The `levelDef` recursion under a bare-context slice, plus the widest repoint sweep in the changeset |
| P4 | Sonnet 5 | high | Mechanical, but the version-pin sweep has undercounted in three consecutive changesets — grep, don't trust |

`ultrathink` must appear inside the message text itself, not in a meta-note, to take effect.