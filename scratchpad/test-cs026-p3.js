// Headless test for CS026 Phase 3 — A 1920x1080 WORLD FOR LEVELS 1-5.
//
//   node scratchpad/test-cs026-p3.js
//
// WHY (archive/PLANNED-FEATURES-CS026.md §2). The slog in an early level is not the fight, it is FINDING the
// last two or three smalls. At 2560x1440 the viewport shows 25% of the world and the farthest a body can
// be from the ship is 1,469 px. At 1920x1080 it shows 44% and the farthest is 1,101 px.
//
// WHAT LANDED — three things and no more:
//   1. `const WORLD_SIZE_EARLY = 2.25`, a third entry in the size table. worldDims scales by sqrt(size),
//      so 2.25 is exactly 1920x1080 (k = 1.5) with no fractional dimensions.
//   2. `worldSizeFor(level)` returns WORLD_SIZE_EARLY while `level <= DEBUG.earlyWorldLevels`, and
//      WORLD_SIZE_FIELD otherwise. The `level` parameter has been unused since CS024 P1, kept as "the
//      seam a per-level scheme would re-enter through" — this is that scheme.
//   3. One registry knob, `earlyWorldLevels` (GLOBAL, def 5, min 0, max 20, step 1). Registry 78 -> 79.
//      NOT a lever. At 0 the feature is off entirely and the build behaves exactly as CS025 shipped.
//
// ⛔ THE REAL SUBJECT OF THIS PHASE IS THE LEVEL 5 -> 6 TRANSITION, WHICH IS SECTION (E).
// `worldSizeFor()` has returned a constant since CS024 P1 removed the orbit archetype, so `resizeWorld()`
// — the six-step carried-entity re-homing pass — HAS NOT FIRED IN LIVE PLAY FOR TWO CHANGESETS. It is
// still exercised by test-cs024-p1.js §E, but *tested* and *shipped* are different claims. Level 5 -> 6
// is now the one place it fires, and it fires with a full field carried across it, so (E) drives exactly
// that: a populated board (debris, Hunters, garbage, powerups, particles, floaters and a loaded tow
// chain) taken across the boundary by the REAL nextWave(), then checked for the three things that could
// go wrong — a body stranded outside the new period, a body landing on top of the ship, and a tow chain
// that arrives stretched or with its verlet velocity destroyed.
//
// ⛔ 2.25 IS THE FLOOR OF THE SIZE TABLE, AND §A RE-DERIVES THE BOUND RATHER THAN QUOTING IT. drawEntity()
// renders each body at EXACTLY ONE wrapped image, and onScreen()'s reach is VIEW/2 + CULL_MARGIN + radius
// — so for the largest body (a size-3 satellite, r = 46) the world's HALF-period must clear 786 x 506 or
// bodies clip at the seam instead of crossing it. 1920x1080 gives 960 x 540 and clears both; 1600x900
// gives 800 x 450 and fails on the vertical; 1280x720 fails that AND puts a SPAWN_MAX_DIST spawn 80 px
// from the ship. Nobody should try a smaller size here without fixing drawEntity() first.
//
// ⛔ THE FLAT SPAWN/DOCK RINGS ARE DELIBERATELY NOT SCALED, and §C MEASURES that rather than asserting
// it. SPAWN_MIN/MAX 220/640 and DOCK_MIN/MAX 260/620 do not move with the world. In a 1080-px vertical
// period a nominal 640 offset folds worst-case to 440 px and a nominal 620 to 460 px — both comfortably
// above their own minimums — so leaving them flat is a checked decision, not an oversight.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL startGame/nextWave/update/draw/resizeWorld paths. Nothing under
// test is reimplemented — in particular §B reads the size off `game.worldSize` after a real level was
// really reached, and §E measures a real field that a real nextWave() really moved.
//
// TRAPs (all asserted in §G):
//   1. GAME_VERSION stays "1.0.0.25" — CS026 P6 owns the next bump.
//   2. NO DESIGN DOC TOUCHED. §2 already carries this spec; the GDD §2.11.1 world-size rewrite is P6's.
//   3. LEVERS and leverState are byte-identical to the parent at every level 1..200 — the world size is
//      NOT a lever and must not become one. It is a stability/legibility property, not a difficulty axis.
//   4. WORLD_SIZE_MAX still reads WORLD_SIZE_ORBIT, so STAR_COUNT still generates the sky at the largest
//      table size and rebuildStarsActive() filters it per world. The starfield was not touched.
//   5. resizeWorld()'s body is BYTE-IDENTICAL to the parent, and so is startGame()'s. This phase gave
//      resizeWorld a caller, not an edit; startGame needed no change and that is confirmed, not assumed.
//
// Every "nothing else moved" claim is written against THIS PHASE'S OWN PARENT SHA via
// scratchpad/_phase-ref.js — a hardcoded literal for the parent, the phase's own commit resolved by
// subject inside PARENT_SHA..HEAD (§4.1), and FORK-CS026-H's loud, counted skip when git is unavailable.
//
// Sections:
//  (A) node --check; WORLD_SIZE_EARLY's value and dimensions; the floor bound, re-derived; the two-band
//      worldSizeFor rule at every level 1..12 and out to 2001, with the boundary pinned on both sides.
//  (B) THE SIZE AT EVERY LEVEL 1..12, driven for real — reached through the real startLevel knob and
//      through a real level-by-level nextWave() climb, with the exact live dimensions at each.
//  (C) the flat rings, MEASURED wrap-aware in the small world — analytically over the whole circle, and
//      then against hundreds of REAL spawnFieldSatellites() and REAL Dock placements.
//  (D) the knob: its registry row, its GLOBAL placement, its ranges, that it is NOT a lever — and that
//      at 0 the feature is off and the build is single-sized exactly as CS025 shipped.
//  (E) ⛔ THE LEVEL 5 -> 6 TRANSITION, DRIVEN FOR REAL ACROSS A POPULATED FIELD. Nothing stranded outside
//      the new period, nothing on top of the ship, the chain's spacing and verlet velocity intact.
//  (F) startGame()'s own path: it still calls applyWorldSize(WORLD_SIZE_FIELD) and lets nextWave() do the
//      resize on an empty field, ship re-centred before the dock is placed — the order is load-bearing.
//  (G) TRAPs 1-5 and the scope pin — all against the phase's own parent SHA.
//  (H) AudioSys.ctx === null smoke: a real run that crosses the boundary, update() and draw().

"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const { parentSource, ownCommits, changedFiles, outsideScope, SKIP_TAG } = require("./_phase-ref.js");
const { installSeed } = require("./_seeded-random.js");

// ⛔ SEEDED BEFORE THE FIRST BUILD (CS026 P1, archive/PLANNED-FEATURES-CS026.md §5.2). This file makes no
// Math.random calls of its own — the nondeterminism is the GAME'S, and some of it is spent at MODULE
// LOAD inside the factory (the starfield), so a seed installed after `new Function(...)(...)` fixes
// nothing. §C samples hundreds of real spawns and §E/§H drive real frames, all of which roll dice.
installSeed(20260812);

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "orbital-overhaul.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];
// Comments stripped so a TOMBSTONE naming a retired shape can never be mistaken for live code (the
// standing test-cs024-p1/p2/p3 idiom).
const execOnly = scriptSrc
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").map(l => l.replace(/\s\/\/.*$/, ""))
  .filter(l => !l.trim().startsWith("//")).join("\n");

// ⛔ THIS PHASE'S OWN PARENT COMMIT, PINNED AS A LITERAL (§4.1). Not HEAD: a reference that follows HEAD
// stops meaning anything the moment this phase commits, and starts failing the moment a later one edits
// the same lines. The phase's OWN commit is what gets resolved dynamically, by subject, inside the
// bounded PARENT_SHA..HEAD range.
const PARENT_SHA = "de673b24ad111583a43189b62c459d6f13da8f06";   // cs-26 p2
const PHASE_SUBJECT = "cs-26 p3:";

