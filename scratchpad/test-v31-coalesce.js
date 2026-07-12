// Headless test for garbage coalescence (v3.1 P3 origin) + the v3.2 P1 physical-clump overhaul.
// Follows the repo test convention: stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, then drive the actual coalesceGarbage()/update()/destroyDebris code against real
// entities — no reimplementation of the logic under test.
//
//   node scratchpad/test-v31-coalesce.js
//
// Checks:
//  (1) a piece can't merge before 1 s (inactive), can after (active) — via the real update() countdown.
//  (2) two active pieces in contact merge — survivor velocity == MOMENTUM sum (v3.2 P1; was the vector
//      sum in v3.1), pieces == 2, mass SUMS, radius derives 7*sqrt(pieces).
//  (3) twelve active pieces coalesce to exactly one new Hunter (hunters +1, clump all dead,
//      AudioSys.hunterborn called exactly once).
//  (4) a merge across the world seam works (wrap-aware dist2/shortDelta), momentum sum preserved.
//  (5) merging does NOT bump game.stats.garbageDecayed (coalescing is a distinct fate; Waste Not safe).
//  (6) v3.2 P1: a pieces>1 clump CANNOT be hooked; a pieces=1 canister still hooks — via real update().
//  (7) mutual attraction is 1-s-gated too.
//  (8) v3.2 P1: mass sums across a chain of merges; radius tracks 7*sqrt(pieces).
//  (9) v3.2 P1: a heavy clump absorbing a fast light piece barely speeds up (momentum-conserving).
// (10) v3.2 P1: two mass-1.0 singles attract EXACTLY as the shipped force (reduction guard — no retune).
// (11) v3.2 P1: the Magnet powerup won't pull a clump, but still pulls a single — via real update().
// (12) v3.2 P1: draw() is crash-free at pieces=1 and pieces=11 (cluster render).
//  Plus: emission sites + fromNode inherit the coalesce defaults.

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
console.log("(2) two active pieces in contact merge — survivor velocity == MOMENTUM sum (v3.2 P1)");
{
  beginPlaying();
  const a = new Garbage(1000, 1000, 11, -3);
  const b = new Garbage(1004, 1002, -7, 5); // within MERGE_DIST
  a.coalesceDelay = 0; b.coalesceDelay = 0;
  // momentum sum with the PRE-merge masses (both default 1.0 here): v = (mₐvₐ + m_b v_b)/(mₐ+m_b)
  const ma = a.mass, mb = b.mass, mt = ma + mb;
  const momVx = (ma * a.vx + mb * b.vx) / mt, momVy = (ma * a.vy + mb * b.vy) / mt;
  const sumVx = a.vx + b.vx; // the OLD contract, to prove we're no longer doing this
  game.garbage = [a, b];
  coalesceGarbage(1 / 60);
  assert(b.dead && !a.dead, "2: survivor is the earlier piece (a); other marked dead");
  assert(a.pieces === 2, "2: survivor.pieces === 2");
  assert(a.mass === mt, `2: survivor.mass SUMS to ${mt} (got ${a.mass})`);
  assert(a.radius === 7 * Math.sqrt(2), `2: survivor.radius derives 7*sqrt(2) (got ${a.radius})`);
  assert(a.vx === momVx && a.vy === momVy, `2: survivor velocity is the MOMENTUM sum (${a.vx},${a.vy})`);
  assert(a.vx !== sumVx, "2: survivor velocity is NOT the old literal vector sum");
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
  const momVx = (a.mass * a.vx + b.mass * b.vx) / (a.mass + b.mass);
  game.garbage = [a, b];
  coalesceGarbage(1 / 60);
  assert(b.dead && a.pieces === 2, "4: pieces straddling the x seam merge (wrap-aware dist2)");
  assert(a.vx === momVx, "4: survivor velocity is the momentum sum across the seam");
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
console.log("(6) a pieces>1 clump CANNOT be hooked; a pieces=1 canister still hooks (v3.2 P1)");
{
  beginPlaying();
  game.cargoMax = 12; // ample headroom, chain empty
  const clump = new Garbage(game.ship.x, game.ship.y, 0, 0); // sits on the ship -> would hook if allowed
  clump.pieces = 5;          // a fused clump
  clump.coalesceDelay = 0;
  game.garbage = [clump];
  assert(clump.pieces === 5, "6: pre-condition — clump has pieces === 5");
  update(1 / 60);
  assert(game.chain.length === 0 && !clump.dead, "6: a clump (pieces>1) is NOT hooked (the load-bearing rule)");

  beginPlaying();
  game.cargoMax = 12;
  const single = new Garbage(game.ship.x, game.ship.y, 0, 0); // a lone canister on the ship -> hooks
  single.coalesceDelay = 0;
  game.garbage = [single];
  update(1 / 60);
  assert(game.chain.length === 1, "6: a pieces=1 canister still hooks as exactly ONE node");
  assert(game.chain[0].mass === 1.0, "6: the hooked single tows as one mass-1.0 node");
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
console.log("(8) v3.2 P1: mass SUMS across a chain of merges; radius tracks 7*sqrt(pieces)");
{
  beginPlaying();
  // four co-located active pieces (two normal mass-1.0, two half-mass Hunter scrap) collapse in one pass
  const pcs = [new Garbage(1000, 1000, 0, 0), new Garbage(1000, 1000, 0, 0),
               new Garbage(1000, 1000, 0, 0, undefined, 0.5), new Garbage(1000, 1000, 0, 0, undefined, 0.5)];
  for (const p of pcs) p.coalesceDelay = 0;
  game.garbage = pcs;
  coalesceGarbage(1 / 60);
  const survivor = pcs[0];
  assert(!survivor.dead && pcs.slice(1).every(p => p.dead), "8: first piece survives, other three consumed");
  assert(survivor.pieces === 4, `8: pieces sums across the chain (got ${survivor.pieces})`);
  assert(survivor.mass === 3.0, `8: mass SUMS across the chain (1+1+0.5+0.5 = 3.0, got ${survivor.mass})`);
  assert(survivor.radius === 7 * Math.sqrt(4), `8: radius = 7*sqrt(4) = 14 (got ${survivor.radius})`);
  // spot-check the derivation holds for a lone piece too
  assert(new Garbage(0, 0).radius === 7, "8: a single piece still reads radius 7 (= 7*sqrt(1))");
}

// =====================================================================
console.log("(9) v3.2 P1: a heavy clump absorbing a fast light piece BARELY speeds up (momentum)");
{
  beginPlaying();
  const heavy = new Garbage(1000, 1000, 0, 0); // an anchor at rest...
  heavy.mass = 10; heavy.pieces = 10; heavy.coalesceDelay = 0;
  const light = new Garbage(1004, 1000, 100, 0); // ...eats a fast little single
  light.mass = 1; light.coalesceDelay = 0;
  game.garbage = [heavy, light];
  coalesceGarbage(1 / 60);
  assert(light.dead && heavy.pieces === 11, "9: heavy survives, absorbs the light piece (pieces 10 -> 11)");
  assert(heavy.mass === 11, "9: mass sums to 11");
  assert(heavy.vx === 100 / 11, `9: survivor velocity is the momentum sum 100/11 ≈ 9.09 (got ${heavy.vx})`);
  assert(heavy.vx < 15, "9: a heavy wad barely speeds up eating a 100 px/s piece (not the 100 a vector sum would give)");
}

// =====================================================================
console.log("(10) v3.2 P1: two mass-1.0 singles attract EXACTLY as the shipped force (reduction guard)");
{
  beginPlaying();
  const a = new Garbage(1000, 1000, 0, 0);
  const b = new Garbage(1080, 1000, 0, 0); // 80 px apart, inside MAGNET_RANGE, outside MERGE_DIST
  a.coalesceDelay = 0; b.coalesceDelay = 0;
  game.garbage = [a, b];
  coalesceGarbage(1 / 60);
  // shipped flat pull: dx/d == 1 here, so the per-frame kick is exactly GARBAGE_MAGNET_PULL * dt
  const expected = GARBAGE_MAGNET_PULL * (1 / 60);
  assert(Math.abs(a.vx - expected) < 1e-12, `10: a.vx == the shipped mass-1.0 kick ${expected} (got ${a.vx})`);
  assert(a.vx === -b.vx, "10: still exactly equal-and-opposite at mass 1.0 (GARBAGE_MAGNET_PULL unretuned)");
}

// =====================================================================
console.log("(11) v3.2 P1: the Magnet powerup does NOT pull a clump, but still pulls a single — via real update()");
{
  beginPlaying();
  game.powerFx.magnet = 10; // magnet active (time mode default)
  const clump = new Garbage(game.ship.x + 40, game.ship.y, 0, 0); // in magnet range, out of pickup range
  clump.pieces = 2;
  game.garbage = [clump];
  update(1 / 60);
  assert(clump.vx === 0 && clump.vy === 0, "11: a clump (pieces>1) feels no Magnet pull");
  assert(game.chain.length === 0 && !clump.dead, "11: and it is not hooked");

  beginPlaying();
  game.powerFx.magnet = 10;
  const single = new Garbage(game.ship.x + 40, game.ship.y, 0, 0); // same spot, one piece
  game.garbage = [single];
  update(1 / 60);
  assert(single.vx < 0, "11: a pieces=1 canister IS pulled toward the ship (to its left)");
}

// =====================================================================
console.log("(12) v3.2 P1: draw() is crash-free at pieces=1 and pieces=11 (cluster render)");
{
  let threw = false;
  try {
    const one = new Garbage(200, 200); one.decay = 999; one.draw();
    const wad = new Garbage(300, 300); wad.decay = 999; wad.pieces = 11;
    wad.radius = 7 * Math.sqrt(11); wad.draw();
  } catch (e) { threw = true; console.log("    threw: " + e); }
  assert(!threw, "12: draw() renders a 1-piece and an 11-piece clump without throwing");
}

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
