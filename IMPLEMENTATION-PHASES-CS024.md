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
| ⛔ | **GATE A** — blocking playtest ← *Paul plays; answers go in `STATUS.md`* | — | — | — |
| **P4** | The odometer mechanism | **Opus** | high | **yes** |
| **P5** | Lever wiring + UFO per-size independence | Sonnet | high | no |
| **P6** | Count-only powerups + Engine-as-fuel | **Opus** | high | no |
| **P6b** | ⚠️ *corrective* — drivers-only-wrap + UFO restage | **Opus** | high | **yes** |
| **P6c** | ⚠️ *corrective* — lever floor/ceil/steps knobs | **Opus** | high | **yes** |
| **P6d** | ⚠️ *corrective* — `startLevel` debug knob (gate tooling) | Sonnet | medium | no |
| ⛔ | **GATE B** — blocking playtest ← *Paul plays; answers go in `STATUS.md`* | — | — | — |
| **P7** | Retune, version bump, full doc rewrite | **Opus** | high | no |

**P6b, P6c and P6d are IN-ROUND CORRECTIVE PHASES**, opened in conversation
after P4 and P5 landed, following the CS020 P1b / CS021 P1b / CS023 P4b
precedent. They were not in this document's original plan. P6b and P6c each fix
something the phase above them shipped; P6d is gate tooling. **All three must
land before Gate B**, because Gate B's whole job is
tuning a ramp — it cannot do that against a mechanism that regresses at level 33
with sliders that flatten whatever they touch. **Order matters: P6b before P6c**,
since P6c derives every slider's range from the `LEVERS` table and P6b changes
nine step counts and removes two `carriesTo` lists in it.

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

## How a playtest gate works (read this once)

A gate is a **stop**. Claude Code cannot answer these questions; only playing the
build can. Here is the whole handoff, start to finish.

**Step 1 — Claude Code opens the gate.** The last phase before a gate ends its
session by writing a gate-open block into `STATUS.md` under the existing
`## Playtest asks (Paul — can't be checked headlessly)` heading: the questions
verbatim, plus a short briefing on what the headless suite already settled, so
the playtest concentrates on what only playing can answer. Each phase prompt
below that precedes a gate carries this as its final numbered instruction.

**Step 2 — Paul plays and answers.** Pull, open `asteroids-deluxe.html` in a
browser, play what the gate says to play, then **write the answers into that
same `STATUS.md` section.** Inline under each question is fine; the repo's own
established style is literally `Paul says: this is fine.` A one-line answer per
question is enough — this is not a report.

*The alternative, if you'd rather not edit the file:* paste the answers into the
next Claude Code session's opening message instead, and tell it to record them in
`STATUS.md` before it starts work. Same outcome, and it is what CS020 P2 did when
the answers were missing. Editing `STATUS.md` yourself is more durable; pasting
is faster. Either unblocks the gate.

**Step 3 — the next session reads them and proceeds.** It retunes from your
actual answers only. If a question is unanswered or unanswerable, it must
**stop and ask you directly** rather than invent an interpretation — the CS020
P2 precedent, and a standing rule.

**Two things that make answers useful:**

- **For anything driven by a debug slider: open the panel, retune live, and
  report the number you landed on — not a yes/no.** "Too fast" costs the next
  session a guess; "I settled at 140" costs it nothing.
- **"Fine" is a complete answer.** A gate that comes back clean means the closing
  phase is bump-and-sweep only, and that has happened twice (CS020 P2, CS022 P4).
  Do not manufacture changes to justify the gate.

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
>
> **FINALLY — OPEN THE GATE.** This phase is followed by a blocking playtest.
> Before finishing, write a gate-open block into `STATUS.md` under the existing
> `## Playtest asks (Paul — can't be checked headlessly)` heading, following the
> shape CS021/CS022/CS023 used: state plainly that **GATE A is open and P4 must
> not run until it is answered here**, reproduce Gate A's six questions verbatim
> from `IMPLEMENTATION-PHASES-CS024.md`, say what to play (6+ levels, no
> deliberate farming, plus one run that deliberately hoards garbage), and add a
> short briefing of **what the headless suite already settled** — the measured
> pair-count at the soft ceiling, the coalescence timing, which knobs are live
> sliders and their ranges — so the playtest spends itself on what only playing
> can answer. Flag question 1 as the one that can change P4's scope.

