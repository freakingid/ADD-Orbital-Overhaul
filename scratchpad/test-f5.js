// Headless test for Phase 5 (F4 Hunter Satellites — killer-satellite/wedge redesign).
// Follows GDD 5.4 rule 7: stub window/document/rAF, eval the REAL <script> block,
// then drive the actual game code (no reimplementation).
//
//   node scratchpad/test-f5.js
//
// Confirms:
//  (A) destroying a full Hunter lineage (1 large -> 3 mediums -> 9 smalls) = 13 kills, and (v3.4 P1)
//      exactly HUNTER_GARBAGE[3] + 3*HUNTER_GARBAGE[2] normal-mass (1.0) + 9*HUNTER_GARBAGE[1]
//      low-mass (0.5) canisters, per-tier, from the real destroyHunter path;
//  (B) per-tier split + garbage in isolation: large -> 3 mediums + HUNTER_GARBAGE[3]x mass-1.0;
//      medium -> 3 smalls + HUNTER_GARBAGE[2]x mass-1.0; small -> destroyed (no children) +
//      HUNTER_GARBAGE[1]x mass-0.5;
//  (C) per-tier damage/score tables, the passive-vs-homing split, and spawnCore making a core;
//  (D) EVERY speed & turn rate wires through difficultyFactor: wave-1 values sit exactly on
//      the HUNTER_FLOOR_FRAC floor and are meaningfully slower than wave-20 values (all tiers),
//      while the large core's drift *speed* scales but it never homes;
//  (E) split children ACTIVELY home — a homer re-aims its heading toward the ship over frames;
//  (F) a Hunter body touching a tow-chain node severs the chain (chain-vulnerability preserved).

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
  "HunterSatellite", "Garbage", "destroyHunter",
  "HUNTER_RADII", "HUNTER_SCORE", "HUNTER_DAMAGE",
  "HUNTER_SPEED_CEIL", "HUNTER_TURN_CEIL", "HUNTER_FLOOR_FRAC", "HUNTER_SCATTER",
  "HUNTER_GARBAGE", "HUNTER_SMALL_MASS",
  "difficultyFactor", "angleTo",
  "WORLD_W", "WORLD_H"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub);
const {
  startGame, update, game, keys,
  HunterSatellite, Garbage, destroyHunter,
  HUNTER_RADII, HUNTER_SCORE, HUNTER_DAMAGE,
  HUNTER_SPEED_CEIL, HUNTER_TURN_CEIL, HUNTER_FLOOR_FRAC, HUNTER_SCATTER,
  HUNTER_GARBAGE, HUNTER_SMALL_MASS,
  difficultyFactor, angleTo,
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
  game.state = "playing"; game.paused = false;
}
function node(x, y, mass) {
  return { x, y, px: x, py: y, spin: 0, spinRate: 0, mass };
}

startGame();
game.state = "playing"; game.paused = false;
console.log(`(config) FLOOR_FRAC=${HUNTER_FLOOR_FRAC}  HUNTER_GARBAGE=${JSON.stringify(HUNTER_GARBAGE)}@mass${HUNTER_SMALL_MASS}(small)  SPEED_CEIL=${JSON.stringify(HUNTER_SPEED_CEIL)}`);

// =====================================================================
// (A) full Hunter lineage: 13 kills; per-tier canister counts (v3.4 P1)
// =====================================================================
console.log("(A) full lineage kill / tiered-garbage counts");
clearField();
game.wave = 3;
game.hunters = [new HunterSatellite(cx, cy, 3, 0)];
game.garbage.length = 0;
let kills = 0;
const sizesKilled = [];
while (game.hunters.length) {
  const current = game.hunters;
  game.hunters = [];                 // children destroyHunter pushes accumulate here
  for (const h of current) { sizesKilled.push(h.size); destroyHunter(h); kills++; }
}
const largeK = sizesKilled.filter(s => s === 3).length;
const medK   = sizesKilled.filter(s => s === 2).length;
const smallK = sizesKilled.filter(s => s === 1).length;
assert(kills === 13, `A: lineage produced 13 kills (got ${kills})`);
assert(largeK === 1 && medK === 3 && smallK === 9,
  `A: tier kill breakdown 1 large / 3 medium / 9 small (got ${largeK}/${medK}/${smallK})`);
