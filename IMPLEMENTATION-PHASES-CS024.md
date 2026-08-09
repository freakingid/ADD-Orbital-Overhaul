# IMPLEMENTATION PHASES — Changeset 024

Companion to `PLANNED-FEATURES-CS024.md`. Dependency-ordered. **One phase per
session, one commit per phase, on `main`.** Claude Code commits; Paul pushes.

**Baseline:** `4eb6493`, `GAME_VERSION` `"1.0.0.22"`. Target: `"1.0.0.24"`
(P7 owns the bump — `.23` is skipped deliberately, see spec §0).

## Phase map

| Phase | Scope | Model | Effort | `ultrathink` |
|---|---|---|---|---|
| **P0** | CS023 supersession — docs only | Sonnet | low | no |
| **P1** | Orbit + drift excision (code, tests, tool) | **Opus** | high | **yes** |
| **P2** | Dead-code sweep + registry prune | Sonnet | medium | no |
| **P3** | Gameplay removals: canister, ambient Hunter, garbage decay | **Opus** | high | **yes** |
| ⛔ | **GATE A** — blocking playtest | — | — | — |
| **P4** | The odometer mechanism | **Opus** | high | **yes** |
| **P5** | Lever wiring + UFO per-size independence | Sonnet | high | no |
| **P6** | Count-only powerups + Engine-as-fuel | **Opus** | high | no |
| ⛔ | **GATE B** — blocking playtest | — | — | — |
| **P7** | Retune, version bump, full doc rewrite | **Opus** | high | no |

**Setting the model/effort in Claude Code:** use the session-level `/model`
command before pasting the prompt. Where the table says `ultrathink`, the keyword
is already baked into the prompt text below at the specific sub-problem it
applies to — do not add it as a separate message.

**Every prompt below assumes these standing rules and does not restate them:**
read `CLAUDE.md` then `STATUS.md` before touching code; update `STATUS.md` at the
end of the session; commit but do not push; surface genuine design decisions
rather than inventing them; prefer `str_replace` over full-file rewrites; a phase
is not done until its headless test passes.

---

## P0 — CS023 supersession

**Model: Sonnet · Effort: low**

> This is a documentation-only phase for Changeset 024. **Do not touch
> `asteroids-deluxe.html` or anything in `scratchpad/`.**
>
> Context: CS023 landed phases P1 through P4c and was then interrupted. P5 —
> which owned the version bump and the entire doc sweep — never ran. So
> `GAME_VERSION` is still `"1.0.0.22"`, and `ORBITAL-OVERHAUL-GDD.md`,
> `GDD-VERSION-HISTORY.md` and `DIFFICULTY-LEVERS.md` all still describe the
> CS022 build. CS024 is about to delete most of what CS023 landed, so those
> docs will **not** be back-filled.
>
> Do three things:
>
> 1. Append one consolidated entry to `GDD-VERSION-HISTORY.md` recording that
>    CS023 landed P1–P4c (orbit shell retune to size-9 / 400-200 geometry;
>    `debrisBounce` satellite-vs-satellite elastic bounce; mutual collision
>    damage; the inward debris drift), that P5 never ran, and that the changeset
>    is **superseded by CS024** rather than completed. State plainly that
>    `GAME_VERSION` was never bumped for it and that CS024 goes straight to
>    `1.0.0.24`, skipping `.23`.
> 2. Add a short, dated banner at the top of `ORBITAL-OVERHAUL-GDD.md` §2 noting
>    that the orbit-level material (§2.13.1 and every §2 reference to the orbit
>    archetype) describes a system scheduled for removal in CS024, and that the
>    document is between changesets. Do **not** delete any §2 content — CS024 P7
>    owns the rewrite.
> 3. Add the same one-line caveat at the top of `DIFFICULTY-LEVERS.md`.
>
> Then read `PLANNED-FEATURES-CS024.md` end to end and report anything in it that
> contradicts what you find in the live build. Do not fix anything — report only.
>
> **TRAP 1:** `GAME_VERSION` must remain `"1.0.0.22"`. P7 owns the bump.
> **TRAP 2:** `git diff --name-only` must show only the three doc files plus
> `STATUS.md`.

**Commit:** `cs-24 p0: declare CS023 superseded, doc banners`

---

## P1 — Orbit + drift excision

**Model: Opus · Effort: high · `ultrathink` baked in**

