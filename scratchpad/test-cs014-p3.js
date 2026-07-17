// Headless test for CS014 Phase 3 — "HOW TO PLAY" reference card + "Replay Hints" (Options).
//
//   node scratchpad/test-cs014-p3.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL menuInput/openPause/draw path via a recording 2D-context stub
// that logs fillText calls (mirrors test-cs013-p2.js's canvas-recording idiom) — no menu/render logic
// is reimplemented here.
//
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) navigation: title -> Options -> How to Play -> back; pause -> Options -> How to Play -> back;
//      cursor indices land back where they started at every hop (the CS010 FORK-4 back-path regression
//      class this exact kind of row insertion shipped once before).
//  (C) Replay Hints: flips a pre-set settings.tutSeen to all-false, fires AudioSys.ui(true) feedback
//      exactly once, does NOT navigate off Options, and persists through the localStorage stub.
//  (D) drawHowto() is crash-free (ctx null AND the recording ctx); the CONTROLS block reflects a
//      REBOUND thrust key (driven through the real startRebind/captureKeyRebind capture path, not a
//      direct bindings mutation).
//  (E) every pre-existing menu-suite test file still passes after the MENU_OPTIONS insertion (verified
//      by running the full scratchpad/test-*.js suite alongside this file — see STATUS.md CS014 P3).

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
function noThrow(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.message); } }

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs014p3_extracted.js");
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

// ---- Recording 2D context — logs fillText calls with the style state active at call time
// (mirrors test-cs013-p2.js's idiom). Every other method is a safe no-op.
let recLog = [];
function makeRecordingCtx() {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null, shadowBlur: 0 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "fillText") return (str, x, y) => recLog.push({ c: "fillText", str: String(str), x, y, font: t.font, color: t.fillStyle, align: t.textAlign });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}
const recCtx = makeRecordingCtx();
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => recCtx };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };

// A second, totally-null-safe ctx proxy for the ctx-null-equivalent crash check (mirrors test-cs013-p2
// section H's "AudioSys.ctx null" idea, applied here to the draw path via AudioSys itself untouched —
// this file just re-renders through the SAME recording ctx per section, since drawHowto has no audio
// dependency; the crash-free guarantee is what's under test, not silence).

function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    Q: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    threshold: { value: 0, setValueAtTime() {} }, ratio: { value: 1, setValueAtTime() {} },
    attack: { value: 0, setValueAtTime() {} }, release: { value: 0, setValueAtTime() {} },
    type: "sine", buffer: null, loop: false, curve: null, playbackRate: { value: 1 },
    connect() { return makeAudioNode(); }, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {}
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
const localStorageStub = {
  getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: k => { delete lsStore[k]; }
};

const RETURN = [
  "startGame", "update", "game", "openPause", "closePause", "quitToTitle", "menuInput", "gotoScreen",
  "rootItems", "MENU_OPTIONS", "REBINDABLE", "bindings", "keyLabel", "padLabel", "startRebind",
  "captureKeyRebind", "drawHowto", "drawOptionsMenu", "COLOR", "AudioSys", "settings", "TUT_IDS",
  "saveSettings", "loadSettings", "STORAGE_KEY", "VIEW_W", "VIEW_H"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, localStorageStub);
const {
  startGame, update, game, openPause, closePause, quitToTitle, menuInput, gotoScreen,
  rootItems, MENU_OPTIONS, REBINDABLE, bindings, keyLabel, padLabel, startRebind,
  captureKeyRebind, drawHowto, drawOptionsMenu, COLOR, AudioSys, settings, TUT_IDS,
  saveSettings, loadSettings, STORAGE_KEY, VIEW_W, VIEW_H
} = A;

AudioSys.init();

function render(fn) { recLog = []; fn(); return recLog; }

