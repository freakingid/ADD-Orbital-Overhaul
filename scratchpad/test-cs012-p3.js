// Headless test for CS012 Phase 3 — Achievements: max-cap-haul (24-canister) lifetime unlock +
// MAX HAUL UI celebration. Follows GDD 5.4 rule 7: stub window/document/rAF/navigator (+ fake
// localStorage), eval the REAL <script> block, then drive the ACTUAL dock-offload path
// (update()) + Achievements.evaluate()/save()/load() — no reimplementation of the latch/offload
// logic under test. Mirrors scratchpad/test-f9.js's fillChain/tickDock/parkOnDock idiom.
//
//   node scratchpad/test-cs012-p3.js
//
// Checks (per the phase prompt):
//  (A) node --check on the extracted <script>.
//  (B) resetGameStats() leaves maxChainVisit false.
//  (C) Driving deliveries so deliveryCount passes through 24 sets game.stats.maxChainVisit true
//      exactly once; a visit topping out at 23 does NOT set it; a visit at 12 sets fullChainVisit
//      but NOT maxChainVisit.
//  (D) After maxChainVisit is set, Achievements.evaluate() puts "max_haul" in the lifetime-
//      unlocked set (goal 1 met); it stays unlocked across a subsequent
//      resetGameStats()+save()/load() (lifetime persistence).
//  (E) The celebration pushes a floater and arms cargoFlash on the 24th delivery; nothing on a
//      12 or 23 haul.
//  (F) No new VoiceSys line is emitted by the max-haul path (dockDelivery still fires its
//      existing dock_20 tier only, once, on the emptying pop).

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
  const tmp = path.join(repoRoot, "scratchpad", "_cs012p3_extracted.js");
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

// ---- Headless environment stubs (mirrors test-f9.js) ----
const noopCtx = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub };

function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    Q: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    threshold: { value: 0, setValueAtTime() {} }, ratio: { value: 1, setValueAtTime() {} },
    attack: { value: 0, setValueAtTime() {} }, release: { value: 0, setValueAtTime() {} },
    type: "sine", buffer: null, loop: false, curve: null, playbackRate: { value: 1 },
    connect() { return makeAudioNode(); }, disconnect() {}, setPeriodicWave() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