> Changeset 024, Phase 1. Implement per `PLANNED-FEATURES-CS024.md` §1.1, §1.5
> and §4.1. **Orbit levels are removed from the game permanently and will not be
> reintroduced.**
>
> **Grep every anchor by symbol before you edit anything.** This spec was written
> against `4eb6493` and any line number in it is an estimate.
>
> **Remove from `asteroids-deluxe.html`:**
>
> - The entire `ORBIT_*` constants block: `ORBIT_INNER_RADIUS`,
>   `ORBIT_RADIUS_STEP`, `ORBIT_RADIUS_STEP_PAD`, `ORBIT_DENSITY`,
>   `ORBIT_GAP_MULT`/`_FLOOR`/`_STEP`, `ORBIT_SAFETY_MARGIN`, `ORBIT_ANG_VEL`,
>   `ORBIT_FAST_MULT`, `ORBIT_FAST_RING`, `ORBIT_SPAWN_TRIES`,
>   `ORBIT_LEVEL_EVERY`, `ORBIT_RING_COUNT`.
> - Every orbit function: `generateOrbitLayout`, `placeOrbitRing`,
>   `nearestOrbitDist`, `spawnSafeOrbitLayout`, `orbitTangent`,
>   `orbitSyncVelocity`, `orbitGapMult`, `orbitRadiusStepFor`,
>   `orbitEffectiveCount`, `orbitEffectiveGapMult`, `spawnOrbitWave`,
>   `rerollOrbitStartAngles`, `activeRingsFor`.
> - The CS023 inward drift in full: `DEBRIS_DRIFT_TRIGGER_R`, `_TARGET_R`,
>   `_ACCEL`, `updateDebrisDrift()`, `maxOrbitSpeed()`, its `update()` call
>   site, the `drifting` field and all four of its disarm sites.
> - `game.orbitLayout` and every reader.
> - The `r` start-angle reroll keybind (debug screen only).
> - The 11 ORBIT debug knobs plus `debrisDriftAccel` — remove the registry
>   entries outright. This is a deliberate rebuild, not an append; row indices
>   below them will shift and that is expected. Orphaned keys in
>   `afd_settings_v1.debug` are ignored under the standing
>   known-value-else-default rule: **no schema bump, no migration, no shim.**
> - Delete the file `tools/orbit-lab.html`.
>
> **Three consequences that are not obviously "orbit" — ultrathink each of these
> before writing the edit, because each one is a place where a plausible-looking
> change is subtly wrong:**
>
> 1. **`debrisBounce()` must simplify, not merely lose a branch.** Its dispatch
>    is currently `const aFixed = !!a.orbitCenter || a instanceof Saucer` (same
>    for `b`). With no rails this reduces to the Saucer test alone, and the
>    **rail/rail no-op branch becomes unreachable and must be deleted.** The
>    mass-weighted free/free exchange and the free/fixed branch (Saucer as an
>    immovable wall) both stay and must remain **behaviourally byte-identical** —
>    momentum conserved at the `DEBRIS_MASS` ratios, tangential components
>    exactly preserved, the `DEBRIS_BOUNCE_MIN` floor on relative separation
>    speed applied as equal-and-opposite impulses, the overlap push split in
>    inverse proportion to mass. Prove all of that still holds rather than
>    assuming the deletion was neutral.
> 2. **`DebrisSatellite` loses `orbitCenter`, `orbitRadius`, `orbitAngle`,
>    `orbitAngVel` and its rail motion mode.** Free-body motion only. Check
>    `shieldBounce` and `shieldDeflect` — they gate on `orbitCenter` too.
> 3. **`worldSizeFor()` loses its archetype key and returns `WORLD_SIZE_FIELD`
>    unconditionally.** Do **not** delete `worldSizeFor`, `resizeWorld`,
>    `worldDims`, the size table, `WORLD_SIZE_MAX` or `WORLD_SIZE_ORBIT`'s slot
>    in that table. Paul explicitly wants the 9× path (3840×2160) kept live and
>    testable for possible future use. `STAR_COUNT` must go on deriving from
>    `WORLD_SIZE_MAX`. `resizeWorld` will now never be called with a different
>    size in normal play — keep it working anyway and keep it under test.
>
> **`levelDef()` keeps existing this phase**, minus its `archetype`,
> `orbitRings` and `fieldCount` columns. P4 replaces it entirely; do not
> pre-empt that. `nextWave()` loses its archetype branch and calls
> `spawnFieldSatellites()` unconditionally.
>
> **Tests.** Delete outright, since their entire subject is gone:
> `test-cs021-p1.js`, `test-cs021-p1b.js`, `test-cs021-p2.js`,
> `test-cs021-p3.js`, `test-cs022-p1.js`, `test-cs022-p2.js`,
> `test-cs022-p3.js`, `test-cs023-p1.js`. Prune the orbit-dependent sections of
> `test-cs023-p2.js` and `test-cs023-p4.js` — `p4`'s subject is the drift, so
> if nothing survives, delete it. Elsewhere, standing TRAPs and registry-count
> pins get **inverted to their positive successor** with a `REPOINTED BY CS024
> P1` note, per the convention this codebase has used since CS017 P6 — never
> silently deleted. **Grep for the pins; do not trust any list, including this
> one.** At CS023 P4 a spec predicting two affected files hit twelve.
>
> **New `scratchpad/test-cs024-p1.js`** proving: zero occurrences of `orbit` or
> `Orbit` as an identifier anywhere in the source (comments referencing the
> removal are fine and should be checked for separately); `debrisBounce`'s two
> surviving branches behaving identically to before across a sweep of size pairs
> and incoming velocities; a real `startGame`/`nextWave` run at levels 1–20 with
> every level the same world size; `resizeWorld` still correct when driven
> directly at size 9; and the registry's new entry count.
>
> **TRAP 1:** `GAME_VERSION` stays `"1.0.0.22"`.
> **TRAP 2:** mutual collision damage (CS023 P3) is **not** in scope and must be
> byte-unchanged — pin the hazards-vs-ship block and `destroySaucer` against
> `HEAD`.
> **TRAP 3:** the docs (`ORBITAL-OVERHAUL-GDD.md`, `GDD-VERSION-HISTORY.md`,
> `DIFFICULTY-LEVERS.md`) are P7's job. Do not touch them.
> **TRAP 4:** measure the full regression baseline **before** editing, then run
> it twice consecutively after. Report both.