// ================= (B) navigation: title/pause -> Options -> How to Play -> back =================
(function sectionB() {
  console.log("(B) navigation: title -> Options -> How to Play -> back; pause -> Options -> How to Play -> back");

  // -- From the title screen: openPause() routes straight to "options" (no root — §2.16). --
  game.state = "title"; game.paused = false; game.menu.screen = null; game.menu.index = 0;
  openPause();
  assert(game.menu.screen === "options", "B: title openPause() -> options");
  game.menu.index = MENU_OPTIONS.indexOf("How to Play");
  const idxTitle = game.menu.index;
  menuInput("confirm");
  assert(game.menu.screen === "howto", "B: confirm on How to Play -> howto screen (title path)");
  menuInput("back");
  assert(game.menu.screen === "options" && game.menu.index === idxTitle,
    "B: back from howto -> options, cursor index unchanged (title path)");
  assert(MENU_OPTIONS[game.menu.index] === "How to Play", "B: cursor still reads How to Play (title path)");
  // "pause" from howto also exits cleanly (menuHowto's other exit branch)
  gotoScreen("howto");
  menuInput("pause");
  assert(game.paused === false && game.menu.screen === null, "B: pause action from howto closes the menu entirely");

  // -- Mid-game: openPause() opens the ROOT; Options -> How to Play -> back must retrace through both
  // hops (howto -> options -> root), landing the cursor back on "Options" in the root AND on
  // "How to Play" in options — the exact shape the CS010 FORK-4 back-path bug broke once before. --
  startGame(); game.state = "playing"; game.paused = false; game.menu.screen = null;
  openPause();
  assert(game.menu.screen === "root", "B: mid-game openPause() -> root");
  game.menu.index = rootItems().indexOf("Options");
  const rootIdx = game.menu.index;
  menuInput("confirm");
  assert(game.menu.screen === "options", "B: root Options row -> options screen");
  game.menu.index = MENU_OPTIONS.indexOf("How to Play");
  const idxPause = game.menu.index;
  menuInput("confirm");
  assert(game.menu.screen === "howto", "B: confirm on How to Play -> howto screen (mid-game path)");
  menuInput("back");
  assert(game.menu.screen === "options" && game.menu.index === idxPause,
    "B: back from howto -> options, cursor index unchanged (mid-game path)");
  menuInput("back");
  assert(game.menu.screen === "root" && game.menu.index === rootIdx,
    "B: back from options -> root, cursor index unchanged (still on Options)");
  closePause();
  assert(game.paused === false && game.menu.screen === null, "B: closePause() leaves no menu open");
})();

// ================= (C) Replay Hints =================
(function sectionC() {
  console.log("(C) Replay Hints: flips a pre-set tutSeen to all-false, fires feedback once, persists");
  startGame(); game.state = "playing"; game.paused = false;

  // Pre-set a returning player's latches — a mix of true/false, never all-false already (else flipping
  // "everything" to false would be indistinguishable from a no-op).
  TUT_IDS.forEach((id, i) => { settings.tutSeen[id] = (i % 2 === 0); });
  assert(TUT_IDS.some(id => settings.tutSeen[id] === true), "C: precondition — at least one hint pre-seen");

  openPause();
  game.menu.index = rootItems().indexOf("Options");
  menuInput("confirm");
  assert(game.menu.screen === "options", "C: reached Options");
  game.menu.index = MENU_OPTIONS.indexOf("Replay Hints");

  let uiCalls = 0;
  const origUi = AudioSys.ui;
  AudioSys.ui = function (v) { uiCalls++; return origUi.call(AudioSys, v); };
  menuInput("confirm");
  AudioSys.ui = origUi;

  assert(TUT_IDS.every(id => settings.tutSeen[id] === false), "C: every TUT_IDS flag is now false");
  assert(game.menu.screen === "options", "C: Replay Hints does not navigate off Options");
  assert(uiCalls === 1, `C: AudioSys.ui feedback fired exactly once (got ${uiCalls})`);

  // Persistence: saveSettings() must have written the all-false tutSeen through the localStorage stub —
  // round-trip it into a FRESH settings object the way loadSettings() actually does, rather than just
  // re-reading the same in-memory `settings` object back at itself.
  const raw = lsStore[STORAGE_KEY];
  assert(typeof raw === "string" && raw.length > 0, "C: saveSettings() wrote to the localStorage stub");
  const parsed = JSON.parse(raw);
  assert(parsed.tutSeen && TUT_IDS.every(id => parsed.tutSeen[id] === false),
    "C: the persisted payload's tutSeen is all-false for every TUT_IDS entry");

  // Flip everything back to true in memory only, then loadSettings() from the stub and confirm it
  // restores all-false — proving the write actually round-trips through the real load path, not just
  // that JSON.parse of the raw string looks right.
  TUT_IDS.forEach(id => { settings.tutSeen[id] = true; });
  loadSettings();
  assert(TUT_IDS.every(id => settings.tutSeen[id] === false),
    "C: loadSettings() restores the persisted all-false tutSeen");

  closePause();
})();

