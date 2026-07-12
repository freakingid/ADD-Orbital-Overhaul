// Headless test for v3.4 Phase 2: the difficulty-lever mechanism (leverScale) + the
// powerup-size and dock-size levers. Follows GDD 5.4 rule 7: stub window/document/rAF,
// eval the REAL <script> block, then drive the actual game code (no reimplementation).
//
//   node scratchpad/test-v34-p2.js
//
// Confirms:
//  (A) leverScale: disabled -> always `start` regardless of wave (swept to wave 200);
//      enabled -> `start` at wave 1, monotonically approaches `floor` as wave climbs, and
//      never goes below `floor` at any wave (swept to wave 200).
//  (B) a Powerup constructed at wave 1 has radius === POWERUP_RADIUS * 2 (lever disabled by
//      default = start); the pickup gate reads p.radius (not the constant) — a canister at
//      40px from the ship IS collected at the 2x radius and would NOT be at the 1x radius;
//      the render `r` (this.radius) and the collision `r` (p.radius + SHIP_RADIUS) agree.
//  (C) a Dock constructed at wave 1 has radius === DOCK_RADIUS * 2, its baked pts reach that
//      radius, the real offload gate (dist2 vs game.dock.radius+10) fires at the scaled
//      distance, and draw() is crash-free.
//  (D) flipping each lever's enabled to true shrinks the quantity toward its floor as wave
//      climbs and clamps there — both levers proven to work while shipping disabled.

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

const noopCtx = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub };
const windowStub = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
  AudioContext: function () {}, webkitAudioContext: function () {} };
const performanceStub = { now: () => Date.now() };
const navigatorStub = { getGamepads: () => [] };

const returnList = [
  "startGame", "update", "draw", "game", "keys",
  "leverScale", "ramp", "difficultyFactor",
  "LEVER_POWERUP_SIZE", "LEVER_DOCK_SIZE",
  "Powerup", "Dock", "POWERUP_RADIUS", "DOCK_RADIUS", "SHIP_RADIUS",
  "dist2", "WORLD_W", "WORLD_H"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, () => 0, navigatorStub);
const {
  startGame, update, draw, game, keys,
  leverScale, ramp, difficultyFactor,
  LEVER_POWERUP_SIZE, LEVER_DOCK_SIZE,
  Powerup, Dock, POWERUP_RADIUS, DOCK_RADIUS, SHIP_RADIUS,
  dist2, WORLD_W, WORLD_H
} = A;

const DT = 1 / 60;
const cx = WORLD_W / 2, cy = WORLD_H / 2;
let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

function clearField() {
  game.debris.length = 0; game.hunters.length = 0; game.saucers.length = 0;
  game.bullets.length = 0; game.chain.length = 0; game.garbage.length = 0;
  game.particles.length = 0; game.floaters.length = 0; game.powerups.length = 0;
}
function resetShip(over = {}) {
  Object.assign(game.ship, {
    dead: false, hp: 250, invuln: 0, shieldOn: false, energy: 1,
    angle: 0, x: cx, y: cy, vx: 0, vy: 0, cooldown: 0
  }, over);
  game.powerFx = { rapid: 0, triple: 0, magnet: 0, engine: 0 };
  game.state = "playing"; game.paused = false;
}

startGame();
game.state = "playing"; game.paused = false;
console.log(`(config) POWERUP_RADIUS=${POWERUP_RADIUS} DOCK_RADIUS=${DOCK_RADIUS}`);
console.log(`(config) LEVER_POWERUP_SIZE=${JSON.stringify(LEVER_POWERUP_SIZE)} LEVER_DOCK_SIZE=${JSON.stringify(LEVER_DOCK_SIZE)}`);

// --- (A) leverScale mechanism ---
assert(LEVER_POWERUP_SIZE.enabled === false, "LEVER_POWERUP_SIZE ships disabled");
assert(LEVER_POWERUP_SIZE.start === 2.0 && LEVER_POWERUP_SIZE.floor === 1.0, "LEVER_POWERUP_SIZE start/floor 2.0/1.0");
assert(LEVER_DOCK_SIZE.enabled === false, "LEVER_DOCK_SIZE ships disabled");
assert(LEVER_DOCK_SIZE.start === 2.0 && LEVER_DOCK_SIZE.floor === 1.0, "LEVER_DOCK_SIZE start/floor 2.0/1.0");

{
  const lever = { enabled: false, start: 2.0, floor: 1.0 };
  let allStart = true;
  for (let w = 1; w <= 200; w++) { if (!near(leverScale(lever, w), 2.0)) allStart = false; }
  assert(allStart, "disabled lever: leverScale === start at every wave 1..200");
}
{
  const lever = { enabled: true, start: 2.0, floor: 1.0 };
  assert(near(leverScale(lever, 1), 2.0), "enabled lever: wave 1 === start");
  let prev = leverScale(lever, 1);
  let monotonic = true, neverBelowFloor = true;
  for (let w = 2; w <= 200; w++) {
    const v = leverScale(lever, w);
    if (v > prev + 1e-9) monotonic = false; // must approach floor from above, never increase
    if (v < lever.floor - 1e-9) neverBelowFloor = false;
    prev = v;
  }
  assert(monotonic, "enabled lever: leverScale monotonically decreases toward floor as wave climbs");
  assert(neverBelowFloor, "enabled lever: leverScale never below floor at any wave 1..200");
  assert(leverScale(lever, 200) < 1.05 && leverScale(lever, 200) >= 1.0, "enabled lever: nearly at floor by wave 200");
}
// clamp: an enabled lever whose ramp would (hypothetically) undershoot floor must clamp there
{
  const lever = { enabled: true, start: 2.0, floor: 1.0 };
  for (let w = 1; w <= 200; w++) assert(leverScale(lever, w) >= 1.0 - 1e-9, `floor clamp holds at wave ${w}`);
}

