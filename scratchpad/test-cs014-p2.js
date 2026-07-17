// Headless test for CS014 Phase 2 — clump pre-birth telegraph (pulse at HUNTER_TELEGRAPH_COUNT
// pieces) + HULL +25 repair floater (FLAG-CS014-h). Follows GDD 5.4 rule 7: stub window/document/
// rAF/navigator (+ fake localStorage), eval the REAL <script> block, then drive the REAL
// Garbage.draw()/addScore() via a recording 2D-context stub (recording-canvas pattern per
// test-cs012-p2.js §B) — no reimplementation of the pulse/repair math.
//
//   node scratchpad/test-cs014-p2.js
//
// Checks:
//  (A) node --check on the extracted <script>.
//  (B) telegraph: Garbage.draw() at pieces 1/8/9/11 is crash-free; ctx.globalAlpha reads exactly 1
//      after every draw (leak guard, per the corner-glow comment's warning); a pieces=8 clump draws
//      the SAME stroke alpha regardless of when it's drawn (no modulation below the threshold), a
//      pieces=9 clump draws a DIFFERENT stroke alpha at two different clock times (modulates).
//  (C) floater: crossing a repair milestone at hp < max pushes exactly one FloatText reading
//      "HULL +" + REPAIR_AMOUNT (derived, not pinned) and still keeps the existing shieldPing.
//      Crossing at full HP pushes no floater and still pays REPAIR_FULL_BONUS.

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
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs014p2_extracted.js");
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

// ---- Recording 2D context — logs globalAlpha sets (recording-canvas pattern per test-cs012-p2.js).
const recLog = [];
function makeRecordingCtx() {
  const state = { globalAlpha: 1, shadowBlur: 0 };
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
      if (p === "globalAlpha") recLog.push(["globalAlpha", v]);
      return true;
    }
  });
}
const recCtx = makeRecordingCtx();
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => recCtx };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };

// ---- Audio + env stubs (mirror test-cs012-p2.js) ----
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
  "startGame", "update", "game", "settings", "AudioSys", "Garbage", "FloatText", "addScore",
  "HUNTER_TELEGRAPH_COUNT", "HUNTER_COALESCE_COUNT", "REPAIR_MILESTONE", "REPAIR_AMOUNT",
  "REPAIR_FULL_BONUS", "SHIP_MAX_HP", "COLOR"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, global.localStorage);
const {
  startGame, update, game, settings, AudioSys, Garbage, FloatText, addScore,
  HUNTER_TELEGRAPH_COUNT, HUNTER_COALESCE_COUNT, REPAIR_MILESTONE, REPAIR_AMOUNT,
  REPAIR_FULL_BONUS, SHIP_MAX_HP, COLOR
} = A;

AudioSys.init();

assert(HUNTER_TELEGRAPH_COUNT < HUNTER_COALESCE_COUNT,
  `sanity: HUNTER_TELEGRAPH_COUNT (${HUNTER_TELEGRAPH_COUNT}) < HUNTER_COALESCE_COUNT (${HUNTER_COALESCE_COUNT})`);

// ================= (B) telegraph pulse =================
console.log("(B) Garbage.draw telegraph: crash-free, alpha leak guard, pulse only at >= HUNTER_TELEGRAPH_COUNT");

function drawAt(pieces, t) {
  perfNow = t;
  recLog.length = 0;
  const g = new Garbage(100, 100, 0, 0, Math.max(1, pieces));
  g.pieces = pieces;
  g.radius = 7 * Math.sqrt(pieces);
  const origRandom = Math.random;
  Math.random = () => 0; // strip the radioactive-flicker jitter so alpha reads deterministically
  try { g.draw(); } finally { Math.random = origRandom; }
  return recLog.filter(e => e[0] === "globalAlpha").map(e => e[1]);
}

