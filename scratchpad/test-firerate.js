// Headless test for v3.0 Phase 2 — fire-rate rebalance (B-6).
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator, eval the REAL <script> block, then
// drive the actual fire block over N real frames — no reimplementation under test.
//
//   node scratchpad/test-firerate.js
//
// Checks:
//  (A) FIRE_COOLDOWN / RAPID_FIRE_COOLDOWN constants exist, rapid is faster than base.
//  (B) Post-shot cooldown equals FIRE_COOLDOWN with Rapid inactive.
//  (C) Post-shot cooldown equals RAPID_FIRE_COOLDOWN with Rapid active.
//  (D) Driving the real fire block over N seconds yields more shots/sec with Rapid active
//      than without, and Triple alone (no Rapid) still uses the base cadence.
//  (E) draw()/update() stay crash-free with Rapid active (regression smoke).

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

const returnList = ["startGame", "update", "draw", "game", "keys",
  "FIRE_COOLDOWN", "RAPID_FIRE_COOLDOWN"];

const wrapped = new Function(
  "window", "document", "navigator", "performance", "requestAnimationFrame", "localStorage",
  scriptSrc + `\nreturn { ${returnList.join(", ")} };`
);
const G = wrapped(windowStub, documentStub, navigatorStub, performanceStub, rafStub, global.localStorage);
const { startGame, update, draw, game, keys, FIRE_COOLDOWN, RAPID_FIRE_COOLDOWN } = G;

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ok - ${msg}`); }
  else { failed++; console.log(`  FAIL - ${msg}`); }
}

// =====================================================================
console.log("(A) constants exist and rapid is faster than base");
assert(typeof FIRE_COOLDOWN === "number", "A: FIRE_COOLDOWN is a number");
assert(typeof RAPID_FIRE_COOLDOWN === "number", "A: RAPID_FIRE_COOLDOWN is a number");
assert(RAPID_FIRE_COOLDOWN < FIRE_COOLDOWN, "A: RAPID_FIRE_COOLDOWN < FIRE_COOLDOWN");
assert(Math.abs(FIRE_COOLDOWN - 0.20) < 1e-9, "A: base FIRE_COOLDOWN retuned to 0.20");
assert(Math.abs(RAPID_FIRE_COOLDOWN - 0.09) < 1e-9, "A: RAPID_FIRE_COOLDOWN is 0.09");

// =====================================================================
console.log("(B) post-shot cooldown == FIRE_COOLDOWN with Rapid inactive");
startGame();
game.state = "playing"; game.paused = false;
game.powerFx.rapid = 0; game.powerFx.triple = 0;
game.ship.cooldown = 0;
keys[" "] = true;
update(1 / 60);
assert(Math.abs(game.ship.cooldown - FIRE_COOLDOWN) < 1e-9, "B: cooldown set to base FIRE_COOLDOWN");
keys[" "] = false;

// =====================================================================
console.log("(C) post-shot cooldown == RAPID_FIRE_COOLDOWN with Rapid active");
startGame();
game.state = "playing"; game.paused = false;
game.powerFx.rapid = 15; game.powerFx.triple = 0;
game.ship.cooldown = 0;
keys[" "] = true;
update(1 / 60);
assert(Math.abs(game.ship.cooldown - RAPID_FIRE_COOLDOWN) < 1e-9, "C: cooldown set to RAPID_FIRE_COOLDOWN");
keys[" "] = false;

// =====================================================================
console.log("(D) shots/sec: rapid > base; Triple alone stays on base cadence");
// Count fire EVENTS (volleys) directly by clearing game.bullets every frame (so RAPID_MAX_BULLETS's
// cap on simultaneously-alive bullets can't mask the cooldown-driven cadence difference) and counting
// frames where a new bullet appears — a direct observation of the real fire block firing, not an
// inference from cooldown's float value (whose remainder varies with cadence vs. frame length).
function countVolleys(seconds, { rapid = 0, triple = 0 } = {}) {
  startGame();
  game.state = "playing"; game.paused = false;
  game.ship.x = 1000; game.ship.y = 1000; game.ship.vx = 0; game.ship.vy = 0;
  game.powerFx.rapid = rapid; game.powerFx.triple = triple;
  game.ship.cooldown = 0;
  keys[" "] = true;
  let volleys = 0;
  const dt = 1 / 60;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    if (rapid) game.powerFx.rapid = rapid;   // hold the timer up so it can't expire mid-run
    if (triple) game.powerFx.triple = triple;
    game.bullets.length = 0;                 // clear each frame so MAX_BULLETS/RAPID/TRIPLE caps
                                              // never gate fire — isolates cooldown-driven cadence
    // Also clear ambient hazards each frame: this test measures *cooldown-driven* cadence only,
    // and a wave-1 debris/saucer/hunter drifting into the stationary ship can land a hit whose
    // hit-stun interrupts firing and drops the volley count — a pre-existing RNG-timing flake
    // (its rate rides on the shared Math.random sequence, so any unrelated change that consumes
    // RNG differently shifts it). Isolating the ship keeps section D deterministic.
    game.debris.length = 0; game.hunters.length = 0; game.saucers.length = 0;
    update(dt);
    if (game.bullets.length > 0) volleys++;
  }
  keys[" "] = false;
  return volleys;
}

const window_s = 1.0;
const baseVolleys = countVolleys(window_s, {});
const rapidVolleys = countVolleys(window_s, { rapid: 15 });
const tripleVolleys = countVolleys(window_s, { triple: 15 });

console.log(`    volleys/${window_s}s — base = ${baseVolleys}, rapid = ${rapidVolleys}, triple = ${tripleVolleys}`);
assert(rapidVolleys > baseVolleys, "D: Rapid Fire produces more shots/sec than base");
assert(Math.abs(tripleVolleys - baseVolleys) <= 1, "D: Triple alone fires at ~base cadence (Triple doesn't change cooldown)");

// Expected volley counts over 1s: base ~= floor(1/0.20)+1, rapid ~= floor(1/0.09)+1 ballpark.
assert(baseVolleys >= 4 && baseVolleys <= 6, "D: base cadence ~5 shots/sec at FIRE_COOLDOWN=0.20");
assert(rapidVolleys >= 9 && rapidVolleys <= 12, "D: rapid cadence ~10-11 shots/sec at RAPID_FIRE_COOLDOWN=0.09");

// =====================================================================
console.log("(E) crash-free regression smoke with Rapid active");
startGame();
game.state = "playing"; game.paused = false;
game.powerFx.rapid = 15;
keys[" "] = true;
for (let i = 0; i < 60; i++) { update(1 / 60); draw(); }
keys[" "] = false;
assert(true, "E: 60 frames of update()+draw() with Rapid active did not throw");

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
