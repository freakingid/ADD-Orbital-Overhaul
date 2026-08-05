// Headless test for v3.1 Phase 1 — shrink the toroidal world to 2560x1440 + clamp spawn rings.
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator, eval the REAL <script> block, then
// drive the actual spawn path against the real code — no reimplementation under test.
//
//   node scratchpad/test-v31-world.js
//
// Checks:
//  (A) WORLD_W/WORLD_H are 2560/1440; SPAWN_MAX_DIST/DOCK_MAX_DIST clamped; mins unchanged.
//  (B) Many real nextWave() debris spawns land within [SPAWN_MIN_DIST, SPAWN_MAX_DIST] of the ship.
//  (C) Many real Dock spawns land within [DOCK_MIN_DIST, DOCK_MAX_DIST] of the ship.
//  (D) STAR_COUNT is the area-derived value for the LARGEST world size (density preserved).
//
// REPOINTED BY CS022 P1. WORLD_W/WORLD_H are `let` now and change with the level's archetype
// (worldDims(WORLD_SIZE_FIELD) = 2560x1440, worldDims(WORLD_SIZE_ORBIT) = 3840x2160 as of CS023 P1), so:
//   * this file's destructured WORLD_W/WORLD_H are a SNAPSHOT taken at module load — i.e. the FIELD
//     size, which is what the game boots in and what startGame() re-applies. Every place that needs
//     the size the sim is CURRENTLY running at goes through liveDims() below instead.
//   * (A) still pins 2560/1440, but now as "the FIELD-level size", derived from worldDims() rather
//     than restated as bare literals.
//   * (D)'s area derivation moves to WORLD_SIZE_MAX, since `stars` is generated once for the largest
//     world in the table and filtered per world into starsActive (spec §4.3 / FLAG-CS022-d).

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

const noopCtx = new Proxy({}, { get() { return () => {}; }, set() { return true; } });
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub };

const noAudio = new Proxy({ state: "running", currentTime: 0, sampleRate: 44100,
  destination: {}, createGain: () => noAudio, createBuffer: () => ({ getChannelData: () => new Float32Array(1) }) },
  { get(t, p) { return p in t ? t[p] : () => noAudio; } });
function FakeAudioContext() { return noAudio; }
const windowStub = { addEventListener() {}, innerWidth: 1280, innerHeight: 720,
  AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext };
const performanceStub = { now: () => 0 };
const rafStub = () => 0;
const navigatorStub = { getGamepads: () => [] };
const lsStore = {};
global.localStorage = { getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); }, removeItem: k => { delete lsStore[k]; } };

const returnList = ["startGame", "update", "draw", "game", "nextWave", "Dock",
  "WORLD_W", "WORLD_H", "VIEW_W", "VIEW_H",
  "SPAWN_MIN_DIST", "SPAWN_MAX_DIST", "DOCK_MIN_DIST", "DOCK_MAX_DIST",
  "STAR_DENSITY", "STAR_COUNT", "dist2",
  "levelDef",   // CS021 P1: section (B) is archetype-aware now
  // CS022 P1: the world-size seam. worldDims + game.worldSize are how a test reads the size the sim
  // is CURRENTLY running at — the destructured WORLD_W/WORLD_H below are only a load-time snapshot.
  "worldDims", "worldSizeFor", "WORLD_SIZE_FIELD", "WORLD_SIZE_ORBIT", "WORLD_SIZE_MAX"];

const wrapped = new Function(
  "window", "document", "navigator", "performance", "requestAnimationFrame", "localStorage",
  scriptSrc + `\nreturn { ${returnList.join(", ")} };`
);
const G = wrapped(windowStub, documentStub, navigatorStub, performanceStub, rafStub, global.localStorage);
const { startGame, game, nextWave, Dock, WORLD_W, WORLD_H, VIEW_W, VIEW_H,
  SPAWN_MIN_DIST, SPAWN_MAX_DIST, DOCK_MIN_DIST, DOCK_MAX_DIST,
  STAR_DENSITY, STAR_COUNT, dist2, levelDef,
  worldDims, worldSizeFor, WORLD_SIZE_FIELD, WORLD_SIZE_ORBIT, WORLD_SIZE_MAX } = G;

