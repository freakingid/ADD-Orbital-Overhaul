# PLANNED FEATURES — CS023

**Changeset:** CS023 — Collision damage, satellite bounce, and the inward drift
**Baseline:** CS022 complete. Public repo HEAD `6654ef6`, `GAME_VERSION "1.0.0.22"` → ships `"1.0.0.23"`. The attached build is byte-identical to HEAD (verified).
**Source:** Paul's four-part CS023 request, a fresh `tools/orbit-lab.html` dump, and Paul's fork resolutions of 2026-08-05, all re-grounded against the real build. Where the request and the build disagree, the build wins and the disagreement is recorded in §2.

✅ **ALL FORKS RESOLVED** (§3). Implementation-ready.

> **AMENDED 2026-08-05, after P4 shipped:** FORK-H is re-resolved — **the drift runs on EVERY level, not orbit levels only.** The orbit radii were only ever a way of naming two distances. Corrected by **Phase 4b**; see C15.

---

## 1. The feature

Four changes. Three of them are one idea — **an orbit level should be a place where things hit each other** — and the fourth (the geometry retune) is what makes the other three affordable.

### 1.1 Collisions deal damage in both directions

Today the ship is the only thing that gets hurt in a collision. A satellite the ship rams is untouched; a UFO the ship rams is untouched; two satellites pass straight through each other; a UFO flies through a satellite. CS023 closes all four.

| Contact | Today | CS023 |
|---|---|---|
| Ship ↔ Debris satellite (unshielded) | ship takes `DEBRIS_DAMAGE`, satellite untouched | **both** — satellite destroyed/split, **no score** |
| Ship ↔ Hunter satellite (unshielded) | ship takes `HUNTER_DAMAGE`, Hunter untouched | **both** — Hunter destroyed/split, **no score** |
| Ship ↔ UFO (unshielded) | ship takes `s.damage`, UFO untouched | **both** — UFO destroyed, **no score** |
| Debris ↔ Debris | *no pass exists* | **elastic bounce**, asymmetric on rails |
| UFO ↔ Debris | *no pass exists* | **UFO destroyed, no score**; satellite bounces |
| UFO shot → Debris | already destroys/splits it, no score | **unchanged** — see C1 |

Shielded contact is a separate, already-designed rule set and is **out of scope** (C10).

**A collision kill moves no score and no achievement counters, but drops everything else.** That is not a new rule — it is exactly the existing `awardScore = false` contract on `destroyDebris`/`destroyHunter`, which already suppresses score and stats while still emitting garbage canisters, splitting the body, and (at the large Hunter tier) dropping a powerup. CS023 extends the same parameter to `destroySaucer` and uses it at all four new kill sites. See C13.

### 1.2 A satellite that hits something bounces off it — unless it is on a rail

Two free-moving satellites collide elastically, mass-weighted. A free satellite that hits an **orbiting** one bounces off it and the orbiting one stays on its rail, untouched — exactly the asymmetry CS021 P1b already built for the ship (`shieldBounce`), reused rather than re-invented. The rail is authoritative; nothing pushes a body whose position is re-derived from its orbit angle every frame.

### 1.3 The shipped geometry — smaller world, tighter shell, far fewer satellites

From the orbit lab, with `ORBIT_FAST_RING` hand-edited (C3):

| Symbol | CS022 | **CS023** | Note |
|---|---|---|---|
| `WORLD_SIZE_ORBIT` | 16 (5120×2880) | **9** (3840×2160) | budget 1,420 → **1,060 px** |
| `ORBIT_INNER_RADIUS` | 460 | **400** | dock centre to ring 1 centre |
| `ORBIT_RADIUS_STEP` | 276 | **138** | 1.5 × the 92 px large-satellite diameter |
| `ORBIT_RING_COUNT` | 4 | 4 | unchanged |
| ring radii | 460/736/1012/1288 | **400 / 538 / 676 / 814** | outer satellite edge **860 px** vs a 1,060 px budget |
| `ORBIT_DENSITY` | [0.75,0.45,0.35,0.42] | **[0.12, 0.12, 0.12, 0.12]** | flat — the rhythm is gone |
| radial corridors | 326/184/184/184 | **266 / 46 / 46 / 46 px** | first figure is clearance over the 88 px dock |
| `ORBIT_FAST_RING` | `3` | **`[2, 4]`** | a *list*, not a number — C3, FORK-G ✅ |
| `ORBIT_GAP_MULT` etc. | 2.5 / 1.8 / 0.1 / 8 | unchanged | but see C5 — the curve is now nearly inert |
| `ORBIT_ANG_VEL` / `_FAST_MULT` | 6 °/s / 3.0 | unchanged | still first-pass, still gate material |

CS022 shipped 27 satellites at level 3 rising to a peak of 84. **CS023's full shell is 15 satellites rising to 16, across the entire 63-level game** (C5) — a 5× cut that is what pays for two new O(n²)-shaped passes in §1.1 and §1.2.

Per-ring tangential speeds at the shipped motion constants, which the drift's cap in §1.5 is derived from:

| Ring | Radius | Angular velocity | Tangential speed |
|---|---|---|---|
| 1 | 400 | 6 °/s | 41.9 px/s |
| **2** | 538 | **18 °/s (fast)** | **169.0 px/s** |
| 3 | 676 | 6 °/s | 70.8 px/s |
| **4** | 814 | **18 °/s (fast)** | **255.7 px/s** ← the fastest a satellite ever moves in orbit |

### 1.4 The rings arrive innermost first (FORK-A ✅)

CS022's ramp is **inverted**, not retired. One ring per occurrence of the archetype, **from the inside out**:

| Occurrence | Level | Rings | Ring sats | Field sats | **Level total** | Lanes (px) |
|---|---|---|---|---|---|---|
| 1 | 3 | ring 1 | 3 | 5 | **8** | 746 |
| 2 | 6 | rings 1, 2 | 3/3 = 6 | 3 | **9** | 746/1035 |
| 3 | 9 | rings 1, 2, 3 | 3/4/4 = 11 | 13 | **24** | 746/753/970 |
| 4 | 12 | all four | 3/4/4/5 = 16 | 9 | **25** | 746/753/970/931 |
| 5–21 | 15 … 63 | all four, held | 16, flat | 3–13 | **19–29** | as above |

Radii never move — the ramp **selects** rings, it does not re-space them. Ring 1 sits at 400 px whether or not rings 2–4 exist, which is the point: **level 3's shell is 266 px off the dock, right where the player already is.** That is the direct answer to the dead-space complaint the outermost-first ramp produced.