const normalMass = game.garbage.filter(g => g.mass === 1.0).length;
const lowMass    = game.garbage.filter(g => g.mass === HUNTER_SMALL_MASS).length;
const expectNormal = HUNTER_GARBAGE[3] + 3 * HUNTER_GARBAGE[2];
const expectLow = 9 * HUNTER_GARBAGE[1];
assert(normalMass === expectNormal, `A: ${expectNormal} normal-mass canisters (1 large + 3 mediums) (got ${normalMass})`);
assert(lowMass === expectLow, `A: ${expectLow} low-mass canisters (9 smalls x ${HUNTER_GARBAGE[1]}) (got ${lowMass})`);
assert(game.garbage.length === expectNormal + expectLow,
  `A: total ${expectNormal + expectLow} canisters from a full lineage (got ${game.garbage.length})`);
const massSum = game.garbage.reduce((s, g) => s + g.mass, 0);
const expectMass = expectNormal * 1.0 + expectLow * HUNTER_SMALL_MASS;
assert(near(massSum, expectMass), `A: total towable mass sums to ${expectMass} (got ${massSum})`);

// =====================================================================
// (B) per-tier split + tiered garbage mass in isolation
// =====================================================================
console.log("(B) per-tier splits + tiered garbage mass");
clearField();
destroyHunter(new HunterSatellite(cx, cy, 3, 0));
assert(game.garbage.length === HUNTER_GARBAGE[3] && game.garbage.every(g => g.mass === 1.0),
  `B: large drops exactly ${HUNTER_GARBAGE[3]} normal-mass (1.0) canisters (got ${game.garbage.length})`);
assert(game.hunters.length === 3 && game.hunters.every(h => h.size === 2 && h.homing),
  "B: large -> 3 actively-homing mediums");

clearField();
destroyHunter(new HunterSatellite(cx, cy, 2, 0));
assert(game.garbage.length === HUNTER_GARBAGE[2] && game.garbage.every(g => g.mass === 1.0),
  `B: medium drops exactly ${HUNTER_GARBAGE[2]} normal-mass (1.0) canisters (got ${game.garbage.length})`);
assert(game.hunters.length === 3 && game.hunters.every(h => h.size === 1 && h.homing),
  "B: medium -> 3 actively-homing smalls");

clearField();
destroyHunter(new HunterSatellite(cx, cy, 1, 0));
assert(game.hunters.length === 0, "B: small -> no children (destroyed)");
assert(game.garbage.length === HUNTER_GARBAGE[1] && game.garbage.every(g => g.mass === HUNTER_SMALL_MASS),
  `B: small drops a burst of ${HUNTER_GARBAGE[1]} LOW-mass (${HUNTER_SMALL_MASS}) canisters (got ${game.garbage.length} @ masses [${[...new Set(game.garbage.map(g => g.mass))]}])`);

// =====================================================================
// (C) damage / score tables, passive-vs-homing, spawnCore
// =====================================================================
console.log("(C) damage / score tables, passive-vs-homing, spawnCore");
game.wave = 5;
const L = new HunterSatellite(cx, cy, 3, 0);
const M = new HunterSatellite(cx, cy, 2, 0);
const S = new HunterSatellite(cx, cy, 1, 0);
assert(L.damage === 60 && M.damage === 45 && S.damage === 30,
  `C: contact damage 60/45/30 by tier (got ${L.damage}/${M.damage}/${S.damage})`);
assert(HUNTER_DAMAGE[3] === 60 && HUNTER_DAMAGE[2] === 45 && HUNTER_DAMAGE[1] === 30, "C: HUNTER_DAMAGE table 60/45/30");
assert(HUNTER_SCORE[3] === 200 && HUNTER_SCORE[2] === 150 && HUNTER_SCORE[1] === 250,
  "C: score 200/150/250 (small worth the most — hardest to hit, preserves the old wedge value)");
