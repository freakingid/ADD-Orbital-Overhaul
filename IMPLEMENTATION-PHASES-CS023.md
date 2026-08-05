# IMPLEMENTATION PHASES — CS023

**Spec:** `PLANNED-FEATURES-CS023.md` — ✅ all forks resolved. Implementation-ready.
**Baseline:** public repo HEAD `6654ef6`, `GAME_VERSION "1.0.0.22"`. CS022 is fully shipped and pushed; the attached build is byte-identical to HEAD.
**Ships:** `"1.0.0.23"` (bumped in P5 only).

> **AMENDED 2026-08-05, after P4 shipped and before the gate:** FORK-H was resolved the wrong way. **The drift runs on every level, not orbit levels only.** Corrected by **Phase 4b** below, which runs before the playtest gate. P4's prompt is left intact as the historical record of what was built; do not re-run it.

Five phases and one blocking playtest gate. One session per phase, one commit per phase, on `main`. Paul commits and pushes himself — Claude Code never pushes.

**Dependency order is strict.**

- **P1 before everything.** It cuts the shell 5× (84 peak → 16), and that is what makes two new collision passes affordable. Running the collision work first means gating the frame budget against a load that is about to disappear.
- **P2 before P3 and P4.** Both consume `debrisBounce()`: P3's UFO rule bounces the satellite off the dying saucer, and P4's drift is disarmed inside the same helper.
- **P4 after P2**, because two of the drift's four release conditions live in `debrisBounce` and the other two are `destroyDebris`'s existing behaviour. P4 adds one line to P2's helper rather than a parallel system.
- **P4 also depends on P1's fast-ring list**, because the drift's speed cap is derived by scanning every ring's `angVel × radius` (spec C14).
- **One repoint sweep, in P1.** Roughly fourteen test files pin the orbit geometry or the world size and eleven reference the ramp; those sets overlap almost completely. Splitting the geometry retune from the ramp inversion means repointing the same files twice.

---

## Setup step — Paul, before P1's session

1. Archive the spent round: `git mv PLANNED-FEATURES-CS022.md IMPLEMENTATION-PHASES-CS022.md archive/`.
2. Commit `PLANNED-FEATURES-CS023.md` and `IMPLEMENTATION-PHASES-CS023.md` to the repo root.

---

## Session preamble — paste before every phase prompt

> Read in full: `CLAUDE.md`, `STATUS.md`, `PLANNED-FEATURES-CS023.md`, and this phase's section of `IMPLEMENTATION-PHASES-CS023.md`.
>
> Grep only, by symbol name, never by line number — every anchor in the spec is an estimate from commit `6654ef6` and drifts the moment a phase lands: `asteroids-deluxe.html`, `ORBITAL-OVERHAUL-GDD.md` (§2.11.1, §2.13, §2.13.1, §3.1 and the Architecture Map rows), `DIFFICULTY-LEVERS.md`.
>
> Do **not** read: `GDD-VERSION-HISTORY.md`, `archive/` (including `archive/STATUS-HISTORY.md` and the CS022 planning docs), or any `tools/` file. They are context bloat and drift risk. `tools/orbit-lab.html` is a design instrument, not shipped code — it is never edited by a build session and never read for the real math; the numbers it produced are already in the spec, and its per-level totals are wrong by construction (spec C4).
>
> Measure the full test-suite baseline (file count, per-file stdout, exit codes) **before** editing anything, and re-run it twice consecutively after. Deliver tests with the code; a phase is not done until its own file passes and the suite is green.
>
> If a genuine design decision surfaces that the spec does not cover, **stop and surface it** — flag it in `STATUS.md` and say so in your response. Do not invent design.

---

## Phase 1 — Geometry, world size, and the inverted ramp

**Goal:** the new orbit shell — smaller world, tighter rings, flat density, a fast-ring *list*, and a ramp that fills from the inside out. One sweep for the whole changeset's geometry pins. No new mechanics.

**Model:** Opus 4.8, xhigh effort, thinking on.

### Paste-ready prompt

