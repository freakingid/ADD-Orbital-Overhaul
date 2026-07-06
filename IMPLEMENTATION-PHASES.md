# ASTEROID FIELD DELUXE — v2.0 Implementation Phases

**Purpose:** breaks the full v2.0 feature set (`PLANNED-FEATURES-v2.md`) into ordered, session-sized phases, each with a ready-to-paste prompt for a **Claude Code** session. One phase = one session, ideally one sitting.

**How to hand off a phase:** open a new Claude Code session in the project directory (with `asteroids-deluxe.html`, the GDD, `PLANNED-FEATURES-v2.md`, `STATUS.md`, and `CLAUDE.md` all present), and paste that phase's prompt block as your first message. Claude Code reads `CLAUDE.md` automatically at session start — that's where the standing rules live now (editing docs in place, committing per phase, one-phase-per-session scope, testing conventions). This doc only carries what's specific to each phase: goal, requirements, and a recommended model/effort setting.

---

## Dependency Order & Rationale

```
Phase 1: World & Camera        ✅ DONE (shipped v1.2) — foundational; everything else assumes world space
   │
Phase 2: HP & Knockback        (survival core — independent of world size, but should land
   │                             before enemies get more numerous/dangerous in Phase 3/4)
   │
Phase 3: Debris Satellites     (introduces the mass field on garbage — F5 folded in here)
   │
Phase 4: Difficulty Ramp       (F10 — the difficulty helper + saucer calming; must exist
   │                             before Phase 5 so the Hunter redesign wires into it directly)
   │
Phase 5: Hunter Satellites     (F4 — depends on Phase 3's mass field AND Phase 4's difficulty
   │                             factor; built gentle-early from the start, not retrofitted)
   │
Phase 6: Powerups              (health→needs Phase 2; magnet/engine→needs Phase 3's mass math)
   │
Phase 7: Basic Gamepad Input   (mostly independent — could move earlier if you want it sooner)
   │
Phase 8: Pause/Options/Rebind  (needs Phase 7 to have controller bindings worth rebinding)
   │
Phase 9: Achievements          (needs final mechanic names/systems from everything above)
```

**Why the difficulty ramp (F10) is its own phase, before the Hunter redesign (F4):** Paul's playtest feedback is that early waves are too intense — Hunters seek too fast, saucers appear/fire/aim too aggressively. The fix is one shared difficulty curve that many systems scale off of. If we built the Hunter redesign (F4) flat and then retrofitted difficulty scaling afterward, we'd be rewriting freshly-written code. Instead, Phase 4 builds the `difficultyFactor` helper and applies it to the *existing* saucers (which need calming regardless), and Phase 5 then builds the new Hunter Satellites wired into that helper from line one. This also means the saucer-calming half of Paul's feedback ships as early as Phase 4, before the Hunter work even starts.

I've listed this as strictly linear, but **Phase 7 (basic gamepad input) has no real dependency on Phases 2–6** — if you'd rather play with a controller sooner, it can move up to run right after Phase 1. Everything else benefits from the stated order.

**Note on scope creep control:** each prompt below explicitly tells Claude Code to build *only* that phase and stop — not to peek ahead at later phases and start wiring them in "while it's in there." This matters because half-built future features are harder to reason about in diffs than clean phase boundaries.

---

## Phase 1 — Larger World & Scrolling Camera

**Status:** ✅ Done — shipped as v1.2. Spec moved to GDD §2.11; see STATUS.md "Changed this session" and Version History v1.2. The deferred off-screen-threat-awareness item is parked under F1's follow-up note (revisit with F10).

**Builds:** `PLANNED-FEATURES-v2.md` Feature F1.
**Depends on:** nothing (first phase).
**Touches:** constants block, all wrap-aware helpers, `draw()`, spawn logic in `nextWave`, dock placement.

### Prompt for Claude Code

