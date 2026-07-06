# ASTEROID FIELD DELUXE — Game Design Document & Handoff Guide

**Version:** 1.4 shipped · v2.0 in progress (Phase 3 of 9 done — see companion docs below)
**File:** `asteroids-deluxe.html` (single self-contained HTML file)
**Stack:** Vanilla JavaScript, HTML5 Canvas 2D, Web Audio API. No dependencies, no build step.
**Logical resolution:** 1280×720 viewport (`VIEW_W×VIEW_H`), scaled to fit window with letterboxing (CSS scaling, canvas stays 1280×720 internally). As of v1.2 the simulation runs in a larger **3840×2160 toroidal world** (`WORLD_W×WORLD_H`) that the viewport scrolls across, keeping the ship centered — see §2.11.

**Companion documents (read alongside this one):**
- **`PLANNED-FEATURES-v2.md`** — full specs, design rationale, and open questions for every feature not yet built. This GDD's Section 2 describes only what's actually shipped; once a v2 feature ships, its spec moves from that doc into this one.
- **`IMPLEMENTATION-PHASES.md`** — the v2 feature list broken into ordered, session-sized phases with ready-to-paste Claude Code prompts.
- **`STATUS.md`** — running session log, same as always.

---

## 1. Vision & Design Pillars

A faithful-in-spirit knockoff of Atari's *Asteroids Deluxe* (1981), the harder sequel to *Asteroids*. Everything added to this game should be tested against these pillars:

1. **Vector purity.** All game objects are glowing stroked polygons on near-black. No fills (except tiny bullet dots and particles), no sprites, no textures. The blue-white palette echoes the Deluxe cabinet's blue-tinted mirror overlay.
2. **Momentum is the game.** The ship drifts. Mastery = managing inertia, not twitch aiming. Any new mechanic should interact with momentum, not bypass it.
3. **Pressure, not chaos.** Deluxe was famous for being *mean* — homing enemies, faster rocks — but every threat is readable and has a counterplay. New enemies need a visible tell and a fair answer.
4. **The shield is a resource, not a panic button.** Energy management is the core Deluxe innovation. New mechanics can spend, restore, or threaten shield energy.
5. **Greed is a choice.** (v1.1) Bonus systems like the salvage chain must always be optional, must degrade the player's core capabilities while pursued, and must be losable right up to the payoff. Reward the player for *choosing* risk, never force the risk on them.
6. **Ease players in.** (planned, v2.0 — see `PLANNED-FEATURES-v2.md` F10) Opening waves should be approachable; intensity ramps gradually with wave number, not all at once. Any threat parameter (speed, fire rate, accuracy, spawn frequency, density) should be expressed as a base value scaled by a shared wave-driven difficulty factor, so the whole game's pacing tunes from one place. Complements Pillar 3 — pressure should arrive *on a schedule*, not slam the player at wave 1.

---

## 2. Current Mechanics Specification

### 2.1 Ship
- Rotation 4.2 rad/s; thrust 340 px/s²; max speed 520 px/s; drag 35%/s (exponential).
- Collision radius 13 px. Wraps at the world edge.
- **Health:** a single HP pool (`SHIP_MAX_HP` = 250) for the whole run — no lives, no respawns. Unshielded hazard/bullet hits subtract source-specific damage; 0 HP is a permanent game over. See §2.7 and §2.12.
- **Hit-stun invulnerability:** any non-lethal hit grants `HIT_STUN_DURATION` (1.0 s) of invulnerability (rendered as blinking) during which further hits are ignored, and shoves the ship away from the hazard at `KNOCKBACK_SPEED` (250 px/s). There is no longer a separate 2.5 s spawn invulnerability — a run starts immediately vulnerable (the first wave spawns ≥220 px away). `ship.invuln` is now purely the hit-stun timer.

### 2.2 Weapons
- Max 4 player bullets alive at once; 0.16 s fire cooldown; bullet speed 620 px/s + ship velocity inherited; 1.05 s lifetime. Bullets wrap.

### 2.3 Shield (hold Shift)
- Energy 0→1. Drains 0.55/s while held; recharges 0.12/s while off; each deflection costs an extra 0.22. Cuts out below 0.02 energy.
- Radius 26 px. Deflects debris satellites and killer satellites elastically (bounced away at 1.1× their speed, pushed out of overlap). Blocks hostile bullets (costs deflection energy). **Destroys wedges on contact** (they still split).

### 2.4 Debris Satellites (v1.4)

The passive main hazard (formerly "Asteroids" — the `Asteroid` class was renamed `DebrisSatellite` and its array `game.asteroids` → `game.debris` in Phase 3). They drift randomly and screen-wrap exactly as the old rocks did; the change is visual identity, split fan-out, and guaranteed salvage.

- **Three sizes.** Radius / base drift speed / score: large 46 px / 70 / 20 · medium 26 px / 110 / 50 · small 13 px / 160 / 100 (`DEBRIS_RADII` / `DEBRIS_SPEEDS` / `DEBRIS_SCORE` — scores unchanged from the old asteroid values).
- Speeds get ±30% random variance and a per-wave multiplier of `1 + (wave−1) × 0.08`.
- **3-way splits (F3).** Large → **3 mediums**; medium → **3 smalls**; small → destroyed (no children). This replaces the old 2-way split.
- **Guaranteed garbage at every tier (F3).** *Every* destruction — including the final small-tier kill — emits exactly `DEBRIS_GARBAGE` (**3**) canisters, each with a random outward kick so they fan out. This replaces the old probabilistic single drop (`GARBAGE_DROP` by size). One fully-cleared large lineage (1 large → 3 mediums → 9 smalls = 13 kills) therefore yields **39** canisters, all mass 1.0 (see §2.10). This drove the Phase-3 balance pass (shorter `GARBAGE_DECAY`, trimmed wave counts — §2.7, §2.10.1).
- **Shape.** A broken-satellite silhouette: an irregular hull polygon (`n = 6 + size` vertices, radius jitter 0.65–1.05) plus 1–2 protruding antenna/panel shards (open polylines with a small crossbar at the tip), drawn via `drawPoly`/`glowStroke` in `COLOR.debris` (the same blue as the old asteroids, distinct from the teal Hunter satellites). Collision stays circle-vs-circle at the hull radius; the antennas are cosmetic.
- **Contact damage** carries over from F2 unchanged: `DEBRIS_DAMAGE` = large 50 / medium 35 / small 20 (`DMG_LARGE/MEDIUM/SMALL`).