assert(L.homing === false, "C: large core is PASSIVE (does not home)");
assert(M.homing === true && S.homing === true, "C: medium & small ACTIVELY home");
assert(L.radius === HUNTER_RADII[3] && M.radius === HUNTER_RADII[2] && S.radius === HUNTER_RADII[1], "C: per-tier collision radii");
const core = HunterSatellite.spawnCore();
assert(core.size === 3 && core.homing === false, "C: spawnCore() makes a passive large core");

// =====================================================================
// (D) difficulty scaling: floor at wave 1, meaningfully faster by wave 20 (every tier)
// =====================================================================
console.log("(D) difficulty ramp wired into every speed & turn rate");
function tier(size, wave) { game.wave = wave; return new HunterSatellite(cx, cy, size, 0); }
assert(near(difficultyFactor(1), 0), "D: difficultyFactor(1) == 0 (wave 1 sits exactly on the floor)");

for (const size of [3, 2, 1]) {
  const w1 = tier(size, 1), w20 = tier(size, 20);
  // wave-1 speed is exactly the floor fraction of the ceiling
  assert(near(w1.speed, HUNTER_SPEED_CEIL[size] * HUNTER_FLOOR_FRAC),
    `D[size ${size}]: wave-1 speed == ceiling x FLOOR_FRAC (${(HUNTER_SPEED_CEIL[size] * HUNTER_FLOOR_FRAC).toFixed(1)}, got ${w1.speed.toFixed(1)})`);
  // and meaningfully slower than wave 20 (ratio ~0.60 given df(20)~0.907)
  const ratio = w1.speed / w20.speed;
  assert(ratio > 0.5 && ratio < 0.72,
    `D[size ${size}]: wave-1 speed is meaningfully slower than wave 20 (ratio ${ratio.toFixed(3)}, exp ~0.60)`);
  assert(w1.speed < w20.speed - 1, `D[size ${size}]: speed climbs wave 1 -> 20 (${w1.speed.toFixed(1)} < ${w20.speed.toFixed(1)})`);
  // turn rate scales the same way for the homing tiers; the large core never turns
  if (size === 3) {
    assert(w1.turnRate === 0 && w20.turnRate === 0, "D[large]: core turn rate is 0 at all waves (passive drift)");
  } else {
    assert(near(w1.turnRate, HUNTER_TURN_CEIL[size] * HUNTER_FLOOR_FRAC),
      `D[size ${size}]: wave-1 turn rate == ceiling x FLOOR_FRAC (got ${w1.turnRate.toFixed(3)})`);
    assert(w1.turnRate < w20.turnRate - 0.05, `D[size ${size}]: turn rate climbs wave 1 -> 20 (${w1.turnRate.toFixed(2)} < ${w20.turnRate.toFixed(2)})`);
  }
}
// concrete headline: a small homer at wave 1 vs wave 20
const s1 = tier(1, 1), s20 = tier(1, 20);
console.log(`  small homer speed: wave1 ${s1.speed.toFixed(0)} px/s  vs  wave20 ${s20.speed.toFixed(0)} px/s  (turn ${s1.turnRate.toFixed(2)} vs ${s20.turnRate.toFixed(2)} rad/s)`);
// the large core's drift speed scales but stays passive
const L1 = tier(3, 1), L20 = tier(3, 20);
assert(L1.speed < L20.speed && L1.homing === false && L20.homing === false,
  `D: large core drift speed scales (${L1.speed.toFixed(0)} -> ${L20.speed.toFixed(0)}) yet never homes`);

// =====================================================================
// (E) split children actively home — heading re-aims toward the ship
// =====================================================================
console.log("(E) active homing: a homer re-aims toward the ship");
resetShip({ x: cx, y: cy });
game.wave = 20;
const homer = new HunterSatellite(cx + 200, cy, 1, 0);   // starts pointing +x (heading 0)
homer.speed = 0; homer.vx = 0; homer.vy = 0;              // freeze position so the target angle is fixed
homer.scatter = 0;                                        // skip the scatter window; home immediately
const targetHeading = angleTo(homer, game.ship);          // ship is at -x from the homer => PI
assert(Math.abs(Math.abs(targetHeading) - Math.PI) < 1e-6, "E: target heading toward ship is +/-PI (geometry pinned)");
for (let i = 0; i < 300; i++) homer.update(DT);
assert(near(Math.abs(homer.heading), Math.PI, 1e-4),
  `E: homer re-aimed from heading 0 to face the ship (heading ${homer.heading.toFixed(4)}, target +/-${Math.PI.toFixed(4)})`);

