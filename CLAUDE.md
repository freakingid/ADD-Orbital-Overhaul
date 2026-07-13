# CLAUDE.md — Asteroid Field Deluxe (ADD-Orbital-Overhaul)

Always loaded at the start of a Claude Code session. Read this, then read
`STATUS.md` **before touching code**. This file is non-negotiables +
conventions + code map; `STATUS.md` is ground truth for what is actually built.

## What this is

Asteroid Field Deluxe — a standalone, browser-based vector arcade shooter in
the spirit of Atari's *Asteroids Deluxe*, with an original radioactive-salvage
tow-chain mechanic layered on top. Single self-contained HTML file: HTML5
Canvas 2D + vanilla JavaScript + Web Audio API. **No bundler, no build step, no
external assets or libraries, no npm runtime deps.** The browser opens the file
directly. Solo developer (Paul); you (Claude Code) are the implementer only.

Repo: https://github.com/freakingid/ADD-Orbital-Overhaul (public, GPL-3.0).

## Non-negotiables

- **Read `STATUS.md` first**, every session, before any code. Update it at the
  **end** of every session: what changed, and any architectural decision made.
- **Commit per phase, on `main`.** Unlike some of Paul's other projects, this
  one *does* want you to commit. Each phase (see `IMPLEMENTATION-PHASES.md`)
  ends as its own commit — code and doc updates together — so a regression can
  be rolled back to the last known-good phase. Don't push unless asked; local
  commits are fine, pushing is Paul's call.
- **Implementation only, against an already-reviewed plan.** Sessions execute
  a phase prompt from `IMPLEMENTATION-PHASES.md`. If a genuine design decision
  surfaces that `PLANNED-FEATURES-v2.md` doesn't cover, **stop and surface
  it** — don't invent design or quietly pick an interpretation. Flag it in
  STATUS.md and say so in your response; that's a conversational-session
  question, not an implementation one.
- **Docs are edited in place, not printed for copy-paste.** You have direct
  read/write access to every file in this directory. "Update the GDD" or
  "update STATUS.md" means edit those actual files on disk — move a shipped
  feature's spec out of `PLANNED-FEATURES-v2.md` into GDD Section 2, flip its
  status tag, bump the GDD version header and Version History, rewrite the
  relevant STATUS.md sections. All as real file edits, part of the commit.
- **One phase per session.** Build only what that phase's prompt scopes. Don't
  peek ahead and start wiring in later phases "while you're in there" — half-
  built future features are harder to reason about in diffs than clean phase
  boundaries. If you notice a later phase will be easier because of a small
  choice now, note it in STATUS.md rather than building ahead.

## Documentation layers (don't conflate them)

- `orbital-overhaul-GDD.md` — design **intent** + what's actually
  **shipped**. Section 2 must always describe the current build, never a
  planned one. Sections 1 (Pillars) and 3 (Architecture Map / conventions)
  rarely change; read them before writing code.
- `GDD-VERSION-HISTORY.md` — the append-only per-phase changelog, split out of
  the GDD's §7 in CS009 P0 for context economy. **Not session context** — do
  not attach it to a build session by default; pull it in only when a session
  genuinely needs project history. New phase entries are appended here, not
  back into the GDD.
- `PLANNED-FEATURES-v2.md` — design **detail for what's not built yet**: full
  specs, rationale, and flagged assumptions for every pending feature. When a
  feature ships, its spec moves out of here and into the GDD.
- `IMPLEMENTATION-PHASES.md` — the build **order**: dependency-ordered phases,
  each with a ready-to-paste prompt, required testing, and a suggested commit
  message.
- `CLAUDE.md` (this file) — non-negotiables, conventions, code map.
- `STATUS.md` — build **reality** + decisions. You maintain it.

## Tech + test conventions

- **Single file, vanilla JS, no modules.** Everything lives in one
  `<script>` block inside `asteroids-deluxe.html`. No imports, no build step —
  the file must always be runnable as-is by opening it in a browser.
- **Tuning constants at the top, never inline magic numbers.** New mechanics
  get named constants in the constants block (grouped by system, e.g.
  `GARBAGE_*`, `CHAIN_*`, `CARGO_*`, `DOCK_*`). This is how balance gets tuned
  later without hunting through logic.
- **Headless smoke tests, no canvas.** Extract the script block and run
  `node --check` for syntax. For gameplay logic, stub `window`,
  `document.getElementById` (return a canvas whose `getContext` yields a Proxy
  that no-ops every method), and `requestAnimationFrame`, then drive
  `startGame()` and `update(1/60)` directly against the real code — never
  inline a copy of the logic under test. `AudioSys` is safe headless because
  every method early-returns when `this.ctx` is null. Deliver tests with the
  code, not after; a phase isn't done until its headless test passes.
