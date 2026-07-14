// Headless test for CS009 Phase 5 — bank feedback (powerBank state, ring scale-pop, "+Ns" badge).
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator (+ fake localStorage), eval the REAL
// <script> block, then drive the ACTUAL applyPowerup()/update()/startGame() — no reimplementation.
//
//   node scratchpad/test-cs009-p5.js
//
// Checks (per the phase prompt):
//  (A) a FIRST pickup arms no badge (powerBank.rapid === 0)
//  (B) a SECOND pickup while active arms powerBank.rapid === HUD_BANK_FLASH and powerBankAmt.rapid === 15
//  (C) same for magnet: powerBankAmt.magnet === 30, NOT 15 (FLAG-F regression)
//  (D) powerBank decays to 0 under update() within HUD_BANK_FLASH seconds
//  (E) startGame() clears both maps

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ---- Minimal canvas/ctx stub (no-op Proxy) ----
const noopCtx = new Proxy({}, { get() { return () => {}; }, set() { return true; } });
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };

// ---- Audio + env stubs (mirror test-cs009-p4) ----
function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} },
    Q: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} }, // CS010 P9: VoiceSys engine automates Q
    type: "sine", buffer: null, loop: false, playbackRate: { value: 1 }, curve: null, onended: null,
    connect() { return makeAudioNode(); }, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {}
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
const performanceStub = { now: () => 0 };
const rafStub = () => 0;
const navigatorStub = { getGamepads: () => [] };
const lsStore = {};
global.localStorage = {
  getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: k => { delete lsStore[k]; }
};

const returnList = [
  "startGame", "update", "applyPowerup", "game", "settings", "AudioSys",
  "HUD_BANK_FLASH", "HUD_BANK_POP", "POWERUP_DURATION", "MAGNET_DURATION", "POWERUP_BUDGET"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, global.localStorage);
const {
  startGame, update, applyPowerup, game, settings, AudioSys,
  HUD_BANK_FLASH, HUD_BANK_POP, POWERUP_DURATION, MAGNET_DURATION, POWERUP_BUDGET
} = A;

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

AudioSys.init();

function fresh() {
  startGame();
  game.state = "playing"; game.paused = false;
  settings.shotPowerupMode = "time";
  settings.magnetMode = "time";
}

// ================= (A) a first pickup arms no badge =================
(function sectionA() {
  fresh();
  applyPowerup("rapid");
  assert(game.powerBank.rapid === 0, `A: first pickup arms no badge — got powerBank.rapid=${game.powerBank.rapid}`);
  assert(game.powerBankAmt.rapid === 0, `A: first pickup sets no badge amount — got ${game.powerBankAmt.rapid}`);
  assert(game.powerFx.rapid === POWERUP_DURATION, "A: first pickup still starts the effect normally");
})();

// ================= (B) a second pickup while active arms the badge =================
(function sectionB() {
  fresh();
  applyPowerup("rapid");
  applyPowerup("rapid"); // banked — effect was already active
  assert(game.powerBank.rapid === HUD_BANK_FLASH,
    `B: bank arms powerBank.rapid === HUD_BANK_FLASH — got ${game.powerBank.rapid}`);
  assert(game.powerBankAmt.rapid === 15,
    `B: bank badge amount is 15 for rapid — got ${game.powerBankAmt.rapid}`);
  assert(near(game.powerFx.rapid, 2 * POWERUP_DURATION), "B: powerFx still banks (adds duration)");
})();

// ================= (C) magnet badge is 30, not 15 (FLAG-F regression) =================
(function sectionC() {
  fresh();
  applyPowerup("magnet");
  applyPowerup("magnet"); // banked
  assert(game.powerBankAmt.magnet === 30,
    `C: magnet bank badge is 30 (MAGNET_DURATION), NOT 15 — got ${game.powerBankAmt.magnet}`);
  assert(game.powerBankAmt.magnet === MAGNET_DURATION, "C: badge comes from powerDuration(), not a literal");

  // and count mode: banked budget badge equals POWERUP_BUDGET[type], not a literal either
  fresh();
  settings.magnetMode = "pieces";
  applyPowerup("magnet");
  applyPowerup("magnet");
  assert(game.powerBankAmt.magnet === POWERUP_BUDGET.magnet,
    `C: count-mode magnet bank badge equals POWERUP_BUDGET.magnet — got ${game.powerBankAmt.magnet}`);
})();

// ================= (D) powerBank decays to 0 within HUD_BANK_FLASH under update() =================
(function sectionD() {
  fresh();
  applyPowerup("rapid");
  applyPowerup("rapid");
  assert(game.powerBank.rapid === HUD_BANK_FLASH, "D: precondition — bank armed");
  const dt = 1 / 60;
  let t = 0;
  while (game.powerBank.rapid > 0 && t < HUD_BANK_FLASH + 1) {
    update(dt);
    t += dt;
  }
  assert(game.powerBank.rapid === 0, `D: powerBank decays to exactly 0 — got ${game.powerBank.rapid}`);
  assert(t <= HUD_BANK_FLASH + dt + 1e-6,
    `D: decay completes within HUD_BANK_FLASH sec — took ${t}`);
})();

// ================= (E) startGame() clears both maps =================
(function sectionE() {
  fresh();
  applyPowerup("rapid");
  applyPowerup("rapid");
  applyPowerup("magnet");
  applyPowerup("magnet");
  assert(game.powerBank.rapid > 0 && game.powerBank.magnet > 0, "E: precondition — banks armed pre-reset");
  startGame();
  for (const k of ["rapid", "triple", "magnet", "engine"]) {
    assert(game.powerBank[k] === 0, `E: startGame() clears powerBank.${k}`);
    assert(game.powerBankAmt[k] === 0, `E: startGame() clears powerBankAmt.${k}`);
  }
})();

// ---------------------------------------------------------------------------
console.log(`\ntest-cs009-p5: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
