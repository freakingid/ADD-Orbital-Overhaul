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
//  (5) v3.2 P3: a plain merge leaves game.stats.hunterCoalesced untouched; a 12-piece transform bumps
//      it by exactly one (the repurposed Waste-Not stat replaces the removed garbageDecayed).
//  (6) v3.2 P1: a pieces>1 clump CANNOT be hooked; a pieces=1 canister still hooks — via real update().
//  (7) mutual attraction is 1-s-gated too.
//  (8) v3.2 P1: mass sums across a chain of merges; radius tracks 7*sqrt(pieces).
//  (9) v3.2 P1: a heavy clump absorbing a fast light piece barely speeds up (momentum-conserving).
// (10) v3.2 P1: two mass-1.0 singles attract EXACTLY as the shipped force (reduction guard — no retune).
// (11) v3.2 P1: the Magnet powerup won't pull a clump, but still pulls a single — via real update().
// (12) v3.2 P1: draw() is crash-free at pieces=1 and pieces=11 (cluster render).
// (13) v3.2 P2: a player bullet shatters a pieces=7 clump into exactly 7 live singles, mass-split,
//      full-delay, mass-conserving, and they don't immediately re-merge; a player bullet passes
//      THROUGH a pieces=1 canister; a hostile bullet passes through a clump; the emitted pieces are
//      hookable once in pickup range; shattering doesn't coalesce anything.
// (16) v3.2 P3: a canister survives an arbitrarily long update() run and never dies of age; the old
//      garbageDecayed stat is gone from game.stats.
// (17) v3.2 P3 (FORK-B/B1): a bornOfScrap core killed through its FULL lineage emits ZERO garbage,
//      while awarding the SAME score and still dropping its small-tier powerup.
// (18) v3.2 P3: a TIMER-spawned (non-bornOfScrap) Hunter still emits the full 12 normal + 54 low = 66.
// (19) v3.2 P3: the bornOfScrap flag propagates through BOTH split generations (large -> med -> small).
// (20) v3.2 P3: game.stats.hunterCoalesced increments exactly once per 12-piece transform.
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
  "DebrisSatellite", "HunterSatellite", "destroyDebris", "destroyHunter", "shatterClump", "Bullet", "AudioSys",
  "GARBAGE_COALESCE_DELAY", "GARBAGE_MERGE_DIST", "GARBAGE_MAGNET_RANGE",
  "GARBAGE_MAGNET_PULL", "HUNTER_COALESCE_COUNT", "GARBAGE_PICKUP", "GARBAGE_SHATTER_KICK",
  "HUNTER_GARBAGE", "HUNTER_SMALL_GARBAGE", "HUNTER_SMALL_MASS", "HUNTER_SCORE",
  "WORLD_W", "WORLD_H"];

