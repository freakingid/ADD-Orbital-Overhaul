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
//  (D) STAR_COUNT is the area-derived value for the new 2560x1440 world (density preserved).

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
  "STAR_DENSITY", "STAR_COUNT", "dist2"];

const wrapped = new Function(
  "window", "document", "navigator", "performance", "requestAnimationFrame", "localStorage",
  scriptSrc + `\nreturn { ${returnList.join(", ")} };`
);
const G = wrapped(windowStub, documentStub, navigatorStub, performanceStub, rafStub, global.localStorage);
const { startGame, game, nextWave, Dock, WORLD_W, WORLD_H, VIEW_W, VIEW_H,
  SPAWN_MIN_DIST, SPAWN_MAX_DIST, DOCK_MIN_DIST, DOCK_MAX_DIST,
  STAR_DENSITY, STAR_COUNT, dist2 } = G;

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ok - ${msg}`); }
  else { failed++; console.log(`  FAIL - ${msg}`); }
}

// =====================================================================
console.log("(A) World dimensions + clamped spawn/dock constants");
assert(WORLD_W === 2560, "A: WORLD_W is 2560");
assert(WORLD_H === 1440, "A: WORLD_H is 1440");
assert(SPAWN_MIN_DIST === 220, "A: SPAWN_MIN_DIST unchanged at 220");
assert(SPAWN_MAX_DIST === 640, "A: SPAWN_MAX_DIST clamped to 640");
assert(DOCK_MIN_DIST === 260, "A: DOCK_MIN_DIST unchanged at 260");
assert(DOCK_MAX_DIST === 620, "A: DOCK_MAX_DIST clamped to 620");
const bindingLimit = Math.min(WORLD_W, WORLD_H) / 2 - 60;
assert(SPAWN_MAX_DIST <= bindingLimit, "A: SPAWN_MAX_DIST within min(WORLD_W,WORLD_H)/2-60");
assert(DOCK_MAX_DIST < SPAWN_MAX_DIST, "A: DOCK_MAX_DIST stays below SPAWN_MAX_DIST");

// =====================================================================
console.log("(B) Real nextWave() debris spawns land within the clamped ring, many samples");
let debrisOk = true, debrisMinSeen = Infinity, debrisMaxSeen = 0;
for (let trial = 0; trial < 25; trial++) {
  startGame();
  game.state = "playing"; game.paused = false;
  game.ship.x = Math.random() * WORLD_W;
  game.ship.y = Math.random() * WORLD_H;
  game.wave = 1 + Math.floor(Math.random() * 6);
  game.debris = [];
  nextWave();
  for (const d of game.debris) {
    const dist = Math.sqrt(dist2(d, game.ship));
    debrisMinSeen = Math.min(debrisMinSeen, dist);
    debrisMaxSeen = Math.max(debrisMaxSeen, dist);
    if (dist < SPAWN_MIN_DIST - 1e-6 || dist > SPAWN_MAX_DIST + 1e-6) debrisOk = false;
  }
}
assert(debrisOk, `B: every sampled debris spawn within [${SPAWN_MIN_DIST}, ${SPAWN_MAX_DIST}] (saw [${debrisMinSeen.toFixed(1)}, ${debrisMaxSeen.toFixed(1)}])`);

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
console.log("(D) STAR_COUNT is the area-derived value for the new world size (density preserved)");
const expectedStarCount = Math.round(STAR_DENSITY * (WORLD_W * WORLD_H) / (VIEW_W * VIEW_H));
assert(STAR_COUNT === expectedStarCount, `D: STAR_COUNT (${STAR_COUNT}) matches STAR_DENSITY*area/viewport formula (${expectedStarCount})`);
assert(STAR_DENSITY === 80, "D: STAR_DENSITY untouched at 80 (P1 v3.0 value)");

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
