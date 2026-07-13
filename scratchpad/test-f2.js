// Headless test for Phase 2 (F2): HP pool + knockback + hit-stun replacing lives.
// Follows GDD 5.4 rule 7: stub window/document/rAF, eval the REAL <script> block,
// then drive update()/damageShip() against the actual game code (no reimplementation).
//
//   node scratchpad/test-f2.js
//
// Confirms: (a) HP drops by the right amount per hit type, (b) hit-stun prevents
// double-damage across consecutive frames, (c) knockback shoves the ship away from
// the hazard, (d) 0 HP triggers a permanent game over with no respawn attempt,
// plus the score-milestone hull-repair bonus and that the shield still blocks
// damage+knockback entirely.

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

// Build a factory that returns the internal bindings we want to drive/inspect.
const returnList = [
  "startGame", "update", "game", "keys",
  "DebrisSatellite", "HunterSatellite", "Saucer", "Bullet",
  "damageShip", "killShip", "addScore",
  "SHIP_MAX_HP", "DMG_SMALL", "DMG_MEDIUM", "DMG_LARGE", "DMG_BULLET", "HUNTER_DAMAGE",
  "KNOCKBACK_SPEED", "HIT_STUN_DURATION",
  "REPAIR_MILESTONE", "REPAIR_AMOUNT", "REPAIR_FULL_BONUS",
  "WORLD_W", "WORLD_H", "SHIP_RADIUS"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub);
const {
  startGame, update, game, keys,
  DebrisSatellite, HunterSatellite, Saucer, Bullet,
  damageShip, addScore,
  SHIP_MAX_HP, DMG_SMALL, DMG_MEDIUM, DMG_LARGE, DMG_BULLET, HUNTER_DAMAGE,
  KNOCKBACK_SPEED, HIT_STUN_DURATION,
  REPAIR_MILESTONE, REPAIR_AMOUNT, REPAIR_FULL_BONUS,
  WORLD_W, WORLD_H
} = A;

const DT = 1 / 60;
let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error("  FAIL: " + msg); }
}

// ---- Helpers ----
function clearField() {
  game.debris.length = 0; game.hunters.length = 0;
  game.saucers.length = 0; game.bullets.length = 0; game.chain.length = 0;
  game.garbage.length = 0; game.particles.length = 0;
}
function resetShip(over = {}) {
  Object.assign(game.ship, {
    dead: false, hp: SHIP_MAX_HP, invuln: 0, shieldOn: false, energy: 1,
    x: WORLD_W / 2, y: WORLD_H / 2, vx: 0, vy: 0
  }, over);
  game.state = "playing"; game.paused = false; // a live ship implies an active game
}
// A hazard placed a few px to the +x of the ship (overlapping), velocity zeroed
// so it stays put for deterministic assertions.
function place(hazard, arr, dx = 6, dy = 0) {
  hazard.x = game.ship.x + dx; hazard.y = game.ship.y + dy;
  hazard.vx = 0; hazard.vy = 0;
  arr.push(hazard);
  return hazard;
}

startGame();
game.state = "playing"; game.paused = false;

// =====================================================================
// (a) HP decreases by the correct amount per hit type
// =====================================================================
console.log("(a) per-hit-type damage amounts");
function oneHit(label, expected, setup) {
  clearField();
  resetShip();
  const before = game.ship.hp;
  setup();
  update(DT);
  const delta = before - game.ship.hp;
  assert(Math.abs(delta - expected) < 1e-6, `${label}: HP -${delta}, expected -${expected}`);
  assert(Math.abs(game.ship.invuln - HIT_STUN_DURATION) < 0.02,
    `${label}: hit-stun opened (~${HIT_STUN_DURATION}s, got ${game.ship.invuln.toFixed(3)})`);
}
oneHit("large debris",  DMG_LARGE,  () => place(new DebrisSatellite(0, 0, 3, 1), game.debris));
oneHit("medium debris", DMG_MEDIUM, () => place(new DebrisSatellite(0, 0, 2, 1), game.debris));
oneHit("small debris",  DMG_SMALL,  () => place(new DebrisSatellite(0, 0, 1, 1), game.debris));
// Hunter Satellites (F4/v1.6) replaced the killer satellite + wedges, with their own
// higher per-tier contact damage (60/45/30). This still exercises the generic F2 path:
// damageShip applies each hazard's own `.damage` field.
oneHit("large hunter",  HUNTER_DAMAGE[3], () => place(new HunterSatellite(0, 0, 3), game.hunters));
oneHit("medium hunter", HUNTER_DAMAGE[2], () => place(new HunterSatellite(0, 0, 2, 0), game.hunters));
oneHit("small hunter",  HUNTER_DAMAGE[1], () => place(new HunterSatellite(0, 0, 1, 0), game.hunters));
oneHit("big saucer",   DMG_MEDIUM, () => place(new Saucer(false), game.saucers));
oneHit("small saucer", DMG_SMALL,  () => place(new Saucer(true), game.saucers));
oneHit("hostile bullet", DMG_BULLET, () => place(new Bullet(0, 0, 0, 0, true), game.bullets));