> I'm working on Asteroid Field Deluxe, a single-file HTML5 canvas game (`asteroids-deluxe.html`). Read `asteroid-field-deluxe-GDD.md` in full before touching code — especially Section 3 (Architecture Map) and 3.4 (chain physics contract). Also read `PLANNED-FEATURES-v2.md`, Feature F1 only.
>
> **Goal for this session:** implement F1 — a larger scrolling world.
>
> Requirements:
> - Introduce `WORLD_W`/`WORLD_H` (proposed 3840×2160) as the actual simulation space, distinct from `VIEW_W`/`VIEW_H` (1280×720, the visible viewport/canvas size). Rename existing `W`/`H` usages carefully — anywhere they currently mean "the wrap boundary," they should become `WORLD_W`/`WORLD_H`; anywhere they mean "the screen," they should become `VIEW_W`/`VIEW_H`.
> - The world still wraps at its own edges (same torus topology, just bigger) — `wrap()`, `dist2()`, `angleTo()`, and `shortDelta()` all need to use `WORLD_W`/`WORLD_H`.
> - Add a camera (`game.camera.x`, `game.camera.y`) that tracks the ship's world position every frame. In `draw()`, translate the canvas context by `-camera.x + VIEW_W/2, -camera.y + VIEW_H/2` before drawing world-space entities; draw HUD elements *after* restoring the untranslated context so they stay screen-fixed.
> - Cull entities outside the viewport (plus a margin, say 100px) from `draw()` calls for performance — they should still `update()` normally, just skip drawing.
> - Update `nextWave`'s spawn logic to place new large asteroids within some reasonable radius of the ship's *current* world position, not the old fixed screen-center-relative logic — otherwise waves can spawn entirely unreachable in a 3840×2160 world.
> - Update the recycling dock's placement logic similarly — reachable relative to the ship, not just "somewhere in a 1280×720 rect."
> - The starfield background (currently a fixed per-frame pattern) should extend across world space so it doesn't visibly repeat/tile in an obvious way as the camera scrolls.
>
> Constraints: keep this a single self-contained HTML file, no external assets or libraries. Preserve every existing convention documented in GDD Section 3 (tuning constants at top, wrap-aware helpers, dead-flag/filter entity lifecycle, drawPoly/glowStroke rendering pattern). Don't touch anything from Phases 2+ in `PLANNED-FEATURES-v2.md` — this session is scoped to F1 only.
>
> Before delivering: run `node --check` on the extracted script, and build a headless test (stub `window`/`document`/`requestAnimationFrame` as needed) that drives `update()` for several seconds with the ship moving in a straight line, confirming the camera follows, world-wrap still works correctly at the *world* boundary (not the old 1280×720 one), and entities spawned near the ship stay within a sane distance.
>
> Deliver (per CLAUDE.md's conventions — real file edits, not chat output): the complete updated `asteroids-deluxe.html`; `asteroid-field-deluxe-GDD.md` edited in place (move F1's spec from `PLANNED-FEATURES-v2.md` into GDD Section 2 as a new subsection, mark it 🟢 Done in the planned-features doc or remove that section, bump the version header and Version History); `STATUS.md` edited in place per its existing template, including specific playtest asks (e.g. "confirm the camera doesn't feel laggy/floaty," "confirm no visible starfield seam").
>
> **Recommended settings:** Opus 4.8 · **xhigh** effort · extended thinking **on**. This is the foundational refactor — it touches every wrap-aware helper and the render pipeline, and a subtle world-vs-screen coordinate mistake propagates everywhere, so it's worth the deeper reasoning. Consider adding `ultrathink` to the message if you want extra care on the camera/wrap-boundary math specifically.
>
> **Suggested commit:** `Phase 1: larger scrolling world + camera (F1)`

---

## Phase 2 — Health Points & Knockback

**Builds:** `PLANNED-FEATURES-v2.md` Feature F2.
**Depends on:** Phase 1 (works in either world, but should land before enemy density increases in Phase 3/4).
**Touches:** `Ship` class, `killShip`, HUD, extra-life scoring logic, respawn-clearing logic (removed).

### Prompt for Claude Code

