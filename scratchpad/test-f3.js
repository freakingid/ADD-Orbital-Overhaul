// Headless test for Phase 3 (F3 Debris Satellites + F5 variable-mass garbage).
// Follows GDD 5.4 rule 7: stub window/document/rAF, eval the REAL <script> block,
// then drive the actual game code (no reimplementation).
//
//   node scratchpad/test-f3.js
//
// Confirms:
//  (A) destroying a full lineage (1 large -> 3 mediums -> 9 smalls) = 13 kills and
//      EXACTLY 39 garbage canisters (guaranteed 3 per tier, incl. the small tier);
//  (B) per-tier split/emit counts in isolation (3-way split at large/medium, small
//      destroyed; every tier drops exactly 3 canisters);
//  (C) the F5 `mass` field: default 1.0, carried by Garbage.fromNode(), copied onto
//      the chain node at pickup, and preserved through a chain sever;
//  (D) chain tow physics now scale off the chain's MASS SUM, not its node count:
//      thrust penalty, top-speed penalty, and the momentum tug all match the mass-sum
//      formulas, and an 8x mass-1.0 chain tows IDENTICALLY to a 16x mass-0.5 chain.

"use strict";
const fs = require("fs");
const path = require("path");

// ---- Extract the real game script from the single-file build ----
const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ---- Headless environment stubs ----
const noopCtx = new Proxy({}, { get: () => () => {} });          // every ctx method is a no-op
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub };
const windowStub = {
  addEventListener: () => {},
  innerWidth: 1280, innerHeight: 720,
  AudioContext: function () {}, webkitAudioContext: function () {}
};
const performanceStub = { now: () => Date.now() };
const rafStub = () => 0;               // never actually runs the game loop
const navigatorStub = { getGamepads: () => [] };

const returnList = [
  "startGame", "update", "game", "keys",
  "DebrisSatellite", "Garbage",
  "destroyDebris", "updateChain", "scatterChain", "chainMass",
  "DEBRIS_GARBAGE", "DEBRIS_SCORE",
  "GARBAGE_PICKUP", "GARBAGE_DECAY", "DEBUG",
  "CHAIN_LINK", "CHAIN_TUG", "CARGO_MASS", "CARGO_THRUST", "CARGO_MAXSPD",
  "SHIP_THRUST", "SHIP_MAX_SPEED", "SHIP_DRAG",
  "WORLD_W", "WORLD_H"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub);
const {
  startGame, update, game, keys,
  DebrisSatellite, Garbage,
  destroyDebris, updateChain, scatterChain, chainMass,
  DEBRIS_GARBAGE, GARBAGE_DECAY,
  GARBAGE_PICKUP, DEBUG,
  CHAIN_LINK, CHAIN_TUG, CARGO_MASS, CARGO_THRUST, CARGO_MAXSPD,
  SHIP_THRUST, SHIP_MAX_SPEED, SHIP_DRAG,
  WORLD_W, WORLD_H
} = A;

const DT = 1 / 60;
const cx = WORLD_W / 2, cy = WORLD_H / 2;
let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error("  FAIL: " + msg); }
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// ---- Helpers ----
function clearField() {
  game.debris.length = 0; game.hunters.length = 0;
  game.saucers.length = 0; game.bullets.length = 0; game.chain.length = 0;
  game.garbage.length = 0; game.particles.length = 0; game.floaters.length = 0;
}
function resetShip(over = {}) {
  Object.assign(game.ship, {
    dead: false, hp: 250, invuln: 0, shieldOn: false, energy: 1,
    angle: -Math.PI / 2, x: cx, y: cy, vx: 0, vy: 0
  }, over);
  // Clear any active powerups so a random Engine drop from a prior update() can't halve chainMass
  // (ENGINE_MASS_MULT) and flake the (D) mass-sum assertions. (Fix owned by the B-8 chain phase.)
  game.powerFx = { rapid: 0, triple: 0, magnet: 0, engine: 0 };
  game.state = "playing"; game.paused = false;
}
function node(x, y, mass) {
  return { x, y, px: x, py: y, spin: 0, spinRate: 0, mass };
}

startGame();
game.state = "playing"; game.paused = false;
console.log(`(config) DEBRIS_GARBAGE=${DEBRIS_GARBAGE}  (garbage decays on DEBUG.garbageLifetime=${DEBUG.garbageLifetime}, CS015 P6; was the frozen GARBAGE_DECAY=${GARBAGE_DECAY} single-only)`);