const wrapped = new Function(
  "window", "document", "navigator", "performance", "requestAnimationFrame", "localStorage",
  scriptSrc + `\nreturn { ${returnList.join(", ")} };`
);
const G = wrapped(windowStub, documentStub, navigatorStub, performanceStub, rafStub, global.localStorage);
const { startGame, update, game, coalesceGarbage, Garbage, DebrisSatellite, HunterSatellite,
  destroyDebris, destroyHunter, shatterClump, Bullet, AudioSys, GARBAGE_COALESCE_DELAY, GARBAGE_MERGE_DIST, GARBAGE_MAGNET_RANGE,
  GARBAGE_MAGNET_PULL, HUNTER_COALESCE_COUNT, GARBAGE_PICKUP, GARBAGE_SHATTER_KICK,
  HUNTER_GARBAGE, HUNTER_SMALL_GARBAGE, HUNTER_SMALL_MASS, HUNTER_SCORE, WORLD_W, WORLD_H } = G;

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
assert(GARBAGE_COALESCE_DELAY === 6.0, `0: GARBAGE_COALESCE_DELAY is 6.0 (v3.2 P3 retune 1.0->6.0; got ${GARBAGE_COALESCE_DELAY})`);
assert(GARBAGE_MERGE_DIST === 12, `0: GARBAGE_MERGE_DIST is 12 (got ${GARBAGE_MERGE_DIST})`);
assert(HUNTER_COALESCE_COUNT === 12, `0: HUNTER_COALESCE_COUNT is 12 (got ${HUNTER_COALESCE_COUNT})`);
assert(GARBAGE_MAGNET_RANGE === 260, `0: GARBAGE_MAGNET_RANGE is 260 (v3.2 P3 retune 140->260; got ${GARBAGE_MAGNET_RANGE})`);
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
console.log("(1) a piece can't merge before the coalesce delay, can after — via the real update() countdown");
{
  beginPlaying();
  const a = new Garbage(1000, 1000, 0, 0);
  const b = new Garbage(1005, 1000, 0, 0); // 5 px apart (< MERGE_DIST 12), zero velocity so they hold position
  game.garbage = [a, b];

  coalesceGarbage(1 / 60); // both fresh (full coalesceDelay) -> inert
  assert(!a.dead && !b.dead && a.pieces === 1, "1: fresh pieces do NOT merge (coalesceDelay > 0)");

  // advance half the delay (drive the real update countdown; velocity is 0 so they hold position) — still inert
  a.update(GARBAGE_COALESCE_DELAY * 0.5); b.update(GARBAGE_COALESCE_DELAY * 0.5);
  coalesceGarbage(1 / 60);
  assert(!a.dead && !b.dead && a.pieces === 1, "1: still inert at half the coalesce delay");

  // advance past the full delay -> active
  a.update(GARBAGE_COALESCE_DELAY * 0.5 + 0.02); b.update(GARBAGE_COALESCE_DELAY * 0.5 + 0.02);
  assert(a.coalesceDelay <= 0 && b.coalesceDelay <= 0, "1: both active past the full coalesce delay");
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
console.log("(5) v3.2 P3: a plain merge leaves hunterCoalesced alone; a 12-transform bumps it by one");
{
  beginPlaying();
  const base = game.stats.hunterCoalesced;
  // simple 2-piece merge (not a transform) -> hunterCoalesced unchanged
  const a = new Garbage(1000, 1000, 0, 0), b = new Garbage(1003, 1000, 0, 0);
  a.coalesceDelay = 0; b.coalesceDelay = 0;
  game.garbage = [a, b];
  coalesceGarbage(1 / 60);
  assert(a.pieces === 2 && game.stats.hunterCoalesced === base, "5: a plain merge leaves hunterCoalesced unchanged");
  // and the transform-to-Hunter path -> exactly one increment
  game.garbage = [];
  for (let i = 0; i < HUNTER_COALESCE_COUNT; i++) {
    const g = new Garbage(1000, 1000, 0, 0); g.coalesceDelay = 0; game.garbage.push(g);
  }
  coalesceGarbage(1 / 60);
  assert(game.stats.hunterCoalesced === base + 1, "5: coalescing into a Hunter bumps hunterCoalesced by exactly one");
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
               new Garbage(1000, 1000, 0, 0, 0.5), new Garbage(1000, 1000, 0, 0, 0.5)]; // mass is the 5th ctor arg (v3.2 P3)
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
    const one = new Garbage(200, 200); one.draw(); // v3.2 P3: no decay field / blink branch to set up
    const wad = new Garbage(300, 300); wad.pieces = 11;
    wad.radius = 7 * Math.sqrt(11); wad.draw();
  } catch (e) { threw = true; console.log("    threw: " + e); }
  assert(!threw, "12: draw() renders a 1-piece and an 11-piece clump without throwing");
}

// =====================================================================
console.log("(13) v3.2 P2: a player bullet shatters a pieces=7 clump into exactly 7 hookable singles");
{
  beginPlaying();
  const clumpMass = 3.5;
  const clump = new Garbage(1000, 1000, 6, -2);
  clump.pieces = 7; clump.mass = clumpMass; clump.radius = 7 * Math.sqrt(7);
  const bullet = new Bullet(1000, 1000, 0, 0, false); // dead-center, non-hostile
  game.garbage = [clump];
  game.bullets = [bullet];
  const coalescedBefore = game.stats.hunterCoalesced;
  update(1 / 60);
  assert(bullet.dead, "13: the bullet is consumed by the clump");
  assert(clump.dead, "13: the clump is destroyed");
  assert(game.garbage.length === 7, `13: exactly 7 fresh singles emitted (got ${game.garbage.length})`);
  assert(game.garbage.every(g => g.pieces === 1), "13: every emitted piece is pieces === 1");
  assert(game.garbage.every(g => g.coalesceDelay === GARBAGE_COALESCE_DELAY),
    "13: every emitted piece has a full, re-armed coalesceDelay");
  assert(game.garbage.every(g => Math.abs(g.mass - clumpMass / 7) < 1e-12),
    `13: every emitted piece's mass is clumpMass/7 = ${clumpMass / 7}`);
  const totalMass = game.garbage.reduce((s, g) => s + g.mass, 0);
  assert(Math.abs(totalMass - clumpMass) < 1e-9, `13: total emitted mass conserves clumpMass (${totalMass} vs ${clumpMass})`);
  assert(game.stats.hunterCoalesced === coalescedBefore, "13: shattering a clump does not coalesce anything (hunterCoalesced unchanged)");

  // the 7 emitted pieces do NOT immediately re-merge next frame (the delay gate holds)
  const countBefore = game.garbage.length;
  update(1 / 60);
  assert(game.garbage.length === countBefore, "13: the fresh shatter burst does not merge on the very next frame");
}

