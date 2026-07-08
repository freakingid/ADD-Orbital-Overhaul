// Headless test for Phase 6 (F6 Powerups).
// Follows GDD 5.4 rule 7: stub window/document/rAF, eval the REAL <script> block,
// then drive the actual game code (no reimplementation).
//
//   node scratchpad/test-f6.js
//
// Confirms:
//  (A) applyPowerup effect magnitudes — Health repairs +25 capped at max; each timed effect
//      arms its own powerFx slot to POWERUP_DURATION and no other;
//  (B) the flexible bullet cap — 4 / 8 (Rapid) / 12 (Triple), and Rapid+Triple together = 12
//      (the higher cap), NOT 24 (not multiplied);
//  (C) Triple Shot fires a 3-bullet spread (single otherwise); Rapid lets a 5th+ bullet fly;
//  (D) duration expiry — a timed effect counts down through update() to 0 and the cap resets;
//      a same-type pickup REFRESHES the timer (doesn't stack magnitude);
//  (E) Engine halves the EFFECTIVE towed mass fed to chainMass() (thrust/top-speed/tug);
//  (F) Magnet moves free garbage toward the ship over a few frames (real pull, not teleport),
//      and does NOT when inactive;
//  (G) drops come only from small-tier Debris/Hunter kills, never large, and never Health.

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
  "Powerup", "Garbage", "DebrisSatellite", "HunterSatellite",
  "applyPowerup", "maybeDropPowerup", "maxBullets", "chainMass",
  "destroyDebris", "destroyHunter",
  "POWERUP_DURATION", "POWERUP_HEALTH_AMOUNT", "POWERUP_DROP_TYPES", "POWERUP_DROP_CHANCE",
  "RAPID_MAX_BULLETS", "TRIPLE_MAX_BULLETS", "MAX_BULLETS", "TRIPLE_SPREAD",
  "ENGINE_MASS_MULT", "MAGNET_RANGE_MULT", "MAGNET_PICKUP_MULT",
  "GARBAGE_PICKUP", "SHIP_MAX_HP",
  "dist2", "shortDelta", "WORLD_W", "WORLD_H"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub);
const {
  startGame, update, game, keys,
  Powerup, Garbage, DebrisSatellite, HunterSatellite,
  applyPowerup, maybeDropPowerup, maxBullets, chainMass,
  destroyDebris, destroyHunter,
  POWERUP_DURATION, POWERUP_HEALTH_AMOUNT, POWERUP_DROP_TYPES, POWERUP_DROP_CHANCE,
  RAPID_MAX_BULLETS, TRIPLE_MAX_BULLETS, MAX_BULLETS, TRIPLE_SPREAD,
  ENGINE_MASS_MULT, MAGNET_RANGE_MULT, MAGNET_PICKUP_MULT,
  GARBAGE_PICKUP, SHIP_MAX_HP,
  dist2, shortDelta, WORLD_W, WORLD_H
} = A;

const DT = 1 / 60;
const cx = WORLD_W / 2, cy = WORLD_H / 2;
let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error("  FAIL: " + msg); }
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

function clearField() {
  game.debris.length = 0; game.hunters.length = 0;
  game.saucers.length = 0; game.bullets.length = 0; game.chain.length = 0;
  game.garbage.length = 0; game.particles.length = 0; game.floaters.length = 0;
  game.powerups.length = 0;
}
function resetFx() { game.powerFx = { rapid: 0, triple: 0, magnet: 0, engine: 0 }; }
function resetShip(over = {}) {
  Object.assign(game.ship, {
    dead: false, hp: 250, invuln: 0, shieldOn: false, energy: 1, cooldown: 0,
    angle: -Math.PI / 2, x: cx, y: cy, vx: 0, vy: 0
  }, over);
  game.state = "playing"; game.paused = false;
}
function quietTimers() { game.hunterTimer = 999; game.saucerTimer = 999; game.healthTimer = 999; }
function node(x, y, mass) { return { x, y, px: x, py: y, spin: 0, spinRate: 0, mass }; }

