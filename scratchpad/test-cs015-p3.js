// Headless test for CS015 Phase P3 (items 9, 8) — wave clears on debris-empty alone (Hunters/loose
// garbage carry over by design); the Scoop mouth now also captures powerups.
//
//   node scratchpad/test-cs015-p3.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL update()/nextWave()/inScoopBox()/applyPowerup() — never
// reimplement game logic. Sections:
//  (A) node --check on the extracted <script>.
//  (B) Item 9 — with game.debris forced empty and a live Hunter + a loose garbage piece placed at the
//      wrap-toroidal antipode of the ship (so neither can incidentally collide with it in the ~2.6s
//      window), driving the REAL update() loop until the wave-clear timer (>2.5s) fires nextWave():
//      the wave advances by exactly 1, the SAME Hunter and garbage instances survive into the new wave
//      (nextWave() does not clear game.hunters/game.garbage), and fresh debris is added on top.
//  (C) Item 8 — a powerup positioned just outside the base pickup circle (r = p.radius + SHIP_RADIUS)
//      is NOT collected at scoopLevel 0 (inScoopBox is unconditionally false there); the same-shaped
//      placement, but inside the scoop mouth (inScoopBox true) at scoopLevel >= 1, IS collected — via
//      the real update() powerup-pickup loop, so it's the real inScoopBox() + real applyPowerup() that
//      run, confirmed by powerupsPicked incrementing and the real powerFx effect landing.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs015p3_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try {
    execSync(`node --check "${tmp}"`, { stdio: "pipe" });
    passed++;
  } catch (e) {
    failed++;
    console.error("  FAIL: node --check: " + e.stderr.toString());
  } finally {
    fs.unlinkSync(tmp);
  }
})();

const noopCtx = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
const windowStub = {
  addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
  AudioContext: undefined, webkitAudioContext: undefined
};
const performanceStub = { now: () => Date.now() };
const rafStub = () => 0;
const navigatorStub = { getGamepads: () => [] };
const lsStore = {};
const localStorageStub = {
  getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: k => { delete lsStore[k]; }
};

const RETURN = [
  "startGame", "update", "nextWave", "game", "dist2", "inScoopBox",
  "HunterSatellite", "Garbage", "Powerup",
  "SHIP_RADIUS", "SCOOP_WIDTH", "SCOOP_DEPTH", "WORLD_W", "WORLD_H"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, localStorageStub);
const {
  startGame, update, nextWave, game, dist2, inScoopBox,
  HunterSatellite, Garbage, Powerup,
  SHIP_RADIUS, SCOOP_WIDTH, SCOOP_DEPTH, WORLD_W, WORLD_H
} = A;

// ================= (B) wave clears on debris-empty; Hunters/garbage carry over =================
(function sectionB() {
  console.log("(B) Wave clears on debris-empty alone; a live Hunter + loose garbage carry into the new wave, new debris added on top");
  startGame(); // wave = 1 (startGame's own nextWave() call)
  const waveBefore = game.wave;
  assert(waveBefore === 1, "B: sanity — fresh game starts at wave 1");

  game.debris = []; // force the debris-empty condition immediately, before any update() runs
  const ship = game.ship;
  // Wrap-toroidal antipode of the ship's spawn point — the maximum possible separation on this
  // world, so neither the Hunter's slow "last stand" drift nor the ship can reach the other within
  // the few seconds this test drives.
  const oppX = (ship.x + WORLD_W / 2) % WORLD_W;
  const oppY = (ship.y + WORLD_H / 2) % WORLD_H;

  const hunter = new HunterSatellite(oppX, oppY, 3);
  game.hunters = [hunter];
  const garbage = new Garbage(oppX, oppY, 0, 0);
  game.garbage = [garbage];
  assert(dist2(hunter, ship) > 1000 * 1000, "B: sanity — the test Hunter starts far outside any collision range of the ship");
  assert(!hunter.dead && !garbage.dead, "B: sanity — the test Hunter and garbage start alive");

  let guard = 0;
  while (game.wave === waveBefore && guard++ < 200) update(0.1);

  assert(guard < 200, "B: nextWave fired within the guard window (wave-clear timer > 2.5s of debris-empty)");
  assert(game.wave === waveBefore + 1, `B: wave advanced by exactly 1 on debris-empty (got ${game.wave})`);
  assert(game.hunters.includes(hunter), "B: the live Hunter carried over into the new wave (nextWave does not clear game.hunters)");
  assert(!hunter.dead, "B: the carried Hunter was not incidentally destroyed along the way");
  assert(game.garbage.includes(garbage), "B: the loose garbage carried over into the new wave (nextWave does not clear game.garbage)");
  assert(!garbage.dead, "B: the carried garbage was not incidentally destroyed/decayed along the way");
  assert(game.debris.length > 0, "B: fresh debris was added on top of the carried-over hazards for the new wave");
})();