**Commit:** `cs-24 p3: permanent garbage, coalescence-only hunters, density ceiling`

---

## ⛔ GATE A — BLOCKING PLAYTEST (after P3)

**P4 must not run until the questions below are answered in `STATUS.md`'s
`## Playtest asks` section.** See "How a playtest gate works" above for the
handoff. P3's own prompt ends by writing these questions into that section.

**What to play:** a fresh run, **at least 6 levels**, without deliberately
farming garbage. Then, separately, one run where you *do* deliberately let
garbage pile up, to see the ceiling behaviour.

**The questions:**

1. **Do Hunters still appear at all?** Roughly how many levels before the first
   one? ← *this is the one that can change the plan; see below*
2. **Is the field readable?** With garbage permanent, does a level-6 screen read
   as salvage-rich or as visual noise?
3. **Does the cull ever visibly fire?** You should never see a canister vanish.
   If you do, `GARBAGE_SOFT_MAX` (220) is too low — it's a live knob, so raise it
   until it stops and report the number.
4. **Frame rate**, subjectively, at the worst moment you can produce.
5. **Does removing the bonus canister leave the early levels flat?** It was
   explicitly a reason-to-keep-playing for low-stakes waves.
6. **Last stand:** does a large Hunter resuming its old vector when debris
   reappears read as intentional, or as a bug?

**⛔ Question 1 is the one that can change the plan.** Hunters now arise from
exactly one source. If the answer is "never" or "only once, at level 9," then P4
inherits a coalescence retune it does not currently scope, and the levers that
would move are `coalescePause`, `garbageAttractRadius` and
`garbageAttractForce` — all live sliders. **Try them at the gate and report the
numbers**; that is far cheaper than P4 guessing.

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

> **✅ LANDED as `9e70891`. AS BUILT, and what it left open.** `leverState(wave)`
> shipped with the ORIGINAL unrestricted carry semantics — a carried lever that
> itself declares `carriesTo` wraps like any other, and `ufoFlightSpeedBig` /
> `ufoFlightSpeedSmall` still carry at 4 steps each. **The FORK-CS025-A
> drivers-only-wrap amendment did not reach this session**, so the level-33 UFO
> flight-speed regression is live in the build and the second-generation levers
> do not saturate until level 97. **Corrected by P6b.**

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

> **✅ LANDED as `c96a983`. AS BUILT, and what it left open.** The one-knob-per-
> lever instruction above was **incoherent and this is where that surfaced.** P5
> did the only sensible thing available to it: `leverKnob(id, label, unit)`
> returns `{ def: null, min, max, step }` with `min`/`max` from
> `Math.min`/`Math.max` of the shipped pair, and consumers read
> `DEBUG.<leverId> ?? lv.<leverId>`. So an untouched slider leaves the odometer
> alone, but **moving one PINS that lever to a flat constant at every level** —
> it cannot tune the ramp's floor, ceiling or period, and it cannot move an
> endpoint past its partner. **Corrected by P6c.**

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
>
> **FINALLY — OPEN THE GATE.** This phase is followed by a blocking playtest.
> Write a gate-open block into `STATUS.md` under `## Playtest asks`, following
> the same shape as P3's: **GATE B is open, P7 must not run until it is answered
> here**, Gate B's seven questions verbatim, what to play (levels 1→20 minimum),
> and a briefing listing **every one of the 17 levers with its knob id, current
> value, range and step** — remembering each lever has TWO rows, a floor and a
> ceiling — so retuning at the gate is dragging a slider rather than hunting for
> one. Note explicitly which levers are inverted, so a floor above its ceiling
> reads as correct rather than as a bug. Restate the standing instruction: report the
> number landed on, not a yes/no.

