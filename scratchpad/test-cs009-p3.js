// Headless test for CS009 Phase 3 — CARGO ring (FORK-2 A).
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator (+ fake localStorage), eval the REAL
// <script> block, then drive REAL dock deliveries via update() — no reimplementation under test.
//
//   node scratchpad/test-cs009-p3.js
//
// REPOINTED BY CS018 P5 (FORK-CS018-B): this file's whole subject at CS009 was the delivery-earned
// growCap mechanism — cargoMax growing +1 every CARGO_GROW_PER canisters, capped at CARGO_CAP_MAX,
// with cargoFlash arming on each cap-up. CS018 P5 retires that mechanism outright: cargoMax is now
// GRANTED by levelDef(game.wave).payloadSlots in nextWave(), never by game.stats.delivered. Every
// check below is repointed to its mirror-image claim at the same strength, per the CS018 P4
// precedent (test-cs017-p3.js) for a mechanism retired wholesale rather than weakened or deleted:
//  (A) many real deliveries within the SAME level do NOT grow game.cargoMax (the growCap block is
//      gone) and do NOT arm cargoFlash (no delivery-driven cap-up left to arm it).
//  (B) cargoFlash's OWN decay mechanism is untouched (still used by the Maxed Out latch) — armed
//      directly (not via a delivery cap-up, which no longer exists) it still decays to 0 within
//      HUD_CAP_FLASH sec of real time.
//  (C) startGame() still clears cargoFlash, and resets cargoMax to levelDef(1).payloadSlots (8), not
//      the historical CARGO_BASE (12).
//  (D) cargoMax does NOT move away from its level-1 value even after FAR more than the old
//      more-than-enough-to-cap delivery count — it is now delivery-count-INDEPENDENT.

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
  "CARGO_BASE", "CARGO_CAP_MAX", "HUD_CAP_FLASH"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub);
const { startGame, update, game, CARGO_BASE, CARGO_CAP_MAX, HUD_CAP_FLASH } = A;
// CARGO_GROW_PER (30) was a dead constant, deleted in CS024 P2 (declaration-and-comment only, zero
// live readers) — kept here as a local historical literal since this file's math is built around it.
const CARGO_GROW_PER = 30;

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

// --- (A) Many real deliveries within the same level: cargoMax must NOT grow, flash must stay 0. ---
console.log("(A) real deliveries no longer grow cargoMax or arm cargoFlash (growCap retired, CS018 P5)");
assert(game.cargoMax === 8, "sanity: cargoMax starts at levelDef(1).payloadSlots (8), not CARGO_BASE");
fillChain(CARGO_GROW_PER - 1);
game.deliveryCount = 0; game.offloadTimer = 0;
tickDock(CARGO_GROW_PER); // deliver CARGO_GROW_PER - 1 canisters (a couple spare ticks to be safe)
assert(game.stats.delivered === CARGO_GROW_PER - 1, "delivered CARGO_GROW_PER-1 canisters (got " + game.stats.delivered + ")");
assert(game.cargoMax === 8, "cargoMax unchanged by deliveries (got " + game.cargoMax + ")");
assert(game.cargoFlash === 0, "cargoFlash never armed by a delivery (still 0)");

// One more delivery crosses the OLD CARGO_GROW_PER threshold — under the retired mechanism this used
// to grow the cap and arm the flash; now it must do neither.
fillChain(1);
game.offloadTimer = 0;
tickDock(1);
assert(game.stats.delivered === CARGO_GROW_PER, "delivered exactly CARGO_GROW_PER canisters (got " + game.stats.delivered + ")");
assert(game.cargoMax === 8, "cargoMax STILL unchanged crossing the old growth threshold (got " + game.cargoMax + ")");
assert(game.cargoFlash === 0, "cargoFlash STILL not armed crossing the old growth threshold (got " + game.cargoFlash + ")");

// --- (B) cargoFlash's own decay mechanism is untouched — it still decays within HUD_CAP_FLASH sec of
// real time once armed (armed directly here, since the delivery-driven cap-up that used to arm it in
// this file no longer exists; the Maxed Out latch, test-cs018-p5.js §D, is the live arming source now).
console.log("(B) cargoFlash decays to 0 within HUD_CAP_FLASH sec (decay mechanism itself is unchanged)");
game.cargoFlash = HUD_CAP_FLASH;
let t = 0;
const dt = 1 / 60;
while (game.cargoFlash > 0 && t < HUD_CAP_FLASH + 1) {
  update(dt);
  t += dt;
}
assert(game.cargoFlash === 0, "cargoFlash reached 0 (got " + game.cargoFlash + ")");
assert(t <= HUD_CAP_FLASH + dt + 1e-9, "decayed within HUD_CAP_FLASH sec (took " + t.toFixed(3) + "s)");

// --- (C) startGame() clears cargoFlash and resets cargoMax to the level-1 table value. ---
console.log("(C) startGame() clears cargoFlash and resets cargoMax to levelDef(1).payloadSlots");
game.cargoFlash = HUD_CAP_FLASH;
startGame();
assert(game.cargoFlash === 0, "a fresh run starts with cargoFlash === 0");
assert(game.cargoMax === 8, "a fresh run resets cargoMax to levelDef(1).payloadSlots (8), not CARGO_BASE (12)");

// --- (D) cargoMax is delivery-count-INDEPENDENT: FAR more than the old more-than-enough-to-cap
// delivery count still leaves it at the level-1 value. ---
console.log("(D) cargoMax never moves from its level value no matter how many canisters are delivered");
game.debris = []; game.hunters = []; game.saucers = []; game.bullets = []; game.powerups = []; game.garbage = [];
game.saucerTimer = 1e9; game.hunterTimer = 1e9; game.healthTimer = 1e9;
game.ship.invuln = 1e9; game.ship.shieldOn = false;
game.dock.x = game.ship.x; game.dock.y = game.ship.y;
const overDeliver = CARGO_GROW_PER * (CARGO_CAP_MAX - CARGO_BASE + 5); // the old "way past the cap" count
let remaining = overDeliver;
while (remaining > 0) {
  const chunk = Math.min(remaining, 50);
  fillChain(chunk);
  game.offloadTimer = 0;
  tickDock(chunk + 1);
  remaining -= chunk;
}
assert(game.stats.delivered >= overDeliver, `D: (setup) delivered at least ${overDeliver} canisters (got ${game.stats.delivered})`);
assert(game.cargoMax === 8, "cargoMax is STILL 8 after far more than the old cap-reaching delivery count (got " + game.cargoMax + ")");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