let passed = 0, failed = 0, skipped = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function close(got, want, msg, tol = 1e-9) { assert(Math.abs(got - want) <= tol, `${msg} (got ${got}, want ${want})`); }
// FORK-CS026-H: skip LOUDLY and COUNTED, never silently. The closing phase greps for SKIP_TAG.
function skip(what) { skipped++; console.log(`  ${SKIP_TAG}: ${what}`); }

// ---- Headless environment (the standing stub idiom) ----
function makeCtxStub() {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null,
    shadowBlur: 0, shadowColor: null, globalAlpha: 1 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return s => ({ width: 6 * String(s).length });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}
const RETURN = [
  "game", "startGame", "nextWave", "update", "draw",
  "worldDims", "worldSizeFor", "resizeWorld", "applyWorldSize",
  "WORLD_SIZE_EARLY", "WORLD_SIZE_FIELD", "WORLD_SIZE_ORBIT", "WORLD_SIZE_MAX",
  "VIEW_W", "VIEW_H", "CULL_MARGIN", "DEBRIS_RADII",
  "SPAWN_MIN_DIST", "SPAWN_MAX_DIST", "DOCK_MIN_DIST", "DOCK_MAX_DIST", "DOCK_RADIUS",
  "STAR_COUNT", "STAR_DENSITY", "stars", "starsActive",
  "DEBUG", "debugShown", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG_OVERRIDE_ID", "applyDebug",
  "LEVERS", "leverState",
  "DebrisSatellite", "HunterSatellite", "Garbage", "Powerup", "Particle", "FloatText", "Dock",
  "dist2", "shortDelta", "wrapPos", "CHAIN_LINK", "SHIP_RADIUS", "SHIP_MAX_HP",
  "AudioSys", "GAME_VERSION",
  // The live torus period, read off the module's own mutable bindings rather than a snapshot.
  'liveDims: () => [WORLD_W, WORLD_H]',
];
function buildFrom(src, { exportList = RETURN, store = null } = {}) {
  const c = makeCtxStub();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 };
  const s = store || {};
  const localStorageStub = {
    getItem: k => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: k => { delete s[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + exportList.join(", ") + " };");
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
}
const build = opts => buildFrom(scriptSrc, opts);

// Start a build directly at `level`, through the REAL startLevel knob + the REAL startGame().
function atLevel(A, level) {
  A.applyDebug("startLevel", level);
  A.startGame();
  A.game.state = "playing"; A.game.paused = false;
  return A;
}
// Advance to the next level through the REAL nextWave(), the way play does — debris cleared first,
// because that is what the wave-clear condition reads.
function advance(A) {
  A.game.debris.length = 0;
  A.nextWave();
}

// ================= (A) the constant, the floor, and the two-band rule =====================
let X = null;
(function sectionA() {
  console.log("(A) WORLD_SIZE_EARLY, the rendering floor re-derived, and worldSizeFor's two bands");
  const tmp = path.join(__dirname, "_cs026p3_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  try { X = build(); passed++; } catch (e) { failed++; console.error("  FAIL: A: the build evaluates — " + e.message); }
  if (!X) { console.error("ABORT: build failed"); process.exit(1); }

  eq(X.WORLD_SIZE_EARLY, 2.25, "A: WORLD_SIZE_EARLY is 2.25");
  const [EW, EH] = X.worldDims(X.WORLD_SIZE_EARLY);
  eq(EW, 1920, "A: worldDims(WORLD_SIZE_EARLY) is exactly 1920 wide");
  eq(EH, 1080, "A: ...and exactly 1080 tall — no fractional dimensions");
  // DERIVED, not a literal that happens to agree: `size` counts viewport-sized SCREENS OF AREA, so the
  // linear scale is sqrt(size) — k = 1.5 here, which is why 2.25 lands on integers at a 1280x720 view.
  close(Math.sqrt(X.WORLD_SIZE_EARLY), 1.5, "A: ...k = sqrt(2.25) = 1.5, the linear scale");
  eq(EW, X.VIEW_W * 1.5, "A: ...and 1920 IS VIEW_W * k, the sqrt-of-area derivation");
  eq(EH, X.VIEW_H * 1.5, "A: ...as 1080 is VIEW_H * k");
  assert(X.WORLD_SIZE_EARLY < X.WORLD_SIZE_FIELD, "A: the early world is genuinely SMALLER than the field world");
  // The visibility figures the change was argued from, recomputed rather than quoted.
  const visible = (w, h) => (X.VIEW_W * X.VIEW_H) / (w * h);
  const [FW, FH] = X.worldDims(X.WORLD_SIZE_FIELD);
  close(visible(FW, FH), 0.25, "A: (why) the field world shows 25% of itself at once", 5e-4);
  close(visible(EW, EH), 4 / 9, "A: (why) ...and the early world shows 44%", 5e-4);
  close(Math.hypot(FW / 2, FH / 2), 1468.6, "A: (why) the farthest a body can be in the field world is ~1,469 px", 0.1);
  close(Math.hypot(EW / 2, EH / 2), 1101.5, "A: (why) ...and ~1,101 px in the early world", 0.1);

  // ⛔ THE FLOOR. Re-derived from the two things that actually set it — drawEntity() draws ONE wrapped
  // image per body, and onScreen()'s reach is VIEW/2 + CULL_MARGIN + radius — so the half-period must
  // clear that reach for the largest body or it clips at the seam instead of crossing it.
  eq(X.CULL_MARGIN, 100, "A: (derivation) CULL_MARGIN is 100");
  eq(X.DEBRIS_RADII[3], 46, "A: (derivation) the largest body is a size-3 satellite, r = 46");
  const needX = X.VIEW_W / 2 + X.CULL_MARGIN + X.DEBRIS_RADII[3];
  const needY = X.VIEW_H / 2 + X.CULL_MARGIN + X.DEBRIS_RADII[3];
  eq(needX, 786, "A: (derivation) ...so the required half-period is 786 wide");
  eq(needY, 506, "A: (derivation) ...and 506 tall");
  assert(EW / 2 >= needX && EH / 2 >= needY,
    `A: ⛔ WORLD_SIZE_EARLY's half-period (${EW / 2} x ${EH / 2}) clears 786 x 506 — 2.25 is a LEGAL size`);
  // ...and the next two sizes anyone would reach for do NOT, which is what makes 2.25 the floor rather
  // than a preference. Stated as failing assertions on those sizes, so the bound is a live check.
  for (const [sz, label] of [[1.5625, "1600x900"], [1, "1280x720"]]) {
    const [w, h] = X.worldDims(sz);
    assert(!(w / 2 >= needX && h / 2 >= needY),
      `A: ⛔ ...while ${label} (half-period ${w / 2} x ${h / 2}) does NOT — 2.25 is the FLOOR`);
  }
  // Size 1 fails a SECOND way, and that one is about the flat rings rather than the renderer.
  {
    const [w1, h1] = X.worldDims(1);
    const worstFold = h1 - X.SPAWN_MAX_DIST;   // a purely vertical nominal-max spawn, folded
    eq(worstFold, 80, "A: ⛔ at 1280x720 a SPAWN_MAX_DIST spawn folds to 80 px from the ship");
    assert(worstFold < X.SPAWN_MIN_DIST, "A: ...inside SPAWN_MIN_DIST (220)");
    assert(worstFold < X.DOCK_RADIUS, "A: ...and inside DOCK_RADIUS (88) — a fully visible world needs the rings scaled too");
    assert(w1 === 1280 && h1 === 720, "A: (setup) ...that being the size-1 world, one viewport across");
  }

  // The two-band rule, at the knob's shipped default.
  eq(X.DEBUG.earlyWorldLevels, 5, "A: the earlyWorldLevels knob defaults to 5");
  for (let lv = 1; lv <= 12; lv++) {
    const want = lv <= 5 ? X.WORLD_SIZE_EARLY : X.WORLD_SIZE_FIELD;
    eq(X.worldSizeFor(lv), want, `A: worldSizeFor(${lv}) is ${lv <= 5 ? "WORLD_SIZE_EARLY" : "WORLD_SIZE_FIELD"}`);
  }
  // ...and far out, including every level that used to be an orbit level (multiples of 3), because "it
  // is right for the first twelve" would pass even if a stray schedule survived somewhere further on.
  for (const lv of [15, 21, 42, 63, 99, 100, 1000, 2001])
    eq(X.worldSizeFor(lv), X.WORLD_SIZE_FIELD, `A: worldSizeFor(${lv}) is still the field world — one band boundary, not a cycle`);
  // ⛔ NOT A SAWTOOTH. Under the odometer, level 11 and level 21 are identical to level 1 in every LEVER;
  // the world size deliberately is NOT, because it is not a lever. Stated outright so a future reader
  // does not "fix" it into following junkCount's wrap.
  assert(X.worldSizeFor(1) !== X.worldSizeFor(11) && X.worldSizeFor(11) === X.worldSizeFor(21),
    "A: ⛔ the size does NOT follow the odometer's sawtooth — levels 11 and 21 are the field world, unlike level 1");
  // The boundary, pinned on both sides so an off-by-one in the `<=` fails loudly.
  eq(X.worldSizeFor(5), X.WORLD_SIZE_EARLY, "A: level 5 — the LAST early level — is still the small world");
  eq(X.worldSizeFor(6), X.WORLD_SIZE_FIELD, "A: ...and level 6 is the field world; the band is inclusive");

  // The size table's other two entries are untouched, and the whole table is still exact integers.
  eq(X.WORLD_SIZE_FIELD, 4, "A: WORLD_SIZE_FIELD is still 4");
  eq(X.WORLD_SIZE_ORBIT, 9, "A: WORLD_SIZE_ORBIT still holds its slot at 9");
  for (const sz of [X.WORLD_SIZE_EARLY, X.WORLD_SIZE_FIELD, X.WORLD_SIZE_ORBIT]) {
    const [w, h] = X.worldDims(sz);
    assert(Number.isInteger(w) && Number.isInteger(h), `A: worldDims(${sz}) is whole-pixel (${w}x${h})`);
  }
})();

// ================= (B) the size at every level 1..12, driven for real =====================
(function sectionB() {
  console.log("(B) the size at every level 1..12 — reached for real, twice: by startLevel and by climbing");
  // Path 1: the real startLevel knob + the real startGame(), one fresh build per level.
  for (let lv = 1; lv <= 12; lv++) {
    const A = build();
    atLevel(A, lv);
    eq(A.game.wave, lv, `B: (setup) startLevel really reached level ${lv}`);
    const want = lv <= 5 ? A.WORLD_SIZE_EARLY : A.WORLD_SIZE_FIELD;
    const [ww, wh] = A.worldDims(want);
    eq(A.game.worldSize, want, `B: level ${lv} is running at ${lv <= 5 ? "the small world" : "the field world"}`);
    const [lw, lh] = A.liveDims();
    eq(lw, ww, `B: level ${lv}: the live torus period is ${ww} wide`);
    eq(lh, wh, `B: level ${lv}: ...and ${wh} tall`);
    // The ship is inside its own world at every level — the cheapest possible catch for a resize that
    // moved the period without re-homing anything.
    assert(A.game.ship.x >= 0 && A.game.ship.x < lw && A.game.ship.y >= 0 && A.game.ship.y < lh,
      `B: level ${lv}: ...and the ship is inside it (${A.game.ship.x.toFixed(0)}, ${A.game.ship.y.toFixed(0)})`);
  }

  // Path 2: ONE build climbing 1 -> 12 through the real nextWave(), which is the path that actually
  // fires resizeWorld(). The two paths can disagree — startLevel jumps straight to a level on an empty
  // field, a climb crosses the boundary with whatever the previous level left behind.
  {
    const A = build();
    atLevel(A, 1);
    const seen = [];
    for (let lv = 1; lv <= 12; lv++) {
      if (lv > 1) advance(A);
      eq(A.game.wave, lv, `B: (climb) reached level ${lv} by nextWave()`);
      const want = lv <= 5 ? A.WORLD_SIZE_EARLY : A.WORLD_SIZE_FIELD;
      eq(A.game.worldSize, want, `B: (climb) level ${lv} is at the size its band asks for`);
      eq(A.game.worldSize, A.worldSizeFor(lv), `B: (climb) ...which is exactly what worldSizeFor(${lv}) said`);
      seen.push(`${A.liveDims().join("x")}`);
    }
    eq(seen.join(" "), "1920x1080 1920x1080 1920x1080 1920x1080 1920x1080 2560x1440 2560x1440 " +
                       "2560x1440 2560x1440 2560x1440 2560x1440 2560x1440",
      "B: ⛔ the whole climb, level by level: five small, then field forever");
    // EXACTLY ONE resize across the climb, and it is at 5 -> 6. Counted by watching the dimensions
    // change rather than by spying, so it counts what the player would actually experience.
    let changes = 0;
    for (let i = 1; i < seen.length; i++) if (seen[i] !== seen[i - 1]) changes++;
    eq(changes, 1, "B: ⛔ exactly ONE world change in twelve levels — resizeWorld fires once per run, not per wave");
  }
})();

// ================= (C) the flat rings, measured wrap-aware in the small world ==============
(function sectionC() {
  console.log("(C) the flat spawn/dock rings clear the small world — measured, not assumed");
  const A = build();
  atLevel(A, 1);
  const [W, H] = A.liveDims();
  eq(W, 1920, "C: (setup) level 1 is the small world");
  eq(H, 1080, "C: (setup) ...1080 tall, which is the axis that binds");

  // THE RINGS DID NOT MOVE. That is the decision — checked, then left flat.
  eq(A.SPAWN_MIN_DIST, 220, "C: SPAWN_MIN_DIST unchanged at 220");
  eq(A.SPAWN_MAX_DIST, 640, "C: SPAWN_MAX_DIST unchanged at 640");
  eq(A.DOCK_MIN_DIST, 260, "C: DOCK_MIN_DIST unchanged at 260");
  eq(A.DOCK_MAX_DIST, 620, "C: DOCK_MAX_DIST unchanged at 620");

  // A nominal offset larger than the half-period does not get clamped, it gets FOLDED by the wrap. The
  // question is whether the folded distance can fall below the ring's own MINIMUM. Swept over the whole
  // circle rather than evaluated at the one worst heading, so this is about the ring, not a lucky angle.
  const foldMin = (nominal) => {
    let worst = Infinity;
    for (let i = 0; i < 3600; i++) {
      const a = i * Math.PI / 1800;
      let dx = Math.abs(nominal * Math.cos(a)); if (dx > W / 2) dx = W - dx;
      let dy = Math.abs(nominal * Math.sin(a)); if (dy > H / 2) dy = H - dy;
      worst = Math.min(worst, Math.hypot(dx, dy));
    }
    return worst;
  };
  const spawnFold = foldMin(A.SPAWN_MAX_DIST), dockFold = foldMin(A.DOCK_MAX_DIST);
  close(spawnFold, 440, "C: a nominal 640 px spawn folds worst-case to 440 px — the purely vertical heading", 1e-6);
  close(dockFold, 460, "C: a nominal 620 px dock placement folds worst-case to 460 px", 1e-6);
  assert(spawnFold > A.SPAWN_MIN_DIST, `C: ⛔ 440 is still clear of SPAWN_MIN_DIST (${A.SPAWN_MIN_DIST})`);
  assert(dockFold > A.DOCK_MIN_DIST, `C: ⛔ 460 is still clear of DOCK_MIN_DIST (${A.DOCK_MIN_DIST})`);
  assert(dockFold > A.DOCK_RADIUS, `C: ⛔ ...and clear of DOCK_RADIUS (${A.DOCK_RADIUS}), so a dock never lands on the ship`);
  assert(A.SPAWN_MAX_DIST < W / 2 && A.DOCK_MAX_DIST < W / 2,
    "C: neither maximum reaches the HORIZONTAL half-period (960), so only the vertical axis ever folds");
  // ...and the reason this is the right instrument: min(W,H)/2 - 60 — resizeWorld()'s carried-body dmax —
  // is 480 here, which BOTH maxima exceed. Recorded outright so nobody later "fixes" the rings against it.
  eq(Math.min(W, H) / 2 - 60, 480, "C: (context) resizeWorld's dmax at this size is 480");
  assert(A.SPAWN_MAX_DIST > 480 && A.DOCK_MAX_DIST > 480,
    "C: ⛔ (context) ...which BOTH ring maxima exceed — dmax clamps CARRIED bodies, it does not bound a SPAWN, which wraps");

  // Now the real thing: hundreds of REAL spawns and REAL Dock placements in the small world, measured
  // with the game's own wrap-aware dist2.
  let minSpawn = Infinity, maxSpawn = 0, spawnSamples = 0, spawnBad = 0;
  for (let trial = 0; trial < 30; trial++) {
    const B = build();
    atLevel(B, 1);
    eq(B.game.worldSize, B.WORLD_SIZE_EARLY, `C: (setup) spawn trial ${trial} really ran in the small world`);
    for (const d of B.game.debris) {
      const dist = Math.sqrt(B.dist2(d, B.game.ship));
      spawnSamples++;
      minSpawn = Math.min(minSpawn, dist); maxSpawn = Math.max(maxSpawn, dist);
      if (dist < B.SPAWN_MIN_DIST - 1e-6 || dist > B.SPAWN_MAX_DIST + 1e-6) spawnBad++;
      // The claim that actually matters to a player: no satellite is ON the ship at spawn.
      if (dist < B.SHIP_RADIUS + d.radius) spawnBad++;
    }
  }
  assert(spawnSamples > 50, `C: (control) the sweep sampled ${spawnSamples} real spawns in the small world`);
  eq(spawnBad, 0, `C: ⛔ every one of them landed inside [${A.SPAWN_MIN_DIST}, ${A.SPAWN_MAX_DIST}] wrap-aware (saw [${minSpawn.toFixed(1)}, ${maxSpawn.toFixed(1)}])`);
  assert(minSpawn >= A.SPAWN_MIN_DIST, "C: ...and the closest of them still clears SPAWN_MIN_DIST");

  let minDock = Infinity, maxDock = 0, dockBad = 0;
  for (let trial = 0; trial < 200; trial++) {
    const d = new A.Dock();
    const dist = Math.sqrt(A.dist2(d, A.game.ship));
    minDock = Math.min(minDock, dist); maxDock = Math.max(maxDock, dist);
    if (dist < A.DOCK_MIN_DIST - 1e-6 || dist > A.DOCK_MAX_DIST + 1e-6) dockBad++;
    if (d.x < 0 || d.x >= W || d.y < 0 || d.y >= H) dockBad++;
  }
  eq(dockBad, 0, `C: ⛔ 200 real Dock placements all landed inside [${A.DOCK_MIN_DIST}, ${A.DOCK_MAX_DIST}] and inside the world (saw [${minDock.toFixed(1)}, ${maxDock.toFixed(1)}])`);
})();

// ================= (D) the knob =====================
(function sectionD() {
  console.log("(D) earlyWorldLevels: the registry row, GLOBAL, not a lever — and 0 turns the feature off");
  const e = X.DEBUG_ENTRIES.find(v => v.id === "earlyWorldLevels");
  assert(!!e, "D: the earlyWorldLevels row exists in the registry");
  if (e) {
    eq(e.def, 5, "D: def is 5 — and the ENTRY is the source of truth (no shipped constant backs it)");
    eq(e.min, 0, "D: min is 0, which is what makes the feature switchable off");
    eq(e.max, 20, "D: max is 20");
    eq(e.step, 1, "D: step is 1 — a whole number of levels");
    eq(e.unit, "", "D: no unit");
    assert(!e.toNative && !e.clampShown, "D: no toNative / clampShown hook — the shown value IS the native one");
    eq(e.label, "Small-world levels", "D: its label");
    // ⛔ NOT A LEVER, spelled out row by row. The world size is a stability/legibility property, not a
    // difficulty axis, so it takes ONE flat row: no floor/ceil/steps triple, no ▼ driver glyph, no ↳
    // carried glyph, no (inv). TRAP 3 in §G is the other half of this — the LEVERS table is untouched.
    for (const suffix of ["Floor", "Ceil", "Steps"])
      assert(!X.DEBUG_ENTRIES.some(v => v.id === "earlyWorldLevels" + suffix),
        `D: ⛔ NOT A LEVER — there is no earlyWorldLevels${suffix} row`);
    assert(!/[▼↳]|\(inv\)/.test(e.label), "D: ⛔ ...and its label wears no ▼ / ↳ / (inv) marker");
    assert(!X.LEVERS.some(l => l.id === "earlyWorldLevels"), "D: ⛔ ...and it is not in LEVERS at all");
  }
  // GLOBAL, and placed after debrisBounceRestitution but before P6d's startLevel — which keeps the
  // gate-tooling knob reading as the registry's trailing dev tool.
  const gIdx = X.DEBUG_VARS.findIndex(v => v.header === "GLOBAL");
  assert(gIdx >= 0, "D: (setup) there is a GLOBAL section");
  const globalIds = X.DEBUG_VARS.slice(gIdx + 1).map(v => v.id);
  eq(globalIds.join(","),
    "sweepCoalescePause,debrisBounceRestitution,earlyWorldLevels,startLevel,levelBannerTime,levelBannerFade,levelBannerSize,levelBannerY",
    "D: GLOBAL holds it, after debrisBounceRestitution and before startLevel (CS026 P5's four level banner knobs trail startLevel)");
  eq(X.DEBUG.earlyWorldLevels, 5, "D: the live value seeds from the def");

  // It is READ LIVE at the wave boundary, never cached — a panel change takes effect on the next level.
  {
    const A = build();
    atLevel(A, 1);
    eq(A.game.worldSize, A.WORLD_SIZE_EARLY, "D: (setup) level 1 starts small at the default");
    A.applyDebug("earlyWorldLevels", 2);
    eq(A.DEBUG.earlyWorldLevels, 2, "D: (setup) the panel wrote 2");
    advance(A);   // -> level 2, still inside the shortened band
    eq(A.game.worldSize, A.WORLD_SIZE_EARLY, "D: level 2 is still small under a band of 2");
    advance(A);   // -> level 3, now outside it
    eq(A.game.worldSize, A.WORLD_SIZE_FIELD, "D: ⛔ level 3 is the field world — the knob was re-read at the boundary, not cached");
    // And it can go the other way mid-run too, which is what "live" has to mean.
    A.applyDebug("earlyWorldLevels", 20);
    advance(A);   // -> level 4
    eq(A.game.worldSize, A.WORLD_SIZE_EARLY, "D: ...and widening the band mid-run puts level 4 back in the small world");
  }

  // The override toggle folds it in like every other row: OFF derives from def without discarding the edit.
  {
    const A = build();
    A.applyDebug("earlyWorldLevels", 12);
    eq(A.DEBUG.earlyWorldLevels, 12, "D: (setup) the edit lands");
    A.applyDebug(A.DEBUG_OVERRIDE_ID, 0);
    eq(A.DEBUG.earlyWorldLevels, 5, "D: with overrides OFF it derives from def, like every other row");
    eq(A.debugShown.earlyWorldLevels, 12, "D: ...without discarding the edit");
    A.applyDebug(A.DEBUG_OVERRIDE_ID, 1);
    eq(A.DEBUG.earlyWorldLevels, 12, "D: ...and back ON restores it");
  }

  // ⛔ AT 0 THE FEATURE IS OFF ENTIRELY AND THE BUILD IS SINGLE-SIZED, EXACTLY AS CS025 SHIPPED. This is
  // the gate's clean A/B, so it is DRIVEN rather than reasoned about: a real twelve-level climb with the
  // knob at 0 must never leave the field world and must never fire a resize.
  {
    const A = build();
    A.applyDebug("earlyWorldLevels", 0);
    atLevel(A, 1);
    for (let lv = 1; lv <= 200; lv++)
      eq(A.worldSizeFor(lv), A.WORLD_SIZE_FIELD, lv <= 12
        ? `D: with the knob at 0, worldSizeFor(${lv}) is WORLD_SIZE_FIELD — the CS025 behaviour`
        : `D: ...and still is at level ${lv}`);
    const seen = new Set();
    for (let lv = 1; lv <= 12; lv++) {
      if (lv > 1) advance(A);
      seen.add(A.liveDims().join("x"));
    }
    eq([...seen].join(","), "2560x1440", "D: ⛔ ...and a real twelve-level climb never leaves 2560x1440 — one size, no resize, exactly as CS025 shipped");
    eq(A.game.wave, 12, "D: (setup) the climb really reached level 12");
  }
})();

// ================= (E) ⛔ THE LEVEL 5 -> 6 TRANSITION, ACROSS A POPULATED FIELD ============
(function sectionE() {
  console.log("(E) ⛔ level 5 -> 6 driven for real, carrying a full field across the resize");
  const A = build();
  atLevel(A, 5);
  eq(A.game.worldSize, A.WORLD_SIZE_EARLY, "E: (setup) level 5 is the small world");
  const [oldW, oldH] = A.liveDims();
  eq(`${oldW}x${oldH}`, "1920x1080", "E: (setup) ...1920x1080");
  const g = A.game;

  // ---- POPULATE. Every array resizeWorld() snapshots gets real members, spread over the small world
  // INCLUDING hard against its seams, because a seam-straddling body is the case only shortDelta gets
  // right and is exactly what step 1's old-period snapshot exists for.
  //
  // ⛔ DEBRIS IS DELIBERATELY NOT IN THE CARRIED SET, AND THAT IS A PROPERTY OF THE GAME, NOT A GAP IN
  // THE TEST. Wave clear is `game.debris.length === 0` — debris only — so at a REAL transition the
  // debris array is empty by construction; there has never been a satellite to carry across one. What
  // does cross is everything CS015 P3 pinned as carrying over: Hunters, loose garbage, powerups, and
  // (CS022 P1) particles, floaters and the tow chain. resizeWorld() still snapshots game.debris, which
  // costs nothing and is what makes it safe if that ever changes; the assertion below states the
  // premise rather than leaving it implicit.
  // ⛔ THE SHIP IS PARKED NEAR A CORNER FIRST, AND THAT IS THE WHOLE REASON THE SNAPSHOT EXISTS. At a
  // real transition the ship is wherever the wave happened to clear, not at the centre — and a ship near
  // a seam is what makes the carried bodies STRADDLERS, whose offset only shortDelta gets right (a naive
  // subtraction is out by a whole world period). With the ship at the centre nothing can straddle at
  // all, so staging it there would have tested step 1 vacuously.
  g.ship.x = 60; g.ship.y = 60; g.ship.vx = 0; g.ship.vy = 0;
  g.camera = { x: g.ship.x, y: g.ship.y };
  const place = (i, n) => {   // a ring around the SHIP, wrapped — so most of it is across a seam
    const a = (i / n) * Math.PI * 2;
    const r = 80 + (i % 5) * 90;
    return [((g.ship.x + Math.cos(a) * r) % oldW + oldW) % oldW,
            ((g.ship.y + Math.sin(a) * r) % oldH + oldH) % oldH];
  };
  for (let i = 0; i < 6; i++) { const [x, y] = place(i + 1, 9); g.hunters.push(new A.HunterSatellite(x, y, 1 + (i % 3))); }
  for (let i = 0; i < 24; i++) { const [x, y] = place(i, 24); g.garbage.push(new A.Garbage(x, y, 0, 0)); }
  for (let i = 0; i < 4; i++) { const [x, y] = place(i, 7); g.powerups.push(new A.Powerup(x, y, "health")); }
  for (let i = 0; i < 12; i++) { const [x, y] = place(i, 12); g.particles.push(new A.Particle(x, y, "#fff")); }
  for (let i = 0; i < 3; i++) { const [x, y] = place(i, 3); g.floaters.push(new A.FloatText("+100", x, y, "#fff")); }
  // Bodies pressed right up against each seam, so the snapshot has genuine straddlers to get right —
  // and their SHORT offset to the ship at world centre runs the other way round the torus.
  for (const [sx, sy] of [[2, oldH / 2], [oldW - 2, oldH / 2], [oldW / 2, 2], [oldW / 2, oldH - 2],
                          [2, 2], [oldW - 2, oldH - 2]])
    g.garbage.push(new A.Garbage(sx, sy, 0, 0));
  // A LOADED TOW CHAIN, built the way updateChain leaves one: a relaxed rope trailing the ship, each node
  // CHAIN_LINK behind the last, with px/py one frame back so it carries a real verlet velocity.
  const anchorX = g.ship.x, anchorY = g.ship.y;
  const NODES = 10, VEL = 1.25;
  g.chain.length = 0;
  for (let i = 0; i < NODES; i++) {
    const x = anchorX - (i + 1) * A.CHAIN_LINK, y = anchorY;
    g.chain.push({ x, y, px: x - VEL, py: y, spin: 0, spinRate: 0, mass: 1, towed: true });
  }
  // Measure everything that has to survive, BEFORE the move.
  const carried = [...g.hunters, ...g.garbage, ...g.powerups, ...g.particles, ...g.floaters];
  const beforeOffsets = carried.map(e => {
    const [dx, dy] = A.shortDelta(g.ship.x, g.ship.y, e.x, e.y);
    return { e, dx, dy, d: Math.hypot(dx, dy), bearing: Math.atan2(dy, dx) };
  });
  const beforeSpacing = [];
  for (let i = 1; i < g.chain.length; i++)
    beforeSpacing.push(Math.hypot(g.chain[i].x - g.chain[i - 1].x, g.chain[i].y - g.chain[i - 1].y));
  const beforeVel = g.chain.map(n => [n.x - n.px, n.y - n.py]);
  const beforeCount = carried.length;
  assert(beforeCount >= 50, `E: (setup) ${beforeCount} bodies are on the board, plus a ${NODES}-node tow`);
  assert(beforeOffsets.some(o => o.d > 480), "E: (setup) ...and some sit beyond the small world's own dmax, so the clamp branch is exercised at all");
  assert(beforeOffsets.some(o => {
    const naive = Math.hypot(o.e.x - g.ship.x, o.e.y - g.ship.y);
    return naive > o.d + 1;
  }), "E: (setup) ...and some are genuine SEAM STRADDLERS whose short offset is not the naive one");

  // ---- THE TRANSITION, through the REAL nextWave(). resizeWorld() is never called directly.
  g.debris.length = 0;   // the wave-clear condition, which is the only way a transition ever happens
  eq(g.debris.length, 0, "E: (premise) a real transition happens on an EMPTY debris array — that IS the wave-clear condition");
  A.nextWave();
  eq(g.wave, 6, "E: (setup) the real nextWave() advanced to level 6");
  eq(g.worldSize, A.WORLD_SIZE_FIELD, "E: ⛔ level 6 is the field world — the resize fired");
  const [newW, newH] = A.liveDims();
  eq(`${newW}x${newH}`, "2560x1440", "E: ⛔ ...and the live torus period really is 2560x1440 now");

  // ---- (1) NOTHING IS STRANDED OUTSIDE THE NEW PERIOD. Every carried body, and every chain node, and
  // the ship, and the dock. This is the failure the six-step pass exists to prevent.
  let outside = 0;
  const inWorld = p => p.x >= 0 && p.x < newW && p.y >= 0 && p.y < newH && Number.isFinite(p.x) && Number.isFinite(p.y);
  for (const o of beforeOffsets) if (!inWorld(o.e)) outside++;
  eq(outside, 0, "E: ⛔ NOT ONE carried body is outside the new period");
  for (const n of g.chain) if (!inWorld(n)) outside++;
  eq(outside, 0, "E: ⛔ ...nor any tow-chain node");
  assert(inWorld(g.ship), "E: ⛔ ...nor the ship");
  assert(!g.dock || inWorld(g.dock), "E: ⛔ ...nor the new level's dock");
  eq(g.ship.x, newW / 2, "E: the ship was re-centred in the NEW world (step 3)");
  eq(g.ship.y, newH / 2, "E: ...on both axes");
  eq(g.camera.x, g.ship.x, "E: ...and the camera was synced to it (step 6), so a draw() between frames can't show a stale view");
  eq(g.camera.y, g.ship.y, "E: ...on both axes");

  // ---- (2) NOTHING LANDED ON TOP OF THE SHIP. The bearing is kept exactly and the magnitude is only
  // ever REDUCED (to dmax), so nothing can arrive closer than it already was — asserted body by body,
  // and then as the blunt player-facing claim.
  // ⛔ THE CONTRACT IS EXACT AND IT IS WORTH STATING PRECISELY, BECAUSE THE OBVIOUS PHRASING IS WRONG.
  // Step 4 keeps each body's BEARING and sets its MAGNITUDE to min(d, dmax). It is NOT "nothing ends up
  // closer" — an over-range body is pulled IN to exactly dmax along its own bearing, so it does end up
  // closer, by design (FLAG-CS022-k parks that whole band in a shell at dmax). The checkable claim is
  // the arithmetic itself: new distance === min(old distance, dmax), body by body.
  const dmaxNew = Math.min(newW, newH) / 2 - 60;
  eq(dmaxNew, 660, "E: (derivation) the new world's carried-body dmax is 660");
  let wrongMag = 0, bearingMoved = 0, clamped = 0, untouched = 0;
  for (const o of beforeOffsets) {
    const [dx, dy] = A.shortDelta(g.ship.x, g.ship.y, o.e.x, o.e.y);
    const d = Math.hypot(dx, dy);
    const want = Math.min(o.d, dmaxNew);
    if (Math.abs(d - want) > 1e-6) wrongMag++;
    if (o.d > dmaxNew) clamped++; else untouched++;
    // BEARING IS KEPT EXACTLY — that is the contract; only the magnitude may move.
    let db = Math.atan2(dy, dx) - o.bearing;
    while (db > Math.PI) db -= Math.PI * 2;
    while (db < -Math.PI) db += Math.PI * 2;
    if (Math.abs(db) > 1e-9) bearingMoved++;
  }
  eq(wrongMag, 0, "E: ⛔ every carried body's new distance is exactly min(old distance, dmax) — pulled ALONG its bearing to the shell, never teleported by a period");
  eq(bearingMoved, 0, "E: ⛔ ...and every one kept its bearing exactly (step 4's contract)");
  assert(clamped > 0, `E: (control) ${clamped} bodies really were over-range and really did clamp, so the min() above is not just the identity`);
  assert(untouched > 0, `E: (control) ...and ${untouched} were inside dmax and kept their distance untouched, so it is not just the clamp either`);
  // The blunt version of the same claim, in the terms a player would put it.
  let onTop = 0;
  for (const o of beforeOffsets) {
    const r = (o.e.radius || 6) + A.SHIP_RADIUS;
    if (Math.sqrt(A.dist2(o.e, g.ship)) < r) onTop++;
  }
  eq(onTop, 0, "E: ⛔ nothing is touching the ship on the far side of the transition");

  // ---- (3) THE TOW SURVIVES. It is translated, never scaled and never clamped — a tow is RIGID
  // relative to its tug — so spacing is preserved to the bit, and each node's px/py shifted by the
  // IDENTICAL delta, which is what keeps the implied verlet velocity updateChain integrates next frame.
  eq(g.chain.length, NODES, "E: the chain still has all its nodes");
  const afterSpacing = [];
  for (let i = 1; i < g.chain.length; i++)
    afterSpacing.push(Math.hypot(g.chain[i].x - g.chain[i - 1].x, g.chain[i].y - g.chain[i - 1].y));
  for (let i = 0; i < beforeSpacing.length; i++)
    close(afterSpacing[i], beforeSpacing[i], `E: ⛔ chain link ${i}->${i + 1} kept its spacing exactly`, 1e-9);
  for (let i = 0; i < g.chain.length; i++) {
    close(g.chain[i].x - g.chain[i].px, beforeVel[i][0], `E: ⛔ node ${i}'s implied verlet vx survived the move`, 1e-9);
    close(g.chain[i].y - g.chain[i].py, beforeVel[i][1], `E: ⛔ node ${i}'s implied verlet vy survived the move`, 1e-9);
  }
  // The whole rope stays inside dmax at either size, which is why no wrapNode() call is needed: at
  // CARGO_CAP_MAX nodes it spans 480 px, comfortably inside the SMALL world's 480... and this is the
  // one number worth stating, because it is the tightest it has ever been.
  eq(24 * A.CHAIN_LINK, 480, "E: (derivation) a maximum-length tow spans 480 px");
  eq(Math.min(oldW, oldH) / 2 - 60, 480, "E: ⛔ ...which is EXACTLY the small world's dmax — the tow still fits, with nothing to spare");

  // ---- (4) AND THE SIM KEEPS RUNNING. Real frames after the move, no throw, everything finite.
  let threw = null;
  try {
    for (let i = 0; i < 240; i++) { g.ship.hp = A.SHIP_MAX_HP; A.update(1 / 60); if (i % 60 === 0) A.draw(); }
  } catch (err) { threw = err; }
  assert(!threw, `E: 240 real frames after the transition never threw${threw ? " — " + threw.stack : ""}`);
  const all = [...g.debris, ...g.hunters, ...g.garbage, ...g.powerups, ...g.chain];
  assert(all.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)), "E: ...and every surviving body's position stayed finite");
  assert(g.chain.every(n => Number.isFinite(n.px) && Number.isFinite(n.py)), "E: ...including every chain node's previous position");
})();