// =====================================================================
// (F) a Hunter body touching a chain node severs the tow chain
// =====================================================================
console.log("(F) chain vulnerability: Hunter contact severs the chain");
clearField();
resetShip();                                       // ship at (cx,cy), facing up (angle -PI/2)
game.wave = 3;
game.hunterTimer = 999; game.saucerTimer = 999;    // suppress spawns during the driven frame
// The chain solver pulls each node to one CHAIN_LINK from the anchor before the collision
// pass runs, so pin the single node exactly there (constraint already satisfied -> it stays
// put) and drop the Hunter on top of it. The spot is ~32px from the ship: clear of the
// ship's own collision radius, so only the chain-vs-hazard pass can fire.
const ax = game.ship.x - Math.cos(game.ship.angle) * 12;
const ay = game.ship.y - Math.sin(game.ship.angle) * 12;
const nx = ax, ny = ay + 20;                       // one link out from the anchor
game.chain.push(node(nx, ny, 1.0));
const hz = new HunterSatellite(nx, ny, 1, 0);      // small Hunter sitting on the chain node
hz.speed = 0; hz.vx = 0; hz.vy = 0; hz.scatter = 999;  // frozen in place
game.hunters.push(hz);
assert(game.chain.length === 1, "F: chain has one node before contact");
update(DT);
assert(game.chain.length === 0, "F: Hunter contact severed the tow chain (node destroyed)");
assert(!hz.dead, "F: the Hunter itself survives — it cuts the chain, it isn't consumed");

// =====================================================================
// (G) shield: homing Hunters die on contact (and still split); the core bounces
// =====================================================================
console.log("(G) shield: homers die+split on contact; the core bounces");
keys["shift"] = true;                                 // ship.update() derives shieldOn from the held key each frame
clearField();
resetShip({ energy: 1 });
game.wave = 3;
game.hunterTimer = 999; game.saucerTimer = 999;
const med = new HunterSatellite(cx + 20, cy, 2, 0);   // inside the shield band (26+15 > 20)
med.speed = 0; med.vx = 0; med.vy = 0;                 // freeze so it stays overlapping
game.hunters.push(med);
update(DT);
assert(med.dead, "G: a medium Hunter is destroyed on shield contact");
assert(game.hunters.length === 3 && game.hunters.every(h => h.size === 1),
  `G: the shield-killed medium still split into 3 smalls (got ${game.hunters.length})`);
assert(game.garbage.length === HUNTER_GARBAGE[2] && game.garbage.every(g => g.mass === 1.0),
  `G: shield-kill still emitted the tier's ${HUNTER_GARBAGE[2]} normal-mass canisters`);
assert(game.ship.energy < 1 - 1e-9, `G: the shield-kill cost deflection energy (${game.ship.energy.toFixed(3)} < 1)`);
assert(game.ship.hp === 250, "G: shielded — no hull damage taken from the contact");

clearField();
resetShip({ energy: 1 });
game.wave = 3;
game.hunterTimer = 999; game.saucerTimer = 999;
const bigCore = new HunterSatellite(cx + 20, cy, 3, 0);  // large core inside the shield band
bigCore.vx = 0; bigCore.vy = 0;
game.hunters.push(bigCore);
update(DT);
assert(!bigCore.dead && game.hunters.length === 1, "G: the large core is NOT destroyed by the shield (it bounces)");
assert(Math.hypot(bigCore.vx, bigCore.vy) > 0, "G: the bounced core was shoved away (velocity set by shieldDeflect)");
keys["shift"] = false;

// ---- Summary ----
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