> Implement CS023 Phase 1 per `PLANNED-FEATURES-CS023.md` §1.3, §1.4, §4.1, §4.2 and Corrections C2/C3/C4/C5/C6/C7/C8, with FORK-CS023-A and FORK-CS023-G resolved. Scope is constants, the generator's fast-ring test, the ramp direction, and the repoint sweep. Do **not** add any collision pass, bounce helper, drift field or debug knob — those are P2/P3/P4.
>
> 1. **World size.** `WORLD_SIZE_ORBIT` **16 → 9**. Nothing else in the world-size mechanism moves: `WORLD_SIZE_MAX` is derived via `Math.max` and follows, and `STAR_COUNT` is area-derived from it and follows (1280 → 720; active-at-field-size stays ~320). **Verify both, do not assume them** — and fix `resizeWorld`'s stale grow comment per spec C7: `dmax` at the orbit size is now **1,020 px**, not 1,380, so a materially larger band of carried bodies clamps on the grow and FLAG-CS022-k's `dmax` shell applies in both directions.
>
> 2. **Geometry constants.** `ORBIT_INNER_RADIUS` 460 → **400**, `ORBIT_RADIUS_STEP` 276 → **138**, `ORBIT_DENSITY` → **`[0.12, 0.12, 0.12, 0.12]`**. Rings land at 400/538/676/814, outer satellite edge **860 px** against the size-9 wrap-clean budget of **1,060 px**. Rewrite the fitted-radii comment paragraph around those numbers, and **delete** the density block's "tight → breather → widest → wide" rhythm sentence rather than amending it — there is no rhythm at a flat curve.
>
> 3. **State the corridor fact explicitly in the constants block.** Ring 1 clears the permanent 88 px dock by **266 px**; the inter-ring radial corridor is **46 px** (138 step − 92 px satellite diameter). That corridor is *narrower than the 65 px in-ring fairness floor*, and this is correct, not a bug: `minRequiredGap` has only ever governed tangential lanes between adjacent satellites in one ring. Nobody had to notice at a 276 px step. Say so, so the next reader does not "fix" it.
>
> 4. **`ORBIT_FAST_RING` becomes a list** (spec C3): `3` → **`[2, 4]`**, human 1-based ring numbers, **any length**. One consumer — `spawnOrbitWave`'s `fastRingIndex: ORBIT_FAST_RING - 1`. Convert to a 0-based index list and **rename the generator's parameter to `fastRingIndices`** so the plural is visible at both ends; `generateOrbitLayout`'s `i === fastRingIndex` becomes membership. Rings 2 and 4 spin at `ORBIT_ANG_VEL × ORBIT_FAST_MULT`; rings 1 and 3 do not. **Handle a list of any length including empty** — arbitrary-length support is the point of the type change, and P4's speed cap depends on it (spec C14).
>
> 5. **Invert the ramp** (FORK-CS023-A). In `activeRingsFor`, the fill loop pushes `i` instead of `count - 1 - i` — **innermost first**: `[0]`, `[0,1]`, `[0,1,2]`, `[0,1,2,3]`, complete at occurrence 4 (level 12). That is the entire code change. Everything else about the helper stays correct by construction, including how it composes with the `orbitCount` debug knob (FLAG-CS022-h) and `levelDef`'s `orbitRings` **count** column, which is untouched.
>
>    Two comment obligations, both larger than the code. **(a)** The helper's rationale block argues outermost-first throughout and needs rewriting, not editing. **(b)** CS022 P3's note that *"a ring's array position in `layout.rings` is no longer its ring index"* is now **false** — innermost-first makes position and index agree again. Correct it at **both** its sites and say why, because a future reader finding two contradictory notes will trust the wrong one.
>
> 6. **Record the C5 finding in the `ORBIT_GAP_MULT` comment block.** At density 0.12 the occurrence curve buys **one satellite in the whole game** (ring 2, occurrence 3): the full shell is 15 satellites at levels 3–6 and 16 from level 9 through 63. The mechanism still runs and is no longer observable — and the ramp inversion is now what carries escalation (ring count 1 → 4 across levels 3–12). Do not delete the curve; state it, so a future reader neither retunes a silent lever nor deletes a working one.
>
> **Tests** — new `scratchpad/test-cs023-p1.js` covering spec §6 items 1, 2, 3, 4, 5, 19, 20. Load-bearing: the §1.4 table reproduced by a **real** `nextWave()` at every orbit level 3 → 63, grouped by `orbitRadius` and never by array position, with the rings present always the **innermost** *n* and ring 1 always among them; totals 3/6/11/16 at occurrences 1–4; the counts computed through the generator with C5's single-satellite step at occurrence 3 asserted as the only density-driven change across the whole curve; the fast-ring set keyed by ring index at every occurrence, **including the occurrences where no fast ring is present yet**, and with lists of length 0, 1, 3 and 4 all handled in a sandbox.
>
> **Assert the ramp direction behaviourally, not with a source regex** (spec §6 item 5): level 3 lays exactly one ring at `ORBIT_INNER_RADIUS`, while a pinned-SHA CS022 reference module lays one ring at `ORBIT_INNER_RADIUS + 3 × ORBIT_RADIUS_STEP` from the same call. Also assert `layout.rings[k].index === k` at every occurrence — the fact §1.4 says reverses the CS022 P3 known issue.
>
> **Repoints — the single sweep for the whole changeset.** Ten files hardcode `5120`/`2880` (`test-cs017-p5`, `test-cs020-p1`, `test-cs020-p1b`, `test-cs021-p1`, `test-cs021-p1b`, `test-cs021-p2`, `test-cs022-p1`, `test-cs022-p3`, `test-f5`, `test-v31-world`); seven pin `WORLD_SIZE_ORBIT`; eleven reference `activeRingsFor`; four reference `orbitRings`; two pin `STAR_COUNT`. **Sweep the whole suite rather than trusting those lists** — CS020 P1b, CS021 P2, CS021 P3 and CS022 P3 each found the surface wider than the phase doc predicted, four rounds running.
>
> Two standing traps from CS022's Known issues apply directly. **(a)** Every test file's `WORLD_W`/`WORLD_H` is a load-time snapshot of the FIELD size; anything needing the live period reads `worldDims(game.worldSize)`. **(b)** Files that derive "the first FULL-RAMP level" from `activeRingsFor()` rather than hardcoding 12 still work and must be preserved — but **any test that staged at level 3 expecting the OUTERMOST ring is now silently wrong in the opposite direction**, and CS022 P3's own Known-issues entry about level-3 staging needs re-reading with the sign flipped.
>
> **TRAP 1:** `GAME_VERSION` stays `"1.0.0.22"`. **TRAP 2:** the GDD, `GDD-VERSION-HISTORY.md` and `DIFFICULTY-LEVERS.md` are untouched — P5 owns all three. **TRAP 3:** the registry stays at **44**; no knob is added or removed this phase. **TRAP 4:** `orbitGapMult`, `ORBIT_GAP_MULT_FLOOR`, `ORBIT_GAP_MULT_STEP`, `ORBIT_SAFETY_MARGIN`, `ORBIT_ANG_VEL`, `ORBIT_FAST_MULT`, `ORBIT_SPAWN_TRIES`, `levelDef` in its entirety, and `WORLD_SIZE_FIELD` do not move. Field levels must come out byte-identical — pin that behaviourally against a pre-P1 build under one seed, not by eye.
>
> ultrathink about the repoint sweep and about which pins are stale versus which are silently measuring the wrong thing.

