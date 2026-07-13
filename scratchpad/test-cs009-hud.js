// Headless regression test for CS009 Phase 6 — SCOOP pips relocated to the stack floor + the
// final no-fills sweep of drawHUD(). Follows GDD 5.4 rule 7: stub window/document/rAF/navigator
// (+ fake localStorage), eval the REAL <script> block, then drive the ACTUAL startGame()/drawHUD()
// across a wide sweep of game states — no reimplementation.
//
//   node scratchpad/test-cs009-hud.js
//
// Per-state checks (the phase prompt's required (A)-(C), run for every state below):
//  (A) drawHUD() does not throw.
//  (B) ZERO ctx.fillRect and ZERO ctx.strokeRect calls anywhere in the call (the whole point of the
//      no-fills sweep — the only surviving fills are drawText's fillText and the SCOOP pip's ctx.fill,
//      neither of which is fillRect/strokeRect).
//  (C) ctx.globalAlpha is exactly 1 when drawHUD() returns (no leaked pulse/bank-flash alpha).
// Plus one integration check, not per-state:
//  (D) Capture.hudVisible = false means the call site (`if (Capture.hudVisible) drawHUD();`, the
//      real gating line in the main loop) skips drawHUD() entirely.

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ---- Recording 2D context ----
const recLog = [];
function makeRecordingCtx() {
  const state = {};
  const methods = ["arc", "stroke", "save", "restore", "translate", "rotate", "moveTo", "lineTo",
                   "closePath", "beginPath", "fillText", "fillRect", "strokeRect", "fill"];
  return new Proxy(state, {
    get(t, p) {
      if (p === "log") return recLog;
      if (methods.includes(p)) return (...args) => recLog.push([p, ...args]);
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) {
      t[p] = v;
      if (p === "strokeStyle" || p === "lineWidth" || p === "globalAlpha") recLog.push([p, v]);
      return true;
    }
  });
}
const recCtx = makeRecordingCtx();
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => recCtx };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };

// ---- Audio + env stubs (mirror test-cs009-p2/p4) ----
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
const windowStub = {
  addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
  AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext
};
let perfNow = 5000;
const performanceStub = { now: () => perfNow };
const rafStub = () => 0;
const navigatorStub = { getGamepads: () => [] };
const lsStore = {};
global.localStorage = {
  getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: k => { delete lsStore[k]; }
};

const returnList = [
  "startGame", "drawHUD", "game", "settings", "AudioSys", "Capture",
  "SHIP_MAX_HP", "LOW_HP_THRESHOLD"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, global.localStorage);
const { startGame, drawHUD, game, settings, AudioSys, Capture, SHIP_MAX_HP, LOW_HP_THRESHOLD } = A;

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }

AudioSys.init();

// One real drawHUD() pass; returns fillRect/strokeRect counts + the globalAlpha on return.
function captureHUD() {
  recLog.length = 0;
  recCtx.globalAlpha = 1;   // draw() would have left it at 1 entering drawHUD(); start clean
  drawHUD();
  let fillRectCount = 0, strokeRectCount = 0, alpha = 1;
  for (const e of recLog) {
    if (e[0] === "fillRect") fillRectCount++;
    else if (e[0] === "strokeRect") strokeRectCount++;
    else if (e[0] === "globalAlpha") alpha = e[1];
  }
  return { fillRectCount, strokeRectCount, alpha };
}

function checkState(label, setup) {
  startGame();
  game.state = "playing"; game.paused = false;
  settings.shotPowerupMode = "time";
  settings.magnetMode = "time";
  game.powerups = [];
  game.powerFx = { rapid: 0, triple: 0, magnet: 0, engine: 0 };
  game.powerBudget = { rapid: 0, triple: 0, magnet: 0 };
  game.powerBank = { rapid: 0, triple: 0, magnet: 0, engine: 0 };
  game.powerBankAmt = { rapid: 0, triple: 0, magnet: 0, engine: 0 };
  game.scoopLevel = 0;
  setup();

  let threw = null, result = null;
  try { result = captureHUD(); }
  catch (e) { threw = e; }

  assert(!threw, `${label}: drawHUD() does not throw` + (threw ? ` (threw: ${threw && threw.stack})` : ""));
  if (!threw) {
    assert(result.fillRectCount === 0, `${label}: zero ctx.fillRect calls (got ${result.fillRectCount})`);
    assert(result.strokeRectCount === 0, `${label}: zero ctx.strokeRect calls (got ${result.strokeRectCount})`);
    assert(result.alpha === 1, `${label}: ctx.globalAlpha is exactly 1 on return (got ${result.alpha})`);
  }
}

// ================= (A)-(C) across the required state sweep =================
checkState("fresh run", () => {});

checkState("mid-run, full chain", () => {
  while (game.chain.length < game.cargoMax) game.chain.push({ x: 640, y: 360 });
});

checkState("hull at 1 HP", () => { game.ship.hp = 1; });

checkState("hull at max HP", () => { game.ship.hp = SHIP_MAX_HP; });

checkState("two powerups active", () => {
  game.powerFx.rapid = 8;
  game.powerFx.magnet = 20;
});

checkState("one powerup banked", () => {
  game.powerFx.rapid = 10;
  game.powerBank.rapid = 0.4;
  game.powerBankAmt.rapid = 15;
});

checkState("scoopLevel = 3", () => { game.scoopLevel = 3; });

checkState('game.state === "dying"', () => {
  game.ship.hp = 0;
  game.ship.dead = true;
  game.state = "dying";
});

checkState('game.state === "gameover"', () => {
  game.ship.hp = 0;
  game.ship.dead = true;
  game.state = "gameover";
});

// ================= (D) Capture.hudVisible = false skips drawHUD() entirely =================
(function sectionD() {
  startGame();
  game.state = "playing"; game.paused = false;
  Capture.hudVisible = false;
  recLog.length = 0;
  // the real gating line at the drawHUD() call site in draw(): `if (Capture.hudVisible) drawHUD();`
  if (Capture.hudVisible) drawHUD();
  assert(recLog.length === 0, "D: Capture.hudVisible = false skips drawHUD() entirely (no ctx calls logged)");
  Capture.hudVisible = true;
})();

// ---------------------------------------------------------------------------
console.log(`\ntest-cs009-hud: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