// ================= (F) startGame() needed no change — confirmed, not assumed ==============
(function sectionF() {
  console.log("(F) startGame(): applyWorldSize(FIELD) then nextWave() resizes on an EMPTY field");
  // The source claim first: startGame still applies the FIELD size, and does not know about the early
  // one. The resize to the small world is nextWave()'s, on a board with nothing on it to re-home.
  const sg = execOnly.slice(execOnly.indexOf("function startGame()"), execOnly.indexOf("function nextWave"));
  assert(/applyWorldSize\(WORLD_SIZE_FIELD\)/.test(sg), "F: startGame still calls applyWorldSize(WORLD_SIZE_FIELD)");
  assert(!/WORLD_SIZE_EARLY/.test(sg), "F: ⛔ ...and never mentions WORLD_SIZE_EARLY — this phase did not edit it");
  assert(!/resizeWorld/.test(sg), "F: ...nor calls resizeWorld directly");
  const nw = execOnly.slice(execOnly.indexOf("function nextWave"));
  const nwBody = nw.slice(0, nw.indexOf("\n}\n"));
  const iResize = nwBody.indexOf("resizeWorld(nextWorldSize)"), iDock = nwBody.indexOf("new Dock()");
  assert(iResize >= 0 && iDock >= 0, "F: (setup) nextWave has both the resize and the dock placement");
  assert(iResize < iDock, "F: ⛔ the resize precedes `new Dock()` — the order is load-bearing, the dock is placed ship-relative in the NEW period");

  // ...and behaviourally: a fresh run really does end up in the small world, with an empty field at the
  // moment of the resize, the ship re-centred, and the dock inside its ring in the world it landed in.
  const A = build();
  A.startGame();
  eq(A.game.wave, 1, "F: (setup) a fresh run is level 1");
  eq(A.game.worldSize, A.WORLD_SIZE_EARLY, "F: a fresh run ends up in the small world");
  const [w, h] = A.liveDims();
  eq(`${w}x${h}`, "1920x1080", "F: ...at 1920x1080");
  eq(A.game.ship.x, w / 2, "F: the ship sits at the new world's centre");
  eq(A.game.ship.y, h / 2, "F: ...on both axes");
  assert(A.game.debris.length > 0, "F: (setup) the level's satellites really did spawn");
  for (const d of A.game.debris) {
    const dist = Math.sqrt(A.dist2(d, A.game.ship));
    assert(dist >= A.SPAWN_MIN_DIST - 1e-6 && dist <= A.SPAWN_MAX_DIST + 1e-6,
      `F: ...AFTER the resize, so every one is in the ring measured in the world it is actually in (${dist.toFixed(1)})`);
  }
  const dd = Math.sqrt(A.dist2(A.game.dock, A.game.ship));
  assert(dd >= A.DOCK_MIN_DIST - 1e-6 && dd <= A.DOCK_MAX_DIST + 1e-6,
    `F: ...and the dock was placed after the re-centring, in its own ring (${dd.toFixed(1)})`);
  eq(A.game.chain.length, 0, "F: (premise) the field the resize ran over really was empty — no tow to re-home");
})();