Two consequences worth naming. **The ramp is now the archetype's escalation axis** — ring count 1 → 4 across levels 3–12 carries what the occurrence curve stopped carrying (C5), and levels 12–63 are deliberately flat. And **`layout.rings`' array position is its ring index again**: innermost-first means `rings[0]` is ring 1 at every occurrence, reversing CS022 P3's known issue. Tests keyed by `r.index`/`r.radius` stay correct and must not be reverted to position keying.

### 1.5 Loose debris drifts back toward the shell (FORK-B/C ✅)

This is **not** about the orbiting satellites. It is about every *free* piece — the field component, split children, anything knocked off a rail — of any size.

> When nothing is left within **ring 4's radius (814 px)** of the dock, a gravity-like force switches on for every free debris satellite and pulls it inward toward **ring 3's radius (676 px)**. A piece stops feeling the force once it reaches that distance, or the moment something changes its direction.

The purpose, in Paul's words: *once satellites get sparse, move them into an area of interest for the player, so the player isn't bored hunting around a large level for something to shoot.* The rings themselves never move. What moves is the junk that has drifted out to the far side of a 3840×2160 world.

The force is an **acceleration**, not a velocity override: a piece keeps its own drift and has the inward pull added to it, so what arrives at 676 px is a loose, moving population rather than a tidy ring.

**The inward speed is capped at the fastest speed any satellite reaches in orbit** — 255.7 px/s at the shipped constants (ring 4, the outer fast ring). The cap is on the *inward radial component only*; tangential motion is untouched, so a piece that was already travelling sideways keeps doing so. Nothing that arrives is moving faster than something the player has already had to deal with on a rail, which is the whole justification for the number: it is not a tuning guess, it is the game's own existing maximum. See §4.7 and C14.

Every interrupt Paul named — hitting another satellite, hitting a UFO, taking a player shot, hitting the ship — is a rule this changeset is already adding. That is why the four parts of the request are one design: §1.1 and §1.2 are what interrupt the drift, and the drift is what makes §1.1 and §1.2 happen more than once a level.

### 1.6 The design frame

CS022 §1.6 established that the satellites exist to be destroyed, not threaded past — the fairness floor's job is "never a solid wall," not "always a passable lane." CS023 keeps that reading and adds a second: **an orbit level should decay, not deplete.** A level that starts as a still shell and ends as a still shell minus some satellites is a checklist. A level whose scattered remnants are drawn back into the dock's neighbourhood, collide, knock each other off course and have to be dealt with there is a situation. Every number below is chosen against that.

---

## 2. Corrections — where the request or the prior docs are wrong about this build

Each is settled by the build's own contract or arithmetic; none is a design choice.

**C1 — "UFO shots should damage garbage satellites" is already shipped, and has been for a long time.** ✅ *Confirmed by Paul.* `update()`'s last collision pass, commented *"Saucer bullets can shatter debris satellites too (classic behavior)"*, walks every hostile bullet against `game.debris` and calls `destroyDebris(a, false)` — full destruction and split, **no score to the player**, which is also already what the request asks for. **Nothing to build.** It is pinned as a regression instead (§6 item 12).

**C2 — The lab emits `ORBIT_WORLD_SIZE`; the build calls it `WORLD_SIZE_ORBIT`.** CS022 P1 named it, `worldSizeFor()` reads it, `orbitEffectiveCount()` reads it through `worldDims()`, and seven test files pin it by that name. This is a **value change, 16 → 9, not a rename.**

**C3 — `ORBIT_FAST_RING = [2, 4]` changes the constant's type, and the lab cannot have produced it.** ✅ *Confirmed by Paul: the type change is wanted, so any number of fast rings can be named.* `tools/orbit-lab.html` holds `fastRing` as a scalar and its dump emits a number; the array is a hand-edit. In the build the constant is consumed at exactly one site — `fastRingIndex: ORBIT_FAST_RING - 1` in `spawnOrbitWave` — and tested inside `generateOrbitLayout` as `i === fastRingIndex`. Both become set membership over a **0-based index list**, with the constant staying human 1-based.

**C4 — "at level 3: 15 satellites" is the lab's all-rings-active readout; the lab does not model the ramp.** The lab's `level` slider drives only `orbitGapMult`. Under the inverted ramp (§1.4) level 3 lays **ring 1 alone — 3 satellites** and the 15-satellite figure is what a level 12+ shell holds. The lab remains correct about geometry and wrong about counts-per-level, by construction; do not treat its total as a per-level target.

**C5 — At density 0.12 the occurrence curve is nearly inert, and this is arithmetic, not opinion.** The generator picks counts in two steps: `maxCount = floor(circumference / spacePerSatellite)`, then `count = round(1 + density × (maxCount − 1))`. Density is *the fraction of available room actually used*. The occurrence curve acts only on the first step — `ORBIT_GAP_MULT` 2.5 → 1.8 shrinks `spacePerSatellite` 157 → 138.8 px, raising `maxCount` ~13%:

| gapMult | `spacePerSatellite` | `maxCount` (rings 1–4) | `1 + 0.12 × (maxCount−1)` | rounded |
|---|---|---|---|---|
| 2.50 (level 3) | 157.0 | 16 / 21 / 27 / 32 | 2.80 / 3.40 / 4.12 / 4.72 | **3 / 3 / 4 / 5** |
| 1.80 (level 24+) | 138.8 | 18 / 24 / 30 / 36 | 3.04 / 3.76 / 4.48 / 5.20 | **3 / 4 / 4 / 5** |

The 13% gain is 13% *of the 0.12 term* — half a satellite on ring 4, eaten by rounding. Only ring 2 sits near enough to a boundary to tick over. The same `maxCount` move at CS022's 0.85 density moved ring 4 by four satellites (27 → 31); at 0.12 it moves it by zero.

**Consequence:** `orbitGapMult()`, `ORBIT_GAP_MULT_FLOOR` and `ORBIT_GAP_MULT_STEP` keep running and stop being observable. This is **largely answered by FORK-A's inversion** — escalation now comes from ring *count* (levels 3 → 12) rather than ring *density* — leaving levels 12–63 deliberately flat at 16 ring satellites. Recorded so nobody later retunes a silent curve, or deletes a working mechanism because one density array quieted it. The four density sliders are the dial if the flat tail reads as repetitive.

**C6 — `orbitEffectiveCount(5)` now returns 5, not 4, and `orbitDensity5` becomes a live knob for the first time.** At the new geometry: 4 rings → 860 px, **5 rings → 998 px**, both inside the 1,060 px size-9 budget; 6 rings → 1,136 px, out. The registry's `orbitCount` entry already allows `max: 5`, so a requested 5 stops collapsing to 4. Under the inverted ramp a 5-ring request completes at occurrence 5 (level 15) instead of 4.

