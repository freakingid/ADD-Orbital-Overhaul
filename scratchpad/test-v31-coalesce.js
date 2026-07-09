// Headless test for v3.1 Phase 3 — garbage mutual magnetism + coalescence -> Hunter formation.
// Follows the repo test convention: stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, then drive the actual coalesceGarbage()/update()/destroyDebris code against real
// entities — no reimplementation of the logic under test.
//
//   node scratchpad/test-v31-coalesce.js
//
// Checks (per the Phase-3 prompt):
//  (1) a piece can't merge before 1 s (inactive), can after (active) — via the real update() countdown.
//  (2) two active pieces in contact merge — survivor velocity == exact vector sum, pieces == 2.
//  (3) twelve active pieces coalesce to exactly one new Hunter (hunters +1, clump all dead,
//      AudioSys.hunterborn called exactly once).
//  (4) a merge across the world seam works (wrap-aware dist2/shortDelta).
//  (5) merging does NOT bump game.stats.garbageDecayed (coalescing is a distinct fate; Waste Not safe).
//  (6) a pieces>1 clump hooks as a single mass-1.0 chain node (FORK-2), driven through the real update().
//  Plus: emission sites + fromNode inherit the coalesce defaults; attraction is gated by the 1 s delay.

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

const returnList = ["startGame", "update", "game", "coalesceGarbage", "Garbage",
  "DebrisSatellite", "HunterSatellite", "destroyDebris", "AudioSys",
  "GARBAGE_COALESCE_DELAY", "GARBAGE_MERGE_DIST", "GARBAGE_MAGNET_RANGE",
  "GARBAGE_MAGNET_PULL", "HUNTER_COALESCE_COUNT", "GARBAGE_PICKUP", "WORLD_W", "WORLD_H"];