// =====================================================================
// (A) full lineage: 1 large -> 3 mediums -> 9 smalls = 13 kills, 13*DEBRIS_GARBAGE canisters
// =====================================================================
console.log("(A) full lineage kill/garbage counts");
clearField();
game.debris = [new DebrisSatellite(cx, cy, 3, 1)];
game.garbage.length = 0;
let kills = 0;
const sizesKilled = [];
while (game.debris.length) {
  const current = game.debris;
  game.debris = [];                 // children destroyDebris pushes accumulate here
  for (const d of current) { sizesKilled.push(d.size); destroyDebris(d); kills++; }
}
const largeK = sizesKilled.filter(s => s === 3).length;
const medK   = sizesKilled.filter(s => s === 2).length;
const smallK = sizesKilled.filter(s => s === 1).length;
assert(kills === 13, `A: lineage produced 13 kills (got ${kills})`);
assert(largeK === 1 && medK === 3 && smallK === 9,
  `A: tier kill breakdown 1 large / 3 medium / 9 small (got ${largeK}/${medK}/${smallK})`);
assert(game.garbage.length === 13 * DEBRIS_GARBAGE,
  `A: exactly ${13 * DEBRIS_GARBAGE} canisters from a fully-cleared large lineage (got ${game.garbage.length})`);
assert(game.garbage.every(g => g.mass === 1.0),
  "A: every Debris-sourced canister is mass 1.0");

// =====================================================================
// (B) per-tier split + guaranteed 3-canister drop in isolation
// =====================================================================
console.log("(B) per-tier splits + guaranteed 3-canister drops");
clearField();
destroyDebris(new DebrisSatellite(cx, cy, 3, 1));
assert(game.garbage.length === DEBRIS_GARBAGE, `B: large drops exactly ${DEBRIS_GARBAGE} canisters (got ${game.garbage.length})`);
assert(game.debris.length === 3 && game.debris.every(d => d.size === 2), "B: large -> 3 mediums");

clearField();
destroyDebris(new DebrisSatellite(cx, cy, 2, 1));
assert(game.garbage.length === DEBRIS_GARBAGE, `B: medium drops exactly ${DEBRIS_GARBAGE} canisters (got ${game.garbage.length})`);
assert(game.debris.length === 3 && game.debris.every(d => d.size === 1), "B: medium -> 3 smalls");

clearField();
destroyDebris(new DebrisSatellite(cx, cy, 1, 1));
assert(game.garbage.length === DEBRIS_GARBAGE, `B: small (final tier) still drops exactly ${DEBRIS_GARBAGE} canisters (got ${game.garbage.length})`);
assert(game.debris.length === 0, "B: small -> no children (destroyed)");

// =====================================================================
// (C) the F5 mass field
// =====================================================================
console.log("(C) mass field: default, fromNode carry, pickup copy, sever preserve");
assert(new Garbage(cx, cy).mass === 1.0, "C: Garbage default mass is 1.0");
assert(new Garbage(cx, cy, 0, 0, 0.5).mass === 0.5, "C: Garbage explicit mass is carried (mass is now the 5th ctor arg; v3.2 P3 dropped decay)");
assert(Garbage.fromNode({ x: cx, y: cy, mass: 0.5 }).mass === 0.5, "C: fromNode carries node mass (0.5)");
assert(Garbage.fromNode({ x: cx, y: cy }).mass === 1.0, "C: fromNode on a mass-less node defaults to 1.0");

// pickup copies mass onto the new chain node (drive the real pickup pass)
clearField();
resetShip();
game.garbage.push(new Garbage(game.ship.x + 2, game.ship.y, 0, 0, 0.5));
update(DT);
assert(game.chain.length === 1, "C: a canister within pickup radius hooked onto the chain");
assert(game.chain.length === 1 && game.chain[0].mass === 0.5,
  `C: pickup copied mass 0.5 onto the chain node (got ${game.chain[0] && game.chain[0].mass})`);

// severing a mixed-mass chain preserves each node's mass as free garbage
clearField();
resetShip();
game.chain.push(node(cx, cy, 1.0));
game.chain.push(node(cx, cy, 0.5));
scatterChain();
assert(game.chain.length === 0, "C: scatterChain empties the chain");
const scatMass = game.garbage.map(g => g.mass).sort();
assert(game.garbage.length === 2 && scatMass[0] === 0.5 && scatMass[1] === 1.0,
  `C: scattered garbage preserves node masses [0.5, 1.0] (got [${scatMass}])`);
// v3.3 P4 (9a): severed garbage (Garbage.fromNode) is a single, so it inherits the ONE life clock
// (the old separate GARBAGE_SEVER_DECAY stays deleted — one constant/knob). CS015 P6: that one clock
// is now the live DEBUG.garbageLifetime debug var, not the frozen GARBAGE_DECAY const (see test-cs015-p6.js).
assert(game.garbage.every(g => g.pieces === 1 && g.decay === DEBUG.garbageLifetime),
  "C: severed garbage inherits the single garbageLifetime life clock (no separate sever-decay)");