startGame();
game.state = "playing"; game.paused = false;
console.log(`(config) DURATION=${POWERUP_DURATION}s  DROP_CHANCE=${POWERUP_DROP_CHANCE}  caps 4/${RAPID_MAX_BULLETS}/${TRIPLE_MAX_BULLETS}  ENGINE_MULT=${ENGINE_MASS_MULT}  MAGNET_RANGE=${MAGNET_RANGE_MULT}x`);

// =====================================================================
// (A) applyPowerup effect magnitudes — one of each type
// =====================================================================
console.log("(A) applyPowerup effect magnitudes (one of each type)");
resetShip(); resetFx(); clearField();
// Health: instant +25, capped at max, and never touches a timer slot
game.ship.hp = 100;
applyPowerup("health");
assert(game.ship.hp === 125, `A: Health restores +${POWERUP_HEALTH_AMOUNT} HP (100 -> ${game.ship.hp})`);
game.ship.hp = SHIP_MAX_HP - 10;
applyPowerup("health");
assert(game.ship.hp === SHIP_MAX_HP, `A: Health is capped at max (got ${game.ship.hp}/${SHIP_MAX_HP})`);
assert(game.powerFx.health === undefined || game.powerFx.health === 0, "A: Health is instant — arms no timed slot");

for (const t of ["rapid", "triple", "magnet", "engine"]) {
  resetFx();
  applyPowerup(t);
  assert(near(game.powerFx[t], POWERUP_DURATION), `A: ${t} arms its slot to ${POWERUP_DURATION}s (got ${game.powerFx[t]})`);
  const others = ["rapid", "triple", "magnet", "engine"].filter(o => o !== t);
  assert(others.every(o => game.powerFx[o] === 0), `A: ${t} does not activate any other effect`);
}

// =====================================================================
// (B) flexible bullet cap — the headline "12 not 24" rule
// =====================================================================
console.log("(B) bullet cap: 4 / 8 (rapid) / 12 (triple) / 12 (both, NOT 24)");
resetFx(); assert(maxBullets() === MAX_BULLETS, `B: no powerup -> base cap ${MAX_BULLETS} (got ${maxBullets()})`);
resetFx(); game.powerFx.rapid = 5; assert(maxBullets() === RAPID_MAX_BULLETS, `B: Rapid -> ${RAPID_MAX_BULLETS} (got ${maxBullets()})`);
resetFx(); game.powerFx.triple = 5; assert(maxBullets() === TRIPLE_MAX_BULLETS, `B: Triple -> ${TRIPLE_MAX_BULLETS} (got ${maxBullets()})`);
resetFx(); game.powerFx.rapid = 5; game.powerFx.triple = 5;
assert(maxBullets() === TRIPLE_MAX_BULLETS, `B: Rapid+Triple -> the HIGHER cap ${TRIPLE_MAX_BULLETS} (got ${maxBullets()})`);
assert(maxBullets() !== RAPID_MAX_BULLETS * 3 && maxBullets() !== 24 && maxBullets() !== RAPID_MAX_BULLETS + TRIPLE_MAX_BULLETS,
  `B: Rapid+Triple is NOT multiplied/summed (got ${maxBullets()}, must be ${TRIPLE_MAX_BULLETS})`);

// =====================================================================
// (C) Triple Shot fires a 3-bullet spread; Rapid lifts the real cap
// =====================================================================
console.log("(C) triple-shot spread + rapid cap, driven through Ship.update's fire block");
keys[" "] = true; // input.fire()
// single shot (no weapon powerup)
resetShip(); resetFx(); clearField(); quietTimers();
game.ship.cooldown = 0;
game.ship.update(DT);
let mine = game.bullets.filter(b => !b.hostile);
assert(mine.length === 1, `C: a normal shot fires 1 bullet (got ${mine.length})`);