// CS022 P1: the LIVE torus period, read off the game's own state rather than a stale snapshot.
const liveDims = () => worldDims(game.worldSize);

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ok - ${msg}`); }
  else { failed++; console.log(`  FAIL - ${msg}`); }
}

// =====================================================================
console.log("(A) World dimensions + clamped spawn/dock constants");
// REPOINTED BY CS022 P1: 2560x1440 is now "the FIELD-level world", not "the world". The claim is
// unweakened — it is the size the game boots in, the size startGame() re-applies, and the size every
// one of the 42 field levels runs at — but it is stated as the size table's own value rather than a
// bare literal, so a retune of WORLD_SIZE_FIELD fails loudly here instead of silently.
const [FIELD_W, FIELD_H] = worldDims(WORLD_SIZE_FIELD);
assert(WORLD_W === 2560, "A: WORLD_W boots at 2560 (the FIELD-level world)");
assert(WORLD_H === 1440, "A: WORLD_H boots at 1440 (the FIELD-level world)");
assert(FIELD_W === 2560 && FIELD_H === 1440, "A: worldDims(WORLD_SIZE_FIELD) is exactly 2560x1440");
assert(WORLD_W === FIELD_W && WORLD_H === FIELD_H, "A: the boot dimensions ARE the field-level dimensions");
const [ORBIT_W, ORBIT_H] = worldDims(WORLD_SIZE_ORBIT);
// REPOINTED BY CS023 P1: WORLD_SIZE_ORBIT 16 -> 9 (spec §1.3/C2), so the orbit torus is 3840x2160, not
// 5120x2880. A VALUE change, not a rename — the symbol is read, only the number it resolves to moved.
assert(ORBIT_W === 3840 && ORBIT_H === 2160, "A: worldDims(WORLD_SIZE_ORBIT) is exactly 3840x2160");
assert(ORBIT_W === VIEW_W * Math.sqrt(WORLD_SIZE_ORBIT) && ORBIT_H === VIEW_H * Math.sqrt(WORLD_SIZE_ORBIT),
  "A: ...and that is the sqrt-of-area derivation, not a literal that happens to agree");
assert(worldSizeFor(1) === WORLD_SIZE_FIELD && worldSizeFor(3) === WORLD_SIZE_ORBIT,
  "A: worldSizeFor picks the size off the level's archetype (level 1 field, level 3 orbit)");
assert(SPAWN_MIN_DIST === 220, "A: SPAWN_MIN_DIST unchanged at 220");
assert(SPAWN_MAX_DIST === 640, "A: SPAWN_MAX_DIST clamped to 640");
assert(DOCK_MIN_DIST === 260, "A: DOCK_MIN_DIST unchanged at 260");
assert(DOCK_MAX_DIST === 620, "A: DOCK_MAX_DIST clamped to 620");
// CS022 P1 (spec C5/§7): the two flat constants must clear the reachable-radius limit at BOTH sizes,
// since neither scales with the world. 660 at field size, 1020 at orbit size.
// REPOINTED BY CS023 P1 (spec C7): the orbit figure was 1380 at WORLD_SIZE_ORBIT 16 and is 1020 at 9.
// This is the same `dmax` resizeWorld() clamps carried bodies to, so the drop is what makes C7's
// corrected grow comment true — a materially larger band of carried bodies now clamps on the GROW too.
const bindingLimit = Math.min(FIELD_W, FIELD_H) / 2 - 60;
const orbitLimit   = Math.min(ORBIT_W, ORBIT_H) / 2 - 60;
assert(bindingLimit === 660 && orbitLimit === 1020, "A: the reachable-radius limit is 660 at field size and 1020 at orbit size");
assert(SPAWN_MAX_DIST <= bindingLimit, "A: SPAWN_MAX_DIST within min(W,H)/2-60 at the FIELD size (the binding one)");
assert(SPAWN_MAX_DIST <= orbitLimit && DOCK_MAX_DIST <= orbitLimit,
  "A: both flat spawn/dock maxima also clear the ORBIT size's limit (spec §7 — they do not scale)");
assert(DOCK_MAX_DIST < SPAWN_MAX_DIST, "A: DOCK_MAX_DIST stays below SPAWN_MAX_DIST");

// =====================================================================
console.log("(B) Real nextWave() debris spawns land within the clamped ring, many samples");
// REPOINTED BY CS021 P1: nextWave() has two archetypes now (FORK-CS021-E). A FIELD level still scatters
// into the [SPAWN_MIN_DIST, SPAWN_MAX_DIST] ring around the SHIP — the original claim, unweakened and
// still the majority of the samples. An ORBIT level (every 3rd) lays concentric rings around the DOCK
// instead, so it is checked against ITS world-fit invariant rather than skipped: every satellite sits at
// exactly its ring radius from the dock measured WRAP-AWARE (which is the property that would break if
// the generator ever used naive arithmetic), and the outermost satellite edge stays inside the world's
// wrap-clean radius budget, min(WORLD_W, WORLD_H)/2 - 20. Both archetypes are sampled; neither is
// allowed to go unchecked, and the sample counts are asserted so a schedule change can't empty either.
//
// REPOINTED BY CS022 P3 (spec §1.4, FORK-CS022-F): an orbit level now ALSO spawns levelDef(n-1).junkCount
// ordinary scatter satellites on top of its rings, so "which invariant applies" is a PER-ENTITY question
// (does it carry orbit state?) and no longer a per-LEVEL one. Dispatching on the level, as this loop used
// to, fed the field component's undefined orbitRadius into the ring check and produced NaN. Both
// populations are now checked with their own rule, on both archetypes, and both sample counts are pinned.
let debrisOk = true, debrisMinSeen = Infinity, debrisMaxSeen = 0;
let orbitOk = true, orbitEdgeSlackMin = Infinity, orbitSamples = 0, fieldSamples = 0, orbitWorstErr = 0;
let orbitFieldSamples = 0;   // CS022 P3: scatter satellites sampled ON an orbit level (the field component)
let sizeOk = true;
for (let trial = 0; trial < 25; trial++) {
  startGame();
  game.state = "playing"; game.paused = false;
  // startGame() has just re-applied the FIELD size, so the snapshot is the live period at this point.
  game.ship.x = Math.random() * WORLD_W;
  game.ship.y = Math.random() * WORLD_H;
  game.wave = 1 + Math.floor(Math.random() * 6);
  game.debris = [];
  nextWave();
  // REPOINTED BY CS022 P1: the budget is now read off the LIVE world, not the load-time snapshot —
  // nextWave() has just resized to 3840x2160 if this turned out to be an orbit level (CS023 P1).
  const [liveW, liveH] = liveDims();
  const orbitEdgeBudget = Math.min(liveW, liveH) / 2 - 20;
  if (game.worldSize !== worldSizeFor(game.wave)) sizeOk = false;
  for (const d of game.debris) {
    if (d.orbitCenter) {   // CS022 P3: per-ENTITY, not per-level — an orbit level carries both populations
      orbitSamples++;
      // Wrap-aware distance to the dock must be exactly the satellite's own ring radius.
      const err = Math.abs(Math.sqrt(dist2(d, game.dock)) - d.orbitRadius);
      orbitWorstErr = Math.max(orbitWorstErr, err);
      if (!(d.orbitRadius > 0) || err > 1e-6) orbitOk = false;
      orbitEdgeSlackMin = Math.min(orbitEdgeSlackMin, orbitEdgeBudget - (d.orbitRadius + d.radius));
    } else {
      fieldSamples++;
      if (levelDef(game.wave).archetype === "orbit") orbitFieldSamples++;
      const dist = Math.sqrt(dist2(d, game.ship));
      debrisMinSeen = Math.min(debrisMinSeen, dist);
      debrisMaxSeen = Math.max(debrisMaxSeen, dist);
      if (dist < SPAWN_MIN_DIST - 1e-6 || dist > SPAWN_MAX_DIST + 1e-6) debrisOk = false;
    }
  }
}
assert(fieldSamples > 0, `B: (control) the sweep actually sampled SCATTER spawns (${fieldSamples} pieces)`);
assert(debrisOk, `B: every sampled SCATTER debris spawn within [${SPAWN_MIN_DIST}, ${SPAWN_MAX_DIST}] (saw [${debrisMinSeen.toFixed(1)}, ${debrisMaxSeen.toFixed(1)}])`);
assert(orbitSamples > 0, `B: (control) the sweep actually sampled RAIL-BORNE satellites (${orbitSamples} satellites)`);
// CS022 P3 control: the scatter samples above are no longer field-levels-only — an orbit level
// contributes its fieldCount component to exactly the same [SPAWN_MIN_DIST, SPAWN_MAX_DIST] claim.
assert(orbitFieldSamples > 0,
  `B: (control) at least one ORBIT level's field component was sampled and checked by the scatter rule (${orbitFieldSamples} pieces)`);