**C7 — `dmax` on the orbit transition drops 1,380 → 1,020 px, and the CS022 comment in `resizeWorld` overstates how little binds on the grow.** It reads *"On the GROW almost nothing binds (old max reach 1,468 px against 1,380)."* Against 1,020 a materially larger band of carried bodies gets pulled in along its own bearing. Mechanism unchanged and correct; the comment is wrong, and FLAG-CS022-k's `dmax` shell now applies in **both** directions rather than mostly on the shrink.

**C8 — `STAR_COUNT` moves 1280 → 720 by itself.** Derived `STAR_DENSITY × area(WORLD_SIZE_MAX) / area(VIEW)`, and `WORLD_SIZE_MAX` is `Math.max(4, 9) = 9`. Active count at field size stays ~320. Two files pin these (`test-cs022-p1.js` §H, `test-v31-world.js` §D) and both repoint to the derivation, never to a fresh literal.

**C9 — Satellites have no HP, so "a hit dealt to the Satellite" can only mean the existing one-hit destroy-and-split.** `DebrisSatellite` and `HunterSatellite` carry `size`, `radius`, `damage`, `dead` — no health field, and every kill path is unconditional. CS023 reads "a hit" as **the same hit a player bullet lands**.

**C10 — Shielded contact is out of scope.** Paul's sentence is premised on the ship taking damage. Shielded contact already has three deliberate outcomes (homing Hunters die and split; rail-borne hazards bounce the *ship* via `shieldBounce`; free hazards are deflected via `shieldDeflect`), all argued in CS021 P1b. **None of them changes.** Flagged rather than assumed, because "collisions now hurt both sides" reads like it should apply everywhere.

**C11 — Two rail-borne satellites cannot touch at the shipped geometry.** Rings are 138 px apart and a large satellite is 92 px across, leaving 46 px of clearance; same-ring bodies hold a fixed angular spacing at a shared `angVel`. The bounce pass's ring-vs-ring branch is therefore **unreachable in normal play** and only becomes live under a debug `orbitCount`/`orbitAngVel` change. Spec it, assert the impossibility, do not tune against it. *(This stays true under CS023 — §1.5's drift moves free pieces only, so no body ever crosses a rail radius while itself on a rail.)*

**C12 — There is genuinely no debris-vs-debris pass to extend.** FLAG-CS022-a states it explicitly. §1.2 is new code, not a widened filter, and it is the changeset's second O(n²) pass alongside `coalesceGarbage`. That flag also predicted the consequence CS023 now fixes: field satellites spawning overlapped with a ring satellite, previously "cosmetic and self-resolving."

**C13 — `awardScore = false` already means "no score and no stats, but every drop still happens," and CS023 must not redefine it.** `destroyDebris(a, false)` still emits `DEBRIS_GARBAGE` canisters and still splits; `destroyHunter(h, false)` still drops its tier's canisters, still splits three ways, and **still drops a powerup at the large tier** — that `dropPowerup` call sits deliberately outside the `awardScore` gate. FORK-E (rams award no score) and FORK-F (a satellite-killed UFO still drops a powerup) are therefore **the same rule, already shipped**, and `destroySaucer`'s new parameter must gate exactly what its two siblings gate: `addScore` and the achievement counters, never `dropPowerup`. Writing it any other way would make one member of a three-function family mean something different from the other two.

**C14 — The drift's speed cap must scan every ring, not assume the outermost one is fastest.** Tangential speed is `angVel × radius`, and `angVel` is not uniform — the fast-ring list multiplies some rings by `ORBIT_FAST_MULT`. At the shipped `[2, 4]` the maximum does happen to fall on ring 4 (255.7 px/s), but at a list of `[1, 2]` it would fall on **ring 2** (169.0 px/s), not on the outermost ring's 85.2. Now that `ORBIT_FAST_RING` is arbitrary-length (C3), a "just use the outer ring" shortcut is a latent bug the moment the list changes.

**C15 — The drift is NOT orbit-specific, and the reasoning that made it look orbit-specific was wrong.** The original FORK-H recommendation argued that on a field level the force *"would be on almost permanently and would quietly re-centre 42 of 63 levels on the dock."* Measured against the real worlds, that is false in both halves:

| | Field world (2560×1440) | Orbit world (3840×2160) |
|---|---|---|
| Max wrap-aware distance from the dock | 1,469 px | 2,203 px |
| Share of the world inside the 814 px trigger | 54% | 25% |
| **Share beyond it — the dead zone the drift reclaims** | **46%** | **75%** |
| Longest possible armed fall | 792 px | 1,527 px |
| Speed on arrival at 676 px (a = 30 px/s²) | 218 px/s | 256 px/s (**capped**) |

The trigger requires that **nothing** is inside 814 px of the dock. Field debris spawns ship-relative (`SPAWN_MIN_DIST` 220 to `SPAWN_MAX_DIST` 640 from a ship that itself starts 260–620 px from the dock), so a field level reliably has something inside that radius for most of its length. The force therefore arms **late, in the cleanup tail** — precisely the stretch the mechanic exists to fix, and the same moment it arms on an orbit level.

Two useful consequences fall out. The cap **never binds on a field level** (218 px/s against a 255.7 px/s ceiling), so it is orbit-scale machinery that sits quietly inert on the smaller world rather than something needing a per-archetype variant. And `update()` already early-returns unless `game.state === "playing"`, while `game.dock` is created by every `nextWave()` — so dropping the gate exposes no title-screen or null-dock path.

The naming is what caused the misread, so P4b renames `ORBIT_GRAVITY_*` to `DEBRIS_DRIFT_*`. **The radii keep deriving from the ring geometry** — that is where the numbers legitimately come from — but nothing about the mechanism is archetype-keyed.

---

## 3. Fork ledger — ✅ ALL RESOLVED

