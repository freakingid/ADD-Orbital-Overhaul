// Headless test for CS009 Phase 3 — CARGO ring (FORK-2 A).
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator (+ fake localStorage), eval the REAL
// <script> block, then drive REAL dock deliveries via update() — no reimplementation under test.
//
//   node scratchpad/test-cs009-p3.js
//
// Checks:
//  (A) game.cargoFlash arms to HUD_CAP_FLASH at the EXACT frame game.cargoMax increments (driven by
//      real deliveries crossing CARGO_GROW_PER, not a hand-set cargoMax).
//  (B) cargoFlash decays to 0 within HUD_CAP_FLASH sec of real time.
//  (C) startGame() clears cargoFlash.
//  (D) cargoMax stops growing at CARGO_CAP_MAX even after far more than enough deliveries.

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ---- Headless environment stubs (mirror test-f9.js / test-cs009-p2.js) ----
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
const windowStub = {
  addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
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
  "startGame", "update", "game", "AudioSys",
  "CARGO_BASE", "CARGO_CAP_MAX", "CARGO_GROW_PER", "HUD_CAP_FLASH"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub);
const { startGame, update, game, CARGO_BASE, CARGO_CAP_MAX, CARGO_GROW_PER, HUD_CAP_FLASH } = A;

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }

// --- Set up: same "park the dock on the ship + drain one canister per update() call" idiom as
// the C2 achievement test in test-f9.js.
startGame();
game.debris = []; game.hunters = []; game.saucers = []; game.bullets = []; game.powerups = []; game.garbage = [];
game.saucerTimer = 1e9; game.hunterTimer = 1e9; game.healthTimer = 1e9;
game.ship.invuln = 1e9; game.ship.shieldOn = false;
game.dock.x = game.ship.x; game.dock.y = game.ship.y;

function fillChain(n) {
  game.chain = [];
  for (let i = 0; i < n; i++) game.chain.push({ x: game.ship.x, y: game.ship.y, px: game.ship.x, py: game.ship.y, spin: 0, spinRate: 0, mass: 1 });
}
function tickDock(times) {
  for (let i = 0; i < times; i++) {
    game.ship.x = game.dock.x; game.ship.y = game.dock.y; game.ship.vx = 0; game.ship.vy = 0;
    game.waveClearTimer = 0;
    update(0.13); // > DOCK_OFFLOAD_INTERVAL; one canister peels off per call
  }
}

// --- (A) Deliver up to CARGO_GROW_PER - 1: cargoMax must NOT have grown yet, flash must be 0. ---
console.log("(A) cargoFlash arms at the exact frame cargoMax increments");
assert(game.cargoMax === CARGO_BASE, "sanity: cargoMax starts at CARGO_BASE");
fillChain(CARGO_GROW_PER - 1);
game.deliveryCount = 0; game.offloadTimer = 0;
tickDock(CARGO_GROW_PER); // deliver CARGO_GROW_PER - 1 canisters (a couple spare ticks to be safe)
assert(game.stats.delivered === CARGO_GROW_PER - 1, "delivered CARGO_GROW_PER-1 canisters (got " + game.stats.delivered + ")");
assert(game.cargoMax === CARGO_BASE, "cargoMax has not grown yet (got " + game.cargoMax + ")");
assert(game.cargoFlash === 0, "cargoFlash is still 0 before the cap-up");

// One more delivery crosses CARGO_GROW_PER -> cargoMax grows by 1, flash arms THIS frame.
fillChain(1);
game.offloadTimer = 0;
tickDock(1); // exactly one update() call: offloadTimer starts at 0, dt > DOCK_OFFLOAD_INTERVAL,
             // so this single call both delivers the canister AND arms the flash on this frame —
             // an extra call would immediately decay it, defeating check (A).
assert(game.stats.delivered === CARGO_GROW_PER, "delivered exactly CARGO_GROW_PER canisters (got " + game.stats.delivered + ")");
assert(game.cargoMax === CARGO_BASE + 1, "cargoMax grew by 1 (got " + game.cargoMax + ")");
assert(game.cargoFlash === HUD_CAP_FLASH, "cargoFlash armed to HUD_CAP_FLASH on the cap-up frame (got " + game.cargoFlash + ")");

// --- (B) cargoFlash decays to 0 within HUD_CAP_FLASH sec. ---
console.log("(B) cargoFlash decays to 0 within HUD_CAP_FLASH sec");
let t = 0;
const dt = 1 / 60;
while (game.cargoFlash > 0 && t < HUD_CAP_FLASH + 1) {
  update(dt);
  t += dt;
}
assert(game.cargoFlash === 0, "cargoFlash reached 0 (got " + game.cargoFlash + ")");
assert(t <= HUD_CAP_FLASH + dt + 1e-9, "decayed within HUD_CAP_FLASH sec (took " + t.toFixed(3) + "s)");

// --- (C) startGame() clears cargoFlash. ---
console.log("(C) startGame() clears cargoFlash");
game.cargoFlash = HUD_CAP_FLASH;
startGame();
assert(game.cargoFlash === 0, "a fresh run starts with cargoFlash === 0");
assert(game.cargoMax === CARGO_BASE, "a fresh run resets cargoMax to CARGO_BASE");

// --- (D) cargoMax stops growing at CARGO_CAP_MAX. ---
console.log("(D) cargoMax caps at CARGO_CAP_MAX even with far more than enough deliveries");
game.debris = []; game.hunters = []; game.saucers = []; game.bullets = []; game.powerups = []; game.garbage = [];
game.saucerTimer = 1e9; game.hunterTimer = 1e9; game.healthTimer = 1e9;
game.ship.invuln = 1e9; game.ship.shieldOn = false;
game.dock.x = game.ship.x; game.dock.y = game.ship.y;
const overDeliver = CARGO_GROW_PER * (CARGO_CAP_MAX - CARGO_BASE + 5); // way past the cap
let remaining = overDeliver;
while (remaining > 0) {
  const chunk = Math.min(remaining, 50);
  fillChain(chunk);
  game.offloadTimer = 0;
  tickDock(chunk + 1);
  remaining -= chunk;
}
assert(game.cargoMax === CARGO_CAP_MAX, "cargoMax capped at CARGO_CAP_MAX (got " + game.cargoMax + ")");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