**Commit:** `cs-24 p1: remove orbit levels and the inward drift`

---

## P2 — Dead-code sweep + registry prune

**Model: Sonnet · Effort: medium**

> Changeset 024, Phase 2. Implement per `PLANNED-FEATURES-CS024.md` §1.6 (the
> `leverScale` row only), §1.8 and §5. This is a **removal-only** phase — no
> gameplay behaviour may change.
>
> **Delete these constants** (each grep-confirmed to have zero live readers —
> **re-confirm each one yourself before deleting it**): `CARGO_GROW_PER`,
> `DEBRIS_SPEED_PER_WAVE`, `DEBRIS_COUNT_MAX`, `DEBRIS_COUNT_HARD_MAX`,
> `SAUCER_GAP_FLOOR_MIN`, `SAUCER_GAP_FLOOR_MAX`, `SAUCER_GAP_CEIL_MIN`,
> `SAUCER_GAP_CEIL_MAX`, `SAUCER_FIRE_MULT_FLOOR`, `SAUCER_FIRE_MULT_CEIL`,
> `SAUCER_AIM_ERR_FLOOR`, `SAUCER_AIM_ERR_CEIL`, `SAUCER_ACCURACY_RAMP_SCALE`,
> `GARBAGE_DECAY`, `GARBAGE_CLUMP_MAXSPD`. Several are referenced in comments
> only — update or remove those comments rather than leaving them pointing at
> nothing.
>
> **`DEBRIS_SPEED_CAP` STAYS.** It is insurance, and junk speed is about to
> become a live debug slider. Do not remove it as part of this sweep.
>
> **Delete the `leverScale` mechanism and BAKE IN its shipped effect.** Remove
> `leverScale()`, `LEVER_POWERUP_SIZE` and `LEVER_DOCK_SIZE`. Both levers have
> shipped `enabled: false` since v3.4 P2, which means the mechanism's *only*
> observable effect has always been that powerups and the dock render and
> collide at **2×**. Preserve that exactly: `POWERUP_RADIUS` 15 → **30**,
> `DOCK_RADIUS` 44 → **88**. **Do NOT "restore" 1×** — that would be an
> unrequested balance change, and `DIFFICULTY-LEVERS.md` has warned against
> exactly this cleanup for several changesets. Prove the baked values produce
> identical pickup radii and dock neighbourhood geometry to the pre-edit build.
>
> **Registry:** remove the `freqJitter` knob, keeping the constant frozen at
> **25%** at `jitteredInterval()`'s site. Everything else in the registry is
> P5's to rebuild — do not restructure sections this phase.
>
> **New `scratchpad/test-cs024-p2.js`** proving zero readers of every deleted
> symbol, the baked 2× radii matching a pre-edit reference, and `jitteredInterval`
> producing the same distribution shape at the frozen 25%.
>
> **TRAP 1:** `GAME_VERSION` stays `"1.0.0.22"`.
> **TRAP 2:** no gameplay change. The full regression suite must pass with zero
> behavioural diffs beyond the documented RNG/wall-clock noise files.
> **TRAP 3:** docs untouched.

**Commit:** `cs-24 p2: dead-constant sweep, bake leverScale 2x, freeze freqJitter`

---

## P3 — Gameplay removals

**Model: Opus · Effort: high · `ultrathink` baked in**