### 2.5 Killer Satellite & Homing Wedges (the Deluxe signature)
> ⚠️ **Planned for redesign in v2.0** — this system is being renamed to "Hunter Satellite" (diamond shape, 3-way splits at every tier, garbage emission) to resolve a naming collision with the new Debris Satellites. See `PLANNED-FEATURES-v2.md`, the "Naming & Identity Resolution" note and Feature F4. Not yet built.

- Satellite: spinning double hexagon, radius 30, drifts toward the ship's position at spawn time (55 px/s). Spawns from wave 2 onward, one at a time, 20–32 s timer, only when no satellites or wedges are alive. Worth 200.
- Shot satellite → **3 large wedges** (radius 14, 120 px/s, turn rate 1.6 rad/s, worth 150).
- Shot large wedge → **2 small wedges** (radius 9, 175 px/s, turn rate 2.6 rad/s, worth 250).
- Wedges scatter for 0.6 s before homing engages. Homing is wrap-aware — they chase across screen edges.

### 2.6 Saucers
> ⚠️ **Planned for rebalancing in v2.0** — spawn frequency, fire rate, and small-saucer aim accuracy are being put on the F10 difficulty ramp so early waves are gentler. Behavior/shape unchanged; only the pacing constants become wave-scaled. See `PLANNED-FEATURES-v2.md` Feature F10. Not yet built.

- One at a time; spawn timer 12–22 s minus up to 6 s by wave. Enter from a side edge, zig-zag vertically, exit the far side (no horizontal wrap; despawn after crossing).
- Big saucer: radius 20, 100 px/s, fires randomly every 0.9–1.6 s. Worth 200.
- Small saucer: radius 12, 150 px/s, fires *aimed* (±0.09 rad error) every 0.7–1.1 s. Worth 1000. Spawn chance 25%, rising to 60% above 8000 points.
- Saucer bullets are red, 380 px/s, 1.4 s life, and destroy debris satellites (no score awarded, but they still emit their 3 canisters — see §2.4).

### 2.7 Waves, Health & Scoring

- Wave N spawns `min(3 + N, 9)` large Debris Satellites, placed in a ring 220–1100 px around the ship's *current* world position (see §2.11). *(Trimmed from `min(4 + N, 11)` in Phase 3 to offset the ~8× higher garbage volume from guaranteed 3-per-tier drops — see §2.10.1. `GARBAGE_DECAY` is the primary density lever; this is the secondary trim, and F10 may raise it again for a fuller field.)*
- Next wave starts 2.5 s after the field is clear of debris, satellites, AND wedges. Free garbage and towed cargo do **not** block wave-clear; both persist into the next wave (the dock relocates).
- **Health, not lives (v1.3).** The ship has one HP pool (`SHIP_MAX_HP` = 250); there are no discrete lives, no respawns, and no continues — one hull for the whole run. Any unshielded hazard contact or hostile bullet subtracts source-specific damage, applies knockback, and opens a 1.0 s hit-stun window (see §2.12). At 0 HP the ship explodes, the tow load scatters, and the run ends (true game over).
- **Score milestones repair the hull.** Every 10,000 points (`REPAIR_MILESTONE`) grants +25 HP (`REPAIR_AMOUNT`), capped at max; if already at full HP the milestone instead pays a flat `REPAIR_FULL_BONUS` (2,500) points so it's never wasted. This replaces the old "extra life every 10,000 points."

### 2.8 Audio (all synthesized, no assets)
- Fire: square-wave pitch drop. Explosions: filtered noise bursts, deeper/longer by size. Thrust: looped low-passed noise. Saucer: LFO-warbled triangle (higher/faster for small). Heartbeat: alternating two-tone sine thump whose interval shrinks with wave number and field density (floor 0.28 s). Shield ping / extra life: sine chirp.

### 2.9 States & Controls
- States: `title` → `playing` → `gameover` (Enter restarts). `P` toggles pause. Rotate ←→/A/D, thrust ↑/W, fire Space, shield Shift.

### 2.10 Radioactive Salvage, Tow Chain & Recycling Dock (v1.1)

**Garbage drops (F3-updated).** Every destroyed Debris Satellite emits exactly `DEBRIS_GARBAGE` (3) radioactive canisters at *every* tier, including the final small-tier kill (39 per fully-cleared large lineage — see §2.4). This replaced the old probabilistic single drop. Canisters inherit 25% of the debris's velocity plus a random outward kick (so the trio fans out), drift, spin, and screen-wrap. Each canister carries a **`mass`** field (F5; default **1.0** for all Debris-sourced scrap — see below). They **decay after `GARBAGE_DECAY` (12 s)** if uncollected — blinking below 5 s, blinking fast below 2 s. Canisters knocked loose from a chain get a shorter `GARBAGE_SEVER_DECAY` (10 s) decay. *(Both decay windows were shortened in Phase 3 — from 20 s / 15 s — as the primary lever controlling on-screen canister density against the higher drop volume.)*

**Cargo mass (F5).** Each `Garbage` and each chain node carries a `mass` (default 1.0). `Garbage.fromNode()` carries `mass` back when a node is severed to free garbage; pickup copies the canister's `mass` onto the new chain node. The chain-handling penalties (below) scale with the chain's **total mass** — `chainMass()` = Σ node.mass — not its node count. All current (Debris-sourced) scrap is mass 1.0, so a chain's mass sum equals its length and handling is unchanged from v1.3; lower-mass scrap (planned for Hunter Satellites, F4) will tow more easily. See §3.4.

**Collection & chain.** Flying within 18 px of a canister hooks it onto a tow chain behind the ship (max **12** canisters; extras stay in the field). The chain is simulated: verlet nodes with 20 px distance constraints, anchored to a hitch point 12 px behind the ship. Physics effects:
- *Mass penalty:* thrust is divided by `1 + m×0.10` and top speed by `1 + m×0.05`, where **`m` = the chain's total mass** (`chainMass()` = Σ node.mass, F5). A full chain of 12 mass-1.0 canisters (m = 12) ≈ 45% thrust, 63% top speed. (For all-mass-1.0 cargo, m equals the node count, so this matches the old length-based penalty exactly.)
- *Momentum tug:* when the first link is stretched taut, the ship receives a pull-back acceleration of `CHAIN_TUG (26) × stretch-px × massFactor` (massFactor = min(1.4, m×0.12), same total-mass `m`). Hard turns and burns get the ship yanked by its own cargo.
- The chain is wrap-aware and follows the ship across screen edges.