- **Entity lifecycle: `dead` flag + end-of-frame `.filter()`.** Every entity
  class follows the same contract: constructor / `update(dt)` / `draw()` /
  `dead`. Kill by setting `dead = true`; arrays are filtered once at the end
  of the frame. Never splice an array mid-loop. (Exception: tow-chain nodes,
  which are plain objects removed via `breakChain()`/`chain.pop()`, not a
  dead flag — see the GDD's chain physics contract before touching them.)

## Implementation practices (these bind the code — follow them)

- **Prefer `str_replace` over full-file rewrites.** Re-read the current file
  region before editing; keep edits surgical. The file is long enough that
  full rewrites waste tokens and risk losing unrelated changes.
- **Wrap-aware helpers are mandatory for distance/aiming/link math.**
  `dist2`, `angleTo`, and `shortDelta` all account for the toroidal world —
  naive `Math.hypot`/subtraction breaks near wrap edges. Any new code
  measuring between two world-space points must use these, not raw
  arithmetic. This is the single most common source of subtle bugs in this
  codebase.
- **Rendering goes through `drawPoly` + `glowStroke`.** New visible entities
  define local-space point arrays and reuse these — don't invent a new
  per-entity draw pipeline. Keep the vector-glow look (Pillar 1: no fills
  except bullets/particles, no sprites, no textures).
- **Route all scoring through `addScore()`.** It also handles the HP-repair
  milestone bonus (post-Phase 2) — bypassing it breaks that logic.
- **Tracks are DATA. `MusicSys.update()`/`scheduleStep()` and the
  `layerGates` gain-gating are not to be modified.** New tracks are new
  entries in `MUSIC_TRACKS`, built by their own `buildXTrack()` — never a
  scheduler change. `playNote()`'s voice branch (`type`/`noise`/`hp`/`drop`+
  `dropTime`/`cutoff`+`cutoffTo`+`cutoffTime`+`q`) is the one extension point
  (v3.6) if a track needs a synthesis capability the current fields don't
  cover. `tools/music-lab.html` is the composition/audition instrument —
  tune and audition there, port verbatim, don't hand-tune gains in the live
  build.
- **New enemies follow the established extension points** documented in the
  GDD's Architecture Map (3.3): wire into `startGame` reset, `update()`
  entity update + collision passes + cleanup filter, `draw()` z-order, and
  wave-clear condition if relevant. Decide explicitly whether the new hazard
  can damage the tow chain.
- **Model/effort/thinking guidance lives per-phase in
  `IMPLEMENTATION-PHASES.md`**, not here — each phase prompt ends with a
  recommended setting based on that phase's complexity. Follow it unless
  Paul says otherwise; drop the `ultrathink` keyword into a specific message
  when a prompt flags one sub-problem as the tricky part.