> Changeset 024, Phase 3. Implement per `PLANNED-FEATURES-CS024.md` §1.2, §1.3,
> §1.4, §3.1, §3.2, §3.3 and §4.2–§4.4. **This is the phase where the game
> actually changes**, and the three removals below are load-bearing on each
> other — read all three before writing any of them.
>
> **1. Remove the bonus canister.** `BONUS_CANISTER_PIECES`,
> `BONUS_CANISTER_SCORE`, `BONUS_SPAWN_CHANCE_EARLY`/`_LATE`, `BONUS_RING_PAD`,
> `bonusSpawnChance()`, the `nextWave()` spawn block, `Garbage.bonus`,
> `drawBonusRing()`, the `COLOR.garbageBonus` branch in `Garbage.draw()`, and
> the one-shot payout plus flag-clear in the scoop intake path.
>
> **2. Remove the ambient Hunter producer.** `HunterSatellite.spawnCore()`,
> `game.hunterTimer`, its `startGame` reset, and the whole `update()` spawn
> block including the `game.wave >= 2` gate. **Hunters may now arise from
> exactly one source: garbage coalescing to `HUNTER_COALESCE_COUNT` (12)
> pieces.** `noteLargeHunterSpawn()` stays — it still arms the Hunter's Bane
> achievement on the 0→1 transition, now driven solely by conversion.
>
> **3. Remove garbage decay and make loose garbage permanent.** Delete
> `Garbage.decay`, the `decay -= dt` / `dead` block, `GARBAGE_FADE`, both
> blink-out render branches, and the `garbageLifetime` debug knob. **Removal 2
> is only survivable because of removal 3** — without a permanent supply, the
> coalescence pipeline is the only Hunter producer and would rarely fire.
>
> **ultrathink the density ceiling.** `nextWave()` clears nothing and wave-clear
> triggers on `game.debris.length === 0` alone, so loose canisters now carry
> across levels with no bound, and `coalesceGarbage()` is an O(n²) pair walk
> (~44,500 checks/frame at the CS023 peak). Add:
>
> - `GARBAGE_SOFT_MAX = 220` — above this, cull **one** piece per frame: the
>   **oldest** by cumulative age, preferring a single (`pieces === 1`) over a
>   clump when both are available.
> - `GARBAGE_HARD_MAX = 300` — a backstop; above it, cull down to the soft
>   ceiling in one pass.
> - Both as debug knobs.
> - `Garbage` gains a monotonically increasing `age`, ticked in `update()`, read
>   **only** by the cull ordering. **A merge does NOT reset it** — the retired
>   decay clock did reset on merge, and that is the opposite of what the cull
>   wants.
> - The cull is **silent** — no blink, no particle, no sound. It sits with the
>   end-of-frame cleanup filters, **after** every pass that can mark a piece
>   dead.
>
> **The ceiling must be fully deterministic. Do NOT implement frame-rate-reactive
> culling** — it would break the suite's byte-identical-across-runs discipline,
> it is a lagging indicator, and it would let unrelated background load delete
> the player's salvage. This was considered and rejected; do not reintroduce it.
>
> **4. Hunter cap.** Delete `HUNTER_CAP_STEPS` and `largeHunterCap()`. Add
> `LARGE_HUNTER_MAX = 100`, one constant, no clock. **New overflow rule:** when a
> clump reaches `HUNTER_COALESCE_COUNT` while 100 large Hunters already exist,
> **the clump is destroyed** — it does not hold at its final stage (the retired
> behaviour, which stalls the pipeline) and it does not convert. `boom()` in the
> garbage hue, and `awardScore = false` semantics: no score, no achievement
> counters.
>
> **5. Last stand.** Keep the existing behaviour exactly — while
> `game.debris.length === 0` and the ship is alive, a large core steers toward
> the ship; the moment debris reappears the block stops executing and the core
> retains whatever `vx`/`vy` it had. **Do not flip `this.homing`** (that would
> swap the silhouette and freeze the tumble). Only change: replace the hardcoded
> `HUNTER_LAST_STAND_SPEED` with a debug knob `lastStandSpeed`, default 50.
>
> **New `scratchpad/test-cs024-p3.js`** driving the real
> `startGame`/`nextWave`/`update(1/60)` path: garbage surviving indefinitely
> across several `nextWave()` calls; the soft cull firing exactly once per frame
> at the boundary and picking the oldest; the hard cull's one-pass drain; a
> coalescence run producing a Hunter end-to-end with no ambient producer present;
> the cap-overflow clump destruction with score and achievement counters provably
> unmoved; and a **deterministic frame-budget gate** on `coalesceGarbage`'s pair
> count at the soft ceiling — counter-based, never wall time, with the ceiling
> derived and written down *before* measuring.
>
> **TRAP 1:** `GAME_VERSION` stays `"1.0.0.22"`.
> **TRAP 2:** do not touch `levelDef`, the tier tables or `ramp()`. P4 owns them.
> **TRAP 3:** the tow chain is not `game.garbage` — chain nodes must never be
> culled. Prove it.
> **TRAP 4:** docs untouched.
>
> Several existing tests stage garbage and rely on it decaying. Expect a real
> repoint sweep and report every file you touch.

**Commit:** `cs-24 p3: permanent garbage, coalescence-only hunters, density ceiling`

---

## ⛔ GATE A — blocking playtest