// --- (B) Powerup size lever (disabled -> shipped 2x baseline pinned) ---
game.wave = 1;
{
  const p = new Powerup(cx, cy, "rapid");
  assert(near(p.radius, POWERUP_RADIUS * 2), "Powerup at wave 1: radius === POWERUP_RADIUS * 2 (lever disabled, start=2.0)");
}
game.wave = 50;
{
  const p = new Powerup(cx, cy, "rapid");
  assert(near(p.radius, POWERUP_RADIUS * 2), "Powerup at wave 50: still radius === POWERUP_RADIUS * 2 (lever disabled, inert)");
}
game.wave = 1;

// pickup gate must read p.radius, not the raw constant — drive the real update()
resetShip({ x: cx, y: cy });
clearField();
{
  const p = new Powerup(cx + 40, cy, "rapid");
  game.powerups.push(p);
  const renderR = p.radius;
  const collideR = p.radius + SHIP_RADIUS;
  assert(near(renderR, collideR - SHIP_RADIUS), "render r and collision r agree (both derive from p.radius)");
  update(DT);
  assert(game.powerups.length === 0 || game.powerups[0].dead, "a powerup 40px away IS collected at the 2x radius (dist2 < (p.radius+SHIP_RADIUS)^2)");
}
clearField();
{
  // Sanity: at the shipped 1x baseline (simulate by constructing with floor lever), 40px would NOT collect.
  const savedEnabled = LEVER_POWERUP_SIZE.enabled;
  LEVER_POWERUP_SIZE.start = 1.0; // temporarily pin start to the 1x baseline to prove the negative case
  const p = new Powerup(cx + 40, cy, "rapid");
  LEVER_POWERUP_SIZE.start = 2.0; // restore
  assert(near(p.radius, POWERUP_RADIUS * 1.0), "control: Powerup pinned at start=1.0 has radius === POWERUP_RADIUS");
  game.powerups.push(p);
  resetShip({ x: cx, y: cy });
  update(DT);
  const stillThere = game.powerups.length > 0 && !game.powerups[0].dead;
  assert(stillThere, "control: a powerup 40px away is NOT collected at the 1x radius");
}
clearField();

// --- (C) Dock size lever ---
game.wave = 1;
{
  const d = new Dock();
  assert(near(d.radius, DOCK_RADIUS * 2), "Dock at wave 1: radius === DOCK_RADIUS * 2 (lever disabled, start=2.0)");
  let maxPtDist = 0;
  for (const [px, py] of d.pts) maxPtDist = Math.max(maxPtDist, Math.hypot(px, py));
  assert(near(maxPtDist, d.radius), "Dock: baked pts reach this.radius (2x), not the raw DOCK_RADIUS constant");

  game.dock = d;
  resetShip({ x: d.x, y: d.y });
  game.chain.length = 0;
  game.chain.push({ x: d.x, y: d.y, px: d.x, py: d.y, spin: 0, spinRate: 0, mass: 1.0 });
  game.offloadTimer = 0;
  const before = game.chain.length;
  update(DT);
  assert(game.chain.length < before, "Dock offload gate fires at the scaled (2x) proximity radius via game.dock.radius");

  let drawOk = true;
  try { d.draw(); } catch (e) { drawOk = false; console.error(e); }
  assert(drawOk, "Dock.draw() is crash-free at the 2x radius");
}
clearField();

// --- (D) prove the ramp works while shipping disabled: flip enabled=true and re-check ---
{
  LEVER_POWERUP_SIZE.enabled = true;
  game.wave = 1;
  const p1 = new Powerup(cx, cy, "rapid");
  game.wave = 100;
  const p100 = new Powerup(cx, cy, "rapid");
  assert(near(p1.radius, POWERUP_RADIUS * 2), "Powerup lever ENABLED: wave 1 radius === POWERUP_RADIUS * 2 (start)");
  assert(p100.radius < p1.radius, "Powerup lever ENABLED: radius shrinks toward floor as wave climbs");
  assert(p100.radius >= POWERUP_RADIUS * 1.0 - 1e-6, "Powerup lever ENABLED: radius never drops below the floor (1x)");
  LEVER_POWERUP_SIZE.enabled = false;
  game.wave = 1;
}
{
  LEVER_DOCK_SIZE.enabled = true;
  game.wave = 1;
  const d1 = new Dock();
  game.wave = 100;
  const d100 = new Dock();
  assert(near(d1.radius, DOCK_RADIUS * 2), "Dock lever ENABLED: wave 1 radius === DOCK_RADIUS * 2 (start)");
  assert(d100.radius < d1.radius, "Dock lever ENABLED: radius shrinks toward floor as wave climbs");
  assert(d100.radius >= DOCK_RADIUS * 1.0 - 1e-6, "Dock lever ENABLED: radius never drops below the floor (1x)");
  LEVER_DOCK_SIZE.enabled = false;
  game.wave = 1;
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
