// Headless test for CS014 Phase 0 — additive tutSeen persistence on afd_settings_v1.
//
//   node scratchpad/test-cs014-p0.js
//
// Follows the standing rule (GDD 5.4) and the test-cs010-p2.js pattern: stub window/document/rAF/
// localStorage, eval the REAL <script> block, and drive the ACTUAL saveSettings/loadSettings/
// returnToDefaults — never reimplement the persistence logic. Sections:
//  (A) node --check on the extracted <script>.
//  (B) round-trip: flip three flags, save, reload into a fresh instance -> exactly those three true.
//  (C) corrupt shapes (string / array / number / null / {unknownId:true} / {thrust:"yes"}) each load
//      to a safe result (unknown ids dropped, non-boolean coerced) without disturbing voiceStyle/
//      autoShield/shipTurnScale loaded from the SAME payload.
//  (D) missing key -> all eight flags false.
//  (E) returnToDefaults() leaves a modified tutSeen intact while still restoring bindings.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const extractScript = html => {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Could not find <script> block");
  return m[1];
};

const currentSrc = extractScript(fs.readFileSync(htmlPath, "utf8"));

// ---- stubs (mirrors test-cs010-p2.js) ----
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

const RETLIST = ["TUT_IDS", "settings", "saveSettings", "loadSettings", "returnToDefaults",
  "bindings", "DEFAULT_BINDINGS", "REBINDABLE"];

function buildInstance(scriptSrc, lsStore) {
  lsStore = lsStore || {};
  const listeners = {};
  const windowStub = {
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    innerWidth: 1280, innerHeight: 720, AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext
  };
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETLIST.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, localStorageStub);
}

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(require("os").tmpdir(), "cs014-p0-extracted.js");
  fs.writeFileSync(tmp, currentSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: syntax: " + e.stderr.toString()); }
})();

// ================= (B) round-trip =====================
(function () {
  console.log("(B) round-trip: flip three flags, save, reload into a fresh instance");
  const store = {};
  const A = buildInstance(currentSrc, store);

  assert(A.TUT_IDS.length === 8, `TUT_IDS has 8 ids; got ${A.TUT_IDS.length}`);
  for (const id of A.TUT_IDS) assert(A.settings.tutSeen[id] === false, `settings.tutSeen.${id} starts false`);

  A.settings.tutSeen.hook = true;
  A.settings.tutSeen.dock = true;
  A.settings.tutSeen.decay = true;
  A.saveSettings();

  const B = buildInstance(currentSrc, store);
  for (const id of B.TUT_IDS) {
    const want = (id === "hook" || id === "dock" || id === "decay");
    assert(B.settings.tutSeen[id] === want, `round-trip tutSeen.${id} === ${want} (got ${B.settings.tutSeen[id]})`);
  }
})();

// ================= (C) corrupt shapes =====================
(function () {
  console.log("(C) corrupt tutSeen shapes never disturb other fields' load");
  const goodPayload = tutSeen => ({ shipTurnScale: 1.3, voiceStyle: "vintage", autoShield: true, tutSeen });

  const cleanCases = ["a corrupt string", ["array", "not", "object"], 42, null, { unknownId: true }];
  for (const bad of cleanCases) {
    const store = { "afd_settings_v1": JSON.stringify(goodPayload(bad)) };
    const inst = buildInstance(currentSrc, store);
    for (const id of inst.TUT_IDS) assert(inst.settings.tutSeen[id] === false, `corrupt tutSeen=${JSON.stringify(bad)}: tutSeen.${id} stays false`);
    assert(inst.settings.shipTurnScale === 1.3, `corrupt tutSeen=${JSON.stringify(bad)}: shipTurnScale unharmed (got ${inst.settings.shipTurnScale})`);
    assert(inst.settings.voiceStyle === "vintage", `corrupt tutSeen=${JSON.stringify(bad)}: voiceStyle unharmed (got ${inst.settings.voiceStyle})`);
    assert(inst.settings.autoShield === true, `corrupt tutSeen=${JSON.stringify(bad)}: autoShield unharmed (got ${inst.settings.autoShield})`);
  }

  // A known id with a non-boolean value coerces to boolean rather than being dropped or crashing.
  {
    const store = { "afd_settings_v1": JSON.stringify(goodPayload({ thrust: "yes" })) };
    const inst = buildInstance(currentSrc, store);
    assert(inst.settings.tutSeen.thrust === true, `{thrust:"yes"} coerces to true (got ${inst.settings.tutSeen.thrust})`);
    for (const id of inst.TUT_IDS) if (id !== "thrust") assert(inst.settings.tutSeen[id] === false, `{thrust:"yes"}: unrelated id ${id} stays false`);
    assert(inst.settings.shipTurnScale === 1.3, `{thrust:"yes"}: shipTurnScale unharmed (got ${inst.settings.shipTurnScale})`);
    assert(inst.settings.voiceStyle === "vintage", `{thrust:"yes"}: voiceStyle unharmed (got ${inst.settings.voiceStyle})`);
    assert(inst.settings.autoShield === true, `{thrust:"yes"}: autoShield unharmed (got ${inst.settings.autoShield})`);
  }
})();

// ================= (D) missing key =====================
(function () {
  console.log("(D) missing afd_settings_v1 key -> all eight flags false");
  const inst = buildInstance(currentSrc, {});
  for (const id of inst.TUT_IDS) assert(inst.settings.tutSeen[id] === false, `no saved key: tutSeen.${id} defaults false`);

  // Also cover an existing save that PRE-DATES tutSeen entirely (older schema, no tutSeen field at all).
  const store2 = { "afd_settings_v1": JSON.stringify({ vol: {}, bindings: {} }) };
  const inst2 = buildInstance(currentSrc, store2);
  for (const id of inst2.TUT_IDS) assert(inst2.settings.tutSeen[id] === false, `pre-CS014 save (no tutSeen field): tutSeen.${id} defaults false`);
})();

// ================= (E) returnToDefaults() leaves tutSeen intact =====================
(function () {
  console.log("(E) returnToDefaults() resets bindings only, leaves tutSeen untouched");
  const A = buildInstance(currentSrc);
  for (const id of A.TUT_IDS) A.settings.tutSeen[id] = true;

  // Disturb a rebindable action so returnToDefaults() has something real to restore.
  const action = A.REBINDABLE[0];
  const original = JSON.stringify(A.DEFAULT_BINDINGS[action].keys);
  A.bindings[action].keys = ["z"];
  assert(JSON.stringify(A.bindings[action].keys) !== original, "precondition: binding was actually disturbed");

  A.returnToDefaults();

  assert(JSON.stringify(A.bindings[action].keys) === original, `returnToDefaults() restores ${action}'s default keys (got ${JSON.stringify(A.bindings[action].keys)})`);
  for (const id of A.TUT_IDS) assert(A.settings.tutSeen[id] === true, `returnToDefaults() must NOT touch tutSeen.${id}`);
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