**Do not run P4 until these are answered in `STATUS.md`'s Playtest asks.**
Questions 1–6 in `PLANNED-FEATURES-CS024.md` §6. Question 1 is the one that can
change the plan: if Hunters effectively never appear, P4 inherits a coalescence
retune it does not currently carry.

---

## P4 — The odometer

**Model: Opus · Effort: high · `ultrathink` baked in**

> Changeset 024, Phase 4. Implement per `PLANNED-FEATURES-CS024.md` §2 and §4.5.
> **This phase builds the mechanism and deletes the old one. It does NOT wire
> the levers to their call sites — that is P5.** Read Gate A's answers in
> `STATUS.md` first; if Q1 came back badly, say so and stop rather than absorbing
> a retune this phase does not scope.
>
> **Delete:** `levelDef()`, `stepAt()`, `TIER_STEPS`, `PHASE_LEN`, `LEVEL_MAX`,
> `JUNK_CYCLE`, `ramp()`, `SAUCER_SMALL_CHANCE_FLOOR`/`_CEIL`, and all 21 tier
> knobs.
>
> **Do NOT delete `difficultyFactor()`.** Its only live caller is
> `MusicSys.setIntensity()`. **Rename it `musicIntensity(wave)`** and
> `RAMP_WAVES` → `MUSIC_INTENSITY_WAVES`, curve byte-identical. Music intensity
> was never a difficulty lever and should stop being implemented as one. Prove
> the emitted intensity value is unchanged at every level 1–63.
>
> **Build the odometer.** A `LEVERS` table (spec §2.4) and one pure function
> `leverState(wave)`. Each lever is
> `{ id, floor, ceil, steps, everyNLevels?, carriesTo? }`.
>
> **ultrathink the carry arithmetic before writing it.** The semantics:
>
> - A **driver** has `everyNLevels` and advances one step every N levels.
> - A lever without `everyNLevels` advances **only** by carry.
> - When a lever passes its top step it **resets to step 0** and bumps every
>   lever in its `carriesTo` array by one step.
> - A lever whose `carriesTo` is empty and which reaches its top **PLATEAUS** —
>   pinned at `ceil`. No wrap at the end of a chain, no `LEVEL_MAX`.
> - `carriesTo` is an **ARRAY**, and that is deliberate: a single-successor
>   odometer is multiplicatively deep and would not move small-satellite speed
>   until roughly level 96.
>
> RESTRICTION — only drivers may wrap. A lever may declare carriesTo only if it also declares everyNLevels. Every carried lever plateaus at its ceiling; there is no second carry generation. This was derived by plotting the shipped tables level by level: under an unrestricted rule, ufoFlightSpeedSmall climbs 150 → 210 px/s by level 25 and then resets to 150 at level 33, making a UFO genuinely slower at level 33 than at level 25 — a difficulty regression on one of the game's most visible quantities. Three consequences, all simplifications. (1) The carry graph is depth 1, so propagation is a single pass with no iteration and no recursion: a dependent's carry count is Math.floor((wave - 1) / (everyN × steps)) of its driver, computed directly. (2) A cycle is unreachable by construction, so the load-time guard is not a cycle check — it throws if any lever declares carriesTo without everyNLevels, or names an unknown id. Same idiom as SCOOP_WIDTH[0] !== 0; a deliberate invariant, not test scaffolding, and it must say so in a comment at the site. (3) The shipped UFO table must be authored accordingly — ufoAppearFreq carries to all nine other UFO levers directly, and neither ufoFlightSpeedBig nor ufoFlightSpeedSmall declares a carriesTo. Add to the phase's test file: no lever in the shipped table returns toward its floor at any level 1–200 except a driver. That single assertion is what would have caught the defect this restriction exists to prevent.
>
> The hard part is that this must be computed **closed-form from `wave` alone**,
> not by simulating levels 1..wave in a loop — it is called at spawn sites and
> must stay cheap, and it must be pure. Derive the wrap count of each driver from
> `wave` and `everyNLevels`, then propagate carries through the graph. **The
> carry graph is a DAG, not a chain** — one lever can be bumped by only one
> parent in the shipped tables, but the code must not assume that, and it must
> not infinite-loop on a malformed table. Add a load-time structural assertion in
> the style of the existing `SCOOP_WIDTH[0] !== 0` guard: throw if `carriesTo`
> names an unknown id or if the graph contains a cycle. That guard is an
> invariant, not test scaffolding.
>
> **`leverState` must be evaluable ALONE in a bare context.** The retired
> `test-cs018-p1.js` proved this for `levelDef` by slicing the source from the
> section banner to the closing brace and running nothing else, and the new test
> does the same. Anything `leverState` reads must be inside that slice.
>
> **NOTHING may validate, clamp, reorder or assert `floor <= ceil`** — anywhere,
> ever. Several levers are inverted (a shorter delay, a smaller aim error, is
> harder), so `floor > ceil` is normal and correct. This prohibition is
> load-bearing and carries forward from the retired tier tables.
>
> Also this phase: `payloadSlots` becomes a plain fixed curve outside the
> odometer — 8 at levels 1–4, +2/level, 24 at level 12, flat forever — read by
> `nextWave()` into `game.cargoMax` exactly as `levelDef().payloadSlots` was.
>
> **New `scratchpad/test-cs024-p4.js`**: the bare-context slice; the closed-form
> result matching a brute-force level-by-level simulation at every level 1–200;
> plateau behaviour past every chain's top; the cycle and unknown-id guards
> firing; `musicIntensity` byte-identical to the retired `difficultyFactor` at
> every level; and the `payloadSlots` curve including the level-12 boundary.
>
> **TRAP 1:** `GAME_VERSION` stays `"1.0.0.22"`.
> **TRAP 2:** no call site is rewired this phase. The game's shipped difficulty
> may be temporarily frozen at whatever the removed table's absence leaves —
> say so explicitly in `STATUS.md` if so.
> **TRAP 3:** docs untouched.

