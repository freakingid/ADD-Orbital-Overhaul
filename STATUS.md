# Asteroid Field Deluxe — STATUS

Last updated: 2026-07-05 · Build version: **1.2** (v2.0 Phase 1 of 9 shipped) · Last session: implemented **F1 — larger scrolling world & camera** (world/screen split, camera follow, wrap-aware culled rendering, ship-relative spawns, seamless starfield)

## Working / verified

**Headless-verified this session (v1.2, `scratchpad/test-f1.js`, 26 assertions):**
- Camera tracks the ship's world position every frame with zero lag (`game.camera` == ship exactly).
- World wraps at the **new 3840×2160 boundary** on both X and Y; the ship never renders past `WORLD_*+60`, and folds back near 0 after crossing.
- The ship crosses the **old 1280×720 boundary without wrapping** (regression guard against a stale wrap boundary).
- Wave asteroids spawn in the `[SPAWN_MIN_DIST, SPAWN_MAX_DIST]` = [220, 1100] px ring around the ship's *current* position — verified at world center, near-origin, and far-corner (i.e. across the wrap seam). Dock lands within [260, 900] px each wave.
- Entities keep simulating off-screen with no NaN/blowup; all stay within wrapped world bounds.
- `draw()` runs without throwing in title / playing / seam-straddling / gameover states.

**Verified headlessly (v1.1, unchanged):**
- Garbage drops, decay, pickup, tow physics, screen-wrap, dock delivery scoring, chain severing all still hold (chain now wrap-aware against `WORLD_*`; the chain-render path was updated to nearest-image but the physics contract in GDD §3.4 is untouched).

**Not yet verified (needs a real browser — see playtest asks below):**
- Camera *feel* (lag/floatiness), starfield seam, entity pop-in at the world edge, satellite/saucer entry distances, and frame rate with the 9× world + culling. Plus all prior v1.1 items (tug feel, serpentine visuals, audio).

## Known issues

- None confirmed. Watch items introduced by F1 are in the playtest asks and the balance notes below; the v1.1 watch list (GDD §6) still applies.

## Balance notes

- **New spawn-distance knobs (first-pass, tunable):** `SPAWN_MIN_DIST` 220 / `SPAWN_MAX_DIST` 1100 for wave asteroids; `DOCK_MIN_DIST` 260 / `DOCK_MAX_DIST` 900 for the dock. Chosen so a wave is reachable within ~1.5 screens and the dock within ~1.2 screens. If early waves feel sparse or the dock feels too far, these are the levers.
- **`CULL_MARGIN` 100 px** — generous enough that nothing pops at the viewport edge; lower only if profiling says so.
- **`STAR_DENSITY` 40** preserves the original per-screen star density (→ ~360 stars across the world). Purely cosmetic.
- v1.1 balance notes unchanged (see GDD §6 / prior STATUS entries).
- **Still pending for later phases:** F3 (Debris Satellites) will increase garbage volume ~8× per cleared large lineage — a Phase 3 rebalance, not this session.

## Next up

**Phase 2 — Health Points & Knockback (F2).** Replaces discrete lives with a single HP pool (max 250), knockback-on-hit, 1.0 s hit-stun, permanent no-continue game-over; deletes the respawn-clearing logic. Use the Phase 2 prompt in `IMPLEMENTATION-PHASES.md`. Note for that session: F1 left the respawn/lives system intact (respawn now gates on the *world* center being clear and the ship returns to world center) — F2 removes it wholesale, so don't spend effort preserving it.

Attach/have present all four docs. GDD §2 is now current truth *including* §2.11 (world/camera).

## Changed this session

- **`asteroids-deluxe.html` → v1.2.** Split world from screen: added `WORLD_W/H` (3840×2160) and `VIEW_W/H` (1280×720) constants; retargeted every wrap-aware helper (`wrap`, `dist2`, `angleTo`, `shortDelta`, `wrapNode`) to `WORLD_*`; added `wrapOffset` (nearest wrapped image vs camera) and `wrapPos` (fold a spawn into the world). Added `game.camera`, updated to the ship's position each frame in `update()`. Rebuilt `draw()`: wrap-aware seamless starfield across world space, a camera translate for world-space entities, per-entity cull + nearest-image render (`onScreen`/`drawEntity`), chain drawn nearest-image, HUD/overlays screen-fixed after `ctx.restore()`, dock chevron now orbits screen-center. Ship-relative spawns for waves and the dock (rings). `resize()`/title/HUD use `VIEW_*`; ship spawns at world center.
- **Scope decision (flagged):** the killer Satellite and both Saucers spawned at fixed *screen* edges, which a mechanical world-rename would have placed ~2000 px away (unreachable/invisible). I treated their spawn edge as a **viewport** concept and now spawn them just beyond a viewport edge relative to the ship, folded into the world — this preserves their shipped "slide in from off-screen, cross the screen, drift toward the ship" feel with no change to speed/homing/fire/splits. This is a coordinate-system fix intrinsic to F1, **not** the Phase 4 (saucer calming) / Phase 5 (Hunter redesign) behaviour work — those remain untouched. Saucers keep a `baseY` so their vertical zig-zag stays in a screen-height band around their entry height; they still despawn after crossing ~one viewport width.
- **Headless test** added at `scratchpad/test-f1.js` (evals the real script via stubs, drives `update()`/`draw()`). `node --check` clean; 26/26 assertions pass.
- **Docs:** GDD — version header + resolution note bumped, new **§2.11 (Larger Scrolling World & Camera)**, §2.7/§2.10 spawn-distance lines updated, Architecture Map rows (Constants, Canvas/scaling, Helpers, game object, update(dt), draw()) updated, Version History v1.2 added. `PLANNED-FEATURES-v2.md` — F1 marked 🟢 Done with spec pointed to GDD §2.11, deferred off-screen-awareness note retained; top status line updated.

## Playtest asks (Paul — can't be checked headlessly)

1. **Camera feel** — does the scroll feel tight and responsive, or laggy/floaty? (It's a hard 1:1 follow with no smoothing; if it feels *too* rigid/jittery we can add a touch of lerp, but that's a deliberate later call.)
2. **Starfield** — fly to and across a world edge in every direction: any visible seam, tiling repeat, or star "pop"? (Rendered wrap-aware, so there should be none.)
3. **Entity seam rendering** — when near a world edge with asteroids/wedges around, does anything pop in/out or fail to appear on the wrapped side? (Nearest-image render should keep the far side visible.)
4. **Satellite & saucer entry** — do they still slide in from just off-screen and reach the ship at a fair distance? Confirm a saucer still crosses the view and exits rather than lingering or never appearing.
5. **Wave reachability** — do new waves feel reachable (some rocks visible or a short flight away), not stranded across the world? Dock reachable, and does the green chevron point to it correctly when it's off-screen?
6. **Frame rate** — with the 9× world + culling, confirm no regression late-wave (garbage-heavy) on modest hardware.