console.log("(14) v3.2 P2: a player bullet passes THROUGH a pieces=1 canister; a hostile bullet passes through a clump");
{
  beginPlaying();
  const single = new Garbage(1000, 1000, 0, 0); // pieces === 1 by default
  const playerBullet = new Bullet(1000, 1000, 0, 0, false);
  game.garbage = [single];
  game.bullets = [playerBullet];
  update(1 / 60);
  assert(!playerBullet.dead && !single.dead, "14: a player bullet passes through a pieces=1 canister untouched");

  beginPlaying();
  const clump = new Garbage(1000, 1000, 0, 0);
  clump.pieces = 6; clump.radius = 7 * Math.sqrt(6);
  const hostileBullet = new Bullet(1000, 1000, 0, 0, true);
  game.garbage = [clump];
  game.bullets = [hostileBullet];
  update(1 / 60);
  assert(!clump.dead, "14: a hostile bullet passes through a clump (garbage is untouched by saucer fire)");
}

console.log("(15) v3.2 P2: emitted pieces ARE hookable (pieces===1) once in pickup range — the P1 gate now lets them through");
{
  beginPlaying();
  game.cargoMax = 12;
  const clump = new Garbage(game.ship.x, game.ship.y, 0, 0);
  clump.pieces = 3; clump.radius = 7 * Math.sqrt(3);
  const bullet = new Bullet(game.ship.x, game.ship.y, 0, 0, false);
  game.garbage = [clump];
  game.bullets = [bullet];
  update(1 / 60); // shatters the clump; the 3 singles land at the ship's position, in pickup range
  assert(game.garbage.length === 3 && game.garbage.every(g => g.pieces === 1),
    "15: the clump shattered into 3 pieces=1 singles at the ship");
  update(1 / 60); // a further frame lets the pickup pass hook the now-eligible singles
  assert(game.chain.length === 3, `15: all 3 shattered singles are hookable in pickup range (chain length ${game.chain.length})`);
}

// Drive a whole Hunter lineage to death through the REAL destroyHunter. destroyHunter pushes each
// large/medium kill's 3 children onto game.hunters, so a breadth-first drain naturally processes the
// full 1 + 3 + 9 = 13-member line. Returns the kill count.
function killLineage(core) {
  game.hunters = [core];
  let kills = 0;
  while (game.hunters.length) { destroyHunter(game.hunters.shift()); kills++; }
  return kills;
}

// =====================================================================
console.log("(16) v3.2 P3: a canister survives an arbitrarily long update() run and never dies of age");
{
  beginPlaying();
  const g = new Garbage(500, 500, 0, 0); // isolated — no neighbours to coalesce with
  // drive the REAL Garbage.update for ~120 s of frames; the OLD build killed it at GARBAGE_DECAY (12 s)
  for (let t = 0; t < 120; t += 1 / 60) g.update(1 / 60);
  assert(!g.dead, "16: a lone canister is still alive after ~120 s (never dies of age)");
  assert(g.coalesceDelay <= 0, "16: its coalesce delay has long elapsed (active), yet it did not expire");
  assert(!("garbageDecayed" in game.stats), "16: the old garbageDecayed stat is gone from game.stats");
}