| Fork | Question | **Resolution** |
|---|---|---|
| **FORK-CS023-A** | Ring introduction order | **INVERTED — innermost first.** `activeRings = [0], [0,1], [0,1,2], [0,1,2,3]`, complete at occurrence 4 (level 12). Level 3 is ring 1 alone at 400 px, 266 px off the dock. §1.4. |
| **FORK-CS023-B** | What the inward force acts on | **Free debris satellites only** — every `game.debris` body with no orbit state, at every size. Orbiting satellites never move off their rails; the ring radii are used purely as reference distances. §1.5. |
| **FORK-CS023-C** | Force shape and termination | **A gravity-like acceleration toward the dock**, armed when nothing is inside ring 4's radius, released per-piece on reaching ring 3's radius or on any direction-changing event, with the inward component **capped at the fastest orbital tangential speed**. §4.7. |
| **FORK-CS023-D** | Satellite mass for the bounce | **`DEBRIS_MASS = {3: 9, 2: 3, 1: 1}`** — mass conserved through the 3-way split the game already performs. A small ricochets off a large rather than shoving it. |
| **FORK-CS023-E** | Does a rammed hazard award score? | **No.** All four new kill sites pass `awardScore = false`: no `addScore`, no `debrisKills`/`hunterKills`/`saucerKills`, no `bestDebrisGame`, no lineage or Diamond Cutter progress. Ramming is a cost, not a scoring route. **Drops are unaffected** (C13) — the garbage canisters, the split, and the Hunter/UFO powerups all still happen. |
| **FORK-CS023-F** | A UFO killed by a satellite — powerup? | **Yes, it still drops one.** Which, with E, makes `destroySaucer(s, awardScore = true)` gate exactly what `destroyHunter` gates: score and achievement counters only. One rule, three functions, no special cases. |
| **FORK-CS023-G** | `ORBIT_FAST_RING` as a list | **Yes — a list of 1-based ring numbers, any length.** Rings 2 and 4 ship fast. C3, and C14 for the consequence. |
| **FORK-CS023-H** | Does the drift run on **field** levels? | ⚠️ **RE-RESOLVED after P4 shipped: EVERY LEVEL.** The mechanic is about distance from the dock, not about archetype — the ring radii were only ever a convenient way to name 814 px and 676 px. My earlier orbit-only recommendation rested on a wrong premise and is retracted; see **C15** for why, and **P4b** for the correction. |

### Flags (best-guess, review at the playtest gate)

| Flag | Note |
|---|---|
| **FLAG-CS023-a** | **The trigger counts ALL debris, orbiting and free.** ✅ Confirmed by Paul. The shell must be harvested before the outer stragglers are summoned, rather than the force fighting the level from the first frame. Ring 4 sits at *exactly* 814 px, so it is not "closer than" and never blocks itself. |
| **FLAG-CS023-b** | **Arming is sticky and per-piece.** A piece armed on the triggering frame keeps its force until it arrives or is interrupted, even though the global condition goes false the moment the first piece crosses 814 px. This is Paul's *"they will continue it until their direction is changed"* made literal, and it is what stops the whole population oscillating on and off around the trigger radius. |
| **FLAG-CS023-c** | **Pieces born after arming are not armed.** A split child of a drifting parent starts free and unforced; it can only be armed if the global condition becomes true again. Deliberate — the alternative is inheritance, which would let one armed large seed an entire armed lineage regardless of where the field has got to. |
| **FLAG-CS023-d** | **`DEBRIS_DRIFT_ACCEL` is the one pure guess left: 30 px/s².** The *cap* is derived (§4.7) but the acceleration is not. At 30 px/s² a piece reaches the 255.7 px/s cap after 8.5 s and 1,090 px of fall, so the cap binds only for pieces starting beyond ~1,766 px from the dock — real, in an orbit torus whose farthest point is 2,203 px away, but not the common case — and never at all on a field level, whose farthest point is 1,469 px (C15). Live debug slider from P4; report where the gate leaves it. |
| **FLAG-CS023-e** | **No falloff and no damping, unlike the Magnet.** `MAGNET_PULL` ramps with proximity and applies `MAGNET_DAMP` because it is a precision tool for hooking one canister. This is a slow, flat, long-range nudge, and a falloff curve would make the far pieces the mechanic exists for the slowest to arrive. The cap is what bounds it instead. |
| **FLAG-CS023-f** | **The bounce needs a separation floor or contacts re-bill every frame.** `SHIELD_BOUNCE_MIN` (120 px/s) is the precedent and the reason is identical. Satellites are slower than the ship, so `DEBRIS_BOUNCE_MIN` is **40 px/s**, with `DEBRIS_BOUNCE_RESTITUTION` 1.0 matching `SHIELD_BOUNCE_RESTITUTION`. |
| **FLAG-CS023-g** | **This is the build's second O(n²) pass.** Realistic peak `game.debris` on a level-12+ orbit level is ~200–250 bodies fully split (16 rails → 48 → 144, plus up to 13 field satellites and their children), i.e. ~30k pair-checks in the worst frame — below the 49,203 `coalesceGarbage` checks CS022 P3 measured and gated. Affordable **because** §1.3 cut the satellite count 5×; at CS022's 84 satellites it would not have been. Gated in P2 by the same deterministic-counter method. |
| **FLAG-CS023-h** | **UFOs will die to the rings on orbit levels, often.** A saucer crossing a full shell makes up to 8 ring crossings, each carrying roughly a 10–15% chance of contact at the shipped lane widths — **on the order of two thirds of saucers that cross the shell will not come out.** Thematically excellent, mechanically a real reduction in saucer pressure on the later orbit levels. The ramp softens the early game here: level 3 has one ring, so only two crossings. |
| **FLAG-CS023-i** | **A rammed large Hunter puts three homing children AND a powerup on top of the player** during the 1.0 s hit-stun (C13 — the drop is outside the score gate). Intentional; the ram is supposed to be a bad trade with a consolation. It is the sharpest new failure mode in the changeset. |
| **FLAG-CS023-j** | **Ramming a UFO now costs 20–35 HP for a guaranteed powerup and no score.** FORK-E removed the 1,000-point concern; the powerup remains, and twelve small-UFO rams would spend the whole hull for twelve powerups. Bounded and self-limiting, but it is the one place where the ram is still arguably *profitable*. Gate question 7. |
| **FLAG-CS023-k** | **Every hazard overlapping the ship on the damaging frame is destroyed, not just the one whose damage landed.** The pass is gated on `game.ship.invuln <= 0` at the top, so it can fire at most once per `HIT_STUN_DURATION` (1.0 s) — the i-frame is the rate limiter, exactly as it already is for damage. Gating the kill on `damageShip`'s return would leave a hazard alive when the CS012 auto-shield eats the hit, contradicting "the collision happened." |
| **FLAG-CS023-l** | **No fast ring at occurrence 1, still.** `ORBIT_FAST_RING` is `[2, 4]` and level 3 lays ring 1 alone, so motion arrives at level 6 as a second surprise — the same emergent property FLAG-CS022-b recorded and Paul confirmed he wanted kept. Under the inversion it is now the *inner* fast ring that arrives first. |
| **FLAG-CS023-m** | **The wave-clear condition is untouched.** `game.debris.length === 0` still ends the level; the drift cannot stall a clear, because a drifting piece is still debris and still dies to one bullet. If anything it shortens the tail, which is the point. |
| **FLAG-CS023-n** | **No voice lines.** Standing non-negotiable: ARPAbet must be composed and zero-error-verified in `tools/voice-robot-lab.html` before anything touches `VOICE_LINES`. A "debris is drifting back in" line is tempting and lands in a later changeset. |
| **FLAG-CS023-o** | **Registry grows 44 → 46** (`orbitGravityAccel`, `debrisBounceRestitution`). Append-only discipline applies: **append after the existing ORBIT entries**, never insert, or every row index below moves. Two test files pin the count. |