**Commit:** `cs-24 p4: the lever odometer, payloadSlots curve, musicIntensity rename`

---

## P5 — Lever wiring + UFO per-size independence

**Model: Sonnet · Effort: high**

> Changeset 024, Phase 5. Implement per `PLANNED-FEATURES-CS024.md` §2.4, §2.5,
> §4.6 and §5. P4 built the odometer; this phase connects it to every call site
> and rebuilds the debug registry.
>
> **Wire each lever, reading `leverState(game.wave)` AT THE POINT OF USE** — next
> wave's spawn, next saucer's construction — never per frame, and never cached
> across an event. A debug knob change takes effect at the next relevant event,
> not retroactively on entities already on screen. This is the same discipline
> every retired mechanism followed.
>
> Consumers: `nextWave()` (junk count, all three junk speeds); `destroyDebris()`
> (split-child speeds); `coalesceGarbage()`'s inert-delay gate (`coalescePause`,
> replacing `GARBAGE_COALESCE_DELAY` / the `garbageAttractDelay` knob);
> `HunterSatellite`'s constructor (medium and small pursuit speed); the saucer
> spawn block; and `Saucer`'s constructor and `update()`.
>
> **The three junk speeds are fully independent levers**, one per size. The
> existing shared-ratio derivation from `DEBRIS_SPEEDS[3]` is removed.
>
> **Large Hunters have no speed lever** — frozen at
> `HUNTER_SPEED_CEIL[3] * HUNTER_FLOOR_FRAC` = 40.6 px/s. **All Hunter turn
> rates stay frozen.** Do not lever either.
>
> **UFO per-size independence (§4.6).** `ufoFlightSpeedPx(small)` currently
> derives big as `small * (100/150)`; that derivation goes and each size reads
> its own lever. Same for direction change, fire frequency and shot speed.
>
> Three things about the UFO that are easy to get wrong:
> - **There is exactly ONE appearance timer.** Do not build per-size spawn
>   timers. Which size spawns is a flat `Math.random() < DEBUG.smallUfoChance`
>   (default **0.20**), constant for the whole game and **not a lever**. This
>   replaces the retired `ramp(SAUCER_SMALL_CHANCE_FLOOR, ...)` roll.
> - **Big saucers stay genuinely unaimed** — `rand(0, TAU)`. `ufoAccuracySmall`
>   is small-only and takes no size parameter. Do not add a big-saucer accuracy
>   lever.
> - **`ufoFireFreq*` are MULTIPLIERS** on the shipped `SAUCER_FIRE_BIG` /
>   `SAUCER_FIRE_SMALL` ranges, not intervals, and deliberately do **not** pass
>   through `jitteredInterval()` — those ranges already draw their own random
>   value and a second pass would double the entropy.
>
> **Rebuild the debug registry (§5).** Sections in order: SHIP · GARBAGE ·
> CHAIN GUARD · DELIVERY · JUNK · HUNTER · UFO · POWERUPS · GLOBAL. One knob per
> lever (17), plus `smallUfoChance` and `lastStandSpeed`. Keep
> `autoShieldRegenPause`, `scoopHitsPerLevel`, `garbageAttractRadius`,
> `garbageAttractForce`, `chainGuardIntercepts`/`MinTow`/`Cooldown`,
> `dockComboGrace`, `sweepCoalescePause`, `debrisBounceRestitution`,
> `garbageSoftMax`, `garbageHardMax`. Every `def` derives from the shipped
> constant — never a duplicated literal.
>
> Row indices shift throughout; that is expected for a rebuild. Orphaned keys are
> ignored under known-value-else-default. **No schema bump, no rename of
> `afd_settings_v1`.**
>
> Repoint `logDifficultySnapshot()` / the `DiffLog` columns off the retired
> `levelDef` fields and onto `leverState`.
>
> **New `scratchpad/test-cs024-p5.js`**: every lever observably moving its
> quantity through the real spawn path across levels 1–60; each junk size's speed
> independent of the others; big and small UFOs independent on all four per-size
> levers; the 20% size roll's distribution; big saucers still firing unaimed; the
> registry's ids, defaults, clamping and persistence round-trip.
>
> **TRAP 1:** `GAME_VERSION` stays `"1.0.0.22"`.
> **TRAP 2:** powerup expiry is P6's. Do not touch `powerMode`/`powerFx` here.
> **TRAP 3:** no `floor <= ceil` validator, in the panel or anywhere else.
> **TRAP 4:** docs untouched.