> Continuing Asteroid Field Deluxe. Read `asteroid-field-deluxe-GDD.md` Section 2 (current build, now including Phase 1's world/camera changes) and `PLANNED-FEATURES-v2.md` Feature F2 only.
>
> **Goal for this session:** implement F2 — replace discrete lives with an HP pool and add knockback.
>
> Requirements:
> - Remove `game.lives` and all respawn logic (the "wait for center to clear" behavior GDD 2.1 describes). There is no respawn — one ship, one HP pool, for the whole run.
> - Add `game.ship.hp` (max 100, tunable constant `SHIP_MAX_HP`). Any hazard contact or hostile bullet that isn't blocked by the shield reduces HP by a damage amount specific to the source (propose starting constants: small hazard 20, medium 35, large 50, hostile bullet 15 — put these in the tuning-constants block, not inline).
> - On any non-lethal hit, apply a knockback impulse to the ship's velocity directly away from the hazard's position (propose `KNOCKBACK_SPEED` constant, ~250 px/s) and grant a brief hit-stun invulnerability window (propose `HIT_STUN_DURATION`, ~1.0s) during which further hits are ignored.
> - At 0 HP, trigger the existing explosion/game-over flow (`killShip`'s boom/particle logic, `scatterChain()`) but skip anything respawn-related — this is now a true game over, same as running out of lives used to be.
> - Replace the "extra life every 10,000 points" milestone with a "+25 HP repair" bonus (capped at max HP; if already at max, award a flat score bonus instead so the milestone isn't wasted). Keep this logic inside `addScore()`.
> - HUD: replace the life-ship icons with an HP bar (reuse the visual style of the existing shield-energy bar for consistency — same stroke/fill pattern, different color).
> - The shield continues to work exactly as it does today — it prevents damage (and therefore knockback) entirely at the cost of energy. Knockback only applies when the shield is down.
>
> Constraints: single file, no external libraries, preserve GDD Section 3 conventions. Don't build Phase 3+ content (Debris/Hunter Satellite redesigns) — use the existing Asteroid/Satellite/Wedge/Saucer hazards as your damage sources for now, just update their contact-damage values per the numbers above instead of instant-kill.
>
> Before delivering: `node --check`, plus a headless test that inflicts repeated hazard contact on the ship and confirms (a) HP decreases by the right amount per hit type, (b) hit-stun prevents double-damage in consecutive frames, (c) knockback actually changes ship velocity away from the hazard, (d) HP hitting 0 triggers game-over without any respawn attempt.
>
> Deliver (per CLAUDE.md's conventions): complete updated HTML file; GDD updated in place (F2's spec moved from planned-features into Section 2, version bumped); STATUS.md updated in place with playtest asks — specifically, ask Paul to confirm the knockback strength feels right (not too weak/floaty, not too violent) and that HP damage-per-hit values feel fairly paced across a few waves.
>
> **Recommended settings:** Opus 4.8 · **high** effort · extended thinking **on**. Contained, well-specified change (one class, the damage table, HUD) — high effort is plenty. Bump to xhigh only if the knockback/hit-stun interaction with the existing shield logic proves fiddly.
>
> **Suggested commit:** `Phase 2: HP pool + knockback replaces lives (F2)`

---

## Phase 3 — Debris Satellites (Asteroid Reskin + Garbage Foundation)

**Builds:** `PLANNED-FEATURES-v2.md` Features F3 and F5.
**Depends on:** Phase 2 (needs the HP damage table to assign contact damage to the new entity).
**Touches:** `Asteroid` class (renamed/redesigned), `destroyAsteroid`, garbage/chain mass math, tuning constants.

### Prompt for Claude Code

> Continuing Asteroid Field Deluxe. Read `asteroid-field-deluxe-GDD.md` Section 2 and 3.4 (chain physics contract) in full, and `PLANNED-FEATURES-v2.md` Features F3 and F5 (F5 ships as part of this phase).
>
> **Goal for this session:** rename/redesign the asteroid hazard as "Debris Satellite" with 3-way splits and guaranteed per-tier garbage, and add the mass field to garbage/chain nodes that this requires.
>
> Requirements:
> - Rename the `Asteroid` class to `DebrisSatellite` (or similarly clear name) throughout the codebase — update all references (`game.asteroids` array, spawn logic, collision passes, etc.) consistently. Redesign the polygon shape to read as a broken-satellite silhouette (e.g. an irregular hull with 1–2 protruding antenna/panel-shard lines) rather than a jagged rock, keeping the existing `drawPoly`/`glowStroke` rendering approach.
> - Change the split behavior: large hit → 3 mediums (not 2); medium hit → 3 smalls (not 2); small hit → destroyed. Every tier's destruction — including the final small-tier kill — emits exactly 3 garbage canisters (replacing the old probabilistic single-canister drop).
> - Add a `mass` field (default `1.0`) to the `Garbage` class and to chain nodes. Update `Garbage.fromNode()` to carry `mass` over. Update pickup logic (wherever a `Garbage` instance becomes a chain node) to copy `mass` onto the new node.
> - Change the chain physics formulas in `updateChain`/`Ship.update` from `chain.length` (a count) to `chain.reduce((sum, n) => sum + n.mass, 0)` (a mass sum) for `CARGO_THRUST`, `CARGO_MAXSPD`, and the momentum-tug `massFactor`. All Debris-Satellite-sourced garbage uses `mass: 1.0`, so existing balance should feel roughly unchanged until Phase 5 introduces lower-mass garbage.
> - This phase will substantially increase garbage volume (see F3's math in the planned-features doc: up to ~39 canisters per fully-cleared large lineage vs. ~5 today). **Do a first-pass rebalance**, not a guess-and-ship: reduce wave spawn counts (`nextWave`'s `min(4+wave, 11)` formula) and/or shorten `GARBAGE_DECAY` as needed to keep on-screen density sane, and note in STATUS.md exactly what you changed and why so Paul can retune from a documented baseline.
> - Contact damage against the ship (from Phase 2) should apply per-tier to the renamed entity, same values as before unless you have a specific reason to change them (note any change explicitly).
>
> Constraints: single file, no external libraries, preserve GDD Section 3 conventions, including the dead-flag/filter entity lifecycle for the new split behavior (don't splice arrays mid-loop). Don't build the Hunter Satellite redesign (Phase 5) or the difficulty ramp (Phase 4) yet — the existing hexagon Satellite/Wedge system and saucers stay as-is this phase.
>
> Before delivering: `node --check`, plus a headless test that destroys a full Debris Satellite lineage (one large → 3 mediums → 9 smalls) and confirms the exact garbage count matches spec, mass fields propagate correctly through `Garbage.fromNode()`, and chain tow behavior with an 8-canister chain matches expected mass-sum math.
>
> Deliver (per CLAUDE.md's conventions): complete updated HTML file; GDD updated in place (F3/F5 specs moved into Section 2, Section 3 architecture map updated with the renamed class and mass-sum chain formula, version bumped, Section 3.4's chain contract updated to reflect mass-based math); STATUS.md updated in place with the balance numbers you landed on and specific playtest asks about garbage density/decay feeling right, not overwhelming.
>
> **Recommended settings:** Opus 4.8 · **xhigh** effort · extended thinking **on**. This phase changes the chain-physics contract (count → mass-sum) *and* does a balance pass on garbage volume — two interacting concerns where a shallow pass will get the math subtly wrong. Worth `ultrathink` on the mass-sum conversion if you want to be sure the tow-feel math stays equivalent for mass-1.0 cargo.
>
> **Suggested commit:** `Phase 3: Debris Satellites + variable-mass garbage (F3/F5)`

---

## Phase 4 — Difficulty Ramp & Saucer Calming

**Builds:** `PLANNED-FEATURES-v2.md` Feature F10 (the difficulty helper + the saucer half of it; Hunter scaling arrives with the Hunter redesign in Phase 5).
**Depends on:** nothing structural, but ordered here so the difficulty factor exists before the Hunter redesign wires into it.
**Touches:** new `difficultyFactor` helper, saucer spawn/fire/aim logic, tuning constants.

### Prompt for Claude Code

> Continuing Asteroid Field Deluxe. Read `asteroid-field-deluxe-GDD.md` Section 2 (current build including Phases 1–3) and 2.6 (Saucers specifically), and `PLANNED-FEATURES-v2.md` Feature F10 in full.
>
> **Goal for this session:** add a global difficulty-ramp system and use it to calm the early-game saucers. This addresses playtest feedback that opening waves are too intense.
>
> Requirements:
> - Add a `difficultyFactor(wave)` helper returning a multiplier that starts near 0 at wave 1 and climbs slowly toward ~1.0 over many waves. Use `1 - Math.exp(-(wave-1) / RAMP_WAVES)` with `RAMP_WAVES` as a tuning constant (start at 8). Put `RAMP_WAVES` in the constants block; this one knob controls how fast the whole game ramps.
> - Refactor the **existing saucers** (shipped v1.1 code) so their difficulty-sensitive parameters interpolate between an easy wave-1 floor and a full-intensity ceiling via `difficultyFactor`:
>   - **Spawn frequency:** early waves should have noticeably longer gaps between saucers (propose ~20–30s floor at wave 1) tightening toward the current ~12–16s at full difficulty. Re-express the current `rand(12,22) - min(6, wave)` logic in floor/ceiling terms.
>   - **Fire rate:** both saucers' between-shot timers start slower early (propose ~1.8× the current intervals at wave 1) easing to 1.0× at full difficulty. Current: big `rand(0.9,1.6)`, small `rand(0.7,1.1)`.
>   - **Small saucer aim accuracy:** start much wider (propose ±0.35 rad at wave 1) tightening to the current ±0.09 rad at full difficulty. Big saucer fires randomly already — leave it.
>   - Optionally fold the existing "small saucer more likely above 8000 points" logic into the difficulty factor for consistency (one escalation system instead of two) — but if that muddies the diff, leave it and note the duplication for later.
> - Express every one of these as `floor + (ceiling - floor) * difficultyFactor(wave)` with named floor/ceiling constants, so all early-game pacing is tunable from the constants block.
>
> Constraints: single file, no external libraries, preserve GDD Section 3 conventions. Do NOT touch the Hunter/Satellite/Wedge enemy this phase — its difficulty scaling is built in Phase 5 when it's redesigned. This phase is the difficulty *helper* plus the *saucer* application only.
>
> Before delivering: `node --check`, plus a headless test that calls `difficultyFactor` across waves 1–25 and confirms the curve shape (near 0 early, approaching 1 late), and confirms saucer spawn-gap / fire-rate / aim-error values at wave 1 vs. wave 20 differ in the expected direction and magnitude.
>
> Deliver (per CLAUDE.md's conventions): complete updated HTML file; GDD updated in place (F10's difficulty-factor concept and the saucer scaling moved into Section 2, add the "Ease players in" design principle to Section 1 Pillars, version bumped); STATUS.md updated in place with playtest asks — specifically whether waves 1–4 now feel approachable and whether the ramp reaches satisfying intensity by the teens.
>
> **Recommended settings:** Opus 4.8 · **high** effort · extended thinking **on**. The `difficultyFactor` helper is simple; the work is mostly re-expressing existing saucer constants as floor/ceiling pairs. High effort suffices — the design thinking (curve shape, floor/ceiling values) is already done in F10.
>
> **Suggested commit:** `Phase 4: difficulty ramp + saucer calming (F10)`

---

## Phase 5 — Hunter Satellites (Killer Satellite / Wedge Redesign)

**Builds:** `PLANNED-FEATURES-v2.md` Feature F4.
**Depends on:** Phase 3 (uses the mass field for low-mass garbage) AND Phase 4 (wires into `difficultyFactor` from the start).
**Touches:** `Satellite` and `Wedge` classes (renamed/redesigned), split logic, garbage emission, difficulty scaling.

### Prompt for Claude Code

> Continuing Asteroid Field Deluxe. Read `asteroid-field-deluxe-GDD.md` Section 2 (including Phase 3's Debris Satellite / mass-field changes and Phase 4's `difficultyFactor` helper) and `PLANNED-FEATURES-v2.md` Feature F4.
>
> **Goal for this session:** redesign the existing hexagon Satellite/Wedge system into "Hunter Satellite" — a diamond-shaped, 3-way-splitting, garbage-emitting hazard whose speed ramps gently via the difficulty factor.
>
> Requirements:
> - Rename/merge `Satellite` and `Wedge` into a single `HunterSatellite` concept with three size tiers (large/medium/small), reusing the existing drift-toward-player-at-spawn-time and wrap-aware **active homing** behavior already proven in the shipped Wedge class. Split children **actively home** (relentless re-aiming pursuit) — this is confirmed, not passive drift. The early-game gentleness comes entirely from difficulty scaling, not from weakening the homing behavior.
> - Change shape to a diamond silhouette for all three tiers (replacing the hex/wedge look), scaled per tier.
> - Change split counts: large hit → 3 mediums; medium hit → 3 smalls; small hit → destroyed.
> - **Wire all speed and turn-rate values into `difficultyFactor(game.wave)` from the start.** Each tier's homing speed and turn rate should be `floor + (ceiling - floor) * difficultyFactor(wave)`, where the ceiling values are the full-intensity numbers (use the shipped Wedge values as reference: ~120 px/s / 1.6 rad/s and ~175 px/s / 2.6 rad/s as anchor points, extended sensibly across three tiers) and the floors are gentle wave-1 values (propose ~55–60% of ceiling). The large Hunter's passive pre-hit drift stays passive at all difficulties — only its drift *speed* scales.
> - Large and medium tier kills emit 3 normal-mass (`mass: 1.0`) garbage canisters each. Small tier kills emit a larger burst (propose 5–6) of low-mass (`mass: 0.5`) garbage — call it out visually if easy (slight tint difference) so players can see it tows more easily.
> - Contact damage against the ship: use the Hunter-specific values from Phase 2's damage table (proposed 30/45/60 by tier).
> - Preserve existing chain-vulnerability rules — Hunter Satellites still sever the player's tow chain on contact.
>
> Constraints: single file, no external libraries, preserve GDD Section 3 conventions. Reuse the split/garbage-emission pattern established in Phase 3 for Debris Satellites where it makes sense; a documented parallel pattern is fine if a shared base class would make the diff harder to follow.
>
> Before delivering: `node --check`, plus a headless test destroying a full Hunter lineage and confirming split counts, garbage mass values (normal at large/medium, low at small), chain-severing on contact, AND that homing speed at wave 1 is meaningfully slower than at wave 20 (difficulty factor is actually applied).
>
> Deliver (per CLAUDE.md's conventions): complete updated HTML file; GDD updated in place (F4 spec moved into Section 2, architecture map updated, version bumped); STATUS.md updated in place with playtest asks — specifically whether the Hunter now feels gentle enough in early waves and whether the three-tier homing progression feels appropriately escalating as both tier and wave climb.
>
> **Recommended settings:** Opus 4.8 · **xhigh** effort · extended thinking **on**. Reworking a homing enemy into three tiers, wiring every speed/turn value through the difficulty factor, and adding tiered garbage emission is the most logic-dense enemy change in the plan. xhigh is worth it; add `ultrathink` if the wrap-aware homing across the larger world needs extra scrutiny.
>
> **Suggested commit:** `Phase 5: Hunter Satellites redesign (F4)`

---

## Phase 6 — Powerup System

**Builds:** `PLANNED-FEATURES-v2.md` Feature F6.
**Depends on:** Phase 2 (health powerups need the HP system), Phase 3 (magnet/engine need mass-sum chain math).
**Touches:** new `Powerup` entity class, `Ship.update` fire logic, chain math (temporary modifiers), HUD.

### Prompt for Claude Code

> Continuing Asteroid Field Deluxe. Read `asteroid-field-deluxe-GDD.md` Section 2 (current build including Phases 1–5) and `PLANNED-FEATURES-v2.md` Feature F6.
>
> **Goal for this session:** implement the powerup system — Rapid Fire, Triple Shot, Health, Magnet, and Engine.
>
> Requirements:
> - Add a `Powerup` entity class (visible in the field, following the standard entity contract: constructor/update/draw/dead) with a `type` field for the five kinds above. Give each a distinct, readable vector-glow icon consistent with the game's visual language (Pillar 1).
> - Spawn logic: Health powerups spawn ambiently on a timer (similar cadence to the existing saucer spawn timer). Rapid Fire / Triple Shot / Magnet / Engine drop from small-tier Debris/Hunter Satellite kills at a modest chance (propose 8–12%, tunable constant).
> - Effects (propose ~15s duration for timed ones, tunable):
>   - **Rapid Fire:** doubles `MAX_BULLETS` (4→8) while active.
>   - **Triple Shot:** fires 3 bullets in a narrow spread per shot; triples `MAX_BULLETS` (4→12) while active. If both Rapid Fire and Triple Shot are active simultaneously, use the higher cap (12) rather than multiplying them together.
>   - **Health:** instant effect, not timed — restores HP (propose +25, capped at max) on pickup.
>   - **Magnet:** while active, increases effective pickup radius and pulls nearby garbage toward the ship (a real attraction force reads better than just a bigger pickup circle — apply a small velocity nudge toward the ship for garbage within an extended radius, propose 3× the normal `GARBAGE_PICKUP` radius).
>   - **Engine:** while active, halves the effective mass sum used in the chain's `thrustMul`/`maxSp`/`massFactor` calculations (from Phase 3), making towing feel lighter.
> - Same-type pickups while already active refresh/extend the duration rather than stacking magnitude. Different types can be active simultaneously.
> - HUD: small icon row showing active powerups with a remaining-duration indicator (reuse the shield-bar visual pattern if convenient).
>
> Constraints: single file, no external libraries, preserve GDD Section 3 conventions — new powerup logic should hook into `Ship.update`'s fire block and the chain math functions per the extension points already documented, not create parallel systems.
>
> Before delivering: `node --check`, plus a headless test that spawns one of each powerup type, confirms correct effect magnitude and duration expiry, confirms Rapid Fire + Triple Shot together caps at 12 (not 24), and confirms Magnet actually moves nearby garbage toward the ship over a few frames.
>
> Deliver (per CLAUDE.md's conventions): complete updated HTML file; GDD updated in place (F6 spec moved into Section 2, version bumped); STATUS.md updated in place with playtest asks — specifically whether powerup drop rate feels right (too rare to matter / too common to feel special) and whether the Magnet's pull force feels satisfying rather than jittery.
>
> **Recommended settings:** Opus 4.8 · **xhigh** effort · extended thinking **on**. Five distinct powerup effects, each hooking a different existing system (bullets, HP, mass-math, pickup radius), plus stacking rules and a HUD row — lots of small correct interactions to hold at once. xhigh keeps them all consistent.
>
> **Suggested commit:** `Phase 6: powerup system (F6)`

---

## Phase 7 — Basic Gamepad Input

**Builds:** `PLANNED-FEATURES-v2.md` Feature F7 (hardcoded defaults only — rebinding UI comes in Phase 8).
**Depends on:** nothing structurally (can move earlier if you want controller support sooner).
**Touches:** `input` predicate object (refactored into an input-binding layer).

### Prompt for Claude Code

> Continuing Asteroid Field Deluxe. Read `asteroid-field-deluxe-GDD.md` Section 2 and 3 (Input row) and `PLANNED-FEATURES-v2.md` Feature F7.
>
> **Goal for this session:** add gamepad support with the specified hardcoded defaults. Rebinding UI is NOT in scope for this phase — that's Phase 8.
>
> Requirements:
> - Refactor the existing `input` predicate object so each predicate (`left`, `right`, `thrust`, `fire`, `shield`) checks *either* keyboard state *or* gamepad state, without changing any call sites elsewhere in the code (everything else should keep calling `input.left()` etc. exactly as today).
> - Poll `navigator.getGamepads()` once per frame (in the main loop, before `update()`). Use only the first connected gamepad; ignore additional ones.
> - Defaults: D-Pad Left or Left Stick X < -0.25 → rotate CCW; D-Pad Right or Left Stick X > 0.25 → rotate CW; D-Pad Up or Left Stick Y < -0.25 → thrust; A button → fire. Add a shield binding too (not specified by the user — use right trigger or right bumper as a sensible default, flagged in your delivery notes as a gap-fill you made).
> - Fixed, non-configurable bindings for menu contexts (relevant to later phases but wire the raw button reads now so they're available): A = confirm, B = back, Start = start/pause/unpause. For this phase, Start should at minimum toggle pause the same way the `P` key does today.
> - Structure the binding table as data (e.g. a `bindings` object mapping actions to {key, gamepadButton/axis}) rather than hardcoded logic per action — this makes Phase 8's rebinding UI straightforward to build against.
>
> Constraints: single file, no external libraries (the Gamepad API is native browser). Preserve GDD Section 3 conventions.
>
> Before delivering: `node --check`. Full gamepad testing needs an actual controller and a real browser, which a headless harness can't simulate — instead, structure the code so `navigator.getGamepads` can be stubbed with a fake gamepad object in a headless test, and verify the binding-table lookup logic resolves correctly for a few synthetic button/axis states.
>
> Deliver (per CLAUDE.md's conventions): complete updated HTML file; GDD updated in place (F7's hardcoded-defaults portion moved into Section 2, noting the rebinding UI is still pending in F8/Phase 8); STATUS.md updated in place with an explicit note that controller *feel* (deadzone comfort, button mapping) needs verification with a real controller, which Claude can't do — list this as the top playtest ask.
>
> **Recommended settings:** Opus 4.8 · **high** effort · extended thinking **on**. A clean, contained refactor of the input layer into a data-driven binding table. High effort is appropriate; the main risk is structural cleanliness (so Phase 8 can build on it), not algorithmic difficulty.
>
> **Suggested commit:** `Phase 7: gamepad input with default bindings (F7)`

---

## Phase 8 — Pause Modal, Options Menu & Control Rebinding

**Builds:** `PLANNED-FEATURES-v2.md` Feature F8 (plus F7's rebinding UI).
**Depends on:** Phase 7 (needs a binding table to rebind).
**Touches:** new menu/UI state machine, `AudioSys` (master/category gain routing), settings persistence.

### Prompt for Claude Code

> Continuing Asteroid Field Deluxe. Read `asteroid-field-deluxe-GDD.md` Section 2 and 3 (AudioSys row, Input row) and `PLANNED-FEATURES-v2.md` Features F7 and F8.
>
> **Goal for this session:** build the pause modal, options menu (volume sliders + Controls submenu), and the control-rebinding screen for both keyboard and gamepad.
>
> Requirements:
> - Extend `game.state`/`game.paused` into a small menu state machine: `playing` → (pause) → `menu:root` (Continue / Options / Quit) → `menu:options` (SFX/Music/Master volume sliders + Controls button) → `menu:controls` (rebind screen + Return to Defaults).
> - Menu navigation: A/Enter = confirm, B/Escape = back a screen, Start/P = toggle pause from gameplay. Menus must be navigable by both keyboard and gamepad using Phase 7's binding layer.
> - Refactor `AudioSys` to route every sound through a master gain node and a per-category (SFX) gain node, so the three volume sliders actually affect output. There is no music track in this game yet — add the Music volume slider control and wire it to a gain node with nothing connected to it yet, and say so plainly in your delivery notes rather than silently building a placeholder track.
> - Controls screen: list the configurable actions (rotate CCW/CW, thrust, fire, shield) with their current keyboard and gamepad bindings; clicking/selecting a binding and then pressing a key or gamepad button rebinds it; a "Return to Defaults" button resets the binding table to Phase 7's defaults.
> - Persist volume settings and custom bindings via `localStorage`, wrapped in try/catch (per GDD's existing note that storage isn't available in the claude.ai artifact sandbox but works in a real browser — don't let a storage failure crash the game).
> - Quit returns to the title screen (there's no reliable way for a webpage to close its own tab).
>
> Constraints: single file, no external libraries. Keep gameplay input and menu input cleanly separated — a rebind screen capturing a keypress must not also affect ship rotation/thrust if `paused` state leaks through incorrectly.
>
> Before delivering: `node --check`, plus a headless test that opens the pause menu, changes a volume value, rebinds one action, hits Return to Defaults, and confirms the binding table resets correctly. Note in STATUS.md that persistence itself needs verification in a real browser outside the artifact sandbox.
>
> Deliver (per CLAUDE.md's conventions): complete updated HTML file; GDD updated in place (F7/F8 specs moved into Section 2, noting the new menu state machine in the architecture map, version bumped); STATUS.md updated in place with playtest asks — specifically whether menu navigation feels natural on both keyboard and gamepad, and whether rebinding a control actually takes effect immediately in gameplay.
>
> **Recommended settings:** Opus 4.8 · **xhigh** effort · extended thinking **on**. Introduces the first real menu state machine, an AudioSys gain-routing refactor, live rebinding capture, and localStorage persistence — several distinct subsystems that must not step on each other (especially menu-input vs. gameplay-input separation). xhigh earns its keep here.
>
> **Suggested commit:** `Phase 8: pause menu, options, control rebinding (F8)`

---

## Phase 9 — Achievements System

**Builds:** `PLANNED-FEATURES-v2.md` Feature F9.
**Depends on:** everything above (needs final mechanic names/systems to track against).
**Touches:** new achievement-tracking module, stat hooks scattered through existing systems, notification UI, persistence.

### Prompt for Claude Code

> Continuing Asteroid Field Deluxe. Read `asteroid-field-deluxe-GDD.md` Section 2 in full (this is the largest dependency surface of any phase) and `PLANNED-FEATURES-v2.md` Feature F9, including both starter achievement pools.
>
> **Goal for this session:** build the achievements system — 5 rotating weekly achievements (calendar-deterministic) and the lifetime achievement pool.
>
> Requirements:
> - Implement the 15 weekly and 12 lifetime achievements listed in F9's starter pools, each needing a stat hook somewhere in the game (kill counts by hazard type/tier, dock deliveries, HP thresholds, powerup usage, wave reached, damage-free wave completions, play time, etc.). Add lightweight counters/flags to `game` state as needed for tracking; don't restructure existing systems just to make tracking easier — prefer observing events at the point they already happen (e.g. inside `addScore`, `destroyAsteroid`/`DebrisSatellite` equivalent, dock delivery logic) over adding new indirection layers.
> - Weekly rotation: compute the current ISO week number and year from the real date at game launch; pool index = `(isoYear * 52 + isoWeek) % 15`; select 5 consecutive achievements from the pool starting at that index (wrapping around). This must be deterministic — no randomness — so every player sees the same 5 achievements in the same calendar week.
> - Persist unlocked-achievement state and lifetime counters via `localStorage` (same try/catch caveat as Phase 8 — don't crash if storage is unavailable).
> - Add a simple notification (toast/banner, a few seconds, non-blocking) when an achievement unlocks, and a screen (accessible from the pause menu's Options, or title screen — your call, note which you picked) listing all achievements with progress and unlock status.
>
> Constraints: single file, no external libraries. Preserve every convention documented in GDD Section 3.
>
> Before delivering: `node --check`, plus a headless test that fakes a specific date to confirm the weekly-rotation math picks the expected 5-achievement slice, and drives a few gameplay scenarios (e.g. deliver N canisters, destroy N hazards) to confirm the relevant achievements actually unlock at the right thresholds.
>
> Deliver (per CLAUDE.md's conventions): complete updated HTML file; GDD updated in place (F9 spec moved into Section 2, version bumped — this likely marks v2.0 as fully shipped, so update the top-level version line accordingly); STATUS.md updated in place summarizing the full v2.0 feature set as complete, with a consolidated playtest list covering anything from Phases 1–9 that still needs real-browser verification.
>
> **Recommended settings:** Opus 4.8 · **xhigh** effort · extended thinking **on**. This phase has the widest dependency surface — it reaches into nearly every system to place stat hooks, plus deterministic calendar math and persistence. xhigh helps it place hooks cleanly without disturbing the systems it observes.
>
> **Suggested commit:** `Phase 9: achievements system (F9) — v2.0 complete`

---

## After Phase 9

Once all nine phases have shipped, `PLANNED-FEATURES-v2.md` should be empty of active content (everything moved into the GDD) — at that point, either delete it or repurpose it as the starting template for a v3.0 planning pass, whichever you prefer. This document (`IMPLEMENTATION-PHASES.md`) can be archived or cleared for the next round of phases at the same time.

**Deferred items to carry forward** (parked deliberately, not forgotten): off-screen threat awareness / approach indicators for the larger world (flagged in F1 and F10) — a good early candidate for a v3.0 pass, since it grew more relevant once the world got bigger and the early game got calmer.