**Chain vulnerability.** Any debris satellite, wedge, or killer-satellite body — or any hostile bullet — touching a chain node destroys that canister; **everything aft of it breaks loose** as free garbage (fresh `GARBAGE_SEVER_DECAY` 10 s decay, scatter velocity, mass preserved). Ship death scatters the entire load. Player bullets pass through garbage and chain (they're debris, not targets).

**Recycling dock.** A green octagonal station (radius 44) placed randomly each wave, 260–900 px from the ship's *current* world position (see §2.11). Non-solid — purely a delivery zone. While the ship is within radius+10 and carrying cargo, canisters peel off the **tail** every 0.13 s. Delivery score escalates within a single visit: `50 + 25×(n−1)` for the nth canister (full 12-chain = 2,250). The combo counter resets when the ship leaves the dock's neighborhood (radius+40). Delivery pitch rises per canister; score popups float up.

**HUD.** `CARGO n/12` readout (lit when carrying); a green chevron orbiting the ship points toward the dock whenever cargo > 0.

#### 2.10.1 Design considerations & rationale (read before changing this system)

These were deliberate calls, not accidents — future sessions should understand *why* before tuning:

- **Guaranteed 3-per-tier drops (F3) supersede the old inverted probabilistic model.** The v1.1 design dropped smalls reliably and larges rarely (≈5 per lineage) so garbage appeared only where a lineage was *finished*. Phase 3 replaced that with a flat 3 canisters at every tier (39 per fully-cleared large lineage) — a deliberate, request-driven ~8× volume increase to make salvage a much bigger, more constant temptation (Pillar 5: greed is a choice). The player is **not** expected to collect it all; most will decay uncollected, and that's fine — the point is a field rich with *optional* risk/reward, not housekeeping. Density is now controlled by **decay + the `CHAIN_MAX` (12) tow ceiling**, not by making drops rare.
- **Decay exists to protect readability — and matters more now.** With ~8× the drop volume, persistent garbage would carpet the field into visual noise. `GARBAGE_DECAY` was cut 20 → **12 s** in Phase 3 as the *primary* density lever (with a modest wave-count trim as the secondary — §2.7); severed scrap decays even faster (`GARBAGE_SEVER_DECAY` 10 s). The window still forces the same decision — break off to collect now, or let it go — and the blink pattern is the player's countdown; don't remove it. **Open tuning question:** whether 12 s is the right balance of "field feels populated" vs "field feels cluttered" is an explicit Phase-3 playtest ask, and F10 (more Debris density) will revisit this jointly.
- **The cap of 12 is a handling ceiling, not a scoring one.** Beyond ~12 nodes the thrust penalty makes the ship feel broken rather than heavy, and constraint chains that long start whipping. If raising the cap, retune `CARGO_THRUST` down.
- **The tail-peel offload (chain.pop) matters visually** — the chain visibly shortens from the far end while the ship holds in the dock, which reads as "unloading." Popping from the head would make the whole chain teleport forward one link per tick.
- **Escalating per-piece scores (not a flat rate) is the whole risk/reward engine.** A 12-chain delivery (2,250) is worth far more than four 3-chain trips (450). This is what makes players tow long, dangerous chains past homing wedges. Flatten this and the mechanic collapses into an errand.
- **Aft-severing (losing everything behind a hit node) instead of single-node loss** makes chain *position* strategic: your most recent pickups are the most exposed. It also creates dramatic "lost the whole tail" moments that flat attrition wouldn't.
- **The dock relocates every wave** to prevent a dominant orbit-the-dock strategy and to keep the risk of the haul fresh each wave.
- **The dock is non-solid.** Making it collidable punishes the exact maneuver the game asks for (flying into it while handling badly). Hazards pass over it too — the dock is a zone, not cover.
- **The shield does not protect the chain.** The shield radius (26) only covers the ship; deflected debris can and will hit your own cargo. This is intentional — the shield answer and the cargo answer should be in tension, not stacked.
- **Momentum tug uses pre-constraint stretch** as its force signal (see 3.4). This is a stability decision: spring forces on a hard-constrained chain oscillate; measuring how much the cargo "resisted" the ship this frame and applying only that gives a heavy feel without energy injection.

### 2.11 Larger Scrolling World & Camera (v1.2)

The simulation space and the screen used to be the same 1280×720 rectangle. As of v1.2 they are decoupled: the world is a large torus and the screen is a camera window onto it.

- **World vs viewport.** The world is `WORLD_W × WORLD_H` = **3840×2160** (3× per axis, 9× area) and still wraps at its own edges — same torus topology as before, just bigger. The **viewport** is `VIEW_W × VIEW_H` = **1280×720**, still the canvas size and still CSS-scaled/letterboxed to the window. All world/simulation math (wrap, distance, aiming, chain links) uses `WORLD_W/WORLD_H`; only the canvas, HUD, and title screen use `VIEW_W/VIEW_H`.
- **Camera.** `game.camera.x/y` tracks the ship's world position every frame — no smoothing, no clamping (the world wraps, so there is no edge for the camera to bump into). The ship is therefore always drawn at the center of the viewport. On respawn the ship returns to world center and the camera snaps with it.
- **Render pipeline.** `draw()` clears the viewport, draws the starfield, then (for gameplay) translates the context by `(VIEW_W/2 − camera.x, VIEW_H/2 − camera.y)` and draws every world-space entity inside that transform. The HUD (score, lives, cargo readout, dock chevron, wave, shield bar) and the pause/game-over overlays are drawn **after** restoring the untranslated context, so they stay screen-fixed. Each world entity is drawn at its **nearest wrapped image** relative to the camera (`wrapOffset`), so entities on the far side of the world seam still render in the right place when the ship is near a world edge (a single naive translate would drop them off-screen).
- **Culling.** `onScreen(e, margin)` (wrap-aware) skips drawing any entity more than `CULL_MARGIN` (100 px) outside the viewport. Culled entities still `update()` normally — off-screen hazards keep simulating in the larger world. (Off-screen *threat awareness* — warning the player about hazards approaching from beyond the viewport — is deliberately deferred; see `PLANNED-FEATURES-v2.md` F10.)
- **Starfield.** Background stars are scattered once across the whole world (count scales with world area to preserve the original on-screen density) and rendered wrap-aware in screen space, so the field scrolls seamlessly with no visible tiling repeat or edge seam.
- **Ship-relative spawning.** Because a fixed-rect spawn could drop a whole wave unreachably far away in the big world, spawns are now placed relative to the ship's *current* world position: new large debris satellites in a ring `[SPAWN_MIN_DIST, SPAWN_MAX_DIST]` = [220, 1100] px; the recycling dock in `[DOCK_MIN_DIST, DOCK_MAX_DIST]` = [260, 900] px. Killer satellites and saucers enter from just beyond a **viewport** edge relative to the ship (offset by `VIEW_W/2`/`VIEW_H/2` + a margin, then folded into the world with `wrapPos`), preserving their shipped "slide in from off-screen, cross the screen" feel; their speeds, homing, fire rates, and split behavior are unchanged (those are Phase 4/5 concerns).

> New tuning constants live in the "Larger world & scrolling camera (v1.2)" block at the top: `CULL_MARGIN`, `SPAWN_MIN_DIST`, `SPAWN_MAX_DIST`, `DOCK_MIN_DIST`, `DOCK_MAX_DIST`, `STAR_DENSITY`, plus `WORLD_W/H` and `VIEW_W/H`.

### 2.12 Health, Damage & Knockback (v1.3)

Discrete lives (3 stock + an extra life per 10,000 points) are gone. The ship carries a single HP pool for the entire run; survival is about managing that pool, not stock count. This keeps Pillar 4 intact — the shield is still the "free," energy-priced answer that prevents damage outright — while making one misjudged contact a costly setback rather than an instant stock loss.

- **HP pool.** `ship.hp` starts at `SHIP_MAX_HP` (250). The HUD shows it as a "HULL" bar top-left, styled exactly like the shield-energy bar (same stroke/fill pattern; `COLOR.hp` green, switching to red below 30%).
- **Damage table** (contact = ramming a hazard body; every value is a named constant in the tuning block — first-pass and tunable):

  | Source | Damage | Constant |
  |---|---|---|
  | Small hazard (small debris satellite, small wedge, small saucer) | 20 | `DMG_SMALL` |
  | Medium hazard (medium debris satellite, big wedge, big saucer) | 35 | `DMG_MEDIUM` |
  | Large hazard (large debris satellite, killer satellite) | 50 | `DMG_LARGE` |
  | Hostile (saucer) bullet | 15 | `DMG_BULLET` |

  Each hazard carries its own `damage` field, set in its constructor from these constants (debris satellites via the `DEBRIS_DAMAGE` size table). *These are placeholder assignments mapping the existing v1.1 hazards onto the damage tiers; the Phase 3/5 Debris/Hunter redesigns will define their own per-tier values (the plan proposes higher Hunter ramming damage).*
- **Knockback.** A non-lethal unshielded hit **sets** (not adds) the ship's velocity to `KNOCKBACK_SPEED` (250 px/s) pointing directly away from the hazard's center (wrap-aware, via `shortDelta`), so the ship physically separates instead of grinding inside the hazard. Setting rather than adding guarantees clear separation regardless of prior momentum; drag then bleeds the impulse off naturally over the following second.
- **Hit-stun.** The same hit sets `ship.invuln = HIT_STUN_DURATION` (1.0 s) of invulnerability (the existing blink render doubles as the hit-stun tell). Further hits are ignored until it expires, so no single hazard can chew through the pool in consecutive frames, and several hazards overlapping in one frame still only land one hit. `damageShip()` self-guards on shield/hit-stun/dead, so the collision passes don't need to break early.
- **Death.** At 0 HP `killShip()` runs the explosion boom + particles, `scatterChain()` drops the whole tow load as free garbage, and the state goes straight to `gameover`. There is no respawn path — the old "respawn only when the center is clear" logic (former §2.1) is deleted entirely.
- **Shield unchanged.** A raised shield deflects/blocks at its usual energy cost, and a shielded hit takes **no** damage, knockback, or hit-stun — knockback is strictly the unshielded fallback. The shield still does not protect the tow chain (§2.10.1).

> Tuning constants live in the "Health, damage & knockback (F2)" block at the top: `SHIP_MAX_HP`, `DMG_SMALL/MEDIUM/LARGE`, `DMG_BULLET`, `KNOCKBACK_SPEED`, `HIT_STUN_DURATION`, `REPAIR_MILESTONE`, `REPAIR_AMOUNT`, `REPAIR_FULL_BONUS` (the per-size contact-damage map `DEBRIS_DAMAGE` lives with the debris constants).

---

## 3. Code Architecture Map

Everything lives in one `<script>` block. Reading order top to bottom:

| Section | Contents | Notes for modification |
|---|---|---|
| **Constants** | All tuning values (SHIP_*, BULLET_*, SHIELD_*, `DEBRIS_*`, scores) + v1.1 salvage block (GARBAGE_*, CHAIN_*, CARGO_*, DOCK_*) + v1.2 world block (`WORLD_W/H`, `VIEW_W/H`, `CULL_MARGIN`, `SPAWN_MIN/MAX_DIST`, `DOCK_MIN/MAX_DIST`, `STAR_DENSITY`) + v1.3 HP block (`SHIP_MAX_HP`, `DMG_SMALL/MEDIUM/LARGE`, `DMG_BULLET`, `DEBRIS_DAMAGE`, `KNOCKBACK_SPEED`, `HIT_STUN_DURATION`, `REPAIR_*`). v1.4 (F3): the debris table is `DEBRIS_SPEEDS/RADII/SCORE/DAMAGE` (was `AST_*`) plus `DEBRIS_GARBAGE` (3 canisters/kill); `GARBAGE_DROP` was removed; `GARBAGE_DECAY` 20→12 and a new `GARBAGE_SEVER_DECAY` (10) replaced the inline 15. | **Change balance here first.** Never hardcode magic numbers deeper in the file. `WORLD_*` = the wrap boundary; `VIEW_*` = the screen — keep the distinction (see §2.11). Garbage density tunes from `GARBAGE_DECAY` / `GARBAGE_SEVER_DECAY` + the `nextWave` count. |
| **Canvas/scaling** | `resize()` — CSS scaling, fixed 1280×720 logical viewport | Same pattern as Atomic Dustbin Dan. `resize()` uses `VIEW_W/VIEW_H` (screen); all *world* math uses `WORLD_W/WORLD_H`, never window size. |
| **AudioSys** | Singleton object; all sounds are methods; init on first keypress (autoplay policy). v1.1 adds `pickup()` and `deliver(count)` (pitch climbs with delivery combo) | Continuous sounds (thrust, saucer) are start/stop node pairs. Add new SFX as new methods; follow the `now()` + gain-envelope pattern. |
| **Input** | `keys{}` map + `input` helper predicates | Add new bindings as predicates in `input`, not by reading `keys` inline. Enter/P handled in keydown directly. |
| **Helpers** | `rand`, `wrap`, `dist2`, `angleTo`, **`shortDelta`** (v1.1), **`wrapOffset`/`wrapPos`** (v1.2), `glowStroke`, `drawPoly`, `COLOR` | ⚠️ `wrap`, `dist2`, `angleTo`, `shortDelta` are **wrap-aware** and now operate against `WORLD_W/WORLD_H`. Always use these for distance/aiming/link math — naive `Math.hypot` deltas break near edges. `wrapOffset` gives the nearest wrapped image of a point relative to the camera (rendering); `wrapPos` folds a fresh spawn into `[0,WORLD)`. |
| **Entity classes** | `Ship`, `Bullet`, `DebrisSatellite`, `Satellite`, `Wedge`, `Saucer`, `Particle`, and (v1.1) `Garbage`, `FloatText`, `Dock` + `drawCanister()` shared renderer | Uniform contract: constructor, `update(dt)`, `draw()`, `dead` flag. Some have `split()`. v1.4: `Asteroid` → **`DebrisSatellite`** (broken-satellite silhouette — a `hull` polygon + `shards` open polylines; splits handled in `destroyDebris`, not a `split()` method). `Garbage` gained a **`mass`** field (default 1.0); `Garbage.fromNode(n)` carries `n.mass` back when a severed node becomes free garbage. v1.3: `Ship` has an `hp` field; every hazard (`DebrisSatellite`/`Satellite`/`Wedge`/`Saucer`) carries a `damage` field (contact damage — see §2.12). |
| **game object** | Central state: entity arrays, score/wave, spawn timers. The hazard array is **`game.debris`** (was `game.asteroids`, v1.4). v1.1 adds `garbage`, `chain`, `floaters`, `dock`, `deliveryCount`, `offloadTimer`. v1.2 adds **`camera` `{x,y}`**. v1.3 removes `lives`/`nextExtraLife`/`respawnTimer` and adds **`nextRepair`**; HP lives on `game.ship.hp` | Single mutable global. **`game.chain` is NOT a class-entity array** — it holds plain verlet nodes (see 3.4), which now include a `mass` field. `game.camera` is set to the ship's position each frame in `update()`. |
| **Flow functions** | `startGame`, `nextWave` (also places the Dock; spawns `min(3+wave, 9)` debris — v1.4), `addScore`, `boom`, **`destroyDebris`** (v1.4; 3-way split + 3-canister emit per tier — was `destroyAsteroid`), **`damageShip`** (v1.3), `killShip`, `shieldDeflect` | `addScore` handles the HP-repair milestone — always score through it. `destroyDebris(a, awardScore=true)` kills one debris, emits exactly `DEBRIS_GARBAGE` canisters, and pushes 3 children if `size > 1`. `damageShip(...)` is the single entry point for unshielded hits (→ `killShip` at 0 HP); self-guards on shield/hit-stun/dead. `killShip` is a respawn-free game over (still calls `scatterChain`). |
| **Chain physics** (v1.1) | `chainAnchor`, **`chainMass()`** (v1.4 — Σ node.mass), `wrapNode`, `updateChain`, `breakChain(i)`, `scatterChain`, `drawLink`, `drawChain` — located directly after `shieldDeflect` | See 3.4 for the physics contract. `chainMass()` drives the thrust/top-speed/tug penalties (mass sum, not count). `breakChain(i)` destroys node i and converts nodes i+1..end to free garbage — never splice the chain array directly. |
| **update(dt)** | ship update → **camera-follow** → entity updates → **pickup/chain/dock pass** → spawn timers → collision passes → cleanup filters → wave-clear check → heartbeat | Collision order matters (see 3.1). The old respawn-clearing step is gone (v1.3 — no respawn). `game.camera` is set to the ship's position right after `ship.update` (before spawns, so ship-relative spawns use the current position). Cleanup uses `.filter(!dead)` — never splice mid-loop. |
| **draw()** | Starfield (wrap-aware, screen space) → title OR [**camera transform** → (**dock** → particles → **garbage** → **chain** → debris → satellites → wedges → saucers → bullets → ship → **floaters**) → **restore** → HUD → overlays] | Draw order = z-order: dock is the floor, floaters sit above the ship. World entities go inside the camera translate via `drawEntity` (cull + nearest-image); HUD/overlays are screen-fixed, drawn after `ctx.restore()`. HUD includes the **HULL/HP bar** (v1.3, top-left, replacing the old life-ship icons; same style as the shield bar), the shield bar, cargo counter, and dock-pointer chevron (which now orbits screen-center). See §2.11–2.12. |
| **Main loop** | rAF loop, dt clamped to 0.05 s | Clamp prevents tunneling after tab-switch. The dt clamp also keeps chain constraints stable — keep it. |

### 3.1 Collision conventions
- All collisions are **circle vs circle** using wrap-aware `dist2` against squared radii. Polygon shapes are cosmetic.
- Pass order in `update()`: garbage pickup (during garbage update) → player bullets → targets; hostile bullets → ship → **chain nodes**; hazard bodies → ship (using a spread copy `[...arrays]` so `split()` pushes during iteration are safe); **hazard bodies → chain nodes** (spread copy, labeled `chainScan` loop, first hit wins per frame); saucer bullets → debris satellites.
- Entities are killed by setting `dead = true`; arrays are filtered once at the end of the frame. **Follow this pattern** — it avoids iterator invalidation bugs. (Exception: chain nodes are removed via `breakChain`/`chain.pop()`, never a dead flag — see 3.4.)
- Ship collision radius switches to `SHIELD_RADIUS` (26) whenever the shield is up. The shield does **not** extend to chain nodes (deliberate — see 2.10.1).
- Chain nodes use an effective radius of 7 vs hazard bodies and 9 vs hostile bullets.
- **Unshielded contact/bullet hits call `damageShip(amount, hazardX, hazardY)`** (v1.3) instead of the old instant-kill `killShip()`: it subtracts source-specific HP, applies knockback + a 1.0 s hit-stun, and only routes to `killShip()` (game over) at 0 HP. Shielded contact deflects/blocks instead (no damage). Because `damageShip` self-guards on shield/hit-stun/dead, the hazard-vs-ship loops no longer `break` after the first hit — a shielded ship still deflects every overlapping hazard, and an unshielded one absorbs exactly one hit per stun window (§2.12).

### 3.2 Rendering conventions
- `drawPoly(points, x, y, angle, color, closed)` + `glowStroke(color, width, blur)` produce the vector look via `shadowBlur`. New entities should define local-space point arrays and reuse these — don't invent per-entity draw pipelines. Canisters (free and chained) share one renderer, `drawCanister()`.
- `drawLink()` skips any link whose wrap-aware length exceeds 120 px — this prevents chain segments from streaking across the screen at the wrap seam. Keep this guard if touching chain rendering.
- `shadowBlur` is the main perf cost. If adding many simultaneous entities (>~80), consider a global glow toggle. The salvage feature adds up to ~12 chain nodes + ~15 free canisters at once; watch frame rate in garbage-heavy late waves.

### 3.3 Known safe extension points
- **New enemy:** copy the `Wedge` class shape (constructor / update / draw / dead), add an array to `game`, wire into: `startGame` reset, `update()` entity update + collision passes + cleanup filter, `draw()` z-order, and wave-clear condition if it should block wave end. Decide explicitly whether it can damage the chain (add it to the `chainHazards` spread if so).
- **New weapon/powerup:** hook `Ship.update` fire block; bullets already carry a `hostile` flag that all collision passes respect.
- **New sound:** add an `AudioSys` method; one-shots follow `fire()`, loops follow `thrust()`.
- **New cargo-adjacent mechanic:** work through the existing chain functions — score through `addScore`, break through `breakChain`, convert nodes with `Garbage.fromNode`.

### 3.4 Chain physics contract (v1.1) — read before touching `updateChain`

The tow chain is the only physics system in the game that is *not* the standard entity pattern. Its rules:

- **Node shape:** plain objects `{ x, y, px, py, spin, spinRate, mass }` in the `game.chain` array, ordered head (nearest ship) → tail. `px/py` are the previous-frame verlet positions; implied velocity is `(x−px, y−py)`. **`mass`** (v1.4/F5) is copied from the picked-up `Garbage` (default 1.0) and drives the handling penalties — **any code that creates a chain node must set `mass`**, or `chainMass()` will `NaN`. There is no `dead` flag and no class — nodes are created inline at pickup and removed only by `breakChain(i)`, `scatterChain()`, or `chain.pop()` at the dock.
- **Integration order per frame** (inside `updateChain`): (1) verlet integrate all nodes with damping `0.18^dt`; (2) measure the **pre-constraint** stretch of the first link and apply the momentum tug to the ship; (3) run 3 relaxation passes of position-based distance constraints (link 0: node takes 100% of the correction, the anchor is kinematic; links 1+: 50/50 split between neighbor nodes); (4) `wrapNode` every node.
- **Why tug-before-constraints:** the pre-constraint stretch is the honest measure of how much the cargo resisted the ship this frame. Applying a spring force *after* constraints (when stretch ≈ 0) does nothing; applying stiff springs *instead of* constraints oscillates. Don't reorder these steps.
- **Wrap handling:** `wrapNode` shifts `px/py` by the same amount as `x/y` so implied velocity survives the teleport — this is why the chain doesn't explode at screen edges. All link deltas (constraints *and* rendering) go through `shortDelta`. Any new code measuring between two nodes must do the same.
- **Constraints are equality (rod-like), not rope-like** (they also correct compression). This is what produces the serpentine follow instead of nodes bunching on the ship when it decelerates. If you change to stretch-only constraints, expect the snake feel to disappear.
- **Cargo penalties live in `Ship.update`**, not in the chain code: `thrustMul` and `maxSp` are computed from **`chainMass()`** (Σ node.mass, v1.4/F5), and the momentum-tug `massFactor` in `updateChain` uses the same sum. Before v1.4 these used `game.chain.length` (a count); for all-mass-1.0 cargo the sum equals the count, so v1.3 balance is preserved. If you add other cargo effects (turn rate, shield drain), put them in `Ship.update` alongside and scale them off `chainMass()` too.
- **Stability envelope:** current tuning is stable at dt ≤ 0.05 (the main-loop clamp), 12 nodes, 3 constraint iterations. If you lengthen the chain or the link length, revalidate with the headless test (see 5.4 rule 7) before shipping.

---

## 4. Enhancement Roadmap (candidate backlog)

> **This list is now secondary to `PLANNED-FEATURES-v2.md` / `IMPLEMENTATION-PHASES.md`,** which cover a large, committed v2.0 feature set (controller support, HP system, powerups, achievements, a larger scrolling world, and the satellite redesigns) in far more depth. Items below that overlap with v2.0 are marked; the rest remain a candidate backlog for *after* v2.0 ships.

Ordered roughly by effort. Each is scoped to fit a single working session.

**Small (one short session)**
1. **High-score persistence** — in-memory top-5 table with initials entry on game over. (Note: localStorage does not work in claude.ai artifact preview; fine in a real browser. Gate it with a try/catch.)
2. **Screen shake + flash** on ship death and satellite kill. Add `game.shake` timer, offset ctx translate in `draw()`.
3. **Thump-synced pulse** — starfield or border glow pulses with the heartbeat.
4. ~~**Gamepad support**~~ → superseded and expanded by `PLANNED-FEATURES-v2.md` Feature F7 / `IMPLEMENTATION-PHASES.md` Phase 6.

**Medium (one full session)**
5. ~~**Power-up drops**~~ → superseded and expanded by `PLANNED-FEATURES-v2.md` Feature F6 / Phase 5.
6. **Debris Satellite variants** — e.g. "dense" units (2 hits, darker stroke), "volatile" units (explode, damaging neighbors in radius). Add a `type` field to `DebrisSatellite`; keep circle collision. A "hot" variant could drop extra canisters. *F3 (Debris Satellites) has now shipped (v1.4) — this would layer on top of it: a per-type branch in `destroyDebris` and the constructor.*
7. **Boss saucer every 5 waves** — large multi-hit saucer with a visible hull-damage state (drop polygon vertices as it takes hits). Could deliberately target the player's tow chain for extra menace.
8. **Attract mode** — after 15 s idle on title, run a simple AI demo game (rotate toward nearest rock, thrust away from close threats, fire).

**Large (multi-session — split into sub-goals)**
9. **Two-player co-op** (shared screen, second ship on IJKL/etc., friendly-fire toggle).
10. **Touch controls** for mobile — virtual buttons in the letterbox margins; ties into the existing scaling code.
11. **Campaign structure** — named sectors with modifier rules (gravity well at center, asteroid belts that spawn from one edge, "no shield" sector, etc.).

---

## 5. Session Handoff Protocol

This mirrors the Atomic Dustbin Dan workflow: each new Claude session gets three attachments and a short kickoff prompt.

### 5.1 What to attach to every new session
1. **`asteroids-deluxe.html`** — the current build (always the latest working version).
2. **This GDD** — or at minimum Sections 1–3 plus whichever Section 4 item is being built.
3. **`STATUS.md`** — the running status document (template below). Update it at the end of every session.
4. **For v2.0 work:** also attach `PLANNED-FEATURES-v2.md` and `IMPLEMENTATION-PHASES.md`, and reference the specific phase being built. Claude Code sessions can typically use the phase prompt from `IMPLEMENTATION-PHASES.md` directly as the kickoff message.

### 5.2 Kickoff prompt template

> I'm continuing development of Asteroid Field Deluxe, a single-file HTML5 vector arcade game. Attached: the current build, the game design document, and the status doc.
>
> Read the GDD's Architecture Map (Section 3) before writing code — especially the wrap-aware collision helpers, the dead-flag/filter lifecycle, and the tuning-constants convention.
>
> **This session's goal:** [one specific item, e.g. "Roadmap item 5: power-up drops — rapid fire and shield overcharge only"]
>
> Constraints: keep it a single self-contained HTML file, no external assets or libraries, all changes consistent with the design pillars in GDD Section 1. Deliver the full updated file plus a summary of what changed for the status doc.

### 5.3 STATUS.md template

```markdown
# Asteroid Field Deluxe — STATUS
Last updated: [date] · Build version: [x.y] · Last session: [one line]

## Working / verified
- [features confirmed working in a real browser]

## Known issues
- [bugs, with repro steps if known]

## Balance notes
- [tuning observations from playtesting, e.g. "small wedges feel unfair at turnRate 2.6"]

## Next up
- [the next roadmap item, plus any prep notes]

## Changed this session
- [diff-level summary a future session can trust without re-reading everything]
```

### 5.4 Rules for future sessions (instructions to Claude)

Any Claude session working on this project should:

1. **Deliver the complete file, not fragments.** The build must always be runnable as-is. If the file grows too large for a single response, deliver it in clearly-marked sequential parts and reassemble instructions.
2. **Preserve the tuning-constants convention.** New mechanics get named constants at the top of the script, never inline magic numbers.
3. **Use the wrap-aware helpers** (`dist2`, `angleTo`) for all distance and aiming math. This is the most common way to introduce subtle bugs.
4. **Follow the entity lifecycle**: `dead` flag + end-of-frame `.filter()`. Never remove entities mid-iteration.
5. **Respect the design pillars** (Section 1). If a requested feature conflicts with a pillar, say so and propose an alternative before building.
6. **Route all scoring through `addScore()`** so extra-life logic stays correct.
7. **Syntax-check AND functionally test before delivering.** Extract the script block and run `node --check`. For gameplay logic, use the headless harness pattern established in v1.1: stub `window`, `document.getElementById` (returning a canvas whose `getContext` yields a Proxy that no-ops all methods), and `requestAnimationFrame`; then drive `startGame()` and `update(1/60)` directly, teleporting the ship to set up scenarios. AudioSys is safe headless because every method early-returns when `this.ctx` is null (init only fires on keydown). Verified this way in v1.1: pickup, tow constraint length, screen-wrap chain integrity, dock delivery scoring, and chain severing.
8. **Version bump + changelog.** Increment the version comment at the top of the file and produce a "Changed this session" summary for STATUS.md.
9. **Don't refactor unprompted.** Paul knows this codebase; large structural rewrites make session-to-session diffs unreadable. Propose refactors, don't spring them.
10. **Flag playtest asks.** Claude can't play the game — end each session with 2–3 specific things Paul should verify in the browser (e.g. "confirm the new power-up despawns after 8 s").

---

## 6. Bug Watch List (v1.1)

Areas most likely to hide issues, worth checking during playtests:

- **Shield-deflection edge cases** — deflecting a rock into a wall of other rocks; deflecting at exactly the moment energy hits zero. New in v1.1: deflecting a rock directly into your own tow chain (working as designed, but verify it feels fair).
- ~~**Respawn deadlock**~~ — *resolved by F2 (v1.3): there is no respawn anymore, so this can't occur.*
- **Knockback vs. tow chain (v1.3)** — knockback shoves the ship away from a hazard, which can drag a long chain tail through *other* hazards or fling it across the wrap seam. The chain is wrap-aware and severs per its existing rules, but verify a hit never yanks the ship somewhere that instantly severs the whole haul unfairly.
- **Knockback into a second hazard (v1.3)** — the 1.0 s hit-stun means being knocked straight into another rock is safe *during* the window; verify it doesn't feel like the ship pinballs helplessly once the window expires in a dense field.
- **Saucer sound leak** — the warble is stopped on saucer death/exit and on game over; verify it can't persist if a saucer dies the same frame the ship does.
- **Performance (raised in v1.4)** — heavy `shadowBlur`; the salvage feature already raised the entity ceiling, and F3's guaranteed 3-per-tier drops raise the *free-canister* count far higher (a fully-cleared large lineage emits 39, though the 12 s decay bounds how many coexist). Watch frame rate in garbage-heavy late waves on modest hardware; if it dips, `GARBAGE_DECAY` is the fastest lever, then a global glow toggle (§3.2).
- **Garbage density & decay feel (v1.4/F3)** — the balance pass (`GARBAGE_DECAY` 20→12, `GARBAGE_SEVER_DECAY`→10, wave count `min(4+w,11)`→`min(3+w,9)`) is a *first pass* with no playtest data. Verify the field reads as "richly optional salvage," not "carpeted in clutter," and that 12 s is long enough to actually collect a lineage's worth without feeling frantic. This is the top thing to retune; F10 (more debris density) will revisit it jointly.
- **Chain tug oscillation** — `CHAIN_TUG 26` is stable in headless tests but hasn't been feel-tested against every input pattern. Rapid thrust-flip-thrust with a full chain is the stress case; if the ship judders, lower `CHAIN_TUG` before touching the constraint code.
- ~~**Dock/respawn interaction**~~ — *moot post-F2 (v1.3): no respawn. `killShip()` still calls `scatterChain()`, so a dead ship never keeps a chain.*
- **Wave-transition cargo** — the chain persists across waves (deliberate) but new large debris satellites spawn ≥220 px from the *ship*; a long chain tail can extend beyond that. Verify a wave spawn can't instantly sever a fresh chain unfairly often.
- **Delivery combo reset radius** — combo resets at dock radius+40. Verify a player orbiting the dock edge can't accidentally keep/lose the combo in a confusing way.

---

## 7. Version History

- **v1.0** — Initial build: ship/asteroids/saucers, shield, killer satellite + homing wedges, waves, synth audio.
- **v1.1** — Radioactive salvage: garbage drops with decay, verlet tow chain (mass/momentum penalties, momentum tug), chain vulnerability with aft-severing, relocating recycling dock with escalating delivery scores, cargo HUD + dock pointer, pickup/deliver SFX. New constants block; `shortDelta` helper; `Garbage`/`FloatText`/`Dock` classes; chain physics functions after `shieldDeflect`. Headless-tested: pickup, tow, wrap, delivery scoring, severing.
- **v1.2** — *v2.0 Phase 1 (F1): Larger scrolling world & camera.* Simulation space split from the screen: a 3840×2160 toroidal world (`WORLD_W/H`) with a 1280×720 viewport (`VIEW_W/H`) that scrolls to keep the ship centered (`game.camera`). All wrap-aware helpers (`wrap`/`dist2`/`angleTo`/`shortDelta`/`wrapNode`) retargeted to `WORLD_*`; added `wrapOffset`/`wrapPos`. `draw()` gained a camera transform, wrap-aware per-entity nearest-image rendering + viewport culling (`onScreen`/`drawEntity`), and a world-spanning seamless starfield; HUD/overlays drawn screen-fixed after restore. Spawns (wave asteroids, dock) now ship-relative rings; satellites/saucers enter from viewport edges relative to the ship (feel unchanged). New constants: `CULL_MARGIN`, `SPAWN_MIN/MAX_DIST`, `DOCK_MIN/MAX_DIST`, `STAR_DENSITY`. Headless-tested: camera-follow, world-boundary wrap (x & y), no wrap at old 1280 boundary, ship-relative spawn reachability across the seam, draw() crash-free in all states.
- **v1.3** — *v2.0 Phase 2 (F2): Health Points & Knockback.* Discrete lives replaced by a single HP pool (`SHIP_MAX_HP` = 250) for the whole run; all respawn/lives logic removed (`game.lives`/`nextExtraLife`/`respawnTimer` gone, plus the "respawn only when center is clear" gate). New `damageShip()` handles unshielded hits: source-specific damage (`DMG_SMALL/MEDIUM/LARGE` 20/35/50, `DMG_BULLET` 15, via each hazard's new `damage` field), a `KNOCKBACK_SPEED` (250 px/s) shove away from the hazard, and a `HIT_STUN_DURATION` (1.0 s) i-frame window (reusing `ship.invuln`). `killShip()` is now a respawn-free game over at 0 HP. `addScore()` milestone changed from extra-life to a +25 HP hull repair (`REPAIR_*`), converting to a flat score bonus at full HP. HUD: HULL/HP bar (`COLOR.hp`) replaces the life-ship icons, styled like the shield bar. New `AudioSys.hit()` damage thud. Headless-tested (`scratchpad/test-f2.js`, 54 assertions): per-hit-type damage, hit-stun double-hit prevention, knockback direction/magnitude, 0-HP game over with no respawn, milestone repair, and shield still blocking damage+knockback.
- **v1.4** — *v2.0 Phase 3 (F3 Debris Satellites + F5 variable-mass garbage).* The `Asteroid` class → **`DebrisSatellite`** (array `game.asteroids` → `game.debris`; `AST_*` constants → `DEBRIS_*`; `destroyAsteroid` → `destroyDebris`; `COLOR.asteroid` → `COLOR.debris`); redrawn as a broken-satellite silhouette (irregular `hull` polygon + 1–2 antenna/panel `shards`). Splits changed to 3-way at large/medium (small destroyed), and **every** tier's destruction emits exactly `DEBRIS_GARBAGE` (3) canisters — replacing the probabilistic `GARBAGE_DROP` — so a fully-cleared large lineage yields 39 canisters. F5: `Garbage` and chain nodes gained a **`mass`** field (default 1.0); `Garbage.fromNode()` carries it, pickup copies it onto the node, and the chain thrust/top-speed penalties + momentum-tug `massFactor` now scale off **`chainMass()`** (Σ node.mass) instead of `chain.length` — identical feel for all-mass-1.0 cargo, the groundwork for F4's low-mass Hunter scrap. First-pass balance for the ~8× garbage volume: `GARBAGE_DECAY` 20→12, new `GARBAGE_SEVER_DECAY` 10 (was inline 15), wave spawn `min(4+w,11)`→`min(3+w,9)`. Headless-tested (`scratchpad/test-f3.js`, 28 assertions): 39-canister lineage count, per-tier splits, mass propagation (default/fromNode/pickup/sever), and the mass-sum equivalence of an 8× mass-1.0 chain vs a 16× mass-0.5 chain across thrust, top speed, and tug.
- **v2.0 (in progress)** — Phases 1–3 shipped (larger scrolling world as v1.2; HP & knockback as v1.3; Debris Satellites + variable-mass garbage as v1.4). Still planned: a difficulty ramp, a Hunter Satellite redesign of the killer satellite/wedge system, weapon/health/utility powerups, controller support, pause/options menu with rebindable controls, and an achievements system. Full specs in `PLANNED-FEATURES-v2.md`; build order in `IMPLEMENTATION-PHASES.md`.

---

*End of document. Keep this GDD updated when mechanics change — Section 2 should always describe the current build, not the original one.*