**Commit:** `cs-24 p6: count-only powerups, engine-as-fuel, difficulty menu`

---

## P6b — ⚠️ CORRECTIVE: drivers-only-wrap + UFO restage

**Model: Opus · Effort: high · `ultrathink` baked in**

> Changeset 024, Phase 6b — an **in-round corrective phase**, not in the original
> plan. It lands the FORK-CS025-A amendment that P4 was supposed to carry and
> did not, plus the UFO step-count restage that depends on it. Design source:
> `PLANNED-FEATURES-CS025.md` §1 and §2 — read both.
>
> **Grep every anchor by symbol first.** Everything in this prompt was written
> against `c96a983`, and **P6 has landed since**, touching `DEBUG_VARS` and the
> powerup paths. Re-measure before editing.
>
> **What is wrong in the build.** `leverState()` shipped with unrestricted carry
> semantics: a carried lever that itself declares `carriesTo` wraps like any
> other. Plotted level by level, that makes `ufoFlightSpeedSmall` climb 150 → 210
> px/s by level 25 and then **reset to 150 at level 33** — a UFO genuinely slower
> at level 33 than at 25, a difficulty regression on one of the most legible
> quantities in the game. And the second-generation levers (`ufoDirChange*`,
> `ufoShotSpeed*`, `ufoAccuracySmall`) move twice in 64 levels and do not reach
> their ceilings until level 97.
>
> **The rule: a lever may declare `carriesTo` ONLY if it also declares
> `everyNLevels`.** Every carried lever plateaus at its ceiling. There is no
> second carry generation.
>
> **ultrathink the closed form before editing it.** Under depth-1 the propagation
> collapses: a dependent's carry count is
> `Math.floor((wave - 1) / (everyN × steps))` of its **driver**, computed
> directly, no iteration and no recursion. Three things to get right:
>
> 1. **The junk and hunter chains must be byte-identical in output.** Their
>    dependents already have empty `carriesTo` lists, so nothing about them
>    changes. **Prove it** — compare `leverState(n)` for every junk and hunter
>    lever at every level 1–200 against `HEAD`. A diff there means the closed form
>    is wrong, not that the rule is.
> 2. **Replace the guard, don't delete it.** A cycle is unreachable by
>    construction now, so the load-time assertion becomes a stronger and cheaper
>    one: **throw if any lever declares `carriesTo` without `everyNLevels`, or
>    names an unknown id.** Same idiom as `SCOOP_WIDTH[0] !== 0`. A deliberate
>    invariant, **not test scaffolding** — say so in a comment at the site.
> 3. **Restage the UFO table.** `ufoAppearFreq` stays the driver (25 → 12,
>    8 steps, `everyNLevels` 1) and carries to **all nine** other UFO levers
>    directly. Neither `ufoFlightSpeedBig` nor `ufoFlightSpeedSmall` may keep a
>    `carriesTo`. New step counts — floors and ceils **unchanged**:
>
> | Lever | steps | reaches ceil |
> |---|---|---|
> | `ufoFlightSpeedBig` / `ufoFlightSpeedSmall` | 5 | L33 |
> | `ufoFireFreqBig` / `ufoFireFreqSmall` | 6 | L41 |
> | `ufoDirChangeBig` / `ufoDirChangeSmall` | 7 | L49 |
> | `ufoShotSpeedBig` / `ufoShotSpeedSmall` | 8 | L57 |
> | `ufoAccuracySmall` | 9 | L65 |
>
> **The stagger is the design, and a comment at the table should say so:** speed
> arrives first, then rate of fire, then evasiveness, then shot velocity, and
> **accuracy last** — the most lethal quantity creeping in over the longest span
> in the smallest per-carry increments (9 steps across 22° is ~2.75° per carry).
> Do not "tidy" these into a uniform number; the unevenness is the point.
>
> **`ufoAppearFreq` still cycles forever** and never permanently tightens — at
> level 100 exactly as at level 1. Deliberate: it is the driver, and a driver
> that stopped cycling would freeze every lever under it. Do not "fix" it.
>
> **New `scratchpad/test-cs024-p6b.js`.** The headline assertion is the one that
> would have caught this defect: **no lever in the shipped table returns toward
> its floor at any level 1–200 except a driver.** Also: the guard firing on a
> `carriesTo`-without-`everyNLevels` table and on an unknown id, with a control
> table that passes; junk and hunter output identical to `HEAD` at every level
> 1–200; each UFO lever reaching its ceiling at exactly the level tabled above;
> and the values arriving at the real `Saucer` constructor and `update()` through
> the actual spawn path, not read off `leverState` alone. Where
> `test-cs024-p4.js` asserts depth-2 propagation, **invert those assertions to
> their mirror image** with a `CORRECTED BY CS024 P6b` note — the standing
> convention since CS017 P6 — rather than deleting them.
>
> **TRAP 1:** `GAME_VERSION` stays `"1.0.0.22"`. P7 owns the bump.
> **TRAP 2:** the registry is P6c's. Do not add or reshape a knob here.
> **TRAP 3:** no `floor <= ceil` validator, anywhere.
> **TRAP 4:** `leverState()` must stay pure and evaluable alone in a bare
> context — its slice test must still pass unmodified.
> **TRAP 5:** P6's POWERUPS section and powerup paths are untouched — pin them
> against `HEAD`.
> **TRAP 6:** docs untouched.