assert(orbitOk, `B: every sampled ORBIT satellite sits at exactly its ring radius from the dock, wrap-aware (worst error ${orbitWorstErr.toExponential(2)} px)`);
assert(orbitEdgeSlackMin >= 0, "B: outermost ORBIT satellite edge stays within the LIVE world's wrap-clean budget");
assert(sizeOk, "B: every sampled level ran at the world size its archetype asks for (CS022 P1)");

// =====================================================================
console.log("(C) Real Dock spawns land within the clamped ring, many samples");
let dockOk = true, dockMinSeen = Infinity, dockMaxSeen = 0;
for (let trial = 0; trial < 200; trial++) {
  startGame();
  game.ship.x = Math.random() * WORLD_W;
  game.ship.y = Math.random() * WORLD_H;
  const d = new Dock();
  const dist = Math.sqrt(dist2(d, game.ship));
  dockMinSeen = Math.min(dockMinSeen, dist);
  dockMaxSeen = Math.max(dockMaxSeen, dist);
  if (dist < DOCK_MIN_DIST - 1e-6 || dist > DOCK_MAX_DIST + 1e-6) dockOk = false;
}
assert(dockOk, `C: every sampled dock spawn within [${DOCK_MIN_DIST}, ${DOCK_MAX_DIST}] (saw [${dockMinSeen.toFixed(1)}, ${dockMaxSeen.toFixed(1)}])`);

