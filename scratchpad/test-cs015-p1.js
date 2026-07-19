// Headless test for CS015 Phase P1 (items 1, 2) — pause-panel width fit + Scoop HUD indicator color.
//
//   node scratchpad/test-cs015-p1.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL drawRootMenu()/drawHUD() functions via a recording 2D-context
// stub (mirrors test-cs013-p2.js's canvas-recording idiom) — no menu/HUD-render logic reimplemented.
//
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) drawRootMenu measures ROOT_MENU_HINT at MENU_HINT_SIZE before sizing the panel: the rendered
//      panel width always covers measured-hint-width + 2*ROOT_MENU_HINT_MARGIN, floors at 360 for a
//      narrow hint, and grows past 360 for a wide one — computed from the real symbols, not hardcoded.
//  (C) the Scoop HUD row's color expression (scoopCol) reads COLOR.dim at scoopLevel 0 and
//      POWERUP_COLOR.scoop at scoopLevel >= 1, mirroring the timed powerup rows' active/idle rule —
//      verified via the SCOOP label + level-number fillText color (both fed by the same scoopCol the
//      segmented ring's litColor also uses, confirmed by source: one `const scoopCol` feeds all three).
//  (D) headless: AudioSys.ctx null -> draw() at title (game.paused true/false) and mid-game paused
//      (root screen) never throws.

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
  const tmp = path.join(repoRoot, "scratchpad", "_cs015p1_extracted.js");
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

// ---- Recording 2D context — logs fillText/fillRect/strokeRect/measureText calls with the live style
// state, mirrors test-cs013-p2.js's idiom. measureText is deterministic (8px per char) unless
// `measureWidthOverride` is set, so section (B) can force both the floor and the grow branches. ----
let recLog = [];
let measureWidthOverride = null;
function makeRecordingCtx() {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null, shadowBlur: 0 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "fillText") return (str, x, y) => recLog.push({ c: "fillText", str, x, y, font: t.font, color: t.fillStyle, align: t.textAlign });
      if (p === "fillRect") return (x, y, w, h) => recLog.push({ c: "fillRect", x, y, w, h, color: t.fillStyle });
      if (p === "strokeRect") return (x, y, w, h) => recLog.push({ c: "strokeRect", x, y, w, h, color: t.strokeStyle });
      if (p === "measureText") return (str) => {
        const width = measureWidthOverride != null ? measureWidthOverride : str.length * 8;
        recLog.push({ c: "measureText", str, font: t.font, width });
        return { width };
      };
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

const RETURN = [
  "startGame", "update", "game", "gotoScreen", "draw", "drawRootMenu", "drawHUD",
  "COLOR", "POWERUP_COLOR", "MENU_HINT_SIZE", "ROOT_MENU_HINT", "ROOT_MENU_HINT_MARGIN",
  "HUD_FX_BASE_Y", "AudioSys", "VIEW_W", "VIEW_H"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, localStorageStub);
const {
  startGame, update, game, gotoScreen, draw, drawRootMenu, drawHUD,
  COLOR, POWERUP_COLOR, MENU_HINT_SIZE, ROOT_MENU_HINT, ROOT_MENU_HINT_MARGIN,
  HUD_FX_BASE_Y, AudioSys, VIEW_W, VIEW_H
} = A;

AudioSys.init();
startGame();

function render(fn) { recLog = []; fn(); return recLog; }
const at = (log, x, y) => log.filter(e => e.c === "fillText" && e.x === x && e.y === y);