**Commit:** `cs-24 p6b: only drivers may wrap; restage the UFO chain`

---

## P6c — ⚠️ CORRECTIVE: lever floor/ceil/steps knobs

**Model: Opus · Effort: high · `ultrathink` baked in**

> Changeset 024, Phase 6c — an **in-round corrective phase**, not in the original
> plan. Design source: `PLANNED-FEATURES-CS024.md` §2.6, **rewritten for this
> phase — read it before anything else.** Runs **after P6b**, which changes nine
> step counts and two `carriesTo` lists in `LEVERS`.
>
> **Grep every anchor by symbol first.** P6 and P6b have both landed since this
> was written; `DEBUG_VARS`' contents, its entry count and every registry-count
> pin in the suite will have moved twice. Expect a large repoint sweep and report
> every file you touch — P5's rebuild already forced one, P6's POWERUPS section a
> second, and this is the third.
>
> **What is wrong in the build.** `leverKnob(id, label, unit)` returns
> `{ def: null, min, max, step }` with `min`/`max` from `Math.min`/`Math.max` of
> the shipped pair, and consumers read `DEBUG.<leverId> ?? lv.<leverId>`. An
> untouched slider correctly leaves the odometer alone — **keep that property** —
> but moving one **pins the lever to a flat constant at every level.** It cannot
> tune the ramp's floor, its ceiling or its period, and it cannot move an
> endpoint past its partner. Gate B's job is tuning the ramp; it currently
> cannot.
>
> **Replace the one flat row per lever with THREE: `<leverId>Floor`,
> `<leverId>Ceil`, `<leverId>Steps` — 51 rows.** Moving any of the three
> re-derives that lever's whole ramp immediately, at every level.
>
> **The flat pin is subsumed, not lost:** setting Floor equal to Ceil pins the
> lever to a constant at every level, which is exactly what the retired row did.
> Do not keep a fourth row for it.
>
> **ultrathink these four, because each is a place a plausible edit is wrong:**
>
> 1. **⛔ RANGES MUST SPAN BOTH DIRECTIONS.** Several levers are inverted —
>    `coalescePause` 5.0 → 1.5, `ufoAccuracySmall` 30 → 8, every `ufoFireFreq*`
>    and `ufoDirChange*`, `ufoAppearFreq`. The current
>    `Math.min`/`Math.max`-of-the-shipped-pair locks each slider inside its
>    *current* span, so a ceiling cannot be raised above where it already sits.
>    Each row needs a range wide enough to move either endpoint **past** its
>    partner, and **nothing may assert or clamp `floor <= ceil` in the panel any
>    more than in the table.** Half the levers are ordinary, so a spot check will
>    look fine — test this explicitly on at least one inverted lever per chain.
> 2. **A WRAP MUST LAND EXACTLY ON `floor`, never on an interpolated value.**
>    This already holds (`step 0` short-circuits to `lev.floor`), and it must
>    survive the Steps knob: at any step count, passing the top returns the lever
>    to precisely `floor`, not to a fraction near it. Assert it directly across a
>    sweep of step counts.
> 3. **⛔ INTEGER-VALUED LEVERS NEED ROUNDING AT THE CONSUMER, AND THIS IS NEW.**
>    `junkCount` is a satellite count and `spawnFieldSatellites(count, speed)`
>    currently takes it **raw**. At the shipped 3/12/10 every step is a whole
>    number, so nothing has broken. **The Steps knob breaks that** — 3/12/**7**
>    interpolates to 3, 4.5, 6, 7.5, 9, 10.5, 12, i.e. four and a half satellites.
>    Round at the consumer, and pick the rule deliberately rather than reaching
>    for `Math.round`: state in a comment which levers are integer-valued and
>    why the chosen rounding is right for a *spawn count* specifically. Sweep
>    every step count the knob can reach and assert an integer arrives at the
>    spawn every time.
> 4. **Steps is an INTEGER knob with a floor of 2.** `steps: 1` divides by zero
>    in the `(steps - 1)` span; `steps: 0` is meaningless. Guard it at the row's
>    `min`, not with a runtime clamp.
>
> **Purity:** `leverState()` must not read `DEBUG`; that would drag the registry
> into its bare-context slice and destroy its testability. Keep the existing
> `DEBUG.x ?? lv.x` shape at the consumers, or give `leverState` an optional
> table parameter — **your call, but justify it in `STATUS.md`**, and either way
> the slice test must pass unmodified.
>
> **⛔ THE PANEL MUST SHOW THE CHAIN, NOT JUST THE ROWS.** 51 rows with no
> structure is a wall. A section maps 1:1 to a chain, and within it every row
> either **drives** or **is driven** — the panel has to say which, or a retune is
> guesswork about what a slider will knock on to. Encode it in the label text, so
> **no new registry rows and no renderer change**:
>
> - **Driver lever** — `▼` prefix, unindented. The glyph means "everything
>   indented below moves when this one wraps."
> - **Dependent lever** — two leading spaces and `↳`.
> - **Non-lever flat knob** (`smallUfoChance`, `lastStandSpeed`,
>   `garbageAttractRadius`/`Force`, `sweepCoalescePause`, the CHAIN GUARD and
>   POWERUPS rows) — **no glyph, no indent.** They belong to no chain and must not
>   look as though they do.
> - **Inverted lever** — suffix the label `(inv)`, on all three of its rows. A
>   Floor numerically above its Ceil is correct for these and must not read as a
>   bug at 2am.
>
> Target shape:
>
> ```
> JUNK
> ▼ Junk count · floor
> ▼ Junk count · ceil
> ▼ Junk count · steps
>   ↳ Junk speed (large) · floor
>   ↳ Junk speed (large) · ceil
>   ↳ Junk speed (large) · steps
>   ↳ Junk speed (medium) · floor
>   ...
> HUNTER
> ▼ Coalescence inert delay (inv) · floor
> ...
>   ↳ Hunter speed (medium) · floor
> ...
> Hunter last-stand speed
> ```
>
> **Derive the glyph and the `(inv)` suffix from the `LEVERS` table inside
> `leverKnob()`** — `everyNLevels` decides driver vs dependent, `floor > ceil`
> decides inverted. **Never hand-type them into the label strings**, or a future
> table edit silently desyncs the panel from the mechanism. Assert the derivation
> in the test rather than asserting the literal strings.
>
> **Check the rendered width** before settling on the glyphs. Labels grow by up to
> ~8 characters and the panel truncates rather than wraps; if `(inv)` does not
> fit, shorten the base labels rather than dropping the marker.
>
> **New `scratchpad/test-cs024-p6c.js`**: each of the three knobs per lever
> observably moving that lever's derived value — drag Floor, prove level 1 moved;
> drag Ceil, prove the saturated level moved; drag Steps, prove the saturation
> level itself moved; all three on an **inverted** lever, proving no clamp or
> flip; Floor equal to Ceil producing a genuine constant at every level; the
> exact-`floor` wrap across a sweep of step counts; an integer arriving at
> `spawnFieldSatellites` at every reachable step count; the `steps >= 2` guard;
> and a persistence round-trip through `afd_settings_v1`. Plus the hierarchy:
> every driver carrying `▼`, every dependent `↳`, every non-lever knob neither,
> every inverted lever `(inv)` — all **derived from `LEVERS`**, proven by mutating
> a lever's `everyNLevels` or flipping its floor/ceil and watching the label
> follow.
>
> **FINALLY — REWRITE THE GATE-OPEN BLOCK.** P6 already wrote a Gate B block into
> `STATUS.md` describing the **retired** one-flat-row-per-lever sliders. It is now
> wrong. Rewrite it: 51 lever rows, three per lever, what each does, **which
> levers are inverted** (so a Floor above its Ceil reads as correct rather than as
> a bug), the note that Floor equal to Ceil pins a lever flat, and the P6b
> restage's new saturation levels. Extend the play instruction to **levels 1 → 45**
> — P6b's stagger does its work between 33 and 65, and the old range stopped at 30.
>
> **TRAP 1:** `GAME_VERSION` stays `"1.0.0.22"`.
> **TRAP 2:** an untouched panel must leave shipped behaviour byte-identical —
> pin `leverState` output at every level 1–200 against `HEAD`.
> **TRAP 3:** no `floor <= ceil` validator or clamp, in the panel or anywhere.
> **TRAP 4:** P6's POWERUPS rows survive, and §5's section order holds: SHIP ·
> GARBAGE · CHAIN GUARD · DELIVERY · JUNK · HUNTER · UFO · POWERUPS · GLOBAL.
> **TRAP 5:** no schema bump, no rename of `afd_settings_v1`. Orphaned ids from
> the retired flat rows are ignored under known-value-else-default.
> **TRAP 6:** docs untouched.

**Commit:** `cs-24 p6c: lever floor/ceil/steps knobs`

---

## P6d — ⚠️ CORRECTIVE: `startLevel` debug knob

**Model: Sonnet · Effort: medium**

> Changeset 024, Phase 6d — an **in-round corrective phase**, not in the original
> plan. It is **gate tooling**: Gate B needs to sample a deep level without
> playing thirty levels to reach it, and nothing in the build can currently jump
> the level counter.
>
> **Grep every anchor by symbol first.** P6, P6b and P6c have all landed since
> this was written; `DEBUG_VARS` has been reshaped twice.
>
> **The knob.** `startLevel` in the GLOBAL section, `def: 1, min: 1, max: 99,
> step: 1`. `startGame()` seeds `game.wave` from it so the first `nextWave()`
> lands on that level — today the seed is the literal `game.wave = 0`. Everything
> downstream is already a pure function of `game.wave` (`leverState`,
> `payloadSlots`, `musicIntensity`), so nothing else needs a change to make a
> deep level spawn correctly. **Verify that rather than assuming it.**
>
> **⛔ A RUN STARTED ABOVE LEVEL 1 MUST NOT RECORD.** No high-score entry, no
> achievement unlock, no lifetime-stat write. A debug jump must not be able to
> pollute real progress, and this is the same principle as the standing
> `awardScore = false` contract: the run plays normally and pays nothing out.
>
> Four things to get right about the suppression:
>
> 1. **Set a sticky `game.debugRun` flag ONCE, in `startGame()`, from the knob's
>    value at that instant.** Never re-read the knob mid-run. Otherwise dragging
>    `startLevel` back to 1 during a run would silently re-arm recording for a run
>    that started at 33 — and dragging it up mid-run would retroactively void a
>    legitimate one.
> 2. **Gate the three PERSISTENCE points, not the in-memory counters.** Score,
>    `stats.*` and achievement progress should keep updating normally so the HUD,
>    the gameover screen and toasts all behave as they would in a real run — what
>    is suppressed is the write: `HighScores.add()`, the achievement unlock
>    commit, and the lifetime-stats save. Find all three by grep; do not trust
>    this list.
> 3. **Give it a visible tell.** A short `DEBUG RUN` marker in the HUD whenever
>    `game.debugRun` is true, in `COLOR.dim`, positioned so it reflows nothing.
>    Without it there is no way to tell a voided run from a real one, and the
>    first time a good score silently fails to record will be baffling.
> 4. **`startLevel` is NOT a lever** — a plain flat knob, no `▼`/`↳` glyph, no
>    `(inv)`, no floor/ceil/steps triple. It belongs to no chain.
>
> **Document the fidelity limit in a comment at the knob**, because it is real and
> a future session will otherwise treat the knob as more than it is: a run started
> at level 33 gives a **level-33 field with a level-1 ship** — no scoop upgrades,
> no banked powerups, no accumulated garbage, no towed load. It is a spawn-side
> sampling tool, not a simulation of having played there. **Do not "fix" this by
> seeding scoop level or powerups** — that is unrequested design.
>
> **New `scratchpad/test-cs024-p6d.js`**: a real `startGame()` at several
> `startLevel` values landing on exactly that level; `leverState`, `payloadSlots`
> and the spawned satellite count all matching what the same level produces in a
> played-through run; the three persistence points provably not writing on a
> debug run, and provably still writing at `startLevel === 1`; the flag being
> sticky against a mid-run knob change in both directions; and in-memory score and
> stats still updating normally so the HUD is unaffected.
>
> **TRAP 1:** `GAME_VERSION` stays `"1.0.0.22"`. P7 owns the bump.
> **TRAP 2:** `startLevel === 1` must be byte-identical to today in every
> respect — pin a full run against `HEAD`.
> **TRAP 3:** no lever, no `LEVERS` edit, no `leverState` change.
> **TRAP 4:** the three frozen `localStorage` keys are untouched; suppression is a
> write gate, not a schema change.
> **TRAP 5:** docs untouched.
>
> **FINALLY — CHECK THE GATE-OPEN BLOCK.** P6c rewrote `STATUS.md`'s Gate B block.
> Add `startLevel` to it: what it does, that it voids recording, and that the
> gate's spot-check step uses it.

**Commit:** `cs-24 p6d: startLevel debug knob, recording suppressed on debug runs`

---

## ⛔ GATE B — BLOCKING PLAYTEST (after P6d)

**P7 must not run until questions 7–13 are answered in `STATUS.md`'s
`## Playtest asks` section.** Questions 14–17 are **non-blocking** — see Step 3
below. P6 writes a first version of that block, **P6c rewrites it** and P6d adds
`startLevel` to it; P6c/P6d's version is the one to read, since P6's describes
sliders that no longer exist.

**What to play — this is one evening, not a marathon.**

**Step 1 (blocking): one run, levels 1 → 12, played through.** That is all
questions 7–13. Twelve levels is enough because it crosses every wrap boundary
there is: the junk chain wraps at 11, the hunter and UFO chains at 9, and
`payloadSlots` reaches 24 at level 12 — the first level a Super Mega Delivery is
possible at all.

**Step 2 (blocking, short): set `startLevel` to 33 and play two or three waves.**
A spot-check for anything obviously broken deep in the ramp. **Note the two
limits of this step**, so it isn't over-read: a debug run records nothing, and
you get a level-33 *field* with a level-1 *ship* — no scoop upgrades, no banked
powerups, no accumulated garbage.

**Step 3 (NOT blocking): questions 14–17.** These came from the absorbed CS025
and are about how the UFO stagger *feels* between levels 25 and 45. The headless
tests already prove those curves are monotone, so the only thing playing adds is
feel — and feel at level 40 is only honest in a run you actually played to level
40. **Do not hold P7 for them.** Answer them whenever you next play the game for
its own sake, and if something is wrong the fix is a step-count table edit in a
later changeset.

Every lever has **three** live sliders (Floor, Ceil, Steps). Setting Floor equal
to Ceil pins that lever flat at every level, which is the way to isolate one
quantity's feel. **Retune in-session and report the number you landed on, not a
yes/no.**

**The questions:**

7. **Does the sawtooth read as *breathing*, or as the game repeatedly getting
   easier?** This is the changeset's central bet.
8. **Is the carry legible?** When `junkCount` resets to 3 and the satellites are
   visibly faster, does that land as an escalation?
9. **Three chains breathing on different periods** — `junkCount` every 10 levels,
   `coalescePause` every 8, `ufoAppearFreq` every 8. Rich, or arrhythmic?
10. **Any lever whose floor or ceiling is wrong.** Each lever has **two**
    sliders — `<leverId>Floor` and `<leverId>Ceil`. Slide either, land on a
    number, report the number. Step counts are *not* sliders: if a ramp feels the
    wrong *length* rather than the wrong *height*, say so in words and P7 changes
    it at the source.
11. **All five powerup budgets** — Engine 5.0 s, Rapid 40 shots, Triple 30 pulls,
    Magnet 40 hooks, Guard 3 intercepts. Count-only is new for four of them and
    the engine's 5.0 was never a decision, only a conversational example. All
    five are knobs: **land on numbers and report them.**
12. **Count-only powerups:** does losing timed mode make Magnet (40 hooks) or
    Rapid (40 shots) feel meaningfully different?
13. **Level 12 and the Super Mega Delivery** — now that 24 slots is the first
    moment an SMD is possible at all, does hitting it land as the payoff it
    should be?

**⚠️ The four below are NOT BLOCKING** — they came from the absorbed CS025 and
need levels 25–45 played for real. P7 runs without them. Answer them at leisure.

14. **Levels 25 → 40:** do the UFOs read as continuously escalating? The pre-P6b
    build got visibly slower at 33; this one must not.
15. **Is the stagger legible?** Around 40–50 the UFOs should start feeling
    *evasive* rather than merely fast. A change in character, or undifferentiated
    pressure?
16. **Accuracy last:** by level 45, are small UFO shots feeling genuinely
    threatening? If accuracy still feels harmless, 9 steps is too many.
17. **Levels 41+:** with junk fully ramped at 41 and hunters at 33, does the late
    game feel flat, or does the UFO chain plus the two sawtooths carry it? If
    flat, P7 raises the step counts on the six junk/hunter dependents — a table
    edit, and it will not happen unless you ask.

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
> to `archive/`, and check whether the CS022 pair is already there. **Also
> archive the CS025 pair** — that changeset was absorbed into this one as P6b/P6c
> and has nothing left to build; both files carry a SUPERSEDED banner saying so.
> `DIFFICULTY-LEVERS.md` should cite `PLANNED-FEATURES-CS025.md` §0 as the record
> of *why* the drivers-only-wrap rule exists, since the evidence for it came from
> plotting the tables rather than from reading them.
>
> **TRAP 1:** the GDD must not describe a single removed system. Grep it for
> `orbit`, `bonus canister`, `decay`, `powerFx`, `tier`, `phase` before
> declaring done.
> **TRAP 2:** do not "restore" powerup or dock size to 1× — the 2× baked in at P2
> is the shipped, player-visible reality and has been since v3.4 P2.
> **TRAP 3:** full regression, run twice consecutively, both reported.

**Commit:** `cs-24 p7: retune, version 1.0.0.24, doc sweep — CS024 complete`