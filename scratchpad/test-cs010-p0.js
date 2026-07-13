// Headless test for CS010 Phase 0 — version stamp.
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator (+ a fake localStorage), eval the REAL
// <script> block, then drive the ACTUAL HighScores.add()/load()/save() — no reimplementation of the
// logic under test.
//
//   node scratchpad/test-cs010-p0.js
//
// Checks:
//  (A) GAME_VERSION === "1.0.0.10" (unprefixed).
//  (B) a fresh HighScores.add() stamps build === "1.0.0.10".
//  (C) an existing record carrying build "3.6" survives an afd_scores_v1 load/save round-trip
//      unchanged (no migration of old records).

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

const noopCtx = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };

function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
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

const returnList = ["GAME_VERSION", "HighScores", "AudioSys"];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, global.localStorage);
const { GAME_VERSION, HighScores, AudioSys } = A;

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }

AudioSys.init();

// ================= (A) GAME_VERSION is the new unprefixed scheme =====================
(function sectionA() {
  console.log("(A) GAME_VERSION === \"1.0.0.10\"");
  assert(GAME_VERSION === "1.0.0.10", "A: GAME_VERSION is exactly \"1.0.0.10\" (unprefixed)");
})();

// ================= (B) a fresh HighScores.add() stamps the new build ==================
(function sectionB() {
  console.log("(B) fresh HighScores.add() stamps build === \"1.0.0.10\"");
  HighScores.entries = [];
  const rec = HighScores.add({ initials: "AAA", score: 100, wave: 1, delivered: 1 });
  assert(rec.build === "1.0.0.10", "B: new record's build field is \"1.0.0.10\"");
})();

// ================= (C) an old "3.6" record survives a load/save round-trip unchanged ==
(function sectionC() {
  console.log("(C) a pre-existing build:\"3.6\" record survives a round-trip unchanged");
  const oldRec = { v: 1, id: "legacy-1", initials: "OLD", score: 9999, wave: 5, delivered: 5, ts: 1700000000000, build: "3.6" };
  global.localStorage.setItem("afd_scores_v1", JSON.stringify({ v: 1, entries: [oldRec] }));
  HighScores.entries = [];
  HighScores.load();
  const loaded = HighScores.entries.find(r => r.id === "legacy-1");
  assert(!!loaded, "C: the legacy record loads back");
  assert(loaded.build === "3.6", "C: the legacy record's build field is untouched (\"3.6\")");

  HighScores.save();
  const raw = JSON.parse(global.localStorage.getItem("afd_scores_v1"));
  const resaved = raw.entries.find(r => r.id === "legacy-1");
  assert(!!resaved && resaved.build === "3.6", "C: build field still \"3.6\" after a save round-trip");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