// ================= (G) the TRAPs =====================
(function sectionG() {
  console.log("(G) TRAPs: version, no design doc, LEVERS untouched, the starfield untouched, byte-identity");
  // TRAP 1 — the version stays put. P6 owns the bump.
  // ⛔ FLIPPED BY CS026 P6 TO THE STANDING MIRROR IMAGE (the test-cs021-p4.js/test-cs025-p*.js
  // precedent). This pin asserted the version was UNCHANGED while CS026 P3 ran, and named P6 as the
  // phase that owns the bump — so P6 doing exactly that FALSIFIES the literal form by
  // instruction. Inverted, the claim is permanently true. Do not re-point it to a literal again.
  assert(X.GAME_VERSION !== "1.0.0.25", "G: ⛔ TRAP 1 — GAME_VERSION has moved off the pre-CS026-P6 baseline 1.0.0.25");

  // TRAP 4 — the starfield was not touched. WORLD_SIZE_MAX still reads WORLD_SIZE_ORBIT, so the sky is
  // still generated once at the LARGEST table size and filtered per world; a SMALLER world is simply the
  // easy case for that filter, which is why WORLD_SIZE_EARLY is deliberately absent from the Math.max.
  eq(X.WORLD_SIZE_MAX, Math.max(X.WORLD_SIZE_FIELD, X.WORLD_SIZE_ORBIT), "G: ⛔ TRAP 4 — WORLD_SIZE_MAX is still max(FIELD, ORBIT)");
  eq(X.WORLD_SIZE_MAX, 9, "G: ...which is still 9, the orbit slot");
  assert(X.WORLD_SIZE_EARLY < X.WORLD_SIZE_MAX, "G: ...and WORLD_SIZE_EARLY could not have changed it — it is smaller than both operands");
  const maxDecl = execOnly.match(/const WORLD_SIZE_MAX = [^;]*;/);
  assert(maxDecl && !/WORLD_SIZE_EARLY/.test(maxDecl[0]), "G: ⛔ ...and the declaration itself does not mention WORLD_SIZE_EARLY");
  eq(X.STAR_COUNT, Math.round(X.STAR_DENSITY * X.WORLD_SIZE_MAX), "G: STAR_COUNT is still STAR_DENSITY per screen at the largest table size");
  eq(X.STAR_DENSITY, 80, "G: STAR_DENSITY untouched at 80");
  eq(X.stars.length, X.STAR_COUNT, "G: the sky is still generated once, in full");
  {
    // The filter really does narrow for the small world, and it is a strict SUBSET of the same sky —
    // not a fresh roll. That is the property that makes a transition look stable.
    const A = build();
    atLevel(A, 6);
    const fieldActive = A.starsActive.length;
    const fieldSet = new Set(A.starsActive);
    atLevel(A, 1);
    const earlyActive = A.starsActive.length;
    assert(earlyActive < fieldActive, `G: the small world lights fewer stars (${earlyActive} vs ${fieldActive}) — the per-world filter ran`);
    assert(A.starsActive.every(st => fieldSet.has(st)), "G: ⛔ ...and every one of them is one of the field world's — a sub-region of the SAME sky, not a re-roll");
    assert(A.starsActive.every(st => st.x < 1920 && st.y < 1080), "G: ...all inside the small world's period");
  }

  const ps = parentSource(PARENT_SHA);
  if (!ps) {
    skip("§G's parent-commit pins: LEVERS/leverState byte-identity, resizeWorld/startGame byte-identity");
  } else {
    const OLD = buildFrom(ps, { exportList: [
      "LEVERS", "leverState", "DEBUG_ENTRIES", "GAME_VERSION",
      "SPAWN_MIN_DIST", "SPAWN_MAX_DIST", "DOCK_MIN_DIST", "DOCK_MAX_DIST",
      "WORLD_SIZE_FIELD", "WORLD_SIZE_ORBIT", "WORLD_SIZE_MAX", "STAR_COUNT", "STAR_DENSITY"] });

    // ⛔ TRAP 3 — LEVERS AND leverState ARE BYTE-IDENTICAL TO THE PARENT. The world size is NOT a lever
    // and must not become one. Asserted per entry, so a retuned floor/ceil/steps anywhere fails here
    // rather than being absorbed by a count — and then per level, 1..200, on the odometer's OUTPUT.
    eq(X.LEVERS.length, OLD.LEVERS.length, "G: ⛔ TRAP 3 — the lever count is unchanged");
    eq(X.LEVERS.map(l => l.id).join(","), OLD.LEVERS.map(l => l.id).join(","),
      "G: ⛔ TRAP 3 — the same levers, in the same order");
    const liveById = Object.fromEntries(X.LEVERS.map(l => [l.id, l]));
    for (const lev of OLD.LEVERS)
      eq(JSON.stringify(liveById[lev.id]), JSON.stringify(lev),
        `G: ⛔ TRAP 3 — ${lev.id} is byte-identical to the parent, field for field`);
    let moved = 0;
    for (let w = 1; w <= 200; w++) {
      const before = OLD.leverState(w), now = X.leverState(w);
      for (const k of Object.keys(before)) if (before[k] !== now[k]) moved++;
      for (const k of Object.keys(now)) if (!(k in before)) moved++;
    }
    eq(moved, 0, "G: ⛔ TRAP 3 — leverState is identical to the parent at EVERY level 1..200, key for key");

    // The flat rings did not move — against the parent, not against a remembered literal.
    for (const k of ["SPAWN_MIN_DIST", "SPAWN_MAX_DIST", "DOCK_MIN_DIST", "DOCK_MAX_DIST"])
      eq(X[k], OLD[k], `G: ⛔ ${k} matches the parent exactly — the rings were checked and left FLAT`);
    // TRAP 4 against the parent too, and TRAP 1.
    for (const k of ["WORLD_SIZE_FIELD", "WORLD_SIZE_ORBIT", "WORLD_SIZE_MAX", "STAR_COUNT", "STAR_DENSITY"])
      eq(X[k], OLD[k], `G: ⛔ TRAP 4 — ${k} matches the parent exactly`);
    // ⛔ FLIPPED BY CS026 P6 TO THE STANDING MIRROR IMAGE, matching the literal TRAP 1 pin in this
    // same file. The claim was "CS026 P3 did not move the version off ITS parent"; P6 owns the bump and
    // moves it off that same parent BY INSTRUCTION, so the equality is permanently false and the
    // inequality permanently true. Do not re-point either form to a literal version again.
    assert(X.GAME_VERSION !== OLD.GAME_VERSION,
      "G: ⛔ TRAP 1 — the version has moved off P3's parent (CS026 P6 owns that bump)");

    // TRAP 5 — the two functions this phase must NOT have changed, pinned on their EXECUTABLE source.
    // ⛔ The standing strip idiom replaces a trailing `//…` FIRST, which turns a whole-line comment into
    // a whitespace-only line rather than removing it — so blank lines have to go too, or an ADDED
    // comment still shows up as an added (empty) line and the pin is not one.
    const bodyOf = (src, sig) => { const i = src.indexOf(sig); return src.slice(i, src.indexOf("\n}\n", i)); };
    const strip = t => t.split("\n").map(l => l.replace(/\s\/\/.*$/, ""))
      .filter(l => l.trim() !== "" && !l.trim().startsWith("//")).join("\n");
    eq(bodyOf(scriptSrc, "function resizeWorld(newSize) {"), bodyOf(ps, "function resizeWorld(newSize) {"),
      "G: ⛔ TRAP 5 — resizeWorld() is BYTE-IDENTICAL to the parent, comments and all: this phase gave it a CALLER, not an edit");
    eq(bodyOf(scriptSrc, "function applyWorldSize(size) {"), bodyOf(ps, "function applyWorldSize(size) {"),
      "G: ⛔ TRAP 5 — applyWorldSize() likewise");
    // NARROWED BY CS029 P4 — startGame() picks up exactly one new reset line, `game.deliveryTicker =
    // null;` (§6.3, the CS016 P3 both-places rule already applied to `game.deliveryCount`/
    // `game.offloadTimer` right above it). Filtered out here rather than weakening the comparison, so
    // any OTHER change to startGame() still fails this trap.
    // NARROWED AGAIN BY CS030 P1 — the achievement unlock collector adds two more CS016-P3-rule reset
    // lines, `game.pendingAch = [];` and `game.celebration = null;`. Same treatment: filtered out by
    // name, not a weakened comparison.
    const DROPPED_LINES = new Set([
      "game.deliveryTicker = null;",
      "game.pendingAch = [];",
      "game.celebration = null;",
    ]);
    const dropDeliveryTickerLine = t => t.split("\n").filter(l => !DROPPED_LINES.has(l.trim())).join("\n");
    eq(dropDeliveryTickerLine(strip(bodyOf(scriptSrc, "function startGame()"))), strip(bodyOf(ps, "function startGame()")),
      "G: ⛔ TRAP 5 — startGame()'s EXECUTABLE source is unchanged apart from CS029 P4's deliveryTicker reset and CS030 P1's pendingAch/celebration resets");
    // worldSizeFor is the one function that DID change, which is what makes the three pins above mean
    // something: the instrument can tell a changed body from an unchanged one.
    assert(strip(bodyOf(scriptSrc, "function worldSizeFor(level) {")) !== strip(bodyOf(ps, "function worldSizeFor(level) {")),
      "G: (non-vacuous) ...while worldSizeFor's executable source DID change, so the pins above are doing work");
    // And the comment at worldSizeFor no longer describes the per-level scheme as hypothetical.
    const wsfComment = scriptSrc.slice(scriptSrc.lastIndexOf("// CS022 P1 (FORK-CS022-C)"), scriptSrc.indexOf("function worldSizeFor(level) {"));
    assert(/CS026 P3/.test(wsfComment), "G: the comment above worldSizeFor names CS026 P3 — the seam is documented as USED, not hypothetical");
    assert(!/`level` is now unused/.test(wsfComment), "G: ⛔ ...and no longer claims the level parameter is unused");
  }

  // TRAP 2 + the scope pin — written against this phase's OWN COMMIT, resolved by subject inside the
  // bounded PARENT_SHA..HEAD range (§4.1). Before the commit exists it falls back to the working tree
  // and says so; two matches is AMBIGUOUS and is a failure, never a skip.
  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  let changed = null, provisional = false, ambiguous = false;
  if (shas === null) {
    /* no git history: skipped below */
  } else if (shas.length === 1) {
    changed = changedFiles(PARENT_SHA, shas[0]);
  } else if (shas.length === 0) {
    changed = changedFiles(PARENT_SHA, null);
    provisional = changed !== null;
  } else {
    ambiguous = true;
    failed++;
    console.error(`  FAIL: G: TRAP 2 — ${shas.length} commits match "${PHASE_SUBJECT}"; the pin is ambiguous`);
  }
  if (!changed) {
    if (!ambiguous) skip("§G's TRAP 2 scope pin");
  } else {
    if (provisional) console.log("  (TRAP 2 measured against the WORKING TREE — this phase is not committed yet)");
    // ⛔ TRAP 2 — NO DESIGN DOC TOUCHED. §2 already carries this spec; the GDD §2.11.1 world-size rewrite
    // is P6's. STATUS.md is the build-reality doc, updated every session by standing instruction, and is
    // deliberately outside this pin.
    const designDocs = changed.filter(f => f.endsWith(".md") && f !== "STATUS.md");
    eq(designDocs.join(","), "", `G: ⛔ TRAP 2 — no design doc was touched (found: ${designDocs.join(", ") || "none"})`);
    const outside = outsideScope(changed);
    eq(outside.join(","), "", `G: this phase touched nothing outside the game file, scratchpad/ and STATUS.md (found: ${outside.join(", ") || "none"})`);
    assert(changed.includes("asteroids-deluxe.html"), "G: (setup) the pin really is looking at this phase's diff — the game file is in it");
    assert(changed.includes("scratchpad/test-cs026-p3.js"), "G: (setup) ...including this test file");
    // A POSITIVE pin on the deferral: the GDD passage P6 owes is still there, still describing one world
    // size, which is what makes it findable rather than silently already-correct.
    const gdd = fs.readFileSync(path.join(repoRoot, "ORBITAL-OVERHAUL-GDD.md"), "utf8");
    assert(/2560/.test(gdd), "G: ⛔ TRAP 2 — the GDD still describes the world as 2560-wide; the §2.11.1 rewrite is P6's");
  }
})();