// triple shot
resetShip(); resetFx(); clearField(); quietTimers();
game.powerFx.triple = POWERUP_DURATION;
game.ship.cooldown = 0;
game.ship.update(DT);
mine = game.bullets.filter(b => !b.hostile);
assert(mine.length === 3, `C: Triple Shot fires 3 bullets in one volley (got ${mine.length})`);
// the three headings are the ship heading ± TRIPLE_SPREAD (ship velocity is 0, so bullet vel = dir*speed)
const angs = mine.map(b => Math.atan2(b.vy, b.vx)).sort((a, b) => a - b);
assert(near(angs[1] - angs[0], TRIPLE_SPREAD, 1e-4) && near(angs[2] - angs[1], TRIPLE_SPREAD, 1e-4),
  `C: the 3 bullets are evenly spread by TRIPLE_SPREAD=${TRIPLE_SPREAD} (gaps ${(angs[1]-angs[0]).toFixed(3)}/${(angs[2]-angs[1]).toFixed(3)})`);

// rapid cap: with 4 bullets already alive, base can't fire; Rapid (cap 8) can
resetShip(); resetFx(); clearField(); quietTimers();
for (let i = 0; i < 4; i++) game.bullets.push({ x: cx, y: cy, vx: 0, vy: 0, hostile: false, dead: false, update() {}, draw() {} });
game.ship.cooldown = 0;
game.ship.update(DT);
assert(game.bullets.filter(b => !b.hostile).length === 4, "C: at the base cap (4) a 5th bullet can't fire");
game.powerFx.rapid = POWERUP_DURATION;
game.ship.cooldown = 0;
game.ship.update(DT);
assert(game.bullets.filter(b => !b.hostile).length === 5, "C: Rapid Fire lets the 5th bullet fly (cap raised to 8)");
keys[" "] = false;

// =====================================================================
// (D) duration expiry + same-type refresh
// =====================================================================
console.log("(D) duration counts down to 0 (cap resets); same-type pickup refreshes, not stacks");
resetShip(); resetFx(); clearField(); quietTimers();
game.powerFx.rapid = 0.02;                 // about to expire
assert(maxBullets() === RAPID_MAX_BULLETS, "D: Rapid active before expiry -> cap 8");
for (let i = 0; i < 4; i++) update(DT);    // ~0.067s of game time drives the countdown to 0
assert(game.powerFx.rapid === 0, `D: the effect expired (powerFx.rapid ${game.powerFx.rapid})`);
assert(maxBullets() === MAX_BULLETS, `D: cap reset to ${MAX_BULLETS} after expiry (got ${maxBullets()})`);
// refresh: picking the same type back up sets the FULL duration, it doesn't add to what's left
resetFx();
game.powerFx.triple = 3;
applyPowerup("triple");
assert(near(game.powerFx.triple, POWERUP_DURATION), `D: same-type pickup REFRESHES to ${POWERUP_DURATION} (not 3+${POWERUP_DURATION}); got ${game.powerFx.triple}`);

// =====================================================================
// (E) Engine halves the effective towed mass in chainMass()
// =====================================================================
console.log("(E) Engine halves the effective towed mass (chainMass)");
resetShip(); resetFx(); clearField();
game.chain.push(node(cx, cy, 1.0), node(cx, cy, 1.0), node(cx, cy, 1.0), node(cx, cy, 1.0)); // 4x mass-1.0 = 4.0
assert(near(chainMass(), 4.0), `E: no Engine -> full towed mass (got ${chainMass()})`);
game.powerFx.engine = POWERUP_DURATION;
assert(near(chainMass(), 4.0 * ENGINE_MASS_MULT), `E: Engine -> mass x ${ENGINE_MASS_MULT} (got ${chainMass()}, exp ${4.0 * ENGINE_MASS_MULT})`);
// mixed masses too (low-mass Hunter scrap): 1.0 + 0.5 + 0.5 = 2.0 -> 1.0 under Engine
resetFx(); game.chain.length = 0;
game.chain.push(node(cx, cy, 1.0), node(cx, cy, 0.5), node(cx, cy, 0.5));
assert(near(chainMass(), 2.0), "E: mixed-mass chain sums correctly with no Engine (2.0)");
game.powerFx.engine = POWERUP_DURATION;
assert(near(chainMass(), 1.0), `E: mixed-mass chain halves under Engine (got ${chainMass()})`);

