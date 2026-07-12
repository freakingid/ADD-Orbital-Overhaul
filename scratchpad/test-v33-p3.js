// Headless test for v3.3 Phase 3 — the Scoop powerup + weighted powerup drop economy.
// Repo convention: stub window/document/rAF/navigator/localStorage, eval the REAL <script> block,
// then drive the ACTUAL update()/damageShip()/applyPowerup()/maybeDropPowerup — no reimplementation.
//
//   node scratchpad/test-v33-p3.js
//
// Checks:
//  (0) constants: POWERUP_DROP_CHANCE 0.16, POWERUP_DECAY 26; scoop constants sane; POWERUP_DROP_TYPES
//      still the 4 TIMED types (no "scoop"); POWERUP_DROP_WEIGHTS is the separate weighted table.
//  (1) applyPowerup("scoop") climbs 0->5 and caps; the 6th pick pays SCOOP_MAX_BONUS instead.
//  (2) the scoop BOX captures a canister that is OUTSIDE GARBAGE_PICKUP but inside the mouth, at
//      several ship headings AND across the world wrap seam (via the real update() pickup pass).
//  (3) a canister behind the ship, or laterally outside the mouth, is NOT captured.
//  (4) at scoopLevel 0 the pickup set is identical to the pre-scoop build (circle only).
//  (5) two non-lethal hits drop exactly one level, four drop two; hits at level 0 are harmless.
//  (6) a shielded / i-frame hit (damageShip's early return) does NOT count toward scoopHits.
//  (7) maybeDropPowerup only ever yields a type in POWERUP_DROP_WEIGHTS, and scoop can drop.

"use strict";
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "asteroids-deluxe.html"), "utf8");
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

const returnList = ["startGame", "update", "game", "Garbage", "applyPowerup", "damageShip",
  "maybeDropPowerup", "POWERUP_DROP_WEIGHTS", "POWERUP_DROP_TYPES", "POWERUP_DECAY",
  "POWERUP_DROP_CHANCE", "SCOOP_MAX_LEVEL", "SCOOP_WIDTH", "SCOOP_DEPTH", "SCOOP_HITS_PER_LEVEL",
  "SCOOP_MAX_BONUS", "GARBAGE_PICKUP", "SHIP_RADIUS", "WORLD_W", "WORLD_H"];
const wrapped = new Function(
  "window", "document", "navigator", "performance", "requestAnimationFrame", "localStorage",
  scriptSrc + `\nreturn { ${returnList.join(", ")} };`);
const G = wrapped(windowStub, documentStub, navigatorStub, performanceStub, rafStub, global.localStorage);
const { startGame, update, game, Garbage, applyPowerup, damageShip, maybeDropPowerup,
  POWERUP_DROP_WEIGHTS, POWERUP_DROP_TYPES, POWERUP_DECAY, POWERUP_DROP_CHANCE, SCOOP_MAX_LEVEL,
  SCOOP_WIDTH, SCOOP_DEPTH, SCOOP_HITS_PER_LEVEL, SCOOP_MAX_BONUS, GARBAGE_PICKUP, SHIP_RADIUS,
  WORLD_W, WORLD_H } = G;

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ok - ${msg}`); }
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const wrapC = (v, size) => ((v % size) + size) % size;

function beginPlaying() {
  startGame();
  game.state = "playing"; game.paused = false;
  game.debris = []; game.hunters = []; game.saucers = []; game.garbage = []; game.chain = [];
}
function placeShip(angle, sx, sy) {
  const s = game.ship;
  s.x = sx; s.y = sy; s.vx = 0; s.vy = 0; s.angle = angle;
  s.dead = false; s.invuln = 0; s.shieldOn = false; s.hp = 250;
  return s;
}
// Put a single garbage at ship-local (forward, lateral) — inverse of inScoopBox's projection, wrapped.
function placeGarbage(forward, lateral) {
  const s = game.ship, ca = Math.cos(s.angle), sa = Math.sin(s.angle);
  const wx = wrapC(s.x + forward * ca - lateral * sa, WORLD_W);
  const wy = wrapC(s.y + forward * sa + lateral * ca, WORLD_H);
  const g = new Garbage(wx, wy);
  game.garbage = [g];
  return g;
}
// Set scoop level, run one real update frame, report whether the single garbage got hooked.
function captured(level, forward, lateral, angle = 0, sx = WORLD_W / 2, sy = WORLD_H / 2) {
  beginPlaying();
  placeShip(angle, sx, sy);
  game.scoopLevel = level; game.scoopHits = 0;
  placeGarbage(forward, lateral);
  update(1 / 60);
  return game.chain.length === 1;
}

// =====================================================================
console.log("(0) constants + drop-table separation");
assert(POWERUP_DROP_CHANCE === 0.16, `0: POWERUP_DROP_CHANCE 0.10->0.16 (got ${POWERUP_DROP_CHANCE})`);
assert(POWERUP_DECAY === 26, `0: POWERUP_DECAY 14->26 (got ${POWERUP_DECAY})`);
assert(SCOOP_MAX_LEVEL === 5, `0: SCOOP_MAX_LEVEL === 5 (got ${SCOOP_MAX_LEVEL})`);
assert(SCOOP_HITS_PER_LEVEL === 2, `0: SCOOP_HITS_PER_LEVEL === 2 (got ${SCOOP_HITS_PER_LEVEL})`);
assert(SCOOP_WIDTH.length === 6 && SCOOP_DEPTH.length === 6, "0: SCOOP_WIDTH/DEPTH are 6-entry (index = level)");
assert(SCOOP_WIDTH[0] === 0 && SCOOP_DEPTH[0] === 0, "0: level-0 mouth has zero width & depth (box empty)");
assert(SCOOP_WIDTH[5] === 54, `0: L5 width 54 = 3x the ship's 18px (got ${SCOOP_WIDTH[5]})`);
assert(typeof SCOOP_MAX_BONUS === "number" && SCOOP_MAX_BONUS > 0, "0: SCOOP_MAX_BONUS is a positive score");
assert(Array.isArray(POWERUP_DROP_TYPES) && !POWERUP_DROP_TYPES.includes("scoop"),
  "0: POWERUP_DROP_TYPES (the TIMED-effect list) does NOT contain scoop (FLAG A-9)");
