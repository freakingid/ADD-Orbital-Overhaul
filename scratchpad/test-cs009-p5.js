// Headless test for CS009 Phase 5 — bank feedback (powerBank state, ring scale-pop, "+Ns" badge).
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator (+ fake localStorage), eval the REAL
// <script> block, then drive the ACTUAL applyPowerup()/update()/startGame() — no reimplementation.
//
//   node scratchpad/test-cs009-p5.js
//
// REPOINTED BY CS024 P6 (spec §1.7/§3.4): timed expiry is deleted, so the thing that BANKS is a BUDGET
// rather than a duration, and the badge amount comes from powerBudgetAmount(type) instead of
// powerDuration(type). The banking RULE is unchanged and is exactly what this file guards — a
// same-type pickup ADDS rather than refreshing, and only a pickup while already active arms the badge —
// so every claim repoints onto its budget successor rather than being dropped. Engine joins the file
// for the first time: it was the one type banking never covered (it was timed-only), and its badge is
// a LIVE knob rather than a frozen table entry.
//
// Checks (per the phase prompt, as repointed):
//  (A) a FIRST pickup arms no badge (powerBank.rapid === 0)
//  (B) a SECOND pickup while active arms powerBank.rapid === HUD_BANK_FLASH and powerBankAmt.rapid === 40
//  (C) per-type badge amounts come from powerBudgetAmount(), never a literal — including the two LIVE
//      knobs (guard, engine), and banking works for EVERY type (FLAG-F's regression, repointed)
//  (D) powerBank decays to 0 under update() within HUD_BANK_FLASH seconds
//  (E) startGame() clears both maps

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "orbital-overhaul.html");
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
  "HUD_BANK_FLASH", "HUD_BANK_POP", "POWERUP_BUDGET", "powerBudgetAmount", "POWERUP_DROP_TYPES", "DEBUG"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, global.localStorage);
const {
  startGame, update, applyPowerup, game, settings, AudioSys,
  HUD_BANK_FLASH, HUD_BANK_POP, POWERUP_BUDGET, powerBudgetAmount, POWERUP_DROP_TYPES, DEBUG
} = A;

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

AudioSys.init();

function fresh() {
  startGame();
  game.state = "playing"; game.paused = false;
}

// ================= (A) a first pickup arms no badge =================
(function sectionA() {
  fresh();
  applyPowerup("rapid");
  assert(game.powerBank.rapid === 0, `A: first pickup arms no badge — got powerBank.rapid=${game.powerBank.rapid}`);
  assert(game.powerBankAmt.rapid === 0, `A: first pickup sets no badge amount — got ${game.powerBankAmt.rapid}`);
  assert(game.powerBudget.rapid === powerBudgetAmount("rapid"), "A: first pickup still starts the effect normally (a full grant)");
})();

// ================= (B) a second pickup while active arms the badge =================
(function sectionB() {
  fresh();
  applyPowerup("rapid");
  applyPowerup("rapid"); // banked — effect was already active
  assert(game.powerBank.rapid === HUD_BANK_FLASH,
    `B: bank arms powerBank.rapid === HUD_BANK_FLASH — got ${game.powerBank.rapid}`);
  assert(game.powerBankAmt.rapid === 40,
    `B: bank badge amount is 40 (RAPID_SHOTS) for rapid — got ${game.powerBankAmt.rapid}`);
  assert(near(game.powerBudget.rapid, 2 * POWERUP_BUDGET.rapid), "B: powerBudget BANKS (adds budget, never refreshes)");
})();

// ===== (C) REPOINTED — badges come from powerBudgetAmount(), per type, for EVERY type =====
(function sectionC() {
  // FLAG-F's original claim was "the magnet badge is 30, not 15 — it comes from powerDuration(), not a
  // literal." The literal-vs-function half is the durable half and is what repoints: the badge must
  // read powerBudgetAmount(type), which DIFFERS by type and is a LIVE KNOB for two of the five.
  fresh();
  applyPowerup("triple");
  applyPowerup("triple"); // banked
  assert(game.powerBankAmt.triple === POWERUP_BUDGET.triple && game.powerBankAmt.triple === 30,
    `C: triple's badge is its OWN 30, not rapid's 40 — got ${game.powerBankAmt.triple}`);

  // BANKING WORKS FOR EVERY TYPE, which is new for engine and guard — the two whose grant is a live
  // knob. Driven through the REAL applyPowerup twice per type, budget and badge both checked.
  for (const t of POWERUP_DROP_TYPES) {
    fresh();
    const grant = powerBudgetAmount(t);
    applyPowerup(t);
    assert(game.powerBank[t] === 0, `C: ${t} — a FIRST pickup arms no badge`);
    assert(near(game.powerBudget[t], grant), `C: ${t} — a first pickup grants exactly powerBudgetAmount("${t}") (${grant})`);
    applyPowerup(t);
    assert(game.powerBank[t] === HUD_BANK_FLASH, `C: ${t} — a SECOND pickup while active arms the badge`);
    assert(game.powerBankAmt[t] === grant, `C: ${t} — the badge amount is powerBudgetAmount("${t}"), never a literal — got ${game.powerBankAmt[t]}`);
    assert(near(game.powerBudget[t], 2 * grant), `C: ${t} — the second pickup ADDS (banks), it does NOT refresh`);
  }

  // ...and the two live-knob grants really do follow their knob, so the badge cannot be a frozen table.
  for (const [t, knob, val] of [["engine", "engineBurnSeconds", 12], ["guard", "chainGuardIntercepts", 7]]) {
    fresh();
    DEBUG[knob] = val;
    applyPowerup(t);
    applyPowerup(t);
    assert(game.powerBankAmt[t] === val, `C: ${t}'s badge follows the LIVE DEBUG.${knob} (${val}) — got ${game.powerBankAmt[t]}`);
    assert(near(game.powerBudget[t], 2 * val), `C: ...and it banked two of them`);
  }
  DEBUG.engineBurnSeconds = 10; DEBUG.chainGuardIntercepts = 3;  // REPOINTED BY CS024 P7 — shipped default is 10.0 s
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