// =====================================================================
// (F) Magnet pulls free garbage toward the ship over a few frames
// =====================================================================
console.log("(F) Magnet pulls nearby garbage toward the ship (and doesn't when inactive)");
resetShip({ x: cx, y: cy }); resetFx(); clearField(); quietTimers();
// place a canister at +45px: inside the ~54px attraction range, outside the ~29px magnet pickup
const startX = cx + 45;
const g = new Garbage(startX, cy, 0, 0);
game.garbage.push(g);
game.powerFx.magnet = POWERUP_DURATION;
const dBefore = Math.sqrt(dist2(g, game.ship));
for (let i = 0; i < 6; i++) update(DT);
const dAfter = Math.sqrt(dist2(g, game.ship));
assert(!g.dead, "F: (setup) the canister wasn't collected yet — still a free pull to observe");
assert(dAfter < dBefore - 1, `F: Magnet moved the canister measurably closer (${dBefore.toFixed(1)} -> ${dAfter.toFixed(1)} px)`);
// its velocity now points toward the ship (ship is at -x from the canister, so vx < 0)
const [tx, ty] = shortDelta(g.x, g.y, game.ship.x, game.ship.y); // toward the ship
assert(g.vx * tx + g.vy * ty > 0, `F: the canister's velocity points toward the ship (v·toShip = ${(g.vx*tx+g.vy*ty).toFixed(0)} > 0)`);

// contrast: no magnet, an at-rest canister at the same spot stays put
resetShip({ x: cx, y: cy }); resetFx(); clearField(); quietTimers();
const g2 = new Garbage(cx + 45, cy, 0, 0);
game.garbage.push(g2);
const d2Before = Math.sqrt(dist2(g2, game.ship));
for (let i = 0; i < 6; i++) update(DT);
const d2After = Math.sqrt(dist2(g2, game.ship));
assert(near(d2Before, d2After, 0.5) && near(g2.vx, 0) && near(g2.vy, 0),
  `F: with no Magnet the at-rest canister doesn't drift (${d2Before.toFixed(1)} -> ${d2After.toFixed(1)} px, v=(${g2.vx.toFixed(2)},${g2.vy.toFixed(2)}))`);

// =====================================================================
// (G) drops only from small-tier kills; never Health
// =====================================================================
console.log("(G) drops come from small-tier kills only, and never Health");
assert(!POWERUP_DROP_TYPES.includes("health"), "G: Health is not in the drop pool (it's ambient-only)");
const realRandom = Math.random;

// forced drop: a small-tier Debris kill drops exactly one weapon/utility powerup
Math.random = () => 0.03;   // < POWERUP_DROP_CHANCE -> always drops; also picks index 0 ("rapid")
resetShip(); resetFx(); clearField(); game.wave = 3;
destroyDebris(new DebrisSatellite(cx, cy, 1), false);   // small tier
assert(game.powerups.length === 1 && POWERUP_DROP_TYPES.includes(game.powerups[0].type),
  `G: a small Debris kill dropped one drop-pool powerup (got ${game.powerups.length}, type ${game.powerups[0] && game.powerups[0].type})`);

// forced drop: a small-tier Hunter kill also drops
clearField();
destroyHunter(new HunterSatellite(cx, cy, 1, 0), false); // small tier
assert(game.powerups.length === 1 && POWERUP_DROP_TYPES.includes(game.powerups[0].type),
  `G: a small Hunter kill dropped one drop-pool powerup (got ${game.powerups.length})`);

// even with the roll forced to "always drop", a LARGE kill drops nothing (only small tier rolls)
clearField();
destroyDebris(new DebrisSatellite(cx, cy, 3), false);    // large tier -> splits, no drop
assert(game.powerups.length === 0, `G: a large Debris kill never drops a powerup (got ${game.powerups.length})`);
clearField();
destroyHunter(new HunterSatellite(cx, cy, 3, 0), false); // large tier -> splits, no drop
assert(game.powerups.length === 0, `G: a large Hunter kill never drops a powerup (got ${game.powerups.length})`);

// forced NO drop: below the chance, a small kill drops nothing
Math.random = () => 0.99;   // >= POWERUP_DROP_CHANCE -> never drops
clearField();
destroyDebris(new DebrisSatellite(cx, cy, 1), false);
assert(game.powerups.length === 0, `G: below the drop chance a small kill drops nothing (got ${game.powerups.length})`);
Math.random = realRandom;

// ---- Summary ----
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