assert(["rapid", "triple", "magnet", "engine"].every(t => POWERUP_DROP_TYPES.includes(t)),
  "0: POWERUP_DROP_TYPES still holds the 4 timed effects");
assert(POWERUP_DROP_WEIGHTS && POWERUP_DROP_WEIGHTS.scoop === 2 && POWERUP_DROP_WEIGHTS.rapid === 3 &&
  POWERUP_DROP_WEIGHTS.triple === 3 && POWERUP_DROP_WEIGHTS.magnet === 1 && POWERUP_DROP_WEIGHTS.engine === 1,
  "0: POWERUP_DROP_WEIGHTS is the separate weighted table {rapid3,triple3,scoop2,magnet1,engine1}");

// =====================================================================
console.log("(1) applyPowerup('scoop') climbs then caps + pays a bonus");
{
  beginPlaying();
  placeShip(0, WORLD_W / 2, WORLD_H / 2);
  game.scoopLevel = 0; game.scoopHits = 0; game.score = 0;
  const picked0 = game.stats.powerupsPicked;
  for (let i = 1; i <= SCOOP_MAX_LEVEL; i++) {
    applyPowerup("scoop");
    assert(game.scoopLevel === i, `1: pick ${i} -> scoopLevel ${i} (got ${game.scoopLevel})`);
  }
  assert(game.score === 0, "1: no score awarded while still leveling up");
  const before = game.score;
  applyPowerup("scoop"); // 6th pick, already at max
  assert(game.scoopLevel === SCOOP_MAX_LEVEL, "1: a pick at max does NOT exceed SCOOP_MAX_LEVEL");
  assert(game.score === before + SCOOP_MAX_BONUS, `1: a pick at max pays SCOOP_MAX_BONUS (${SCOOP_MAX_BONUS})`);
  assert(game.stats.powerupsPicked === picked0 + 6,
    "1: each scoop pick counts as a powerup (FLAG A-8: freezes maxWaveNoPowerup — accepted, it IS a powerup)");
}

// =====================================================================
console.log("(2) the box captures beyond the circle — many headings + the wrap seam");
// forward=30 is outside the 18px pickup circle but inside the L5 mouth (depth 36, lateral 0).
assert(30 > GARBAGE_PICKUP, "2: sanity — forward 30 is outside the base GARBAGE_PICKUP circle (18)");
for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 1.0, 2.6]) {
  assert(captured(5, 30, 0, ang), `2: L5 mouth captures a canister at forward 30 (heading ${ang.toFixed(2)})`);
}
// across the world x-seam: ship 5px shy of WORLD_W facing +x, garbage 30px ahead (wraps to x~25)
assert(captured(5, 30, 0, 0, WORLD_W - 5, WORLD_H / 2),
  "2: the box is wrap-aware — captures across the world x-seam");