const wrapped = new Function(
  "window", "document", "navigator", "performance", "requestAnimationFrame", "localStorage",
  scriptSrc + `\nreturn { ${returnList.join(", ")} };`
);
const G = wrapped(windowStub, documentStub, navigatorStub, performanceStub, rafStub, global.localStorage);
const { startGame, update, game, coalesceGarbage, Garbage, DebrisSatellite, HunterSatellite,
  destroyDebris, AudioSys, GARBAGE_COALESCE_DELAY, GARBAGE_MERGE_DIST, GARBAGE_MAGNET_RANGE,
  GARBAGE_MAGNET_PULL, HUNTER_COALESCE_COUNT, GARBAGE_PICKUP, WORLD_W, WORLD_H } = G;

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ok - ${msg}`); }
  else { failed++; console.log(`  FAIL - ${msg}`); }
}

// Instrument the real hunterborn cue so we can count how many times coalescence fires it.
let hunterbornCalls = 0;
AudioSys.hunterborn = () => { hunterbornCalls++; };

function beginPlaying() {
  startGame();
  game.state = "playing"; game.paused = false;
  game.debris = []; game.hunters = []; game.garbage = []; game.chain = [];
}

// =====================================================================
console.log("(0) config + inheritance: constants sane; emission sites + fromNode inherit defaults");
assert(GARBAGE_COALESCE_DELAY === 1.0, `0: GARBAGE_COALESCE_DELAY is 1.0 (got ${GARBAGE_COALESCE_DELAY})`);
assert(GARBAGE_MERGE_DIST === 12, `0: GARBAGE_MERGE_DIST is 12 (got ${GARBAGE_MERGE_DIST})`);
assert(HUNTER_COALESCE_COUNT === 12, `0: HUNTER_COALESCE_COUNT is 12 (got ${HUNTER_COALESCE_COUNT})`);
assert(GARBAGE_MAGNET_RANGE > GARBAGE_MERGE_DIST, "0: magnet range exceeds merge distance");
{
  const fresh = new Garbage(100, 100);
  assert(fresh.pieces === 1, "0: a new Garbage starts at pieces === 1");
  assert(fresh.coalesceDelay === GARBAGE_COALESCE_DELAY, "0: a new Garbage starts inert (coalesceDelay == DELAY)");
  const node = { x: 50, y: 50, px: 50, py: 50, spin: 0, spinRate: 0, mass: 1.0 };
  const revived = Garbage.fromNode(node);
  assert(revived.pieces === 1 && revived.coalesceDelay === GARBAGE_COALESCE_DELAY,
    "0: Garbage.fromNode inherits the coalesce defaults too");
}
// Real emission site: destroyDebris pushes canisters that carry the defaults.
{
  beginPlaying();
  destroyDebris(new DebrisSatellite(1000, 1000, 1, 1), false); // small tier -> emits garbage, no children
  assert(game.garbage.length > 0 && game.garbage.every(g => g.pieces === 1 && g.coalesceDelay === GARBAGE_COALESCE_DELAY),
    "0: destroyDebris-emitted canisters all inherit pieces=1 + full coalesceDelay");
}

// =====================================================================
console.log("(1) a piece can't merge before 1 s, can after — via the real update() countdown");
{
  beginPlaying();
  const a = new Garbage(1000, 1000, 0, 0);
  const b = new Garbage(1005, 1000, 0, 0); // 5 px apart (< MERGE_DIST 12), zero velocity so they hold position
  game.garbage = [a, b];

  coalesceGarbage(1 / 60); // both fresh (coalesceDelay 1.0) -> inert
  assert(!a.dead && !b.dead && a.pieces === 1, "1: fresh pieces do NOT merge (coalesceDelay > 0)");

  a.update(0.6); b.update(0.6); // coalesceDelay now ~0.4 — still inert
  coalesceGarbage(1 / 60);
  assert(!a.dead && !b.dead && a.pieces === 1, "1: still inert at 0.6 s elapsed (< 1 s)");

  a.update(0.6); b.update(0.6); // coalesceDelay now ~-0.2 — active
  assert(a.coalesceDelay <= 0 && b.coalesceDelay <= 0, "1: both active past 1 s");
  coalesceGarbage(1 / 60);
  assert((a.dead || b.dead) && (a.pieces === 2 || b.pieces === 2), "1: active pieces in contact merge (pieces -> 2)");
}

// =====================================================================
console.log("(2) two active pieces in contact merge — survivor velocity == exact vector sum");
{
  beginPlaying();
  const a = new Garbage(1000, 1000, 11, -3);
  const b = new Garbage(1004, 1002, -7, 5); // within MERGE_DIST
  a.coalesceDelay = 0; b.coalesceDelay = 0;
  const sumVx = a.vx + b.vx, sumVy = a.vy + b.vy;
  game.garbage = [a, b];
  coalesceGarbage(1 / 60);
  assert(b.dead && !a.dead, "2: survivor is the earlier piece (a); other marked dead");
  assert(a.pieces === 2, "2: survivor.pieces === 2");
  assert(a.vx === sumVx && a.vy === sumVy, `2: survivor velocity is the LITERAL vector sum (${a.vx},${a.vy})`);
}

// =====================================================================
console.log("(3) twelve active pieces coalesce to exactly one new Hunter");
{
  beginPlaying();
  hunterbornCalls = 0;
  const before = game.hunters.length;
  for (let i = 0; i < HUNTER_COALESCE_COUNT; i++) {
    const g = new Garbage(1000, 1000, 0, 0); // all at the same point -> all within merge dist
    g.coalesceDelay = 0;
    game.garbage.push(g);
  }
  coalesceGarbage(1 / 60);
  assert(game.hunters.length === before + 1, `3: exactly one new Hunter (${before} -> ${game.hunters.length})`);
  assert(game.hunters[game.hunters.length - 1].size === 3, "3: the coalesced Hunter is a large core (size 3)");
  assert(game.garbage.every(g => g.dead), "3: all twelve pieces are consumed (dead)");
  assert(hunterbornCalls === 1, `3: AudioSys.hunterborn fired exactly once (got ${hunterbornCalls})`);
}

// =====================================================================
console.log("(4) a merge across the world seam works (wrap-aware)");
{
  beginPlaying();
  const a = new Garbage(5, 700, 2, 0);
  const b = new Garbage(WORLD_W - 3, 700, 1, 0); // wrap-distance to a is 8 px (< MERGE_DIST), naive dist is huge
  a.coalesceDelay = 0; b.coalesceDelay = 0;
  const sumVx = a.vx + b.vx;
  game.garbage = [a, b];
  coalesceGarbage(1 / 60);
  assert(b.dead && a.pieces === 2, "4: pieces straddling the x seam merge (wrap-aware dist2)");
  assert(a.vx === sumVx, "4: survivor velocity is still the vector sum across the seam");
}

// =====================================================================
console.log("(5) merging does NOT bump garbageDecayed (Waste Not stays safe)");
{
  beginPlaying();
  const base = game.stats.garbageDecayed;
  // simple 2-piece merge
  const a = new Garbage(1000, 1000, 0, 0), b = new Garbage(1003, 1000, 0, 0);
  a.coalesceDelay = 0; b.coalesceDelay = 0;
  game.garbage = [a, b];
  coalesceGarbage(1 / 60);
  assert(game.stats.garbageDecayed === base, "5: a plain merge leaves garbageDecayed unchanged");
  // and the transform-to-Hunter path
  game.garbage = [];
  for (let i = 0; i < HUNTER_COALESCE_COUNT; i++) {
    const g = new Garbage(1000, 1000, 0, 0); g.coalesceDelay = 0; game.garbage.push(g);
  }
  coalesceGarbage(1 / 60);
  assert(game.stats.garbageDecayed === base, "5: coalescing into a Hunter also leaves garbageDecayed unchanged");
}

// =====================================================================
console.log("(6) a pieces>1 clump hooks as a single mass-1.0 chain node (FORK-2), via real update()");
{
  beginPlaying();
  game.cargoMax = 12; // ample headroom, chain empty
  const clump = new Garbage(game.ship.x, game.ship.y, 0, 0); // sits on the ship -> guaranteed hook
  clump.pieces = 5;          // a fused clump
  clump.mass = 1.0;          // FORK-2: still a normal mass-1.0 canister
  clump.coalesceDelay = 0;
  game.garbage = [clump];
  assert(clump.pieces === 5, "6: pre-condition — clump has pieces === 5");
  update(1 / 60);
  assert(game.chain.length === 1, "6: the clump hooks as exactly ONE chain node");
  assert(game.chain[0].mass === 1.0, "6: the hooked node tows as one normal mass-1.0 canister");
}

// =====================================================================
console.log("(7) mutual attraction is gated by the 1 s delay too (not just merging)");
{
  beginPlaying();
  const a = new Garbage(1000, 1000, 0, 0);
  const b = new Garbage(1080, 1000, 0, 0); // 80 px apart: inside MAGNET_RANGE (140), outside MERGE_DIST
  game.garbage = [a, b];
  coalesceGarbage(1 / 60); // both fresh -> no attraction
  assert(a.vx === 0 && b.vx === 0, "7: fresh pieces feel no attraction (velocity unchanged)");
  a.coalesceDelay = 0; b.coalesceDelay = 0;
  coalesceGarbage(1 / 60); // active -> pulled toward each other, symmetrically
  assert(a.vx > 0 && b.vx < 0, "7: active pieces accelerate toward each other (symmetric pull)");
  assert(Math.abs(a.vx + b.vx) < 1e-9, "7: the pull is symmetric (equal and opposite)");
}

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