**Commit:** `CS023 P1: orbit shell retune — size-9 world, 400/138 geometry, flat 0.12 density, fast-ring list, ramp inverted innermost-first`

---

## Phase 2 — The bounce primitive and the satellite↔satellite pass

**Goal:** satellites stop passing through each other. One helper, one pass, one mass table, one frame-budget gate. The changeset's new physics.

**Model:** Opus 4.8, xhigh effort, thinking on.

### Paste-ready prompt

> Implement CS023 Phase 2 per `PLANNED-FEATURES-CS023.md` §1.2, §4.4, §4.5, §4.8 and FORK-CS023-D. Scope is the bounce helper, the debris-vs-debris pass and its constants. Do **not** touch the ship, saucer or drift paths — those are P3 and P4.
>
> 1. **Constants** per spec §4.8: `DEBRIS_MASS = { 3: 9, 2: 3, 1: 1 }` (mass conserved through the 3-way split the game already performs), `DEBRIS_BOUNCE_RESTITUTION = 1.0`, `DEBRIS_BOUNCE_MIN = 40`. Grouped with the other `DEBRIS_*` tuning constants, never inline.
>
> 2. **`debrisBounce(a, b)`** — a sibling of `shieldBounce`, placed immediately after it, and **derived from it rather than re-derived from scratch**. Three cases dispatched on rail state, per spec §4.4: free/free is a mass-weighted elastic exchange along the contact normal; free/rail-borne is `shieldBounce`'s exact shape with the free body in the ship's role (reflect its approaching component *in the rail body's frame*, apply the separation floor, push it out of overlap, `wrap()` it) and the rail body **completely untouched**; rail/rail is a no-op.
>
>    Read `shieldBounce` before writing this and keep its structure visible. Its three load-bearing properties carry over verbatim and for the same reasons: only the **approaching** component is reflected (a body already separating is never yanked backwards); the separation floor is applied **last** and is not optional (reflection alone leaves two touching stationary bodies touching, which is the exact case this exists to fix); and every measurement is wrap-aware — `angleTo` for the normal, `dist2` for the test, `wrap()` after the push. On an orbit level the rings straddle the seam routinely, so naive subtraction is not a theoretical risk here.
>
> 3. **The pass** per spec §4.5 — the `coalesceGarbage` pair-walk idiom, `i` / `j = i+1`, live array (nothing is created or destroyed here), placed after the hazards-vs-chain scan and before `--- Cleanup ---`.
>
> 4. **Leave one seam for P4.** P4 clears a `drifting` flag on any body this helper touches, which is where two of the four drift-release conditions live. Do not stub the field or the flag; just structure the helper so a single clear-on-contact line drops in at the top, and say so in a comment.
>
> **Tests** — new `scratchpad/test-cs023-p2.js` covering spec §6 items 9, 10, 18, 19, 20. State the physics as physics, not as restated code: over ≥40 incoming velocities per case, momentum conserved at the `DEBRIS_MASS` ratios, kinetic energy conserved at restitution 1.0 and strictly decreasing below it, a separating body never reversed, and separation achieved within one frame in every case. Carry a **naive non-wrap normal as a live control** that must fail at the seam. For the asymmetry: drive a free satellite into a rail-borne one for 300 real frames and assert twelve fields of the rail body byte-identical throughout with its distance to `orbitCenter` never leaving `orbitRadius`.
>
> **Assert ring-vs-ring is unreachable** (spec C11) by sweeping every adjacent-ring satellite pair at every occurrence and showing minimum separation is 46 px — do not assert it as a comment. Note in the file that CS023 keeps this true, because P4's drift moves only free bodies and never re-radiuses a rail.
>
> **⛔ FRAME-BUDGET GATE (spec §6 item 18).** This is the build's **second** O(n²) pass. At level 21 with the full shell plus field component, drive a real progressive full harvest and count **both** the debris pair-checks and `coalesceGarbage`'s inner-loop iterations, in an instrumented copy of the real source, one increment per site. **Derive both ceilings before measuring** and document the derivation from CS022 P3's 49,203-check measurement and the entity-count ratio. Wall time (median/p95/p99/worst) and peak simultaneous entities are **reported, not asserted** — headless Node timing is GC-noisy, which is exactly why CS022 P3 gated on a counter. If a ceiling is breached, **stop and report** rather than tuning around it: the four density sliders are the first lever, and a spatial hash is its own changeset with an 8.27M-check justification already on file.
>
> **TRAP 1:** `GAME_VERSION` unchanged; docs untouched. **TRAP 2:** garbage canisters do **not** bounce — `coalesceGarbage` and the whole `Garbage` system are out of scope, and conflating the two is how the pass becomes unaffordable. **TRAP 3:** no ship path, no saucer path, no `damageShip` call. **TRAP 4:** the registry stays at 44; `debrisBounceRestitution` is P4's knob, not this phase's.
>
> ultrathink about the free/rail asymmetry and about deriving the two counter ceilings before you measure them.

**Commit:** `CS023 P2: satellite-vs-satellite elastic bounce — debrisBounce primitive, mass-weighted, rails authoritative`

---

## Phase 3 — Mutual collision damage: ship rams and UFO impacts

**Goal:** a collision hurts both sides, and scores nothing. Small, mechanical, and entirely dependent on P2's helper.

**Model:** Sonnet 5, high effort.

### Paste-ready prompt

> Implement CS023 Phase 3 per `PLANNED-FEATURES-CS023.md` §1.1, §4.3, §4.6, Correction C13 and FORK-CS023-E/F. Re-grep every P1/P2 anchor by symbol — both phases moved things.
>
> **Read Correction C13 first; it is what makes this phase four one-liners instead of a redesign.** `awardScore = false` already means *no score and no achievement counters, but every drop still happens* — `destroyDebris(a, false)` still emits canisters and splits; `destroyHunter(h, false)` still drops canisters, splits three ways, and **still drops a powerup at the large tier**, because that `dropPowerup` call sits deliberately outside the gate. FORK-E (rams score nothing) and FORK-F (a satellite-killed UFO still drops a powerup) are therefore **the same existing rule**, applied at four new sites.
>
> 1. **Ship ↔ hazard, unshielded only.** In `update()`'s *"Collisions: hazards vs ship"* block, inside the existing `else` branch, destroy the hazard after the `damageShip` call: `destroyHunter(h, false)` for a Hunter, `destroyDebris(h, false)` otherwise. The saucer sub-loop takes the matching `destroySaucer(s, false)` in its own `else`.
>
>    Three properties must survive, all already true and all easy to break: the `hazards` array stays a **spread copy** so split children pushed during iteration are not visited this frame; the loop **does not gain a `break`** (that is what lets a shielded ship deflect every overlapping hazard, and shielded behaviour is out of scope); and `h.dead` stays checked at the top of each iteration.
>
> 2. **`damageShip` is called first**, because it reads `h.x`/`h.y` for the knockback vector.
>
> 3. **The kill is NOT gated on `damageShip`'s return** (FLAG-CS023-k). An auto-shield save returns `false` and the collision still physically happened. The rate limiter is the i-frame: the whole pass is gated on `game.ship.invuln <= 0`, so it can fire at most once per `HIT_STUN_DURATION`.
>
> 4. **UFO ↔ debris** per spec §4.6, a new pass beside P2's. On overlap: `destroySaucer(s, false)`, then `debrisBounce(a, s)` — the saucer is a free body (it never wraps and dies on travel), so a rail-borne satellite is untouched and a free one is knocked off course. `break` out of the inner loop; one saucer dies once.
>
> 5. **`destroySaucer` gains `awardScore = true`**, gating `addScore` and both achievement counters — **and nothing else.** `dropPowerup` stays unconditional. That is what makes FORK-F true and what keeps the function's contract byte-for-byte identical in meaning to `destroyHunter`'s; writing it any other way would make one member of a three-function family mean something different from its siblings. Its two existing callers pass nothing and must be byte-unchanged.
>
> 6. **Do NOT build "UFO shots damage satellites" — it already exists** (spec C1, confirmed). `update()`'s last collision pass already calls `destroyDebris(a, false)` on every hostile-bullet/debris overlap with no score, which is exactly what was requested. Pin it as a regression instead.
>
> **Tests** — new `scratchpad/test-cs023-p3.js` covering spec §6 items 6, 7, 8, 11, 12, 19, 20. Load-bearing: all three ram targets driven for real with **`game.score` unchanged and every relevant achievement counter unchanged** (FORK-E), while the canisters, the splits, the large Hunter's powerup and the UFO's powerup **all still appear** (C13 / FORK-F); a **shielded** ram producing byte-identical outcomes to a pinned pre-CS023 build (spec C10 — this is the assertion that catches a scope leak); a ram during i-frames doing nothing at all; three satellites overlapping on one frame all destroyed with exactly **one** `damageShip` application and `dmgThisWave` incremented **once**; the auto-shield case destroying the hazard while the hull does not move; a control proving the bullet and shield kills still award score and stats.
>
> **TRAP 1:** `GAME_VERSION` unchanged; docs untouched. **TRAP 2:** no shielded-path edit of any kind — `shieldDeflect`, `shieldBounce`, the homing-Hunter shield kill and `SHIELD_HIT_COST` are frozen. **TRAP 3:** the chain is untouched; satellites gain no new way to cut a tow. **TRAP 4:** registry stays at 44. **TRAP 5:** do not "tidy" `destroyHunter` by moving its large-tier `dropPowerup` inside the `awardScore` gate — that placement is load-bearing and C13 depends on it.

**Commit:** `CS023 P3: mutual collision damage — ship rams and satellite impacts destroy their target, no score, drops unchanged`

---

## Phase 4 — The inward drift

> ⚠️ **SUPERSEDED IN PART BY PHASE 4B.** This prompt shipped with `game.orbitLayout === null` as an early return, scoping the drift to orbit levels. That was wrong (spec C15). The text below is preserved as the record of what was built; **P4b is the correction and is the one to run.**

**Goal:** once the shell's interior is clear, loose debris is pulled back toward the ring-3 radius — no faster than a satellite moves on the outer fast ring — so the player is never hunting an empty world.

**Model:** Opus 4.8, xhigh effort, thinking on.

### Paste-ready prompt

> Implement CS023 Phase 4 per `PLANNED-FEATURES-CS023.md` §1.5, §4.7, §4.8, Correction C14 and FORK-CS023-B/C/H. Re-grep every anchor by symbol; P1–P3 have all moved things.
>
> **Read §4.7 before anything else and note what this is NOT.** It never reads or writes `orbitCenter`/`orbitRadius`/`orbitAngle`/`orbitAngVel`, never touches `game.orbitLayout`, and never moves a body that is on a rail. Orbiting satellites participate in the trigger and in nothing else. The ring radii are used purely as **reference distances**. The purpose, in Paul's words, is that once satellites get sparse they should be moved into an area of interest for the player, rather than leaving the player hunting a large level for something to shoot.
>
> 1. **Two derived radii and one guessed acceleration** per §4.7. `ORBIT_GRAVITY_TRIGGER_R` and `ORBIT_GRAVITY_TARGET_R` are **derived** from `ORBIT_INNER_RADIUS` + a multiple of `ORBIT_RADIUS_STEP` — never written as 814 and 676 — so a future geometry retune carries them. `ORBIT_GRAVITY_ACCEL` is 30 px/s² and is the one guess left (FLAG-CS023-d). `DebrisSatellite` gains **`drifting`**, absent/false by default, the same optional-field idiom as `orbitCenter`.
>
> 2. **`maxOrbitSpeed()` — the cap, and it must SCAN EVERY RING.** The inward speed is capped at the fastest tangential speed any satellite reaches on a rail: `max` over rings of `angVel × radius`. At the shipped `ORBIT_FAST_RING = [2, 4]` that is ring 4 at **255.7 px/s** — but the outermost ring is *not* always the fastest, because `angVel` is not uniform: at a list of `[1, 2]` the maximum falls on ring 2 (169.0 px/s), not on ring 4's 85.2 (spec C14). **A "just use the outer ring" shortcut is a latent bug the moment the list changes, and P1 just made the list arbitrary-length.** Read the live `DEBUG.orbitAngVel` / `DEBUG.orbitFastMult` / `DEBUG.orbitCount` so a gate retune carries the cap, and call it **once per frame**, not once per body.
>
> 3. **The arming pass**, once per frame in `update()`, after the entity updates and before the collision passes. Early-return on `game.orbitLayout === null` (FORK-CS023-H — orbit levels only for now). If **any** live debris — orbiting or free (FLAG-CS023-a) — is within `ORBIT_GRAVITY_TRIGGER_R` of `game.dock`, return. Otherwise arm every live debris body that has **no orbit state** and is **beyond `ORBIT_GRAVITY_TARGET_R`**. Wrap-aware `dist2` throughout; a ring straddling the seam is the normal case, not the edge case.
>
> 4. **The force is an acceleration added to `vx`/`vy`**, never a velocity override — the piece keeps its own drift and has the pull bent into it. Flat, no falloff, no damping, unlike the Magnet (FLAG-CS023-e): a proximity ramp would make the far pieces this mechanic exists for the slowest to arrive. The **cap bounds it instead**, and the cap applies to the **inward radial component only** — project the velocity onto the toward-dock unit vector, and if that component exceeds the cap, subtract the excess along that axis. Tangential motion is the body's own drift and is untouched, so total speed may legitimately exceed the cap when the tangential part warrants it.
>
> 5. **Release is per-piece and keeps the velocity.** A piece inside `ORBIT_GRAVITY_TARGET_R` clears `drifting` and coasts on with everything it accumulated. It does **not** stop, park, or join a ring — what arrives is a loose moving population, which is the whole point, and because the cap held on the way in, nothing arrives faster than something the player has already had to read on a rail.
>
> 6. **Disarm on contact, in `debrisBounce`.** One line at the top of P2's helper clears `drifting` on both bodies. That covers two of Paul's four interrupts (satellite contact, UFO contact); the other two (player shot, ship ram) need **no code at all** — both destroy the body, and `destroyDebris`'s children are fresh objects with `drifting` absent (FLAG-CS023-c). Verify that third claim rather than assuming it.
>
> 7. **Two debug knobs, APPENDED after the existing ORBIT entries** (FLAG-CS023-o): `orbitGravityAccel` (def `ORBIT_GRAVITY_ACCEL`, 0–200, step 5) and `debrisBounceRestitution` (def `DEBRIS_BOUNCE_RESTITUTION`, 0–1.5, step 0.05). `def` derives from the shipped const as every ORBIT entry already does. **Append, never insert** — order fixes each knob's row index. Registry **44 → 46**; two files pin the count and both move. **No knob for the cap** — it is derived from three knobs that already exist.
>
> **Tests** — new `scratchpad/test-cs023-p4.js` covering spec §6 items 13, 14, 15, 16, 17, 19, 20. Load-bearing: with one ring satellite alive inside the trigger radius nothing is armed, and destroying it arms every free body beyond the target radius on the very next frame and nothing inside it; rail-borne bodies **never** armed regardless of distance; the inward velocity component increasing by exactly `DEBUG.orbitGravityAccel × dt` per frame measured along the wrap-aware dock vector, then **plateauing at `maxOrbitSpeed()` and never exceeding it**, over a fall long enough to reach it (≈8.5 s / 1,090 px at the shipped values); a tangentially-moving piece proving the cap clamps the *radial* component only; a piece released at the target keeping its accumulated speed, that speed being ≤ the cap.
>
> **The cap's derivation gets its own section**, because it is the assertion a plausible-looking mutant fails: `maxOrbitSpeed()` equals the max over rings of `angVel × radius` at `[2, 4]` (ring 4, 255.7) **and, in a sandbox with `ORBIT_FAST_RING = [1, 2]`, equals ring 2's 169.0 rather than the outermost ring's 85.2**. Moving `DEBUG.orbitAngVel` or `DEBUG.orbitFastMult` moves the cap. Both radii asserted as *derived* from `ORBIT_INNER_RADIUS`/`ORBIT_RADIUS_STEP` — a source pin plus a behavioural one that moves `ORBIT_RADIUS_STEP` in a sandbox and shows both follow.
>
> **Edge cases that must not throw or dangle:** `game.dock` is re-created by every `nextWave()`, so assert the force follows the new dock and no piece keeps a stale centre; an armed piece carried through a real `resizeWorld` shrink keeps `drifting` and re-homes with the rest; an armed piece that is scooped, coalesced or destroyed leaves nothing behind; a split child of an armed parent is **not** armed; a seam-straddling case with a naive-arithmetic control that would push the wrong way.
>
> **TRAP 1:** `GAME_VERSION` unchanged; docs untouched — P5 owns them. **TRAP 2:** no rail is read or written. If you find yourself reaching for `orbitRadius` outside `maxOrbitSpeed()`'s ring scan, re-read §4.7 — the mechanic is about free bodies and the ring radii are just numbers. **TRAP 3:** Hunters do not drift; they home. Garbage canisters do not drift; they coalesce. Only `game.debris` is in scope. **TRAP 4:** the wave-clear condition is untouched — a drifting piece is still debris and still dies to one bullet.
>
> ultrathink about the arm/release lifecycle and about the cap's ring scan.

**Commit:** `CS023 P4: inward drift — loose debris pulled back to the ring-3 radius, capped at the fastest orbital speed`

---

## Phase 4b — The drift is not orbit-only

**Goal:** remove the archetype gate P4 shipped, and rename the constants that caused it. Small, surgical, and it must land **before** the playtest gate — otherwise 42 of 63 levels get judged with the mechanic switched off.

**Model:** Sonnet 5, high effort.

### Paste-ready prompt

> Implement CS023 Phase 4b per `PLANNED-FEATURES-CS023.md` Correction **C15** and the re-resolved **FORK-CS023-H**. This is a correction to P4, which shipped the drift scoped to orbit levels. It should not be scoped at all.
>
> **The mechanic is about distance from the dock, not about archetype.** The ring radii were only ever a convenient way to name 814 px and 676 px — they supply the numbers, they do not scope the behaviour. Re-grep every P4 anchor by symbol before editing.
>
> 1. **Delete the archetype gate** from the arming pass — the `game.orbitLayout === null` early return goes. `update()` already early-returns unless `game.state === "playing"`, and `game.dock` is created by every `nextWave()`, so there is no title-screen or null-dock path to worry about; a defensive `if (!game.dock) return;` is in-idiom and free. Nothing else in the pass changes: same trigger radius, same target radius, same "any live debris, orbiting or free" trigger population, same sticky per-piece arming, same disarm sites. On a field level no body ever carries orbit state, so the "no orbit state" clause is simply always true there.
>
> 2. **Rename the constants** — `ORBIT_GRAVITY_TRIGGER_R` / `ORBIT_GRAVITY_TARGET_R` / `ORBIT_GRAVITY_ACCEL` become `DEBRIS_DRIFT_TRIGGER_R` / `DEBRIS_DRIFT_TARGET_R` / `DEBRIS_DRIFT_ACCEL`. **Keep the derivation from `ORBIT_INNER_RADIUS` + a multiple of `ORBIT_RADIUS_STEP`** — that is where the numbers legitimately come from, and it is how they stay in step with a geometry retune. Add the comment that says so explicitly, because the `ORBIT_` prefix is what made a universal mechanic read as archetype-scoped once already and a comment is cheaper than a second occurrence.
>
> 3. **Rename the debug knob id** `orbitGravityAccel` → `debrisDriftAccel`, label "Debris inward drift". **Leave it physically where it is**, appended inside the ORBIT block: moving it would insert mid-registry and shift every row index below, which is exactly what append-only discipline prevents. Add a one-line comment recording that the position is a layout artefact, not a scoping claim. The registry count stays **46**.
>
>    Note the one real cost, and do not try to avoid it: renaming the id orphans whatever value is saved under the old key in `afd_settings_v1.debug`. Under the standing known-value-else-default rule the unknown key is ignored and the new one takes its default — one slider resets once. **No migration, no schema bump, no compatibility shim.**
>
> 4. **`maxOrbitSpeed()` is unchanged and keeps its name.** It genuinely is a statement about orbital speeds — the cap's whole justification is "no faster than a satellite moves on a rail" — and it returns the same 255.7 px/s on every level because it reads constants, not the live layout. **Do not add a field-level variant.** On a field level the longest possible armed fall is 792 px, worth ~218 px/s, so the cap simply never binds there (C15); that is the correct behaviour, not a gap.
>
> **Tests** — extend `scratchpad/test-cs023-p4.js` rather than adding a new file; this is a correction to P4, not a new feature, and splitting it would leave the wrong assertions sitting in the older file.
>
> **The critical work is INVERTING P4's existing field-level assertions, not appending new ones.** P4's file asserts that the pass is inert on a field level. That assertion is now backwards and will pass for the wrong reason if it is merely deleted. Find it, invert it, and leave a `CORRECTED BY CS023 P4B` note beside it — the standing repoint idiom. Then prove on a **real field level**, driven through `startGame` and `nextWave` and not staged by hand: nothing armed while any live debris sits inside 814 px of the dock; every free body beyond 676 px armed on the frame after the last inside-body dies; the same radii as on an orbit level; arrival, release and all four disarm paths behaving identically; **and the cap never binding across the longest fall the field world permits.**
>
> Also assert there is **no reachable reference to `game.orbitLayout`** anywhere in the drift path, and that the three renamed constants have zero readers under their old names.
>
> **TRAP 1:** `GAME_VERSION` unchanged; docs untouched — P5 owns them, and its prompt already carries this correction. **TRAP 2:** the registry count stays 46 and no entry moves position. **TRAP 3:** do not "simplify" by folding the trigger and target radii into literals now that they are not orbit-named — the derivation is the point. **TRAP 4:** nothing about P1, P2 or P3 is in scope; this is one deleted gate, three renamed constants, one renamed knob id, and a set of inverted assertions.

**Commit:** `CS023 P4b: drift applies on every level, not orbit-only — gate removed, ORBIT_GRAVITY_* renamed DEBRIS_DRIFT_*`

---

## ⛔ PLAYTEST GATE — blocking, P5 must not run until answered

Play levels **3, 6, 9 and 12** for one full pass of the ramp, plus **21** for a full field component on top. Play at least one orbit level to a **full harvest** — the only way to see the drift at all. Answers go in `STATUS.md` before P5's session.

Four densities, both orbit velocities, gravity acceleration and bounce restitution are live sliders in the hidden Debug panel's ORBIT section. **Retune in-session and report the number you landed on, not a yes/no.** If an answer needs a FEATURE rather than a constant move, say so and P5 stops — that is what happened at CS021's gate and it was the right call.

### The shell

1. **The inverted ramp.** One ring at 400 px at level 3, growing outward to four by level 12. Does it read as the shell building outward, and — the whole point of the inversion — is the dead space gone?
2. **Level 3 is 3 ring satellites and 5 scatter.** That is a very light level. Too light, or a clean introduction to the archetype?
3. **The 46 px radial corridor.** Flying between rings, does 46 px against a 26 px ship read as threading a needle, or is it invisible because the tangential lanes (746–1035 px) mean you never have to use it? *The one geometric consequence nobody has seen in the hands.*
4. **Two fast rings (2 and 4).** Slow/fast/slow/fast — rhythm or noise? Note the inner fast ring now arrives first, at level 6. *(report where you leave `ORBIT_ANG_VEL` 6 °/s and `ORBIT_FAST_MULT` 3.0 — they also set the drift's speed cap)*
5. **The smaller world.** Orbit levels are 3840×2160 rather than 5120×2880. Less of a commute? Is the field component still findable?
6. **Level 63 is level 12.** Spec C5: the ramp carries escalation to level 12 and then the shell is flat at 16 satellites for 17 more occurrences. Does the archetype need something after 12, or does the drift carry it? *A density ramp is the cheapest answer and it is a CS024 decision, not a P5 retune.*

### The collisions

7. **Ramming, now that it scores nothing.** 50 HP for a large satellite, 60 for a Hunter core, 20–35 for a UFO — no points, but the canisters and powerups still drop. Does it read as a desperate move, a deliberate tool, or a trap? **The one place it may still be too profitable is the UFO: 20 HP for a guaranteed powerup** (FLAG-CS023-j).
8. **A rammed Hunter core puts three homing children AND a powerup on top of you** during the 1.0 s stun (FLAG-CS023-i). Dramatic, or just unfair?
9. **Satellites hitting each other.** Does the bounce read as mass — a small ricocheting off a large at the 9:3:1 ratio — or as two equal things? *(knob: `debrisBounceRestitution`)*
10. **UFOs dying on the rings** (FLAG-CS023-h). Estimated two thirds of saucers that cross a full shell won't come out — but only two ring crossings at level 3, rising with the ramp. A junk belt doing its job, or does saucer pressure just vanish on the later orbit levels?

### The drift

11. **Does it read at all?** The trigger fires only once nothing is left inside 814 px, which is late in a level. Did the outer junk come back to you, or did the level just end? *(knob: `debrisDriftAccel`, a guess at 30 px/s² — set it to 0 for the A/B)*
12. **Is the pull fast enough, and is the cap right?** Pieces accelerate to at most 255.7 px/s inward — the outer fast ring's own speed — and coast on through the shell region when released. Too slow to matter, or does the field genuinely re-form around you? *If it is slow, raise the acceleration first; the cap only binds for pieces starting beyond ~1,766 px from the dock.*
13. **The interrupts.** Shooting a drifting piece, ramming one, or watching two collide mid-drift — does that read as knocking something off course, or does it just look like the pull switched off?
14. **The drift on FIELD levels** (P4b). It runs everywhere now, and the field world is smaller — 46% of it sits beyond the 814 px trigger, versus 75% of an orbit world. Does the cleanup tail of a field level improve as much as an orbit level's does, or does pulling everything to 676 px around the dock feel cramped on the smaller map? *One radius serves both worlds right now; if the field wants its own, that is a CS024 decision, not a P5 retune.*

### Frame rate

15. **`update()` is a non-issue headlessly** and P2's gate says so with a counter. **`draw()` is still untested and `shadowBlur` still scales with entity count.** Watch a full harvest at level 21 and the instant of death on a part-harvested orbit level. Entity counts here are far below CS022's — this is the first round in a while where the answer should be "no problem."

---

## Phase 5 — Retune, version bump, doc sweep

**Goal:** the closing phase. Carry the gate's numbers, bump the version, move every doc to describe what shipped. No new logic.

**Model:** Sonnet 5, high effort.

### Paste-ready prompt

> Implement CS023 Phase 5 — the closing phase. **No new logic.** Read the gate answers in `STATUS.md`'s Playtest asks section and retune from those only; if an answer is "no change," change nothing (the CS020 P2 / CS022 P4 precedent). If an answer asks for something that is a FEATURE rather than a constant move, **surface it and stop**.
>
> 1. **Retune** whatever the gate settled: the four densities, `ORBIT_ANG_VEL`, `ORBIT_FAST_MULT`, `DEBRIS_DRIFT_ACCEL`, `DEBRIS_BOUNCE_RESTITUTION`, `DEBRIS_BOUNCE_MIN`, `DEBRIS_MASS`. Registry `def`s derive from the shipped consts, so a const move carries the knob automatically — verify, don't assume. **Note that moving `ORBIT_ANG_VEL` or `ORBIT_FAST_MULT` also moves the drift's speed cap** (spec C14); say so wherever you record the retune.
>
> 2. **`GAME_VERSION` `"1.0.0.22"` → `"1.0.0.23"`.** Grep the repo whole rather than trusting any list: CS021 P5 predicted eight-plus-four pins and found eleven, and CS022 P4's sweep touched twelve files against a prompt naming five. Live pins that track HEAD get both their console label and their assert message bumped; this changeset's own four test files (P4's now also carrying P4b) get the standing mirror-image repoint (`assert GAME_VERSION !== "1.0.0.22"`) with a `REPOINTED BY CS023 P5` note. Files already asserting `!== "1.0.0.21"` stay correct forever — leave them. Historical header-comment narratives are left alone (CS018 P10 / CS020 P2 precedent).
>
> 3. **GDD — shipped behaviour only.** **§2.13.1** needs the archetype **restated, not amended**: every geometry number moved (radii 460/736/1012/1288 → 400/538/676/814, outer edge 1,334 → 860 against a 1,060 px budget, dock clearance 326 → 266, corridors 184 → 46, density → flat 0.12, the full shell 84 peak → 16), the ramp now runs **innermost-first** with the §1.4 table, the fast ring is a **list**, and the inward drift with its derived cap is new. **The drift is documented as level-agnostic** — §2.13.1 is the orbit section, so the drift's own description belongs in the general debris/level material with only a pointer from §2.13.1, or a future reader will re-scope it exactly as P4 did (spec C15). **§2.11.1** takes the size-9 orbit world and the corrected `dmax`. **§3.1 collision conventions** gains three new passes in its documented pass order — satellite↔satellite, UFO↔satellite, and the mutual-damage rule on hazard↔ship — plus the "the hazard dies too, and scores nothing" clause on its `damageShip` bullet, and a line recording that `awardScore` gates score and stats but never drops (spec C13). **§2.19** takes the registry 44 → 46 with both new knobs. Architecture Map: Constants row gains `DEBRIS_MASS`/`DEBRIS_BOUNCE_*`/`DEBRIS_DRIFT_*`; Entity classes gains `DebrisSatellite.drifting`; Flow functions gains `debrisBounce`, `maxOrbitSpeed` and the arming pass.
>
> 4. **`DIFFICULTY-LEVERS.md`** — the orbit world size row takes 16 → 9; the **orbit ring ramp row takes the inversion and is promoted to the archetype's escalation axis** (spec C5/§5); the orbit-gap-multiplier row records C5 — the curve still runs and buys one satellite in the whole game; the orbit density row takes the flat curve. **Two new rows:** debris inward drift (noting it applies on **every** level, and that the cap tracks the orbit motion knobs but never binds on a field level) and satellite bounce.
>
> 5. **`GDD-VERSION-HISTORY.md`** — one consolidated CS023 (P1–P5, including P4b) entry appended. Open only to append; never read for context.
>
> 6. **`STATUS.md` size check**, per `CLAUDE.md`'s rolling-window rule: this closes CS023, so if the oldest changeset still covered is more than ~3 rounds behind, relocate it into `archive/STATUS-HISTORY.md` — **a straight relocation, newest-first, each entry its own paragraph, never summarized**. Double-check every written entry starts on its own paragraph; a missing trailing newline is what fused years of entries into one 160 KB line in mid-2026.
>
> 7. **Archive check:** `PLANNED-FEATURES-CS022.md` and `IMPLEMENTATION-PHASES-CS022.md` should already be in `archive/` from Paul's setup step. Verify; do not move blind.
>
> Full regression run twice consecutively, diffed against the pre-phase baseline line by line — the only expected differences are the files whose console output echoes the version string, plus the already-documented RNG/wall-clock noise files (`test-cs018-p4`, `test-v31-world`, `test-v33-p2`, `test-v33-p3`, and the frame-budget probes).

**Commit:** `CS023 P5: gate retune, version 1.0.0.23, GDD/levers/history sweep`

---

## Model and effort summary

| Phase | Model | Effort | Why |
|---|---|---|---|
| P1 | Opus 4.8 | xhigh + thinking + `ultrathink` | Fourteen-plus files pin the geometry or world size; a type change and a direction reversal land in the same sweep; two now-false comments must be corrected rather than deleted, and "stale versus silently measuring the wrong thing" has bitten four rounds running |
| P2 | Opus 4.8 | xhigh + thinking + `ultrathink` | New physics with a wrap-aware asymmetry, plus a second O(n²) pass whose ceilings must be derived before they are measured |
| P3 | Sonnet 5 | high | Four one-line insertions and one parameter, against a helper P2 already proved and a contract C13 already established. The care is all in the traps, and they are explicit |
| P4 | Opus 4.8 | xhigh + thinking + `ultrathink` | An arm/release lifecycle whose failure mode is silence, a cap whose obvious shortcut is wrong (C14), and a strong pull toward touching the rails that the spec explicitly forbids |
| P4b | Sonnet 5 | high | One deleted gate and three renames — but the real work is finding and *inverting* P4's field-level assertions rather than deleting them, which is a well-established idiom in this suite |
| P5 | Sonnet 5 | high | Mechanical, but the version-pin sweep has undercounted in four consecutive changesets — grep, don't trust |

`ultrathink` must appear inside the message text itself, not in a meta-note, to take effect.