// across the world y-seam facing +y
assert(captured(5, 30, 0, Math.PI / 2, WORLD_W / 2, WORLD_H - 5),
  "2: the box captures across the world y-seam too");
// a lateral-but-in-mouth canister (within L5 half-width 27) still counts
assert(captured(5, 25, 20, 0), "2: L5 mouth captures a canister at forward 25, lateral 20 (inside 27 half-width)");

// =====================================================================
console.log("(3) misses: behind the ship, or laterally outside the mouth");
assert(!captured(5, -30, 0, 0), "3: a canister 30px BEHIND the ship is NOT captured");
assert(!captured(5, 20, 40, 0), "3: a canister at lateral 40 (> L5 half-width 27) is NOT captured");
assert(!captured(5, 80, 0, 0), "3: a canister forward 80 (beyond depth 36) is NOT captured");

// =====================================================================
console.log("(4) scoopLevel 0 == pre-scoop build (circle only)");
assert(!captured(0, 30, 0, 0), "4: at level 0, a canister at forward 30 (outside circle) is NOT captured");
assert(captured(0, 10, 0, 0), "4: at level 0, a canister at forward 10 (inside the circle) IS captured — base behavior intact");
// and the mouth-only capture that DID work at L5 must fail at L0 (same geometry, box off)
assert(captured(5, 30, 0, 0) && !captured(0, 30, 0, 0),
  "4: the exact mouth capture that works at L5 does not happen at L0");

// =====================================================================
console.log("(5) scoop decays by damage: 2 hits = -1 level, 4 = -2; level 0 harmless");
{
  beginPlaying();
  const s = placeShip(0, WORLD_W / 2, WORLD_H / 2);
  game.scoopLevel = 3; game.scoopHits = 0;
  const hit = () => { s.invuln = 0; return damageShip(10, s.x + 100, s.y); }; // non-lethal, i-frames cleared
  hit(); assert(game.scoopLevel === 3 && game.scoopHits === 1, "5: 1 hit -> still level 3, scoopHits 1");
  hit(); assert(game.scoopLevel === 2 && game.scoopHits === 0, "5: 2 hits -> dropped exactly one level (3->2), tally reset");
  hit(); hit(); assert(game.scoopLevel === 1, "5: 4 hits total from L3 -> dropped two levels (now 1)");
  // level 0: hits are harmless, no underflow, no crash
  game.scoopLevel = 0; game.scoopHits = 0;
  hit(); hit(); hit();
  assert(game.scoopLevel === 0 && game.scoopHits === 0, "5: hits at level 0 are harmless (no accumulation, no underflow)");
}

// =====================================================================
console.log("(6) a shielded / i-frame hit does NOT count toward scoopHits");
{
  beginPlaying();
  const s = placeShip(0, WORLD_W / 2, WORLD_H / 2);
  game.scoopLevel = 2; game.scoopHits = 0;
  s.shieldOn = true;
  const r1 = damageShip(10, s.x + 100, s.y);
  assert(r1 === false && game.scoopHits === 0 && game.scoopLevel === 2,
    "6: a shielded hit early-returns and does not touch scoopHits/scoopLevel");
  s.shieldOn = false; s.invuln = 1.0; // hit-stun i-frames
  const r2 = damageShip(10, s.x + 100, s.y);
  assert(r2 === false && game.scoopHits === 0 && game.scoopLevel === 2,
    "6: an i-frame hit early-returns and does not touch scoopHits/scoopLevel");
}

// =====================================================================
console.log("(7) maybeDropPowerup only yields weighted types; scoop can drop");
{
  beginPlaying();
  game.powerups = [];
  const allowed = new Set(Object.keys(POWERUP_DROP_WEIGHTS));
  for (let i = 0; i < 2000; i++) maybeDropPowerup(100, 100);
  const seen = new Set(game.powerups.map(p => p.type));
  assert(game.powerups.length > 0, "7: over 2000 rolls at least some powerups dropped");
  assert([...seen].every(t => allowed.has(t)), `7: every dropped type is in POWERUP_DROP_WEIGHTS (saw ${[...seen].join(",")})`);
  assert(seen.has("scoop"), "7: scoop actually drops from the weighted table");
  assert(!seen.has("health"), "7: Health never drops (ambient-only)");
}

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