// =====================================================================
console.log("(D) STAR_COUNT is the area-derived value for the LARGEST world size (density preserved)");
// REPOINTED BY CS022 P1 (spec §4.3, FLAG-CS022-d): `stars` is generated ONCE, for WORLD_SIZE_MAX, and
// applyWorldSize() filters it into starsActive per world. The area formula is unchanged — only the
// area it is evaluated over moved, because an area derived from the now-mutable WORLD_W/WORLD_H and
// cached at module load is exactly the bug this changeset had to remove.
const [MAX_W, MAX_H] = worldDims(WORLD_SIZE_MAX);
const expectedStarCount = Math.round(STAR_DENSITY * (MAX_W * MAX_H) / (VIEW_W * VIEW_H));
assert(STAR_COUNT === expectedStarCount, `D: STAR_COUNT (${STAR_COUNT}) matches STAR_DENSITY*maxArea/viewport formula (${expectedStarCount})`);
assert(WORLD_SIZE_MAX === Math.max(WORLD_SIZE_FIELD, WORLD_SIZE_ORBIT),
  "D: WORLD_SIZE_MAX really is the largest size in the table (so no world can ever want more stars than exist)");
assert(STAR_COUNT === Math.round(STAR_DENSITY * WORLD_SIZE_MAX),
  "D: ...which is just STAR_DENSITY per viewport-sized screen, WORLD_SIZE_MAX screens of them");
assert(STAR_DENSITY === 80, "D: STAR_DENSITY untouched at 80 (P1 v3.0 value)");

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