// =====================================================================
// (D) chain tow physics use the MASS SUM (8x1.0 tows identically to 16x0.5)
// =====================================================================
console.log("(D) mass-sum chain physics (thrust / top-speed / tug)");

// chainMass() itself
clearField(); resetShip();
game.chain.push(...Array.from({ length: 8 }, () => node(cx, cy, 1.0)));
assert(near(chainMass(), 8), `D: chainMass of 8x1.0 = 8 (got ${chainMass()})`);
game.chain.length = 0;
game.chain.push(...Array.from({ length: 16 }, () => node(cx, cy, 0.5)));
assert(near(chainMass(), 8), `D: chainMass of 16x0.5 = 8, the equivalent haul (got ${chainMass()})`);

// -- thrust penalty: one isolated ship.update from rest, measure velocity gained --
function measureThrustVx(masses) {
  clearField(); resetShip({ angle: 0 });
  game.chain.push(...masses.map(mm => node(cx, cy, mm)));
  keys["arrowup"] = true;
  game.ship.update(DT);
  keys["arrowup"] = false;
  return game.ship.vx;
}
const drag = Math.pow(1 - SHIP_DRAG, DT);
const expThrustMul8 = 1 / (1 + 8 * CARGO_THRUST);
const expVx8 = SHIP_THRUST * expThrustMul8 * DT * drag;   // angle 0 => pure +x, from rest
const vx8 = measureThrustVx(Array(8).fill(1.0));
assert(near(vx8, expVx8, 1e-9),
  `D: 8-node thrust accel matches mass-sum thrustMul (got ${vx8.toFixed(6)}, exp ${expVx8.toFixed(6)})`);
const vx16 = measureThrustVx(Array(16).fill(0.5));
assert(near(vx16, vx8, 1e-9), `D: thrust — 16x0.5 tows identically to 8x1.0 (got ${vx16.toFixed(6)} vs ${vx8.toFixed(6)})`);
// and it really is heavier than an empty ship
const vx0 = measureThrustVx([]);
assert(vx8 < vx0, `D: an 8-mass chain accelerates slower than an empty ship (${vx8.toFixed(3)} < ${vx0.toFixed(3)})`);

// -- top speed: run to terminal velocity, compare to mass-sum maxSp --
function terminalSpeed(masses) {
  clearField(); resetShip({ angle: 0 });
  game.chain.push(...masses.map(mm => node(cx, cy, mm)));
  keys["arrowup"] = true;
  for (let i = 0; i < 600; i++) game.ship.update(DT);   // ~10s of pure thrust
  keys["arrowup"] = false;
  return Math.hypot(game.ship.vx, game.ship.vy);
}
const expMaxSp8 = SHIP_MAX_SPEED / (1 + 8 * CARGO_MAXSPD);
const term8 = terminalSpeed(Array(8).fill(1.0));
assert(Math.abs(term8 - expMaxSp8) < expMaxSp8 * 0.02 && term8 <= expMaxSp8 + 1e-6,
  `D: 8-node terminal speed ~= mass-sum maxSp ${expMaxSp8.toFixed(1)} (got ${term8.toFixed(1)})`);
const term16 = terminalSpeed(Array(16).fill(0.5));
assert(Math.abs(term16 - term8) < 0.5, `D: top speed — 16x0.5 == 8x1.0 (got ${term16.toFixed(2)} vs ${term8.toFixed(2)})`);

// -- momentum tug: call updateChain directly with a known first-link stretch --
function measureTugVx(masses, stretch) {
  clearField(); resetShip({ angle: 0 });     // anchor = ship.x - 12, on the +x axis
  const anchorX = game.ship.x - 12, anchorY = game.ship.y;
  const n0x = anchorX + CHAIN_LINK + stretch; // first node pulled straight +x, taut
  game.chain.push(node(n0x, anchorY, masses[0]));
  for (let i = 1; i < masses.length; i++) game.chain.push(node(n0x + i * CHAIN_LINK, anchorY, masses[i]));
  updateChain(DT);                            // only the tug writes to ship.vx here
  return game.ship.vx;
}
const stretch = 10;
const expMassFactor8 = Math.min(1.4, 8 * CARGO_MASS);
const expTugVx8 = CHAIN_TUG * stretch * expMassFactor8 * DT;  // node0 pulls in +x
const tug8 = measureTugVx(Array(8).fill(1.0), stretch);
assert(near(tug8, expTugVx8, 1e-6),
  `D: tug impulse matches mass-sum massFactor (got ${tug8.toFixed(6)}, exp ${expTugVx8.toFixed(6)})`);
const tug16 = measureTugVx(Array(16).fill(0.5), stretch);
assert(near(tug16, tug8, 1e-9), `D: tug — 16x0.5 == 8x1.0 (got ${tug16.toFixed(6)} vs ${tug8.toFixed(6)})`);

// ---- Summary ----
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