**Commit:** `cs-24 p5: wire the levers, UFO per-size independence, registry rebuild`

---

## P6 — Count-only powerups + Engine-as-fuel

**Model: Opus · Effort: high**

> Changeset 024, Phase 6. Implement per `PLANNED-FEATURES-CS024.md` §1.7, §3.4,
> §3.5 and §3.7. **Timed powerup expiry is removed entirely; every powerup
> becomes count-based.**
>
> **Delete:** `powerMode()`, `powerDuration()`, `game.powerFx` (and its
> `startGame` reset), `POWERUP_DURATION`, `MAGNET_DURATION`,
> `DEBUG.chainGuardTime`, and the `shotPowerupMode` / `magnetMode` /
> `chainGuardMode` settings fields.
>
> `powerActive(type)` reduces to `game.powerBudget[type] > 0`. Budgets, all
> unchanged from today's count-mode values: Rapid 40 trigger pulls, Triple 30
> (a 3-fan is ONE pull), Magnet 40 canisters hooked, Guard 3 intercepts
> (`DEBUG.chainGuardIntercepts`).
>
> **Engine becomes fuel.** `ENGINE_BURN_SECONDS = 5.0`, a debug knob.
> `game.powerBudget.engine` is decremented by `dt` **only on frames where
> forward thrust is applied.** Rotation and reverse burn nothing — put the
> decrement in `Ship.update()`'s thrust branch, **not** in the main `update()`
> timer block, or rotation will silently drain it. Magnitude stays the flat
> `ENGINE_MASS_MULT = 0.5` while any fuel remains, now with a debug knob
> (`engineMassMult`) — it does **not** taper with remaining fuel.
>
> **Banking is preserved for every type** — a same-type pickup **adds** budget
> rather than refreshing, and arms the HUD bank badge, exactly as v3.6 P4
> established. Health (instant) and Scoop (persistent) are unchanged and stay
> outside `POWERUP_DROP_TYPES`.
>
> **HUD.** The active-effect rows lose their dual time/count shape and render the
> count form only. `POWERUP_DROP_TYPES`' **order stays load-bearing** — it fixes
> each type's HUD row index, so it remains append-only. The `drawRingArc`
> denominator that used to read `powerDuration(type)` now reads
> `powerBudgetAmount(type)`; miss that and the rings render permanently
> over-full.
>
> **Chain Guard drops to three knobs** — `chainGuardIntercepts`,
> `chainGuardMinTow`, `chainGuardCooldown`. Everything else about it is
> unchanged, including the conditional drop-weight entry (`"guard"` only enters
> the roll while `game.chain.length >= DEBUG.chainGuardMinTow`) and the rule that
> an ineligible key must be skipped in **both** the running total and the walk so
> the rest renormalise.
>
> **Difficulty menu.** `DIFFICULTY_ROWS` goes from
> `["shot", "magnet", "autoshield", "chainguard", "back"]` to
> `["autoshield", "back"]`. **Keep the screen** — do not fold auto-shield
> elsewhere. `settings.autoShield` persists exactly as today. The three removed
> mode fields become orphaned keys on `afd_settings_v1` and are **ignored**
> under known-value-else-default: **no schema bump, no rename, no migration
> shim.** Verify a settings file written by the pre-edit build loads cleanly.
>
> Check `VoiceSys`'s expiry lines and `game.powerVoiced` — the "did an effect
> end?" check must still route through `powerActive(type)` and never `powerFx`,
> which no longer exists.
>
> **New `scratchpad/test-cs024-p6.js`**: each type's budget depleting on the
> right event; engine fuel draining on thrust and **not** on rotation or reverse;
> banking adding rather than refreshing for every type; the HUD ring denominator;
> the guard's conditional drop renormalisation at and below the min-tow
> threshold; a pre-edit settings blob loading without error; and an
> `AudioSys.ctx === null` smoke run across a 20-level ramp.
>
> **TRAP 1:** `GAME_VERSION` stays `"1.0.0.22"`. P7 owns the bump.
> **TRAP 2:** `AUTO_SHIELD_SCORE_PENALTY`'s direct `game.score` deduction is the
> one sanctioned `addScore` bypass and is untouched.
> **TRAP 3:** docs untouched.