// ================= (B) drawRootMenu panel width =================
(function sectionB() {
  console.log("(B) drawRootMenu measures ROOT_MENU_HINT and sizes the panel to fit it");
  game.state = "playing";
  gotoScreen("root", 0);

  // sub-test 1: deterministic 8px/char measure -> panel width covers measured width + margins exactly.
  measureWidthOverride = null;
  let log = render(drawRootMenu);
  const measureCall = log.find(e => e.c === "measureText" && e.str === ROOT_MENU_HINT);
  assert(!!measureCall, "B: ctx.measureText was called with ROOT_MENU_HINT");
  assert(measureCall.font === MENU_HINT_SIZE + "px monospace", `B: measured at MENU_HINT_SIZE font (got "${measureCall && measureCall.font}")`);
  let panelRect = log.find(e => e.c === "fillRect");
  assert(!!panelRect, "B: menuPanel drew its background fillRect");
  const expectedW1 = Math.max(360, Math.ceil(measureCall.width) + 2 * ROOT_MENU_HINT_MARGIN);
  assert(panelRect.w === expectedW1, `B: panel width === max(360, measured+2*margin) (got ${panelRect.w}, expected ${expectedW1})`);
  assert(panelRect.w >= measureCall.width + 2 * ROOT_MENU_HINT_MARGIN, "B: panel width covers the measured hint width plus margin on both sides");

  // sub-test 2: a narrow measured hint floors at 360 (today's fixed width, unchanged for a short hint).
  measureWidthOverride = 5;
  log = render(drawRootMenu);
  panelRect = log.find(e => e.c === "fillRect");
  assert(panelRect.w === 360, `B: floors at 360 when the measured hint is narrow (got ${panelRect.w})`);

  // sub-test 3: a wide measured hint grows the panel past 360.
  measureWidthOverride = 500;
  log = render(drawRootMenu);
  panelRect = log.find(e => e.c === "fillRect");
  const expectedW3 = Math.ceil(500) + 2 * ROOT_MENU_HINT_MARGIN;
  assert(panelRect.w === expectedW3, `B: grows past 360 to fit a wide hint (got ${panelRect.w}, expected ${expectedW3})`);
  assert(panelRect.w > 360, "B: the grown width is actually wider than the old fixed 360");

  measureWidthOverride = null; // restore default for later sections
})();

// ================= (C) Scoop HUD indicator color =================
(function sectionC() {
  console.log("(C) Scoop row follows the active/idle convention: dim at level 0, POWERUP_COLOR.scoop at >=1");
  game.state = "playing";
  game.paused = false;
  assert(COLOR.dim !== POWERUP_COLOR.scoop, "C: sanity — COLOR.dim and POWERUP_COLOR.scoop are distinct");

  game.scoopLevel = 0;
  let log = render(drawHUD);
  let label = at(log, 64, HUD_FX_BASE_Y - 4);
  let num = at(log, 64, HUD_FX_BASE_Y + 14);
  assert(label.length === 1, "C: exactly one SCOOP label fillText at level 0");
  assert(num.length === 1, "C: exactly one Scoop level-number fillText at level 0");
  assert(label[0].color === COLOR.dim, `C: SCOOP label reads COLOR.dim at level 0 (got ${label[0] && label[0].color})`);
  assert(num[0].color === COLOR.dim, `C: Scoop level number reads COLOR.dim at level 0 (got ${num[0] && num[0].color})`);

  game.scoopLevel = 3;
  log = render(drawHUD);
  label = at(log, 64, HUD_FX_BASE_Y - 4);
  num = at(log, 64, HUD_FX_BASE_Y + 14);
  assert(label.length === 1, "C: exactly one SCOOP label fillText at level 3");
  assert(num.length === 1, "C: exactly one Scoop level-number fillText at level 3");
  assert(label[0].color === POWERUP_COLOR.scoop, `C: SCOOP label reads POWERUP_COLOR.scoop at level >=1 (got ${label[0] && label[0].color})`);
  assert(num[0].color === POWERUP_COLOR.scoop, `C: Scoop level number reads POWERUP_COLOR.scoop at level >=1 (got ${num[0] && num[0].color})`);

  game.scoopLevel = 0; // restore
})();

// ================= (D) headless no-crash smoke =================
(function sectionD() {
  console.log("(D) AudioSys.ctx null -> draw() at title and mid-game paused (root screen) never throws");
  AudioSys.ctx = null;
  noThrow(() => { startGame(); }, "D: startGame() with ctx null");
  noThrow(() => { for (let i = 0; i < 30; i++) update(1 / 60); }, "D: update(1/60) x30 with ctx null");

  game.state = "title";
  game.paused = false;
  noThrow(() => { render(draw); }, "D: draw() at title, unpaused, never throws");
  game.paused = true;
  gotoScreen("options", 0);
  noThrow(() => { render(draw); }, "D: draw() at title with the pause overlay open never throws");

  game.state = "playing";
  game.paused = true;
  gotoScreen("root", 0);
  noThrow(() => { render(draw); }, "D: draw() mid-game paused on the root screen never throws");

  game.paused = false;
})();

console.log(`\ntest-cs015-p1: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
