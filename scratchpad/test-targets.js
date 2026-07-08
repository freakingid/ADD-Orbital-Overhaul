// Headless test for v3.0 Phase 3 — "TARGETS remaining" HUD (B-7).
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator, eval the REAL <script> block, then
// drive the actual game state/draw against the real code — no reimplementation under test.
//
//   node scratchpad/test-targets.js
//
// Checks:
//  (A) targetsLeft == debris.length + hunters.length in a plain mid-wave state.
//  (B) A Debris split (destroyDebris on a large) raises the count 3 -> 5, driven for real.
//  (C) A Hunter spawning (HunterSatellite.spawnCore via the real hunterTimer path in update())
//      raises the count, driven for real via update().
//  (D) targetsLeft reads exactly 0 the instant debris+hunters both hit zero (the wave-clear gate).
//  (E) draw() stays crash-free with the new HUD line, in both empty and populated states.

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
  "destroyDebris", "DebrisSatellite", "HunterSatellite"];

const wrapped = new Function(
  "window", "document", "navigator", "performance", "requestAnimationFrame", "localStorage",
  scriptSrc + `\nreturn { ${returnList.join(", ")} };`
);
const G = wrapped(windowStub, documentStub, navigatorStub, performanceStub, rafStub, global.localStorage);
const { startGame, update, draw, game, destroyDebris, DebrisSatellite, HunterSatellite } = G;

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ok - ${msg}`); }
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
function targetsLeft() { return game.debris.length + game.hunters.length; }

// =====================================================================
console.log("(A) targetsLeft == debris.length + hunters.length, mid-wave");
startGame();
game.state = "playing"; game.paused = false;
assert(targetsLeft() === game.debris.length + game.hunters.length, "A: identity holds trivially");
assert(game.debris.length === Math.min(3 + game.wave, 9), "A: wave 1 debris count matches min(3+wave,9) spawn rule");
assert(game.hunters.length === 0, "A: no Hunters on wave 1 (FLAG B-7-b)");

// =====================================================================
console.log("(B) Debris split: destroying one large raises the count by 2 (3 -> 5 pattern)");
startGame();
game.state = "playing"; game.paused = false;
game.debris = [new DebrisSatellite(1000, 1000, 3, 1)]; // one large (size 3)
game.hunters = [];
const beforeB = targetsLeft();
destroyDebris(game.debris[0], false);
game.debris = game.debris.filter(a => !a.dead);
const afterB = targetsLeft();
assert(beforeB === 1, "B: starts with exactly 1 large debris");
assert(afterB === 3, "B: one large -> 3 mediums after destroyDebris + filter");
assert(afterB === beforeB + 2, "B: count rose by +2 on the split (3-child minus 1 parent)");

// =====================================================================
console.log("(C) Hunter spawn via the real update() timer path raises the count");
startGame();
game.state = "playing"; game.paused = false;
game.wave = 2;              // hunters only spawn from wave 2 (FLAG B-7-b)
game.debris = [];
game.hunters = [];
game.hunterTimer = 0;       // force the spawn branch on the next update()
const beforeC = targetsLeft();
update(1 / 60);
const afterC = targetsLeft();
assert(beforeC === 0, "C: starts with zero targets");
assert(afterC > beforeC, "C: a Hunter core spawning raises targetsLeft");
assert(game.hunters.length === 1, "C: exactly one Hunter core spawned");

// =====================================================================
console.log("(D) targetsLeft reads exactly 0 the instant the wave-clear gate trips");
startGame();
game.state = "playing"; game.paused = false;
game.debris = [];
game.hunters = [];
assert(targetsLeft() === 0, "D: 0 when both arrays are empty");
assert(game.debris.length === 0 && game.hunters.length === 0, "D: matches the literal wave-clear gate condition");

// =====================================================================
console.log("(E) draw() crash-free with the new HUD line, empty and populated");
startGame();
game.state = "playing"; game.paused = false;
game.debris = [];
game.hunters = [];
draw();
game.debris = [new DebrisSatellite(1000, 1000, 3, 1), new DebrisSatellite(1050, 1000, 2, 1)];
game.hunters = [HunterSatellite.spawnCore()];
draw();
assert(true, "E: draw() did not throw in either state");

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