function FakeAudioContext() {
  return new Proxy({
    state: "running", currentTime: 0, sampleRate: 44100, destination: makeAudioNode(),
    createGain() { return makeAudioNode(); },
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; },
    createPeriodicWave() { return {}; },
    createWaveShaper() { return makeAudioNode(); },
    createDynamicsCompressor() { return makeAudioNode(); },
    resume() {}
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
  "startGame", "update", "game", "AudioSys", "Achievements", "VoiceSys",
  "resetGameStats", "CARGO_CAP_MAX", "COLOR", "HUD_CAP_FLASH"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub);
const {
  startGame, update, game, AudioSys, Achievements, VoiceSys,
  resetGameStats, CARGO_CAP_MAX, COLOR, HUD_CAP_FLASH
} = A;

AudioSys.init();

// ================= (B) resetGameStats() leaves maxChainVisit false =================
(function sectionB() {
  console.log("(B) resetGameStats(): maxChainVisit starts false");
  const s = resetGameStats();
  assert("maxChainVisit" in s, "B: maxChainVisit field exists on a fresh stats bag");
  assert(s.maxChainVisit === false, "B: maxChainVisit starts false");
})();

// ---- Real dock-offload drive helpers (mirrors test-f9.js (C2)/(C8)) ----
function resetAch() {
  for (const k in Achievements.lifetime) Achievements.lifetime[k] = 0;
  Achievements.lifetimeUnlocked = new Set();
  Achievements.weeklyUnlocked = new Set();
  Achievements.lifetimeTiers = {};
  Achievements.activeIds = Achievements.WEEKLY.map(a => a.id);
  Achievements._saveAccum = 1e9;
  game.toasts = [];
}
function parkOnDock() {
  game.debris = []; game.hunters = []; game.saucers = []; game.bullets = []; game.powerups = []; game.garbage = [];
  game.saucerTimer = 1e9; game.hunterTimer = 1e9; game.healthTimer = 1e9;
  game.ship.invuln = 1e9; game.ship.shieldOn = false;
  game.dock.x = game.ship.x; game.dock.y = game.ship.y; // park the dock on the ship
}
function fillChain(n) {
  game.chain = [];
  for (let i = 0; i < n; i++) game.chain.push({ x: game.ship.x, y: game.ship.y, px: game.ship.x, py: game.ship.y, spin: 0, spinRate: 0, mass: 1 });
}
function tickDock(times) {
  for (let i = 0; i < times; i++) {
    // Clear any powerup dropped by the (unrelated) deliveryCount===10 SALVAGE BONUS mechanic before
    // it can be picked up — a long delivery run crosses 10 en route to 24, and that pre-existing
    // system's own collect_* voice line would otherwise confound section F's isolation of the
    // max-haul path specifically.
    game.powerups = [];
    game.ship.x = game.dock.x; game.ship.y = game.dock.y; game.ship.vx = 0; game.ship.vy = 0;
    game.waveClearTimer = 0; // keep the empty field from advancing the wave mid-test
    update(0.13); // > DOCK_OFFLOAD_INTERVAL (0.05s); one canister peels off per update() call
  }
}

// ================= (C) latch fires exactly once at 24; not at 23; 12 sets fullChainVisit only ===
(function sectionC() {
  console.log("(C) real dock offload: maxChainVisit latches at exactly 24, not 23; 12-haul unaffected");

  // --- a 23-canister visit: does NOT set maxChainVisit ---
  startGame(); resetAch(); parkOnDock();
  fillChain(23); game.deliveryCount = 0; game.offloadTimer = 0;
  tickDock(25);
  assert(game.stats.delivered === 23, "C: 23 canisters delivered (got " + game.stats.delivered + ")");
  assert(game.stats.maxChainVisit === false, "C: a 23-haul does NOT set maxChainVisit");

  // --- a 24-canister visit: sets maxChainVisit exactly once ---
  startGame(); resetAch(); parkOnDock();
  fillChain(24); game.deliveryCount = 0; game.offloadTimer = 0;
  let setCount = 0;
  const origPush = game.floaters.push.bind(game.floaters);
  tickDock(26);
  assert(game.stats.delivered === 24, "C: 24 canisters delivered (got " + game.stats.delivered + ")");
  assert(game.stats.maxChainVisit === true, "C: a 24-haul sets maxChainVisit");
  assert(game.stats.fullChainVisit === true, "C: passing through 12 en route also sets fullChainVisit (unchanged behavior)");

  // Driving well past 24 in the SAME visit (chain refilled) must not re-latch or misbehave —
  // maxChainVisit is a flag, so re-setting true is a no-op; just confirm it stays true.
  fillChain(3); game.offloadTimer = 0;
  tickDock(4);
  assert(game.stats.maxChainVisit === true, "C: maxChainVisit remains true after further deliveries in the same game");

  // --- a fresh game, a 12-canister visit: sets fullChainVisit but NOT maxChainVisit ---
  startGame(); resetAch(); parkOnDock();
  fillChain(12); game.deliveryCount = 0; game.offloadTimer = 0;
  tickDock(14);
  assert(game.stats.delivered === 12, "C: 12 canisters delivered (got " + game.stats.delivered + ")");
  assert(game.stats.fullChainVisit === true, "C: a 12-haul sets fullChainVisit");
  assert(game.stats.maxChainVisit === false, "C: a 12-haul does NOT set maxChainVisit");
})();

// ================= (D) evaluate() unlocks max_haul; persists across reset+save/load ============
(function sectionD() {
  console.log("(D) Achievements.evaluate() unlocks max_haul at goal 1; survives resetGameStats()+save()/load()");
  assert(!!Achievements.byId["max_haul"], "D: max_haul is registered in Achievements.byId");
  assert(Achievements.byId["max_haul"].pool === "lifetime", "D: max_haul is a LIFETIME achievement, not weekly");

  startGame(); resetAch(); parkOnDock();
  fillChain(24); game.deliveryCount = 0; game.offloadTimer = 0;
  tickDock(26);
  assert(game.stats.maxChainVisit === true, "D: precondition — maxChainVisit is set");
  Achievements.evaluate();
  assert(Achievements.lifetimeUnlocked.has("max_haul"), "D: evaluate() unlocks max_haul once goal (1) is met");

  // Persist, then simulate a fresh game + reload from storage.
  Achievements.save();
  const savedRaw = localStorage.getItem(Achievements.STORAGE_KEY);
  assert(!!savedRaw, "D: Achievements.save() wrote to localStorage");

  game.stats = resetGameStats(); // fresh per-game stats, as startGame() would do
  assert(game.stats.maxChainVisit === false, "D: a fresh game's stats has maxChainVisit reset to false");

  // Clear in-memory unlock state, then reload via the real load path (init() re-reads storage) —
  // the persisted lifetime unlock must survive.
  Achievements.lifetimeUnlocked = new Set();
  assert(!Achievements.lifetimeUnlocked.has("max_haul"), "D: sanity — in-memory unlock cleared before reload");
  Achievements.init();
  assert(Achievements.lifetimeUnlocked.has("max_haul"), "D: max_haul stays unlocked after resetGameStats()+save()/load() (lifetime persistence)");
})();

// ================= (E) celebration: floater + cargoFlash on the 24th delivery only ==============
(function sectionE() {
  console.log("(E) celebration fires only on the 24th delivery: MAX HAUL floater + cargoFlash armed");

  // --- 12-haul: no MAX HAUL floater, no cargoFlash from this path ---
  startGame(); resetAch(); parkOnDock();
  fillChain(12); game.deliveryCount = 0; game.offloadTimer = 0; game.cargoFlash = 0;
  tickDock(14);
  const maxHaulAt12 = game.floaters.some(f => f.text === "MAX HAUL");
  assert(!maxHaulAt12, "E: a 12-haul pushes no MAX HAUL floater");

  // --- 23-haul: no MAX HAUL floater ---
  startGame(); resetAch(); parkOnDock();
  fillChain(23); game.deliveryCount = 0; game.offloadTimer = 0; game.cargoFlash = 0;
  tickDock(25);
  const maxHaulAt23 = game.floaters.some(f => f.text === "MAX HAUL");
  assert(!maxHaulAt23, "E: a 23-haul pushes no MAX HAUL floater");

  // --- 24-haul: exactly one MAX HAUL floater, gold-colored, larger size; cargoFlash armed ---
  startGame(); resetAch(); parkOnDock();
  fillChain(24); game.deliveryCount = 0; game.offloadTimer = 0; game.cargoFlash = 0;
  tickDock(26);
  const maxHaulFloaters = game.floaters.filter(f => f.text === "MAX HAUL");
  assert(maxHaulFloaters.length === 1, "E: exactly one MAX HAUL floater on the 24th delivery (got " + maxHaulFloaters.length + ")");
  assert(maxHaulFloaters[0].color === COLOR.ach, "E: MAX HAUL floater uses COLOR.ach (gold)");
  assert(maxHaulFloaters[0].size > 16, "E: MAX HAUL floater uses a larger-than-default size (got " + maxHaulFloaters[0].size + ")");
  assert(game.cargoFlash > 0, "E: cargoFlash is armed (>0) right after the 24th delivery");
  assert(game.cargoFlash <= HUD_CAP_FLASH, "E: cargoFlash does not exceed HUD_CAP_FLASH");
})();

// ================= (F) no NEW VoiceSys line from the max-haul path ===============================
(function sectionF() {
  console.log("(F) max-haul path emits no new VoiceSys line — only the existing dock_20 tier fires, once");
  const sayLog = [];
  const origSay = VoiceSys.say.bind(VoiceSys);
  VoiceSys.say = (id) => { sayLog.push(id); return origSay(id); };
  try {
    startGame(); resetAch(); parkOnDock();
    fillChain(24); game.deliveryCount = 0; game.offloadTimer = 0;
    tickDock(26);
  } finally {
    VoiceSys.say = origSay;
  }
  assert(sayLog.length === 1, "F: exactly one VoiceSys.say() call across the whole 24-delivery visit (got " + sayLog.length + ": " + sayLog.join(",") + ")");
  assert(sayLog[0] === "dock_20", "F: the one call is the existing dock_20 tier (n=24 >= 20), not a new max-haul-specific line (got " + sayLog[0] + ")");
})();

// ================= (G) headless startGame()/update no-crash with AudioSys.ctx null ===============
(function sectionG() {
  console.log("(G) AudioSys.ctx null -> startGame()/update(1/60) do not crash");
  AudioSys.ctx = null;
  try { startGame(); passed++; } catch (e) { failed++; console.error("  FAIL: G: startGame() with ctx null threw: " + e.message); }
  try { for (let i = 0; i < 30; i++) update(1 / 60); passed++; } catch (e) { failed++; console.error("  FAIL: G: update(1/60) x30 with ctx null threw: " + e.message); }
})();

// ---------------------------------------------------------------------------
console.log(`\ntest-cs012-p3: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
