# ASTEROID FIELD DELUXE — Game Design Document & Handoff Guide

**Version:** 1.3 shipped · v2.0 in progress (Phase 2 of 9 done — see companion docs below)
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
- Radius 26 px. Deflects asteroids and satellites elastically (bounced away at 1.1× their speed, pushed out of overlap). Blocks hostile bullets (costs deflection energy). **Destroys wedges on contact** (they still split).

### 2.4 Asteroids
> ⚠️ **Planned for replacement in v2.0** — asteroids are being redesigned as "Debris Satellites" with 3-way splits and per-tier garbage. This subsection still describes the shipped behavior; see `PLANNED-FEATURES-v2.md` Feature F3 for the redesign, not yet built.

- Three sizes. Radius / base speed / score: large 46 px / 70 / 20 · medium 26 px / 110 / 50 · small 13 px / 160 / 100.
- Speeds get ±30% random variance and a per-wave multiplier of `1 + (wave−1) × 0.08`.
- Large → two mediums; medium → two smalls; small → gone. Shapes are randomized jagged polygons (10–16 vertices, radius jitter 0.72–1.12).

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
- Saucer bullets are red, 380 px/s, 1.4 s life, and destroy asteroids (no score awarded).

### 2.7 Waves, Health & Scoring

- Wave N spawns `min(4 + N, 11)` large asteroids, placed in a ring 220–1100 px around the ship's *current* world position (see §2.11).
- Next wave starts 2.5 s after the field is clear of asteroids, satellites, AND wedges. Free garbage and towed cargo do **not** block wave-clear; both persist into the next wave (the dock relocates).
- **Health, not lives (v1.3).** The ship has one HP pool (`SHIP_MAX_HP` = 250); there are no discrete lives, no respawns, and no continues — one hull for the whole run. Any unshielded hazard contact or hostile bullet subtracts source-specific damage, applies knockback, and opens a 1.0 s hit-stun window (see §2.12). At 0 HP the ship explodes, the tow load scatters, and the run ends (true game over).
- **Score milestones repair the hull.** Every 10,000 points (`REPAIR_MILESTONE`) grants +25 HP (`REPAIR_AMOUNT`), capped at max; if already at full HP the milestone instead pays a flat `REPAIR_FULL_BONUS` (2,500) points so it's never wasted. This replaces the old "extra life every 10,000 points."

### 2.8 Audio (all synthesized, no assets)
- Fire: square-wave pitch drop. Explosions: filtered noise bursts, deeper/longer by size. Thrust: looped low-passed noise. Saucer: LFO-warbled triangle (higher/faster for small). Heartbeat: alternating two-tone sine thump whose interval shrinks with wave number and field density (floor 0.28 s). Shield ping / extra life: sine chirp.

### 2.9 States & Controls
- States: `title` → `playing` → `gameover` (Enter restarts). `P` toggles pause. Rotate ←→/A/D, thrust ↑/W, fire Space, shield Shift.

### 2.10 Radioactive Salvage, Tow Chain & Recycling Dock (v1.1)

**Garbage drops.** Destroyed asteroids drop a radioactive canister with probability by size: small 100%, medium 40%, large 25% (≈5 canisters per fully-cleared large rock). Canisters inherit 25% of the rock's velocity plus a small random kick, drift, spin, and screen-wrap. They **decay after 20 s** if uncollected — blinking below 5 s, blinking fast below 2 s. Canisters knocked loose from a chain get a shorter 15 s decay.

**Collection & chain.** Flying within 18 px of a canister hooks it onto a tow chain behind the ship (max **12** canisters; extras stay in the field). The chain is simulated: verlet nodes with 20 px distance constraints, anchored to a hitch point 12 px behind the ship. Physics effects:
- *Mass penalty:* per canister, thrust is divided by `1 + n×0.10` and top speed by `1 + n×0.05`. A full chain of 12 ≈ 45% thrust, 63% top speed.
- *Momentum tug:* when the first link is stretched taut, the ship receives a pull-back acceleration of `CHAIN_TUG (26) × stretch-px × massFactor` (massFactor = min(1.4, n×0.12)). Hard turns and burns get the ship yanked by its own cargo.
- The chain is wrap-aware and follows the ship across screen edges.