- **Phases flag their own risks.** A phase prompt should already name its
  hazards (e.g. "don't build Phase 5 content yet," "this changes the chain
  physics contract"). If you hit a risk the prompt didn't flag, note it in
  STATUS.md so the next phase's prompt can account for it.
- **Three frozen `localStorage` keys — never rename or merge them.**
  `afd_settings_v1` (options/bindings/difficulty modes/music track),
  `afd_achievements_v2` (progress + unlocks), and `afd_scores_v1` (v3.6 P6 —
  the high-score table) are independent stores, each with its own guarded
  `storageOK()` try/catch load/save path. None of the three reads or writes
  either of the others. Renaming any of them to match a future product/version
  bump silently wipes every player's saved data for that key — see GDD §2.16.
- **`SCOOP_WIDTH[0] !== 0 || SCOOP_DEPTH[0] !== 0` throws at load time — this
  is a deliberate invariant guard, not test scaffolding.** It's what makes
  `inScoopBox` return `false` at `scoopLevel` 0, which is what keeps garbage
  pickup byte-identical to the pre-scoop build. Don't delete it on a
  "cleanup" pass; if it ever fires, `SCOOP_CONFIG`/`buildScoopSteps` broke the
  invariant, not the assertion (GDD §2.14.1).
- **`POWERUP_DROP_TYPES` is the *timed-effect* list, not the drop table.**
  It's what the HUD active-effect row / `powerActive()` / `powerMode()` /
  `powerBudget` understand, and it deliberately excludes Health (instant) and
  Scoop (persistent, not timed). The **drop table** — what can actually roll
  out of `dropPowerup()` — is the separate `POWERUP_DROP_WEIGHTS`. This
  distinction has already caused confusion across two changesets (v3.3 P3,
  v3.6 P3); don't conflate the two structures a third time (GDD §2.14).

## Code map (target layout — GDD §3 tracks what actually exists)

Everything lives in one file. This is the read-order map; it's descriptive
(matches what's built), not aspirational — check the GDD's Architecture Map
table for the authoritative, currently-accurate version, since this file
updates less often than that one.

```
asteroids-deluxe.html
  <style>            // fixed 1280×720 canvas, letterboxed via CSS scaling
  <script>
    // Constants        SHIP_*, BULLET_*, SHIELD_*, AST_*, GARBAGE_*, CHAIN_*,
    //                   CARGO_*, DOCK_*, scores — all tuning lives here first
    // Canvas/scaling    resize() — CSS scale only, game math never touches
    //                   window size
    // AudioSys          singleton; every sound is a method; init on first
    //                   keypress (autoplay policy); continuous sounds are
    //                   start/stop node pairs
    // Input             keys{} map + input.* predicates; call sites never
    //                   read keys{} directly
    // Helpers           rand, wrap, dist2, angleTo, shortDelta (wrap-aware),
    //                   glowStroke, drawPoly, COLOR
    // Entity classes    Ship, Bullet, Asteroid, Satellite, Wedge, Saucer,
    //                   Particle, Garbage, FloatText, Dock — uniform
    //                   contract, see "Entity lifecycle" above
    // game object       central mutable state: entity arrays, score/lives/
    //                   wave, spawn timers, chain/garbage/dock state
    // Flow functions    startGame, nextWave, addScore, boom, destroyAsteroid,
    //                   killShip, shieldDeflect
    // Chain physics     chainAnchor, wrapNode, updateChain, breakChain,
    //                   scatterChain, drawLink, drawChain — see GDD 3.4
    //                   before touching; verlet nodes, not entity-pattern
    // update(dt)        respawn → entity updates → pickup/chain/dock →
    //                   spawn timers → collision passes → cleanup filters →
    //                   wave-clear → heartbeat
    // draw()            starfield → title OR (dock → particles → garbage →
    //                   chain → rocks → satellites → wedges → saucers →
    //                   bullets → ship → floaters → HUD → overlays)
    // Main loop         requestAnimationFrame, dt clamped to 0.05s
```

**In-flight per the v2.0 plan** (see `PLANNED-FEATURES-v2.md` /
`IMPLEMENTATION-PHASES.md`): `Asteroid` → `DebrisSatellite` rename (Phase 3),
`Satellite`/`Wedge` → `HunterSatellite` merge (Phase 5), a `difficultyFactor()`
helper (Phase 4), a `Powerup` class (Phase 6), a gamepad-aware `input` binding
table (Phase 7), a menu state machine (Phase 8), and an achievements module
(Phase 9). Don't assume any of these exist — check `STATUS.md` for what's
actually landed.

When you add or rename a module-equivalent section, update the GDD's
Architecture Map table **and** `STATUS.md`.

## Design instruments (`tools/`)

Standalone HTML files, **not shipped code** — disposable-by-design instruments
used to pick numbers or compose data before porting the result into
`asteroids-deluxe.html`. Same no-bundler/no-imports rule as the main file;
each carries whatever small slice of game logic it needs duplicated in place
(drift here can only ever produce a bad *preview*, never a bad *build*).

- **`tools/scoop-lab.html`** — the Scoop capture-mouth sizing instrument
  (§2.14.1 of the GDD). Live sliders over `SCOOP_CONFIG`, a level stepper,
  and draggable garbage canisters highlighted by the real `inScoopBox` math;
  answers "how big does this look," not "how does this play."
- **`tools/music-lab.html`** — the music-track composition/audition
  instrument and the porting source for every `MUSIC_TRACKS` entry (GDD
  §2.8/§3 MusicSys row). Runs a faithful copy of `MusicSys`'s scheduler, so
  what it plays is what the game plays; a track is composed and auditioned
  there, then its builder function is ported **verbatim** into the main
  file — never hand-tuned in place. See the MusicSys non-negotiable above.

## Capture tools

A **shipped, player-facing** feature (not debug scaffolding) — the `Capture`
object, defined just above the main loop in `asteroids-deluxe.html`. Do not
strip or gate these behind a debug flag on a refactor pass.

- **P** — export the current frame as a PNG, composited onto black.
- **O** — cycle time scale 1x → 0.5x → 0.25x → 1x (slow motion).
- **H** — toggle the HUD overlay (`drawHUD()`) on/off. Purely visual — the
  game keeps simulating normally either way. `P` respects this: hiding the
  HUD before capturing exports a clean frame.

All three keys are inert outside live play (`Capture.active()` gates on
`game.state === "playing" && !game.paused`), so they can never collide with
menu navigation or control rebinding.

Two integration points in `loop()` are **load-bearing** — preserve them if
`loop()` or `draw()` is ever restructured:
1. `dt` is multiplied by `Capture.timeScale` (drives O's slow-mo).
2. `Capture.afterDraw()` runs immediately after `draw()` (drives P — the
   canvas must hold a complete, already-composited frame first).

The HUD itself lives in its own `drawHUD()` function (the persistent in-play
overlay: score, hull HP, level, cargo/targets, active-powerup bars, scoop
pips, dock/low-health chevrons, shield bar), called from `draw()` gated on
`Capture.hudVisible`. Menus, achievement toasts, and the game-over text are
drawn separately in `draw()` and are unaffected by the H toggle.