---

## 4. The mechanism

> Line numbers below are **estimates from HEAD `6654ef6`** and drift the moment a phase lands. **Re-grep every anchor by symbol name before editing.**

### 4.1 Geometry and world size (constants block, ≈ lines 114–125 and 515–582)

- `WORLD_SIZE_ORBIT` **16 → 9**. `WORLD_SIZE_MAX` is derived (`Math.max`) and follows; `STAR_COUNT` is area-derived from that and follows (C8). `resizeWorld`'s grow comment is corrected per C7.
- `ORBIT_INNER_RADIUS` **460 → 400**, `ORBIT_RADIUS_STEP` **276 → 138**, `ORBIT_DENSITY` **→ `[0.12, 0.12, 0.12, 0.12]`**.
- `ORBIT_FAST_RING` **`3` → `[2, 4]`**. `spawnOrbitWave` maps it to a 0-based list; `generateOrbitLayout`'s parameter is renamed `fastRingIndices` and `i === fastRingIndex` becomes membership. The constant stays human 1-based, as its comment already says, and the conversion must work for a list of **any** length (C14).
- The fitted-radii comment paragraph is rewritten around 860-against-1,060 at size 9, ring 1's **266 px** clearance over the permanent 88 px dock, and the **46 px** inter-ring corridor — which is a new fact worth stating plainly, because it is *narrower than the 65 px in-ring fairness floor*. That is correct, not a bug: `minRequiredGap` has only ever governed tangential lanes between adjacent satellites in one ring, and nobody had to notice at a 276 px step.
- The density block's "tight → breather → widest → wide" rhythm sentence is **deleted**, not amended. There is no rhythm at a flat curve.
- The `ORBIT_GAP_MULT` block gains C5's finding and the note that FORK-A's inversion is what now carries escalation.

### 4.2 Ramp inversion (`activeRingsFor`, ≈ line 5405)

One line. The loop that fills the ring list counts **up from 0** instead of down from `count − 1`:

```
for (let i = 0; i < n; i++) rings.push(i);          // innermost first  (was: count - 1 - i)
```

Everything else about the helper is unchanged and stays correct by construction: `n` is still `clamp(floor(level / ORBIT_LEVEL_EVERY), 1, orbitEffectiveCount(DEBUG.orbitCount))`, so the ramp still composes with the `orbitCount` knob (FLAG-CS022-h) and still completes one occurrence earlier at a lower ring count. `levelDef`'s `orbitRings` column is a **count** and is untouched; `generateOrbitLayout`'s filter, its `inactive` array and `spawnOrbitWave`'s third argument all stay exactly as CS022 P3 built them.

The comment block above it needs rewriting rather than editing — its whole rationale paragraph argues outermost-first — and the CS022 P3 note about array position diverging from ring index is now **false and must be corrected at both its sites**, not just deleted.

### 4.3 Ship ↔ hazard mutual damage (`update()`, the *"Collisions: hazards vs ship"* block, ≈ line 7254)

Inside the existing `else` branch (unshielded), after the `damageShip` call and the Close Shave check:

```
const applied = damageShip(h.damage, h.x, h.y);
if (applied && h instanceof HunterSatellite && !game.ship.dead && game.ship.hp < 10)
  game.stats.closeShave = true;
// CS023: the contact is mutual. `false` = no score, no achievement counters (FORK-E) — the
// existing awardScore contract, so garbage/splits/powerups still drop (C13). NOT gated on
// `applied`: an auto-shield save (FLAG-CS023-k) still happened, physically.
if (h instanceof HunterSatellite) destroyHunter(h, false); else destroyDebris(h, false);
```

`damageShip` must be called **first**: it reads `h.x`/`h.y` for the knockback vector. The saucer sub-loop takes the matching one-line `destroySaucer(s, false)` in its own `else`.

Three properties must survive, all already true and all easy to break:
1. **The `hazards` array is a spread copy** (`[...game.debris, ...game.hunters]`), so children pushed during iteration are not visited this frame. Keep it.
2. **The loop does not `break`.** It never has — that is what lets a shielded ship deflect every overlapping hazard, and shielded behaviour is out of scope (C10).
3. **`h.dead` is checked at the top of each iteration.**

### 4.4 The bounce primitive — `debrisBounce(a, b)`

A sibling of `shieldBounce`, placed immediately after it, and derived from it rather than re-derived from scratch. Three cases, dispatched on rail state:

| `a` | `b` | Outcome |
|---|---|---|
| free | free | elastic exchange along the contact normal, mass-weighted by `DEBRIS_MASS`, restitution `DEBRIS_BOUNCE_RESTITUTION` |
| free | on a rail | **`shieldBounce`'s exact shape** with `a` in the ship's role: reflect `a`'s approaching component *in `b`'s frame*, apply the separation floor, push `a` out of overlap, `wrap(a)`. `b` is untouched. |
| both on rails | — | **no-op** (C11: unreachable at the shipped geometry; assert it) |

`shieldBounce`'s three load-bearing properties carry over verbatim and for the same reasons: only the **approaching** component is reflected (a body already separating is never yanked backwards); the separation floor is applied **last** and is not optional (reflection alone leaves two touching stationary bodies touching, which is exactly the case this exists to fix); and every measurement is wrap-aware — `angleTo` for the normal, `dist2` for the test, `wrap()` after the push. On an orbit level the rings straddle the seam routinely.

**`debrisBounce` also clears `drifting` on any body it touches** (§4.7) — the single place two of Paul's four "direction is changed" interrupts converge.

### 4.5 The debris↔debris pass (`update()`, immediately before *"--- Cleanup ---"*)

```
for (let i = 0; i < game.debris.length; i++) {
  const a = game.debris[i];
  if (a.dead) continue;
  for (let j = i + 1; j < game.debris.length; j++) {
    const b = game.debris[j];
    if (b.dead) continue;
    const r = a.radius + b.radius;
    if (dist2(a, b) < r * r) debrisBounce(a, b);
  }
}
```

Same shape as `coalesceGarbage`'s pair walk, deliberately — it is the file's established idiom and the pass the frame-budget gate already knows how to instrument. It iterates the live array (not a spread copy) because nothing here creates or destroys entities. It must run after `game.debris.forEach(a => a.update(dt))` has derived this frame's rail positions, which every collision pass already does.