**Chain vulnerability.** Any asteroid, wedge, or satellite body — or any hostile bullet — touching a chain node destroys that canister; **everything aft of it breaks loose** as free garbage (fresh 15 s decay, scatter velocity). Ship death scatters the entire load. Player bullets pass through garbage and chain (they're debris, not targets).

**Recycling dock.** A green octagonal station (radius 44) placed randomly each wave, 260–900 px from the ship's *current* world position (see §2.11). Non-solid — purely a delivery zone. While the ship is within radius+10 and carrying cargo, canisters peel off the **tail** every 0.13 s. Delivery score escalates within a single visit: `50 + 25×(n−1)` for the nth canister (full 12-chain = 2,250). The combo counter resets when the ship leaves the dock's neighborhood (radius+40). Delivery pitch rises per canister; score popups float up.

**HUD.** `CARGO n/12` readout (lit when carrying); a green chevron orbiting the ship points toward the dock whenever cargo > 0.

#### 2.10.1 Design considerations & rationale (read before changing this system)

These were deliberate calls, not accidents — future sessions should understand *why* before tuning:

- **Drop rates are inverted from score value** (smalls always drop, larges rarely) so that garbage appears where the player has already *finished* clearing a rock lineage. Making larges drop reliably would flood the field with ~7 canisters per rock and turn collection from a choice into housekeeping — violating Pillar 5.
- **Decay exists to protect readability.** Persistent garbage would accumulate across a wave into visual noise and free points. The 20 s window forces a decision: break off from combat now, or let it go. The blink pattern is the player's countdown — don't remove it.
- **The cap of 12 is a handling ceiling, not a scoring one.** Beyond ~12 nodes the thrust penalty makes the ship feel broken rather than heavy, and constraint chains that long start whipping. If raising the cap, retune `CARGO_THRUST` down.
- **The tail-peel offload (chain.pop) matters visually** — the chain visibly shortens from the far end while the ship holds in the dock, which reads as "unloading." Popping from the head would make the whole chain teleport forward one link per tick.
- **Escalating per-piece scores (not a flat rate) is the whole risk/reward engine.** A 12-chain delivery (2,250) is worth far more than four 3-chain trips (450). This is what makes players tow long, dangerous chains past homing wedges. Flatten this and the mechanic collapses into an errand.
- **Aft-severing (losing everything behind a hit node) instead of single-node loss** makes chain *position* strategic: your most recent pickups are the most exposed. It also creates dramatic "lost the whole tail" moments that flat attrition wouldn't.
- **The dock relocates every wave** to prevent a dominant orbit-the-dock strategy and to keep the risk of the haul fresh each wave.
- **The dock is non-solid.** Making it collidable punishes the exact maneuver the game asks for (flying into it while handling badly). Hazards pass over it too — the dock is a zone, not cover.
- **The shield does not protect the chain.** The shield radius (26) only covers the ship; deflected rocks can and will hit your own cargo. This is intentional — the shield answer and the cargo answer should be in tension, not stacked.
- **Momentum tug uses pre-constraint stretch** as its force signal (see 3.4). This is a stability decision: spring forces on a hard-constrained chain oscillate; measuring how much the cargo "resisted" the ship this frame and applying only that gives a heavy feel without energy injection.

### 2.11 Larger Scrolling World & Camera (v1.2)

The simulation space and the screen used to be the same 1280×720 rectangle. As of v1.2 they are decoupled: the world is a large torus and the screen is a camera window onto it.

- **World vs viewport.** The world is `WORLD_W × WORLD_H` = **3840×2160** (3× per axis, 9× area) and still wraps at its own edges — same torus topology as before, just bigger. The **viewport** is `VIEW_W × VIEW_H` = **1280×720**, still the canvas size and still CSS-scaled/letterboxed to the window. All world/simulation math (wrap, distance, aiming, chain links) uses `WORLD_W/WORLD_H`; only the canvas, HUD, and title screen use `VIEW_W/VIEW_H`.
- **Camera.** `game.camera.x/y` tracks the ship's world position every frame — no smoothing, no clamping (the world wraps, so there is no edge for the camera to bump into). The ship is therefore always drawn at the center of the viewport. On respawn the ship returns to world center and the camera snaps with it.
- **Render pipeline.** `draw()` clears the viewport, draws the starfield, then (for gameplay) translates the context by `(VIEW_W/2 − camera.x, VIEW_H/2 − camera.y)` and draws every world-space entity inside that transform. The HUD (score, lives, cargo readout, dock chevron, wave, shield bar) and the pause/game-over overlays are drawn **after** restoring the untranslated context, so they stay screen-fixed. Each world entity is drawn at its **nearest wrapped image** relative to the camera (`wrapOffset`), so entities on the far side of the world seam still render in the right place when the ship is near a world edge (a single naive translate would drop them off-screen).
- **Culling.** `onScreen(e, margin)` (wrap-aware) skips drawing any entity more than `CULL_MARGIN` (100 px) outside the viewport. Culled entities still `update()` normally — off-screen hazards keep simulating in the larger world. (Off-screen *threat awareness* — warning the player about hazards approaching from beyond the viewport — is deliberately deferred; see `PLANNED-FEATURES-v2.md` F10.)
- **Starfield.** Background stars are scattered once across the whole world (count scales with world area to preserve the original on-screen density) and rendered wrap-aware in screen space, so the field scrolls seamlessly with no visible tiling repeat or edge seam.
- **Ship-relative spawning.** Because a fixed-rect spawn could drop a whole wave unreachably far away in the big world, spawns are now placed relative to the ship's *current* world position: new large asteroids in a ring `[SPAWN_MIN_DIST, SPAWN_MAX_DIST]` = [220, 1100] px; the recycling dock in `[DOCK_MIN_DIST, DOCK_MAX_DIST]` = [260, 900] px. Killer satellites and saucers enter from just beyond a **viewport** edge relative to the ship (offset by `VIEW_W/2`/`VIEW_H/2` + a margin, then folded into the world with `wrapPos`), preserving their shipped "slide in from off-screen, cross the screen" feel; their speeds, homing, fire rates, and split behavior are unchanged (those are Phase 4/5 concerns).

> New tuning constants live in the "Larger world & scrolling camera (v1.2)" block at the top: `CULL_MARGIN`, `SPAWN_MIN_DIST`, `SPAWN_MAX_DIST`, `DOCK_MIN_DIST`, `DOCK_MAX_DIST`, `STAR_DENSITY`, plus `WORLD_W/H` and `VIEW_W/H`.

### 2.12 Health, Damage & Knockback (v1.3)

Discrete lives (3 stock + an extra life per 10,000 points) are gone. The ship carries a single HP pool for the entire run; survival is about managing that pool, not stock count. This keeps Pillar 4 intact — the shield is still the "free," energy-priced answer that prevents damage outright — while making one misjudged contact a costly setback rather than an instant stock loss.

- **HP pool.** `ship.hp` starts at `SHIP_MAX_HP` (250). The HUD shows it as a "HULL" bar top-left, styled exactly like the shield-energy bar (same stroke/fill pattern; `COLOR.hp` green, switching to red below 30%).
- **Damage table** (contact = ramming a hazard body; every value is a named constant in the tuning block — first-pass and tunable):

  | Source | Damage | Constant |
  |---|---|---|
  | Small hazard (small asteroid, small wedge, small saucer) | 20 | `DMG_SMALL` |
  | Medium hazard (medium asteroid, big wedge, big saucer) | 35 | `DMG_MEDIUM` |
  | Large hazard (large asteroid, killer satellite) | 50 | `DMG_LARGE` |
  | Hostile (saucer) bullet | 15 | `DMG_BULLET` |

  Each hazard carries its own `damage` field, set in its constructor from these constants (asteroids via the `AST_DAMAGE` size table). *These are placeholder assignments mapping the existing v1.1 hazards onto the damage tiers; the Phase 3/5 Debris/Hunter redesigns will define their own per-tier values (the plan proposes higher Hunter ramming damage).*
- **Knockback.** A non-lethal unshielded hit **sets** (not adds) the ship's velocity to `KNOCKBACK_SPEED` (250 px/s) pointing directly away from the hazard's center (wrap-aware, via `shortDelta`), so the ship physically separates instead of grinding inside the hazard. Setting rather than adding guarantees clear separation regardless of prior momentum; drag then bleeds the impulse off naturally over the following second.
- **Hit-stun.** The same hit sets `ship.invuln = HIT_STUN_DURATION` (1.0 s) of invulnerability (the existing blink render doubles as the hit-stun tell). Further hits are ignored until it expires, so no single hazard can chew through the pool in consecutive frames, and several hazards overlapping in one frame still only land one hit. `damageShip()` self-guards on shield/hit-stun/dead, so the collision passes don't need to break early.
- **Death.** At 0 HP `killShip()` runs the explosion boom + particles, `scatterChain()` drops the whole tow load as free garbage, and the state goes straight to `gameover`. There is no respawn path — the old "respawn only when the center is clear" logic (former §2.1) is deleted entirely.
- **Shield unchanged.** A raised shield deflects/blocks at its usual energy cost, and a shielded hit takes **no** damage, knockback, or hit-stun — knockback is strictly the unshielded fallback. The shield still does not protect the tow chain (§2.10.1).

> Tuning constants live in the "Health, damage & knockback (F2)" block at the top: `SHIP_MAX_HP`, `DMG_SMALL/MEDIUM/LARGE`, `DMG_BULLET`, `AST_DAMAGE`, `KNOCKBACK_SPEED`, `HIT_STUN_DURATION`, `REPAIR_MILESTONE`, `REPAIR_AMOUNT`, `REPAIR_FULL_BONUS`.

---

## 3. Code Architecture Map

Everything lives in one `<script>` block. Reading order top to bottom:

| Section | Contents | Notes for modification |
|---|---|---|
| **Constants** | All tuning values (SHIP_*, BULLET_*, SHIELD_*, AST_*, scores) + v1.1 block (GARBAGE_*, CHAIN_*, CARGO_*, DOCK_*) + v1.2 world block (`WORLD_W/H`, `VIEW_W/H`, `CULL_MARGIN`, `SPAWN_MIN/MAX_DIST`, `DOCK_MIN/MAX_DIST`, `STAR_DENSITY`) + v1.3 HP block (`SHIP_MAX_HP`, `DMG_SMALL/MEDIUM/LARGE`, `DMG_BULLET`, `AST_DAMAGE`, `KNOCKBACK_SPEED`, `HIT_STUN_DURATION`, `REPAIR_MILESTONE`, `REPAIR_AMOUNT`, `REPAIR_FULL_BONUS`) | **Change balance here first.** Never hardcode magic numbers deeper in the file. `WORLD_*` = the wrap boundary; `VIEW_*` = the screen — keep the distinction (see §2.11). |
| **Canvas/scaling** | `resize()` — CSS scaling, fixed 1280×720 logical viewport | Same pattern as Atomic Dustbin Dan. `resize()` uses `VIEW_W/VIEW_H` (screen); all *world* math uses `WORLD_W/WORLD_H`, never window size. |
| **AudioSys** | Singleton object; all sounds are methods; init on first keypress (autoplay policy). v1.1 adds `pickup()` and `deliver(count)` (pitch climbs with delivery combo) | Continuous sounds (thrust, saucer) are start/stop node pairs. Add new SFX as new methods; follow the `now()` + gain-envelope pattern. |
| **Input** | `keys{}` map + `input` helper predicates | Add new bindings as predicates in `input`, not by reading `keys` inline. Enter/P handled in keydown directly. |
| **Helpers** | `rand`, `wrap`, `dist2`, `angleTo`, **`shortDelta`** (v1.1), **`wrapOffset`/`wrapPos`** (v1.2), `glowStroke`, `drawPoly`, `COLOR` | ⚠️ `wrap`, `dist2`, `angleTo`, `shortDelta` are **wrap-aware** and now operate against `WORLD_W/WORLD_H`. Always use these for distance/aiming/link math — naive `Math.hypot` deltas break near edges. `wrapOffset` gives the nearest wrapped image of a point relative to the camera (rendering); `wrapPos` folds a fresh spawn into `[0,WORLD)`. |
| **Entity classes** | `Ship`, `Bullet`, `Asteroid`, `Satellite`, `Wedge`, `Saucer`, `Particle`, and (v1.1) `Garbage`, `FloatText`, `Dock` + `drawCanister()` shared renderer | Uniform contract: constructor, `update(dt)`, `draw()`, `dead` flag. Some have `split()`. `Garbage.fromNode(n)` converts a severed chain node back to free garbage. v1.3: `Ship` gains an `hp` field; every hazard (`Asteroid`/`Satellite`/`Wedge`/`Saucer`) carries a `damage` field (contact damage — see §2.12). |
| **game object** | Central state: entity arrays, score/wave, spawn timers. v1.1 adds `garbage`, `chain`, `floaters`, `dock`, `deliveryCount`, `offloadTimer`. v1.2 adds **`camera` `{x,y}`**. v1.3 removes `lives`/`nextExtraLife`/`respawnTimer` and adds **`nextRepair`** (next hull-repair score threshold); HP lives on `game.ship.hp` | Single mutable global. **`game.chain` is NOT a class-entity array** — it holds plain verlet nodes (see 3.4). `game.camera` is set to the ship's position each frame in `update()`. |
| **Flow functions** | `startGame`, `nextWave` (now also places the Dock), `addScore`, `boom`, `destroyAsteroid` (now drops garbage), **`damageShip`** (v1.3), `killShip`, `shieldDeflect` | `addScore` now handles the HP-repair milestone (was extra-life) — always score through it. `damageShip(amount, hazardX, hazardY)` is the single entry point for unshielded hits (HP−, knockback, hit-stun, → `killShip` at 0 HP); it self-guards on shield/hit-stun/dead. `killShip` is now a true, respawn-free game over (still calls `scatterChain`). `boom` = particles + explosion sound. |
| **Chain physics** (v1.1) | `chainAnchor`, `wrapNode`, `updateChain`, `breakChain(i)`, `scatterChain`, `drawLink`, `drawChain` — located directly after `shieldDeflect` | See 3.4 for the physics contract. `breakChain(i)` destroys node i and converts nodes i+1..end to free garbage — never splice the chain array directly. |
| **update(dt)** | ship update → **camera-follow** → entity updates → **pickup/chain/dock pass** → spawn timers → collision passes → cleanup filters → wave-clear check → heartbeat | Collision order matters (see 3.1). The old respawn-clearing step is gone (v1.3 — no respawn). `game.camera` is set to the ship's position right after `ship.update` (before spawns, so ship-relative spawns use the current position). Cleanup uses `.filter(!dead)` — never splice mid-loop. |
| **draw()** | Starfield (wrap-aware, screen space) → title OR [**camera transform** → (**dock** → particles → **garbage** → **chain** → rocks → satellites → wedges → saucers → bullets → ship → **floaters**) → **restore** → HUD → overlays] | Draw order = z-order: dock is the floor, floaters sit above the ship. World entities go inside the camera translate via `drawEntity` (cull + nearest-image); HUD/overlays are screen-fixed, drawn after `ctx.restore()`. HUD includes the **HULL/HP bar** (v1.3, top-left, replacing the old life-ship icons; same style as the shield bar), the shield bar, cargo counter, and dock-pointer chevron (which now orbits screen-center). See §2.11–2.12. |
| **Main loop** | rAF loop, dt clamped to 0.05 s | Clamp prevents tunneling after tab-switch. The dt clamp also keeps chain constraints stable — keep it. |

### 3.1 Collision conventions
- All collisions are **circle vs circle** using wrap-aware `dist2` against squared radii. Polygon shapes are cosmetic.
- Pass order in `update()`: garbage pickup (during garbage update) → player bullets → targets; hostile bullets → ship → **chain nodes**; hazard bodies → ship (using a spread copy `[...arrays]` so `split()` pushes during iteration are safe); **hazard bodies → chain nodes** (spread copy, labeled `chainScan` loop, first hit wins per frame); saucer bullets → asteroids.
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

- **Node shape:** plain objects `{ x, y, px, py, spin, spinRate }` in the `game.chain` array, ordered head (nearest ship) → tail. `px/py` are the previous-frame verlet positions; implied velocity is `(x−px, y−py)`. There is no `dead` flag and no class — nodes are created inline at pickup and removed only by `breakChain(i)`, `scatterChain()`, or `chain.pop()` at the dock.
- **Integration order per frame** (inside `updateChain`): (1) verlet integrate all nodes with damping `0.18^dt`; (2) measure the **pre-constraint** stretch of the first link and apply the momentum tug to the ship; (3) run 3 relaxation passes of position-based distance constraints (link 0: node takes 100% of the correction, the anchor is kinematic; links 1+: 50/50 split between neighbor nodes); (4) `wrapNode` every node.
- **Why tug-before-constraints:** the pre-constraint stretch is the honest measure of how much the cargo resisted the ship this frame. Applying a spring force *after* constraints (when stretch ≈ 0) does nothing; applying stiff springs *instead of* constraints oscillates. Don't reorder these steps.
- **Wrap handling:** `wrapNode` shifts `px/py` by the same amount as `x/y` so implied velocity survives the teleport — this is why the chain doesn't explode at screen edges. All link deltas (constraints *and* rendering) go through `shortDelta`. Any new code measuring between two nodes must do the same.
- **Constraints are equality (rod-like), not rope-like** (they also correct compression). This is what produces the serpentine follow instead of nodes bunching on the ship when it decelerates. If you change to stretch-only constraints, expect the snake feel to disappear.
- **Cargo penalties live in `Ship.update`**, not in the chain code: `thrustMul` and `maxSp` are computed from `game.chain.length`. If you add other cargo effects (turn rate, shield drain), put them there alongside.
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
6. **Asteroid variants** — e.g. "dense" rocks (2 hits, darker stroke), "volatile" rocks (explode, damaging neighbors in radius). Add a `type` field to `Asteroid`; keep circle collision. A "hot" variant could drop 2–3 canisters. *Reconsider after Feature F3 (Debris Satellites) ships — may be superseded or may layer on top of it.*
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
- **Performance** — heavy `shadowBlur`; the salvage feature raises the entity ceiling (up to 12 chain nodes + ~15 canisters). Watch frame rate late-wave on modest hardware.
- **Chain tug oscillation** — `CHAIN_TUG 26` is stable in headless tests but hasn't been feel-tested against every input pattern. Rapid thrust-flip-thrust with a full chain is the stress case; if the ship judders, lower `CHAIN_TUG` before touching the constraint code.
- ~~**Dock/respawn interaction**~~ — *moot post-F2 (v1.3): no respawn. `killShip()` still calls `scatterChain()`, so a dead ship never keeps a chain.*
- **Wave-transition cargo** — the chain persists across waves (deliberate) but new large rocks spawn ≥220 px from the *ship*; a long chain tail can extend beyond that. Verify a wave spawn can't instantly sever a fresh chain unfairly often.
- **Delivery combo reset radius** — combo resets at dock radius+40. Verify a player orbiting the dock edge can't accidentally keep/lose the combo in a confusing way.

---

## 7. Version History

- **v1.0** — Initial build: ship/asteroids/saucers, shield, killer satellite + homing wedges, waves, synth audio.
- **v1.1** — Radioactive salvage: garbage drops with decay, verlet tow chain (mass/momentum penalties, momentum tug), chain vulnerability with aft-severing, relocating recycling dock with escalating delivery scores, cargo HUD + dock pointer, pickup/deliver SFX. New constants block; `shortDelta` helper; `Garbage`/`FloatText`/`Dock` classes; chain physics functions after `shieldDeflect`. Headless-tested: pickup, tow, wrap, delivery scoring, severing.
- **v1.2** — *v2.0 Phase 1 (F1): Larger scrolling world & camera.* Simulation space split from the screen: a 3840×2160 toroidal world (`WORLD_W/H`) with a 1280×720 viewport (`VIEW_W/H`) that scrolls to keep the ship centered (`game.camera`). All wrap-aware helpers (`wrap`/`dist2`/`angleTo`/`shortDelta`/`wrapNode`) retargeted to `WORLD_*`; added `wrapOffset`/`wrapPos`. `draw()` gained a camera transform, wrap-aware per-entity nearest-image rendering + viewport culling (`onScreen`/`drawEntity`), and a world-spanning seamless starfield; HUD/overlays drawn screen-fixed after restore. Spawns (wave asteroids, dock) now ship-relative rings; satellites/saucers enter from viewport edges relative to the ship (feel unchanged). New constants: `CULL_MARGIN`, `SPAWN_MIN/MAX_DIST`, `DOCK_MIN/MAX_DIST`, `STAR_DENSITY`. Headless-tested: camera-follow, world-boundary wrap (x & y), no wrap at old 1280 boundary, ship-relative spawn reachability across the seam, draw() crash-free in all states.
- **v1.3** — *v2.0 Phase 2 (F2): Health Points & Knockback.* Discrete lives replaced by a single HP pool (`SHIP_MAX_HP` = 250) for the whole run; all respawn/lives logic removed (`game.lives`/`nextExtraLife`/`respawnTimer` gone, plus the "respawn only when center is clear" gate). New `damageShip()` handles unshielded hits: source-specific damage (`DMG_SMALL/MEDIUM/LARGE` 20/35/50, `DMG_BULLET` 15, via each hazard's new `damage` field), a `KNOCKBACK_SPEED` (250 px/s) shove away from the hazard, and a `HIT_STUN_DURATION` (1.0 s) i-frame window (reusing `ship.invuln`). `killShip()` is now a respawn-free game over at 0 HP. `addScore()` milestone changed from extra-life to a +25 HP hull repair (`REPAIR_*`), converting to a flat score bonus at full HP. HUD: HULL/HP bar (`COLOR.hp`) replaces the life-ship icons, styled like the shield bar. New `AudioSys.hit()` damage thud. Headless-tested (`scratchpad/test-f2.js`, 54 assertions): per-hit-type damage, hit-stun double-hit prevention, knockback direction/magnitude, 0-HP game over with no respawn, milestone repair, and shield still blocking damage+knockback.
- **v2.0 (in progress)** — Phases 1–2 shipped (larger scrolling world as v1.2; HP & knockback as v1.3). Still planned: a Debris Satellite redesign of asteroids, a difficulty ramp, a Hunter Satellite redesign of the killer satellite/wedge system, weapon/health/utility powerups, controller support, pause/options menu with rebindable controls, and an achievements system. Full specs in `PLANNED-FEATURES-v2.md`; build order in `IMPLEMENTATION-PHASES.md`.

---

*End of document. Keep this GDD updated when mechanics change — Section 2 should always describe the current build, not the original one.*