for (const pieces of [1, 8, 9, 11]) {
  let threw = null;
  let alphas;
  try { alphas = drawAt(pieces, 1000); } catch (e) { threw = e; }
  assert(!threw, `B: pieces=${pieces} draw() does not throw (${threw && threw.message})`);
  assert(near(recCtx.globalAlpha, 1), `B: pieces=${pieces} globalAlpha reads exactly 1 after draw (leak guard)`);
  if (pieces > 1) {
    assert(alphas.length > 0, `B: pieces=${pieces} clump logs at least one globalAlpha set`);
  }
}

const below1 = drawAt(HUNTER_TELEGRAPH_COUNT - 1, 1000)[0];
const below2 = drawAt(HUNTER_TELEGRAPH_COUNT - 1, 1450)[0];
assert(near(below1, below2),
  `B: pieces=${HUNTER_TELEGRAPH_COUNT - 1} (below threshold) draws the SAME alpha at different clock times (${below1} vs ${below2})`);

const at1 = drawAt(HUNTER_TELEGRAPH_COUNT, 1000)[0];
const at2 = drawAt(HUNTER_TELEGRAPH_COUNT, 1450)[0];
assert(!near(at1, at2),
  `B: pieces=${HUNTER_TELEGRAPH_COUNT} (at/above threshold) draws a DIFFERENT alpha at different clock times (${at1} vs ${at2}) — pulse modulates`);

// ================= (C) repair floater =================
console.log("(C) addScore milestone-repair floater: HULL +N at hp<max, none (still paid) at full HP");

function freshRun() {
  startGame();
  game.state = "playing"; game.paused = false;
  game.floaters = [];
}

// (C1) hp < max: exactly one FloatText "HULL +25", shieldPing still fires (no throw), score still gains.
freshRun();
game.ship.hp = SHIP_MAX_HP - REPAIR_AMOUNT - 5; // below max, room to repair without clamping oddly
game.score = REPAIR_MILESTONE - 10;
game.nextRepair = REPAIR_MILESTONE;
const hpBefore = game.ship.hp;
addScore(10); // crosses game.nextRepair exactly
assert(game.floaters.length === 1, `C1: exactly one floater pushed on hp<max repair (got ${game.floaters.length})`);
if (game.floaters.length === 1) {
  const f = game.floaters[0];
  assert(f.text === "HULL +" + REPAIR_AMOUNT, `C1: floater text is "HULL +${REPAIR_AMOUNT}" (got "${f.text}")`);
  assert(f.color === COLOR.hp, "C1: floater color is COLOR.hp");
}
assert(game.ship.hp === hpBefore + REPAIR_AMOUNT, "C1: hull actually repaired by REPAIR_AMOUNT");

// (C2) full HP: no floater, REPAIR_FULL_BONUS still paid into score.
freshRun();
game.ship.hp = SHIP_MAX_HP;
game.score = REPAIR_MILESTONE - 10;
game.nextRepair = REPAIR_MILESTONE;
const scoreBeforeBonus = REPAIR_MILESTONE; // score right after the +10 that crosses the threshold
addScore(10);
assert(game.floaters.length === 0, `C2: no floater pushed when repair lands at full HP (got ${game.floaters.length})`);
assert(game.score === scoreBeforeBonus + REPAIR_FULL_BONUS,
  `C2: REPAIR_FULL_BONUS still paid at full HP (got ${game.score}, expected ${scoreBeforeBonus + REPAIR_FULL_BONUS})`);
assert(game.ship.hp === SHIP_MAX_HP, "C2: hull stays at max (no over-heal)");

// ================= (D) full regression =================
console.log("(D) headless startGame()/update(1/60) sanity");
(function () {
  let threw = null;
  try {
    startGame();
    game.state = "playing"; game.paused = false;
    for (let i = 0; i < 30; i++) update(1 / 60);
  } catch (e) { threw = e; }
  assert(!threw, `D: startGame + 30 update(1/60) frames do not throw (${threw && threw.message})`);
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