**Commit:** `cs-24 p6: count-only powerups, engine-as-fuel, difficulty menu`

---

## ⛔ GATE B — blocking playtest

**Do not run P7 until these are answered in `STATUS.md`'s Playtest asks.**
Questions 7–13 in `PLANNED-FEATURES-CS024.md` §6. Play levels 1→20 minimum.
Every lever is a live slider — **retune in-session and report the number you
landed on, not a yes/no.**

---

## P7 — Retune, version bump, full doc rewrite

**Model: Opus · Effort: high**

> Changeset 024, Phase 7 — the closing phase. Read Gate B's answers in
> `STATUS.md` first.
>
> **1. Retune.** Apply every number Gate B returned. If the gate came back "no
> change" on a lever, move nothing — the CS020 P2 and CS022 P4 precedent for a
> clean gate is that the closing phase is bump-and-sweep only. Record which
> levers moved and which did not.
>
> **2. Version bump.** `GAME_VERSION` `"1.0.0.22"` → **`"1.0.0.24"`**. `.23` is
> skipped deliberately — CS023 never closed and never carried it. **Grep for
> every pin rather than trusting a list.** The live pins tracking `HEAD`
> historically number six or more; CS021 P5's phase doc predicted eight and
> undercounted. Test files asserting `!== "1.0.0.22"` are repointed to their
> standing mirror image.
>
> **3. `DIFFICULTY-LEVERS.md`: rewrite from scratch, do not patch.** The current
> 387-line document describes three mechanisms plus a frozen-constant wrinkle
> plus two retired clocks. There is now **one** mechanism. The new document is:
> what a lever is; the odometer's semantics (driver / carry array / plateau /
> the no-ordering-validator prohibition); one table of the shipped levers with
> floor, ceil, steps, everyN and carriesTo; a short section on what is
> deliberately **not** a lever (`payloadSlots`, `smallUfoChance`, `freqJitter`,
> `HUNTER_COALESCE_COUNT`, the garbage attract knobs, `DEBRIS_GARBAGE` /
> `HUNTER_GARBAGE`, `lastStandSpeed`, all Hunter turn rates, large-Hunter speed);
> and the explicit ceilings (`LARGE_HUNTER_MAX` 100, `GARBAGE_SOFT_MAX` /
> `HARD_MAX`, `SWEEP_POWERUP_CAP` 48, `DEBRIS_SPEED_CAP` 1040 px/s). It should
> be a fraction of its current length. Keep the standing rule that anything which
> can grow without bound gets its ceiling recorded here in the same commit.
>
> **4. GDD.** Remove the P0 banner. Delete §2.13.1 and every §2 reference to the
> orbit archetype, the inward drift, the bonus canister, the ambient Hunter
> producer, garbage decay, and timed powerup expiry. Add §2 sections for: the
> odometer; permanent garbage and the density ceiling; coalescence as the sole
> Hunter producer; the large-Hunter cap and its clump-destruction overflow;
> count-only powerups and Engine-as-fuel; the formalised last-stand exception.
> Update the Architecture Map's Constants / Entity classes / Flow functions /
> game-object rows. Correct the "Current build" header. **§2 describes shipped
> behaviour only** — nothing unbuilt enters it.
>
> **5. `GDD-VERSION-HISTORY.md`:** one consolidated CS024 (P0–P7) entry.
>
> **6. `CLAUDE.md`:** the code map's Constants and Flow-functions lines, the
> `POWERUP_DROP_TYPES` note (timed-effect list vs drop table — still two
> structures, but "timed" is now the wrong word), and the frozen-`localStorage`
> bullet's mention of `chainGuardMode`.
>
> **7. `STATUS.md` archive check.** It should cover roughly the last three
> changesets. CS021 and CS022 material is now well past that and its subject no
> longer exists — relocate it to `archive/STATUS-HISTORY.md`, newest-first, each
> entry its own paragraph, **without summarising or shortening**. Watch the
> trailing-newline pitfall on any shell append: a missing `\n\n` is what fused
> years of entries onto one physical line.
>
> **8. Archive** `PLANNED-FEATURES-CS023.md` and `IMPLEMENTATION-PHASES-CS023.md`
> to `archive/`, and check whether the CS022 pair is already there.
>
> **TRAP 1:** the GDD must not describe a single removed system. Grep it for
> `orbit`, `bonus canister`, `decay`, `powerFx`, `tier`, `phase` before
> declaring done.
> **TRAP 2:** do not "restore" powerup or dock size to 1× — the 2× baked in at P2
> is the shipped, player-visible reality and has been since v3.4 P2.
> **TRAP 3:** full regression, run twice consecutively, both reported.

**Commit:** `cs-24 p7: retune, version 1.0.0.24, doc sweep — CS024 complete`