// =====================================================================
// (b) hit-stun prevents double-damage in consecutive frames
// =====================================================================
console.log("(b) hit-stun blocks repeat damage");
clearField();
resetShip();
const rockB = place(new DebrisSatellite(0, 0, 3, 1), game.debris);
update(DT);
const hpAfterFirst = game.ship.hp;
assert(hpAfterFirst === SHIP_MAX_HP - DMG_LARGE, "b: first hit landed for DMG_LARGE");
assert(game.ship.invuln > 0, "b: hit-stun active after the first hit");
for (let i = 0; i < 10; i++) {
  rockB.x = game.ship.x + 6; rockB.y = game.ship.y; rockB.vx = 0; rockB.vy = 0; // re-overlap
  update(DT);
  assert(game.ship.hp === hpAfterFirst, `b: no further damage during stun (frame ${i + 1})`);
}
assert(game.ship.invuln > 0, "b: still stunned after 10 frames (<1s window)");
// once the stun window clears, damage lands again
game.ship.invuln = 0;
rockB.x = game.ship.x + 6; rockB.y = game.ship.y; rockB.vx = 0; rockB.vy = 0;
update(DT);
assert(game.ship.hp === hpAfterFirst - DMG_LARGE, "b: damage resumes after stun clears");

// =====================================================================
// (c) knockback changes ship velocity directly away from the hazard
// =====================================================================
console.log("(c) knockback direction & magnitude");
clearField();
resetShip();
place(new DebrisSatellite(0, 0, 3, 1), game.debris, 30, 0); // hazard to the +x side
update(DT);
const kbSpeed = Math.hypot(game.ship.vx, game.ship.vy);
assert(game.ship.vx < -1, `c: ship shoved in -x, away from the +x hazard (vx=${game.ship.vx.toFixed(1)})`);
assert(Math.abs(game.ship.vy) < 1, `c: shove is straight away, vy≈0 (got ${game.ship.vy})`);
assert(Math.abs(kbSpeed - KNOCKBACK_SPEED) < 1, `c: knockback speed ≈ ${KNOCKBACK_SPEED} (got ${kbSpeed.toFixed(1)})`);

// hazard on the opposite side flips the shove
clearField();
resetShip();
place(new DebrisSatellite(0, 0, 3, 1), game.debris, -30, 0); // hazard to the -x side
update(DT);
assert(game.ship.vx > 1, `c: opposite hazard shoves ship in +x (vx=${game.ship.vx.toFixed(1)})`);

// =====================================================================
// (d) 0 HP => permanent game over, no respawn
// =====================================================================
console.log("(d) lethal hit => game over, no respawn");
clearField();
resetShip({ hp: 10 });
game.state = "playing";
game.chain.push({ x: game.ship.x - 12, y: game.ship.y, px: game.ship.x - 12, py: game.ship.y, spin: 0, spinRate: 0, mass: 1 });
place(new DebrisSatellite(0, 0, 3, 1), game.debris); // 50 dmg vs 10 hp -> lethal
update(DT);
assert(game.ship.hp === 0, "d: HP floored at 0");
assert(game.ship.dead === true, "d: ship is dead");
// v3.6 P5: a lethal hit now enters the "dying" death spectacle first, not straight to "gameover".
assert(game.state === "dying", "d: enters the 'dying' death spectacle, not straight to game-over");
assert(game.chain.length === 0, "d: tow chain scattered on death");
assert(game.garbage.length >= 1, "d: scattered chain became free garbage");
assert(game.lives === undefined, "d: no lives counter remains on game state");
assert(game.respawnTimer === undefined, "d: no respawn timer remains on game state");
for (let i = 0; i < 200; i++) update(DT); // ~3.3s: past the 2.5s death spectacle; old code would have respawned by now
assert(game.ship.dead === true, "d: ship stays dead — no respawn attempt after 3s");
assert(game.state === "gameover", "d: settles into game-over after the death spectacle");
assert(game.ship.hp === 0, "d: HP never restored by a respawn");

// =====================================================================
// (e/f) score-milestone hull repair (replaces extra life)
// =====================================================================
console.log("(e/f) score-milestone hull repair");
clearField();
resetShip({ hp: 100 });
game.score = 0; game.nextRepair = REPAIR_MILESTONE;
addScore(REPAIR_MILESTONE);
assert(game.ship.hp === 100 + REPAIR_AMOUNT, `e: below-max milestone repairs +${REPAIR_AMOUNT} HP (hp=${game.ship.hp})`);
assert(game.nextRepair === REPAIR_MILESTONE * 2, "e: next repair threshold advanced by one interval");

resetShip({ hp: SHIP_MAX_HP });
game.score = REPAIR_MILESTONE; game.nextRepair = REPAIR_MILESTONE * 2;
addScore(REPAIR_MILESTONE); // crosses the 2nd milestone at full HP
assert(game.ship.hp === SHIP_MAX_HP, "f: at full HP, repair stays capped");
assert(game.score === REPAIR_MILESTONE * 2 + REPAIR_FULL_BONUS,
  `f: full-HP milestone paid a flat ${REPAIR_FULL_BONUS} bonus instead (score=${game.score})`);

// =====================================================================
// (g) shield still prevents damage AND knockback entirely
// =====================================================================
console.log("(g) shield blocks damage + knockback");
clearField();
resetShip();
keys["shift"] = true; // hold shield so Ship.update keeps shieldOn true
place(new DebrisSatellite(0, 0, 3, 1), game.debris);
const energyBefore = game.ship.energy;
update(DT);
assert(game.ship.hp === SHIP_MAX_HP, "g: shielded hit deals no HP damage");
assert(game.ship.invuln === 0, "g: shielded hit grants no hit-stun");
assert(Math.hypot(game.ship.vx, game.ship.vy) < 1, "g: shielded hit applies no knockback to the ship");
assert(game.ship.energy < energyBefore, "g: shield deflection consumed energy");
keys["shift"] = false;

// ---- Summary ----
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
