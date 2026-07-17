// Headless test for CS014 Phase 4 — title salvage tagline + GAME_VERSION bump (round close).
//
//   node scratchpad/test-cs014-p4.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL draw() title branch via a recording 2D-context stub that logs
// fillText calls (mirrors test-cs014-p3.js's canvas-recording idiom) — no render logic reimplemented.
//
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) GAME_VERSION === "1.0.0.14".
//  (C) the title screen's draw() branch is crash-free (proxy canvas) and renders the new salvage
//      tagline in COLOR.dock, positioned between the second control line and the Hunter warning.
//  (D) the two pre-existing control lines and the Hunter warning line are all still present and
//      unmoved (the new line was inserted, nothing else nudged).

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
  const tmp = path.join(repoRoot, "scratchpad", "_cs014p4_extracted.js");
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
// (mirrors test-cs014-p3.js's idiom). Every other method is a safe no-op.
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

const RETURN = ["game", "draw", "GAME_VERSION", "COLOR", "AudioSys", "VIEW_W", "VIEW_H"];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, localStorageStub);
const { game, draw, GAME_VERSION, COLOR, AudioSys, VIEW_W, VIEW_H } = A;

AudioSys.init();

function render(fn) { recLog = []; fn(); return recLog; }

// ================= (B) GAME_VERSION =================
(function sectionB() {
  console.log("(B) GAME_VERSION === \"1.0.0.14\"");
  assert(GAME_VERSION === "1.0.0.14", "B: GAME_VERSION is exactly \"1.0.0.14\"");
})();

// ================= (C) title draw() crash-free + new tagline present =================
(function sectionC() {
  console.log("(C) title draw() crash-free; salvage tagline renders in COLOR.dock at the spec'd position");
  game.state = "title";
  game.paused = false;

  let log;
  noThrow(() => { log = render(draw); }, "C: draw() on the title screen renders without throwing");

  const tagline = log.find(e => e.c === "fillText" && e.str === "SHOOT DEBRIS · HOOK SALVAGE · HAUL IT TO THE DOCK");
  assert(!!tagline, "C: title draw() renders the salvage tagline text");
  if (tagline) {
    assert(tagline.x === VIEW_W / 2, "C: tagline is horizontally centered");
    assert(tagline.y === VIEW_H / 2 + 91, `C: tagline sits at y = VIEW_H/2 + 91 (got offset ${tagline.y - VIEW_H / 2})`);
    assert(tagline.color === COLOR.dock, "C: tagline renders in COLOR.dock");
  }

  // Crash-free across a second render pass too (idempotent).
  noThrow(() => { render(draw); }, "C: draw() on the title screen renders a second time without throwing");
})();

// ================= (D) neighboring lines unmoved =================
(function sectionD() {
  console.log("(D) the two control lines and the Hunter warning are all still present, unmoved");
  game.state = "title";
  game.paused = false;
  const log = render(draw);

  const rotateLine = log.find(e => e.c === "fillText" && /^ROTATE:/.test(e.str));
  const fireLine = log.find(e => e.c === "fillText" && /^FIRE:/.test(e.str));
  const hunterLine = log.find(e => e.c === "fillText" && e.str === "BEWARE THE HUNTER SATELLITE");

  assert(!!rotateLine && rotateLine.y === VIEW_H / 2 + 30, "D: first control line unmoved (y = VIEW_H/2 + 30)");
  assert(!!fireLine && fireLine.y === VIEW_H / 2 + 62, "D: second control line unmoved (y = VIEW_H/2 + 62)");
  assert(!!hunterLine && hunterLine.y === VIEW_H / 2 + 120, "D: Hunter warning line unmoved (y = VIEW_H/2 + 120)");
  assert(!!hunterLine && hunterLine.color === COLOR.satellite, "D: Hunter warning keeps its own COLOR.satellite (no collision fallback needed)");
})();

console.log(`\ntest-cs014-p4: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