// ================= (H) headless smoke =====================
(function sectionH() {
  console.log("(H) AudioSys.ctx === null smoke: a real run that crosses the 5 -> 6 boundary");
  const A = build();
  eq(A.AudioSys.ctx, null, "H: (setup) no audio context headless");
  atLevel(A, 3);
  const sizes = new Set();
  let threw = null;
  try {
    for (let i = 0; i < 4000; i++) {
      A.game.ship.hp = A.SHIP_MAX_HP;    // keep the run in "playing" — the resize is a live-sim property
      A.update(1 / 60);
      if (i % 200 === 0) A.draw();
      sizes.add(A.game.worldSize);
      // Clear the field periodically so the run really advances through the real wave-clear path.
      if (A.game.debris.length && i % 90 === 0) A.game.debris.length = 0;
    }
  } catch (e) { threw = e; }
  assert(!threw, `H: 4000 frames of real update()/draw() never threw${threw ? " — " + threw.stack : ""}`);
  eq(A.game.state, "playing", "H: (premise) the run never left \"playing\", so the transition really happened in a live sim");
  assert(A.game.wave > 6, `H: ...and it crossed the boundary (reached level ${A.game.wave})`);
  eq([...sizes].sort().join(","), "2.25,4", "H: ⛔ ...running in BOTH worlds along the way, and no third size");
  eq(A.game.worldSize, A.WORLD_SIZE_FIELD, "H: ...ending in the field world");
  const [w, h] = A.liveDims();
  const bodies = [...A.game.debris, ...A.game.hunters, ...A.game.garbage, ...A.game.powerups, ...A.game.chain];
  // ⛔ CORRECTED BY CS028 P1 — this assertion was WRONG ABOUT THE BUILD'S CONTRACT and passed only
  // because the pinned seed happened not to land on the counter-example. `wrap()` folds a body only
  // once it is more than 60 px past an edge, so a live body legitimately sits up to 60 px OUTSIDE
  // [0, w) at any moment; the strict `p.x < w` form asserted an invariant the game never had.
  // Measured at HEAD (a5ef9f4, this file untouched): seed 9 ends with a Powerup at y = -22.7 and the
  // pinned seed's own run under a different stream position ends with Garbage at exactly y = 1440 —
  // both inside the margin, both failing the old bound. CS028 P1 shifted the Math.random stream (the
  // split path spends one fewer roll per child and one more per kill), which is what surfaced it.
  // The claim §H cares about is unchanged and is what is asserted now: resizeWorld left nothing
  // STRANDED — every body is within one wrap margin of the world it ended in, not a world away.
  const mrg = (scriptSrc.match(/function wrap\(obj\) \{\s*\n\s*if \(obj\.x < -(\d+)\)/) || [])[1];
  assert(mrg !== undefined, "H: (setup) wrap()'s fold margin was read off the build, not hardcoded");
  const M = Number(mrg);
  const stray = bodies.filter(p => !(p.x >= -M && p.x <= w + M && p.y >= -M && p.y <= h + M));
  eq(stray.length, 0,
    `H: every surviving body is within wrap()'s ${M} px margin of the world the run ended in` +
    (stray.length ? ` (worst ${JSON.stringify({ x: +stray[0].x.toFixed(1), y: +stray[0].y.toFixed(1) })} vs ${w}x${h})` : ""));
})();

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed ? 1 : 0);