### 4.6 UFO ↔ debris (`update()`, beside the new pass)

```
for (const s of game.saucers) {
  if (s.dead) continue;
  for (const a of game.debris) {
    if (a.dead) continue;
    const r = s.radius + a.radius;
    if (dist2(s, a) < r * r) { destroySaucer(s, false); debrisBounce(a, s); break; }
  }
}
```

`destroySaucer` gains `awardScore = true`, gating `addScore` and both achievement counters — **and nothing else.** `dropPowerup` stays unconditional, which is what makes FORK-F true and what keeps the function's contract identical to `destroyHunter`'s (C13). Its two existing callers pass nothing and are unchanged.

`debrisBounce(a, s)` treats the saucer as a free body — which it is; it never wraps and dies on travel — so a rail-borne satellite is untouched and a free one is knocked off course and disarmed. The saucer being dead by then does not matter: `debrisBounce` reads `s.x`/`s.y`/`vx`/`vy`, all still valid this frame, and writes only to `a`.

### 4.7 The inward drift (FORK-B/C ✅)

**Two derived radii, one guessed acceleration, one derived cap, one field.** The radii are derived from the ring geometry, never written as literals, so a future geometry retune carries them:

```
// The ring geometry SUPPLIES these two distances; it does not SCOPE them. The drift runs on every
// level, field and orbit alike (C15) — deriving from the rings is how the numbers stay in step with
// a geometry retune, nothing more. Named DEBRIS_*, not ORBIT_*, so that stays legible.
const DEBRIS_DRIFT_TRIGGER_R = ORBIT_INNER_RADIUS + 3 * ORBIT_RADIUS_STEP;  // 814 — ring 4's radius
const DEBRIS_DRIFT_TARGET_R  = ORBIT_INNER_RADIUS + 2 * ORBIT_RADIUS_STEP;  // 676 — ring 3's radius
const DEBRIS_DRIFT_ACCEL     = 30;   // px/s^2 toward the dock. FLAG-CS023-d: the one guess left.
```

**The cap** is a helper, not a constant, because it depends on three live debug knobs and on an arbitrary-length fast-ring list (C14):

```
// The fastest tangential speed any satellite reaches on a rail: max over rings of angVel x radius.
// MUST scan every ring — angVel is not uniform, so the outermost ring is not always the fastest
// (at ORBIT_FAST_RING = [1,2] the maximum falls on ring 2). Reads the live DEBUG knobs, so a gate
// retune of orbitAngVel / orbitFastMult / orbitCount carries the cap with it.
function maxOrbitSpeed() { ... }      // 255.7 px/s at the shipped constants (ring 4)
```

Called **once per frame** in the drift pass and passed down — never once per body, which would be a four-iteration loop times up to ~250 bodies for a value that cannot change within a frame.

`DebrisSatellite` gains **`drifting`** (boolean, absent/false by default) — the same optional-field idiom as `orbitCenter`, so every field satellite, split child and title-screen decoration is byte-for-byte what it is today until something arms it.

**The arming pass**, once per frame in `update()`, after the entity updates and before the collision passes. **It runs on every level** (C15) — no archetype gate. `update()` already early-returns unless `game.state === "playing"`, so `game.dock` is guaranteed live; a defensive `if (!game.dock) return;` is in-idiom and free:

1. If **any** live debris — orbiting or free (FLAG-CS023-a) — is within `DEBRIS_DRIFT_TRIGGER_R` of `game.dock`, return. Wrap-aware `dist2`, never raw subtraction.
2. Otherwise set `drifting = true` on every live debris body that has **no orbit state** and is **beyond `DEBRIS_DRIFT_TARGET_R`** from the dock. On a field level no body ever has orbit state, so that clause is simply always true there.

**The force and the cap**, for each body with `drifting`:

```
const [dx, dy] = shortDelta(d.x, d.y, game.dock.x, game.dock.y);   // toward the dock, wrap-aware
const dist = Math.hypot(dx, dy) || 0.0001;
if (dist <= DEBRIS_DRIFT_TARGET_R) { d.drifting = false; }        // arrived — released, keeps its velocity
else {
  const ux = dx / dist, uy = dy / dist;
  d.vx += ux * DEBUG.debrisDriftAccel * dt;
  d.vy += uy * DEBUG.debrisDriftAccel * dt;
  // CAP THE INWARD COMPONENT ONLY. Tangential motion is the body's own drift and is untouched,
  // so a piece that was already travelling sideways keeps doing so — this bounds how fast the
  // field closes in, not how the pieces move once they are here.
  const vr = d.vx * ux + d.vy * uy;                                // inward radial component
  if (vr > cap) { const excess = vr - cap; d.vx -= excess * ux; d.vy -= excess * uy; }
}
```

Flat force, no falloff, no damping (FLAG-CS023-e) — the cap is what bounds it. Release is **per-piece** and leaves the accumulated velocity intact: a released piece coasts on through the shell region rather than parking, which is what makes the arrival a live population instead of a second ring. Because the cap held while it was drifting, **nothing arrives faster than a satellite on the outer fast ring** — a speed the player has already had to read on a rail.

The cap is applied only while `drifting`. A released or never-armed body is not clamped by anything except the standing `DEBRIS_SPEED_CAP` guard rail, which this can never approach. **On a field level the cap never binds at all** — the longest possible armed fall is 792 px, worth 218 px/s against a 255.7 px/s ceiling (C15) — so it is orbit-scale machinery that sits inert on the smaller world rather than needing a per-archetype variant.

**Disarming.** `drifting` is cleared at exactly four sites, one per interrupt Paul named:
- **arrival** — the branch above;
- **contact with another satellite** and **contact with a UFO** — both inside `debrisBounce` (§4.4), which is why they are one line rather than two;
- **player shot** and **ship contact** — no code needed: both destroy the body, and `destroyDebris`'s children are fresh objects with `drifting` absent (FLAG-CS023-c).

**What the drift does not do:** it never reads or writes `orbitCenter`/`orbitRadius`/`orbitAngle`/`orbitAngVel`, never touches `game.orbitLayout`, and never moves a rail-borne body. Rail-borne satellites participate in the trigger and in nothing else.

### 4.8 New constants and knobs

```
const DEBRIS_MASS = { 3: 9, 2: 3, 1: 1 };   // FORK-D: mass conserved through the 3-way split
const DEBRIS_BOUNCE_RESTITUTION = 1.0;      // mirrors SHIELD_BOUNCE_RESTITUTION
const DEBRIS_BOUNCE_MIN = 40;               // px/s separation floor — SHIELD_BOUNCE_MIN's reason,
                                            // scaled to satellite speeds (18-267 px/s, not the ship's 520)
```

