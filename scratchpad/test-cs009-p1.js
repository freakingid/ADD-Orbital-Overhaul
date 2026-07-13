// Headless test for CS009 Phase 1 — HUD plumbing (HUD_* constants, drawRingArc(), eased game.hudHull).
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator (+ fake localStorage), eval the REAL
// <script> block, then drive the ACTUAL startGame()/update()/drawRingArc() — no reimplementation.
//
//   node scratchpad/test-cs009-p1.js
//
// Checks:
//  (A) game.hudHull converges to the true fraction within ~0.5s of simulated update() calls.
//  (B) frame-rate independence — 2x update(1/60) lands within 1% of 1x update(1/30).
//  (C) startGame() resets hudHull to the fresh ship's true fraction (1, since a new Ship is full HP).
//  (D) drawRingArc doesn't throw against the stubbed ctx and passes frac > 1 through unclamped
//      (no clamping inside the helper — callers clamp; banking can exceed 1.0).

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ---- Headless environment stubs (mirrors test-v36-death.js) ----
const noopCtx = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };

function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} },
    Q: { value: 0 }, type: "sine", buffer: null, loop: false, playbackRate: { value: 1 },
    connect() { return makeAudioNode(); }
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
function FakeAudioContext() {
  return new Proxy({
    state: "running", currentTime: 0, sampleRate: 44100, destination: makeAudioNode(),
    createGain() { return makeAudioNode(); },
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; }
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}

const listeners = {};
const windowStub = {
  addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
  innerWidth: 1280, innerHeight: 720,
  AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext
};
const performanceStub = { now: () => Date.now() };
const rafStub = () => 0;
const navigatorStub = { getGamepads: () => [] };

const lsStore = {};
global.localStorage = {
  getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: k => { delete lsStore[k]; }
};

const returnList = [
  "startGame", "update", "game", "drawRingArc", "AudioSys",
  "SHIP_MAX_HP", "HUD_EASE", "HUD_RING_W", "HUD_RING_BLUR"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, global.localStorage);
const { startGame, update, game, drawRingArc, AudioSys, SHIP_MAX_HP, HUD_EASE, HUD_RING_W, HUD_RING_BLUR } = A;

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }

AudioSys.init();

// ================= (A) hudHull converges to the true fraction within ~0.5s =================
(function sectionA() {
  startGame();
  game.ship.hp = SHIP_MAX_HP;   // fresh ship is already full HP, but be explicit
  game.hudHull = 1;

  game.ship.hp = 50;   // sudden big hit — true fraction drops to 50/250 = 0.2
  const target = game.ship.hp / SHIP_MAX_HP;

  const dt = 1 / 60;
  const frames = Math.ceil(0.5 / dt);
  for (let i = 0; i < frames; i++) update(dt);

  // HUD_EASE's own comment claims ~0.35s to close 95% of the gap, so 0.5s should have closed at
  // least that much (remaining gap <= ~5% of the original 0.8 = 0.04).
  const startGap = 1 - target;
  assert(Math.abs(game.hudHull - target) < 0.05 * startGap,
    `A: hudHull converges to within 95% of the gap after 0.5s (got ${game.hudHull}, target ${target})`);
})();

// ================= (B) frame-rate independence =================
(function sectionB() {
  startGame();
  game.ship.hp = 30; // fixed target throughout — no ship-logic side effects, isolate the ease math

  // Path 1: 2x update(1/60) per "tick"
  game.hudHull = 0.7;
  const targetHp = game.ship.hp;
  for (let i = 0; i < 30; i++) {
    game.ship.hp = targetHp; // pin hp so ship.update()'s own regen/logic can't drift the target
    update(1 / 60);
    game.ship.hp = targetHp;
    update(1 / 60);
  }
  const result60 = game.hudHull;

  // Path 2: 1x update(1/30) per "tick" — same total elapsed time
  startGame();
  game.hudHull = 0.7;
  for (let i = 0; i < 30; i++) {
    game.ship.hp = targetHp;
    update(1 / 30);
  }
  const result30 = game.hudHull;

  const diff = Math.abs(result60 - result30);
  assert(diff < 0.01 * Math.max(Math.abs(result60), Math.abs(result30), 1),
    `B: 2x update(1/60) (${result60}) within 1% of 1x update(1/30) (${result30})`);
})();

// ================= (C) startGame() resets hudHull =================
(function sectionC() {
  startGame();
  game.hudHull = 0.1; // corrupt it mid-run
  game.ship.hp = 5;
  startGame(); // fresh Ship() is full HP -> hudHull should reset to 1, no drain animation
  assert(game.hudHull === 1, `C: startGame() resets hudHull to 1 (fresh ship full HP), got ${game.hudHull}`);
})();

// ================= (D) drawRingArc doesn't throw, passes frac > 1 through unclamped =================
(function sectionD() {
  let threw = false;
  try {
    drawRingArc(1156, 74, 30, 0.5, "#5fe08a");
    drawRingArc(1156, 74, 30, 1.4, "#ffcf5a", HUD_RING_W, HUD_RING_BLUR); // overcharge, frac > 1
    drawRingArc(1156, 74, 30, 0, "#5fe08a");   // frac <= 0 -> early return, no throw
    drawRingArc(1156, 74, 30, -0.3, "#5fe08a"); // frac < 0 -> early return, no throw
  } catch (e) {
    threw = true;
    console.error("  drawRingArc threw:", e);
  }
  assert(!threw, "D: drawRingArc does not throw against the stubbed ctx");
  // Nothing to clamp against in the stubbed no-op ctx — the assertion is that the call above with
  // frac=1.4 didn't throw or get intercepted by an internal clamp (there is no Math.min/max in the
  // helper's source), i.e. the contract is "callers clamp, not drawRingArc".
  const src = html.slice(html.indexOf("function drawRingArc"), html.indexOf("function drawRingArc") + 400);
  assert(!/Math\.min|Math\.max|clamp01/.test(src), "D: drawRingArc source contains no internal clamping");
})();

// ---- summary ----
console.log(`\ntest-cs009-p1: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