// =====================================================================
console.log("(17) v3.2 P3 (FORK-B/B1): a bornOfScrap lineage emits ZERO garbage, same score, still drops its powerup");
{
  const cx = 1000, cy = 1000;
  // baseline: a normal (timer-spawned) full lineage, for the score + garbage reference
  beginPlaying();
  game.powerups = [];
  const scoreBefore0 = game.score;
  const normalCore = new HunterSatellite(cx, cy, 3); // bornOfScrap defaults false
  game.garbage = [];
  const normalKills = killLineage(normalCore);
  const normalScore = game.score - scoreBefore0;
  assert(normalKills === 13, `17: a full lineage is 13 kills (got ${normalKills})`);

  // bornOfScrap: identical lineage, garbage suppressed at every tier
  beginPlaying();
  game.powerups = [];
  const scoreBefore1 = game.score;
  const scrapCore = new HunterSatellite(cx, cy, 3);
  scrapCore.bornOfScrap = true;
  game.garbage = [];
  const realRandom = Math.random;
  Math.random = () => 0; // force maybeDropPowerup to always drop, to prove the small-tier powerup path still fires
  let scrapKills, scrapPowerups;
  try { scrapKills = killLineage(scrapCore); scrapPowerups = game.powerups.length; }
  finally { Math.random = realRandom; }
  const scrapScore = game.score - scoreBefore1;

  assert(scrapKills === 13, `17: the bornOfScrap lineage is also 13 kills (got ${scrapKills})`);
  assert(game.garbage.length === 0, `17: a bornOfScrap lineage emits ZERO garbage at any tier (got ${game.garbage.length})`);
  assert(scrapScore === normalScore, `17: score is UNCHANGED vs the normal lineage (${scrapScore} vs ${normalScore})`);
  assert(scrapPowerups === 9, `17: the small tier still drops its powerup — one per 9 small kills (got ${scrapPowerups})`);
}

// =====================================================================
console.log("(18) v3.2 P3: a timer-spawned (non-bornOfScrap) Hunter still emits the full 12 normal + 54 low = 66");
{
  beginPlaying();
  const core = new HunterSatellite(1000, 1000, 3); // bornOfScrap false
  game.garbage = [];
  killLineage(core);
  const total = game.garbage.length;
  const normalMass = game.garbage.filter(g => g.mass === 1.0).length;
  const lowMass = game.garbage.filter(g => g.mass === HUNTER_SMALL_MASS).length;
  assert(total === 66, `18: a full normal lineage drops 66 canisters (got ${total})`);
  assert(normalMass === HUNTER_GARBAGE * 4, `18: 12 normal-mass canisters from large + 3 mediums (got ${normalMass})`);
  assert(lowMass === HUNTER_SMALL_GARBAGE * 9, `18: 54 low-mass canisters from 9 smalls (got ${lowMass})`);
}

// =====================================================================
console.log("(19) v3.2 P3: the bornOfScrap flag propagates through BOTH split generations");
{
  beginPlaying();
  const core = new HunterSatellite(1000, 1000, 3);
  core.bornOfScrap = true;
  game.hunters = []; game.garbage = [];
  destroyHunter(core); // -> 3 medium children
  const meds = game.hunters.slice();
  assert(meds.length === 3 && meds.every(m => m.size === 2 && m.bornOfScrap === true),
    "19: the 3 medium children inherit bornOfScrap === true");
  game.hunters = [];
  destroyHunter(meds[0]); // -> 3 small grandchildren
  const smalls = game.hunters.slice();
  assert(smalls.length === 3 && smalls.every(s => s.size === 1 && s.bornOfScrap === true),
    "19: the 3 small grandchildren inherit bornOfScrap === true (both generations survive)");
  assert(game.garbage.length === 0, "19: and no garbage was emitted at either generation");
}

// =====================================================================
console.log("(20) v3.2 P3: a coalescence-born core is tagged bornOfScrap; hunterCoalesced counts transforms");
{
  beginPlaying();
  assert(game.stats.hunterCoalesced === 0, "20: fresh game starts at hunterCoalesced 0");
  for (let i = 0; i < HUNTER_COALESCE_COUNT; i++) { const g = new Garbage(500, 500, 0, 0); g.coalesceDelay = 0; game.garbage.push(g); }
  coalesceGarbage(1 / 60);
  const born = game.hunters[game.hunters.length - 1];
  assert(born.size === 3 && born.bornOfScrap === true, "20: the coalesced core is a large core tagged bornOfScrap");
  assert(game.stats.hunterCoalesced === 1, "20: one transform -> hunterCoalesced === 1");
  // a second, independent clump transforms too
  game.garbage = [];
  for (let i = 0; i < HUNTER_COALESCE_COUNT; i++) { const g = new Garbage(700, 700, 0, 0); g.coalesceDelay = 0; game.garbage.push(g); }
  coalesceGarbage(1 / 60);
  assert(game.stats.hunterCoalesced === 2, "20: a second transform -> hunterCoalesced === 2");
}

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