Registry, **appended after the existing ORBIT block** (FLAG-CS023-o), `def` derived from the consts as every ORBIT entry already is:

| id | label | def | min | max | step |
|---|---|---|---|---|---|
| `debrisDriftAccel` | Debris inward drift | `DEBRIS_DRIFT_ACCEL` | 0 | 200 | 5 |
| `debrisBounceRestitution` | Satellite bounce restitution | `DEBRIS_BOUNCE_RESTITUTION` | 0 | 1.5 | 0.05 |

`0` on the first disables the drift entirely, which is the gate's A/B. **No knob is added for the cap** — it is derived from `orbitAngVel`/`orbitFastMult`/`orbitCount`, which are already knobs, so retuning those moves it automatically.

Both entries stay **physically inside the ORBIT block** even though the drift is universal (C15). Moving them would insert mid-registry and shift every row index below, which is exactly what append-only discipline exists to prevent; a one-line comment at the site records that the position is a layout artefact and not a scoping claim.

---

## 5. Difficulty scaling across the game

| Lever | Constants | Curve | Note |
|---|---|---|---|
| Orbit world size | `WORLD_SIZE_ORBIT` 16 → **9** | archetype-keyed binary | Existing row; value only |
| Orbit ring geometry | `ORBIT_INNER_RADIUS` 400, `ORBIT_RADIUS_STEP` 138 | flat | Corridors 266/46/46/46 px |
| Orbit ring ramp | `activeRingsFor()` | **occurrence-scaled, now INNERMOST-first** | **The archetype's escalation axis** (C5) — 1 ring at level 3 to 4 at level 12, flat to 63 |
| Orbit satellite count | `ORBIT_DENSITY` flat 0.12 | flat, 3 → 16 by ring count | The dial if the level 12–63 plateau reads as repetitive |
| Orbit gap multiplier | `ORBIT_GAP_MULT` 2.5 → 1.8 | occurrence-scaled | Unchanged and now nearly unobservable (C5) — record it, don't delete it |
| Debris inward drift | `DEBRIS_DRIFT_*` + `maxOrbitSpeed()` | flat, event-triggered, **every level** | **New row.** Not difficulty-scaled by design; the cap tracks the orbit motion knobs and never binds on a field level (C15) |
| Satellite bounce | `DEBRIS_MASS`, `DEBRIS_BOUNCE_*` | flat | **New row.** Not difficulty-scaled by design |

---

## 6. Test plan (headless, `scratchpad/`, per-phase files)

Every item drives the **real** `startGame` / `nextWave` / `update(1/60)` / `destroyDebris` / `destroySaucer` / `draw` path. Nothing under test is reimplemented; every expectation is recomputed from the same `generateOrbitLayout` + `activeRingsFor` + `levelDef` the shipped code is wired to.