// ================= (C) Scoop mouth captures powerups =================
(function sectionC() {
  console.log("(C) Scoop mouth also captures powerups: miss outside r at level 0, hit inside the mouth (outside r) at level >=1");
  startGame(); // fresh, deterministic ship: world center, angle -PI/2 (facing -y => forward axis is -dy, lateral is +dx)
  const ship = game.ship;
  assert(ship.x === WORLD_W / 2 && ship.y === WORLD_H / 2 && ship.angle === -Math.PI / 2,
    "C: sanity — fresh ship at world center facing up");

  // ---- sub-test 1: scoopLevel 0 — a powerup just outside the base pickup circle is NOT collected ----
  game.scoopLevel = 0;
  const p0 = new Powerup(ship.x, ship.y, "rapid");
  const r0 = p0.radius + SHIP_RADIUS;
  p0.x = ship.x; p0.y = ship.y - (r0 + 5); // straight ahead on the facing axis, just outside r0
  assert(dist2(p0, ship) > r0 * r0, "C: sanity — sub-test 1 powerup placed strictly outside the base pickup circle");
  assert(inScoopBox(p0) === false, "C: sanity — inScoopBox is unconditionally false at scoopLevel 0");
  game.powerups = [p0];
  const pickedBefore1 = game.stats.powerupsPicked;
  update(1 / 60);
  assert(p0.dead === false, "C: scoopLevel 0 — a powerup just outside r is NOT collected");
  assert(game.stats.powerupsPicked === pickedBefore1, "C: scoopLevel 0 miss — powerupsPicked unchanged (applyPowerup did not run)");

  // ---- sub-test 2: scoopLevel >= 1 — a powerup inside the scoop mouth but outside r IS collected ----
  game.scoopLevel = 5; // max level -> largest mouth, most margin over the base circle
  const p1 = new Powerup(ship.x, ship.y, "rapid");
  const r1 = p1.radius + SHIP_RADIUS;
  const forward = Math.min(SCOOP_DEPTH[5], r1 + 10); // clears the base circle, stays within the mouth's depth
  assert(forward > r1, "C: sanity — the chosen forward offset clears the base pickup radius");
  assert(forward <= SCOOP_DEPTH[5], "C: sanity — the chosen forward offset stays within the mouth's depth at level 5");
  p1.x = ship.x; p1.y = ship.y - forward; // lateral = 0 (dead ahead), well within SCOOP_WIDTH[5]/2
  assert(dist2(p1, ship) > r1 * r1, "C: sanity — sub-test 2 powerup placed strictly outside the base pickup circle");
  assert(inScoopBox(p1) === true, "C: sanity — inScoopBox is true at scoopLevel >=1 for this placement");
  game.powerups = [p1];
  const pickedBefore2 = game.stats.powerupsPicked;
  const fxBefore = game.powerFx.rapid;
  update(1 / 60);
  assert(p1.dead === true, "C: scoopLevel >=1 — a powerup inside the scoop mouth but outside r IS collected");
  assert(game.stats.powerupsPicked === pickedBefore2 + 1, "C: scoopLevel >=1 hit — powerupsPicked incremented (the real applyPowerup ran)");
  assert(game.powerFx.rapid > fxBefore, "C: the real applyPowerup ran — rapid powerFx duration was actually added");

  game.powerups = []; game.scoopLevel = 0; // restore
})();

console.log(`\ntest-cs015-p3: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