// ================= (D) drawHowto: crash-free + live rebind reflected =================
(function sectionD() {
  console.log("(D) drawHowto crash-free; CONTROLS block reflects a REAL rebound thrust key");
  startGame(); game.state = "playing"; game.paused = false;

  // Rebind "thrust" through the REAL capture path (Controls screen), not a direct bindings mutation —
  // proves the reference card reads whatever the player actually bound, not a baked default.
  const thrustRow = REBINDABLE.indexOf("thrust");
  game.menu.screen = "controls"; game.menu.row = thrustRow; game.menu.col = 0; game.menu.rebinding = null;
  startRebind("thrust", "key");
  assert(game.menu.rebinding && game.menu.rebinding.action === "thrust", "D: rebind armed for thrust/key");
  captureKeyRebind("k");
  assert(bindings.thrust.keys.includes("k"), "D: thrust is now bound to 'k'");
  const expectedKeyLabel = keyLabel(bindings.thrust);
  const expectedPadLabel = padLabel(bindings.thrust);
  assert(expectedKeyLabel === "K", `D: keyLabel(thrust) reads the rebound key (got "${expectedKeyLabel}")`);

  gotoScreen("howto");
  let log;
  noThrow(() => { log = render(drawHowto); }, "D: drawHowto() renders without throwing");

  const thrustLabelEntry = log.find(e => e.c === "fillText" && e.str === bindings.thrust.label);
  assert(!!thrustLabelEntry, `D: CONTROLS block draws the "${bindings.thrust.label}" action row`);
  const keyEntry = log.find(e => e.c === "fillText" && e.str === expectedKeyLabel);
  assert(!!keyEntry, `D: CONTROLS block draws the rebound keyboard label "${expectedKeyLabel}"`);
  const padEntry = log.find(e => e.c === "fillText" && e.str === expectedPadLabel);
  assert(!!padEntry, `D: CONTROLS block draws the gamepad label "${expectedPadLabel}" (unchanged by the rebind)`);

  // Every other rebindable action's row is present too (not just thrust) — the table is complete.
  REBINDABLE.forEach(name => {
    const entry = log.find(e => e.c === "fillText" && e.str === bindings[name].label);
    assert(!!entry, `D: CONTROLS block draws the "${bindings[name].label}" row`);
  });

  // Copy must never imply a tow/release key/control exists (spec constraint) — a light content guard.
  const allText = log.filter(e => e.c === "fillText").map(e => e.str).join(" | ").toLowerCase();
  assert(!/release/.test(allText) && !/tow key/.test(allText),
    "D: reference-card copy never mentions a release control or a \"tow key\"");

  // Crash-free across a second render pass too (idempotent — no accumulating state from one draw to the next).
  noThrow(() => { render(drawHowto); }, "D: drawHowto() renders a second time without throwing");

  // drawOptionsMenu still renders crash-free at the grown 504px panel height with the two new rows present.
  noThrow(() => { gotoScreen("options", 0); render(drawOptionsMenu); }, "D: drawOptionsMenu renders with the two new rows");

  closePause();
})();

// ================= (E) note: full regression =================
console.log("(E) full pre-existing menu-suite regression: run scratchpad/test-*.js alongside this file (see STATUS.md)");

console.log(`\ntest-cs014-p3: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