1. **Geometry and ramp.** The §1.4 table reproduced by a real `nextWave()` at every orbit level 3 → 63, grouped by `orbitRadius` and never by array position. The rings present are always the **innermost** *n*, ring 1 is always among them, and the totals are 3/6/11/16 at occurrences 1–4. Counts computed through the generator, with C5's single-satellite step at occurrence 3 asserted as the *only* density-driven change across the whole curve.
2. **World size.** Every orbit level exactly 3840×2160, every field level exactly 2560×1440, through 30 consecutive real transitions; the round trip landing on `=== 2560/1440`; `dmax` 1020/660; CS022 P1 §C's carried-entity bearing/distance claims re-run at the new sizes.
3. **Budget and clamp.** Outer edge 860 against 1,060; `orbitEffectiveCount` returning 5 at a requested 5 **and** at a requested 6 (C6), asserted as a change against a pinned-SHA CS022 reference module, not as a fresh literal.
4. **Fast rings.** Rings 2 and 4 carry `ORBIT_ANG_VEL × ORBIT_FAST_MULT` and rings 1 and 3 do not, at every occurrence, keyed by ring index — including the occurrences where a fast ring is not yet present (FLAG-CS023-l). A control asserting the CS022 scalar behaviour must now fail. **Lists of length 0, 1, 3 and 4 all handled** (C3 — the point of the type change).
5. **Ramp direction as a behavioural claim, not a source regex.** Level 3 lays exactly one ring and its radius is `ORBIT_INNER_RADIUS`; a pinned CS022 reference build lays one ring at `ORBIT_INNER_RADIUS + 3 × ORBIT_RADIUS_STEP` from the same call. `layout.rings[k].index === k` at every occurrence (§1.4's reversal of the CS022 P3 known issue).
6. **Ship ram, all three targets.** A large satellite rammed unshielded: ship loses `DEBRIS_DAMAGE[3]`, satellite `dead`, three mediums pushed, `DEBRIS_GARBAGE` canisters emitted — and **`game.score` unchanged, `debrisKills` unchanged, `bestDebrisGame` unchanged** (FORK-E). Same for a large Hunter, which must additionally **still drop its powerup** (C13), and both saucer sizes, which must **still drop theirs** (FORK-F). **Plus the negative:** a *shielded* ram byte-identical to a pinned pre-CS023 build (C10), and a ram during i-frames doing nothing at all.
7. **Multi-overlap (FLAG-CS023-k).** Three satellites staged overlapping the ship on one frame: all three destroyed, exactly one `damageShip` application, `dmgThisWave` incremented once, no second hit for a full `HIT_STUN_DURATION`.
8. **Auto-shield interaction.** `settings.autoShield` on, hull at/below `LOW_HP_THRESHOLD`: hull unchanged, `AUTO_SHIELD_SCORE_PENALTY` applied, **hazard still destroyed**.
9. **Bounce physics as physics, not as restated code.** Over ≥40 incoming velocities per case: momentum conserved at the `DEBRIS_MASS` ratios; kinetic energy conserved at restitution 1.0 and strictly decreasing below it; a separating body never reversed; separation achieved within one frame in every case. A naive non-wrap normal as a **live control** that must fail at the seam.
10. **Bounce asymmetry.** A free satellite driven into a rail-borne one across 300 real frames: twelve fields of the rail body byte-identical throughout, its distance to `orbitCenter` never leaving `orbitRadius`, the free one's outbound velocity matching the closed form. Ring-vs-ring asserted **unreachable** (C11) by sweeping every adjacent-ring satellite pair at every occurrence and showing the minimum separation is 46 px.
11. **UFO kills.** A saucer driven into a satellite: `dead`, **zero** score movement, `saucerKills`/`smallSaucerKills` unchanged, **one powerup pushed** (FORK-F), the satellite bounced-or-untouched per its rail state and **disarmed** if it was drifting. A control proving the bullet and shield kills still award score and stats.
12. **UFO shot → satellite is unchanged (C1).** Byte-identical to a pinned pre-CS023 build over a seeded run — a *regression* test for something the changeset deliberately does not touch.
13. **Drift trigger.** With one ring satellite alive inside 814 px, nothing is armed. Destroy it and, on the next frame, every free debris body beyond 676 px is armed and nothing inside it is. Rail-borne bodies are **never** armed regardless. **The same trigger and arming behaviour proven on a FIELD level** — same radii, same lateness, no archetype gate anywhere (C15). Both radii asserted as *derived* from `ORBIT_INNER_RADIUS`/`ORBIT_RADIUS_STEP`, never as 814/676 literals.
14. **Drift motion and the cap.** An armed piece's inward velocity component increasing by exactly `DEBUG.debrisDriftAccel × dt` per frame, measured along the wrap-aware dock vector, with its tangential component untouched — then **plateauing at `maxOrbitSpeed()` and never exceeding it**, over a fall long enough to reach it (≈8.5 s / 1,090 px at the shipped values). A tangentially-moving piece proving the cap clamps the *radial* component only and leaves total speed above the cap where the tangential part warrants it. A piece released at the target radius keeping its accumulated speed, and that speed being ≤ the cap. **On a field level, the cap asserted never to bind** — the longest armed fall (792 px) arrives at ~218 px/s, and a piece must reach the target without ever being clamped (C15).
15. **The cap is derived, and derived correctly (C14).** `maxOrbitSpeed()` equals the max over rings of `angVel × radius` at the shipped `[2, 4]` (ring 4, 255.7 px/s) — **and, in a sandbox with `ORBIT_FAST_RING = [1, 2]`, equals ring 2's 169.0 px/s rather than the outermost ring's 85.2.** A "use the outer ring" mutant must fail this. Also: moving `DEBUG.orbitAngVel` or `DEBUG.orbitFastMult` moves the cap, and the helper is called **once per frame**, not once per body.
16. **Drift release and disarm.** All four interrupts driven for real: arrival, satellite contact, UFO contact, and destruction by shot and by ram. The contact cases additionally prove the *other* body's state is correct (untouched if rail-borne, bounced and disarmed if free). A split child of an armed parent is **not** armed (FLAG-CS023-c).
17. **Drift edge cases.** An armed piece carried through a real `resizeWorld` shrink keeps `drifting` and re-homes with the rest. `game.dock` is re-created every `nextWave()` — assert the force follows the new dock and no piece keeps a stale centre. An armed piece that coalesces, is scooped, or is destroyed leaves nothing dangling. A seam-straddling case with a naive-arithmetic control that would push the wrong way.
18. **⛔ FRAME-BUDGET GATE.** At level 21 with the full shell plus field component, drive a real progressive full harvest. Gate on **deterministic counters** — the debris pair-check count *and* `coalesceGarbage`'s inner-loop iterations, in an instrumented copy of the real source, one increment per site. **Derive both ceilings before measuring** and document the derivation from CS022 P3's 49,203-check measurement and the entity-count ratio. Wall time (median/p95/p99/worst) and peak simultaneous entities are **reported, not asserted** — headless Node timing is GC-noisy, which is exactly why CS022 P3 gated on a counter. If a ceiling is breached, **stop and report**; the four density sliders are the first lever and a spatial hash is its own changeset.
19. **Determinism.** Every new file byte-identical across three consecutive runs under a seeded LCG, with any unpinned `Math.random()` site named.
20. **`AudioSys.ctx` null smoke** across a real ramp, plus `node --check` and source pins for every constant this changeset moves and every one it does not.

---

## 7. What CS023 does NOT touch

- **Shielded contact** (C10) — `shieldDeflect`, `shieldBounce`, the homing-Hunter shield kill, `SHIELD_HIT_COST`, `game.stats.deflects`.
- **UFO shots vs satellites** (C1) — already shipped, pinned as a regression.
- **The `awardScore` contract** (C13). It gates score and achievement counters; it has never gated a drop, and CS023 does not make it start.
- **Orbiting satellites' motion.** No rail is ever re-radiused, re-spaced or left. The drift acts only on free bodies (FORK-B).
- **The tow chain**, `breakChain`, the chain-guard absorb cooldown, and the hazards-vs-chain scan. Satellites gain no new way to cut a tow.
- **`coalesceGarbage`** and the whole garbage/clump system. Canisters do not bounce and do not drift; they coalesce, which is their own mechanic.
- **Hunter speed/turn rates** (frozen at level-1 values since CS018 P4), the large-Hunter cap table, and both Hunter producers. Hunters do not drift — they home.
- **`levelDef`** entirely: `orbitRings`, `fieldCount` and its recursion, `junkCount`, the payload curve, the saucer tier tables.
- **The three frozen `localStorage` keys.** The two new debug knobs ride the existing `afd_settings_v1.debug` object under the standing known-value-else-default rule. No schema bump, ever.
- **`WORLD_SIZE_FIELD`** and every field level's play, which must come out byte-identical.

---

## 8. Retirement ledger

| Symbol | Fate | Why |
|---|---|---|
| `ORBIT_FAST_RING` as a scalar | **Type change → list of any length** | C3 / FORK-G. A widening, not a retirement; the one consumer, the one generator test, and the drift's cap (C14) all move. |
| `activeRingsFor`'s outermost-first order | **Reversed in place** | FORK-A. One line of code, a whole comment block of rationale, and two now-false notes about array position ≠ ring index. |
| `destroySaucer(s)` | **Gains `awardScore = true`** | FORK-E/F. Brings it into line with `destroyDebris`/`destroyHunter`; gates score and stats only, never `dropPowerup` (C13). |
| `ORBIT_GAP_MULT` occurrence curve | **Kept, nearly unobservable** | C5. Record the fact; do not delete a working mechanism because one density array silenced it, and do not retune a curve that is not connected to anything. |
| `ORBIT_DENSITY`'s rhythm comment | **Deleted** | C5 / §4.1. There is no rhythm at a flat curve. |
| `ORBIT_GRAVITY_*` constants and the `orbitGravityAccel` knob | **Renamed → `DEBRIS_DRIFT_*` / `debrisDriftAccel`** (P4b) | C15. The `ORBIT_` prefix is what made a universal mechanic read as archetype-scoped once already; the radii keep deriving from the ring geometry. Renaming the knob id orphans one saved value under the standing known-value-else-default rule — one slider resets to default once, no schema bump. |
| `ORBIT_RADIUS_STEP_PAD` | Still retired, still zero readers | CS022 P2. Unchanged by this round. |
| `generateOrbitLayout`'s `activeRings` / `inactive` | **Kept and still used** | The ramp survives; only its direction changed. |