// CS038 P6 headless test — the low-hull glow RETUNE (GATE A applied to drawHUD()'s glow block).
// Follows test-cs009-hud.js's bespoke recording-ctx pattern (not _harness.js's makeCtxStub, which
// swallows gradient stops/coords) — eval the REAL <script> block, stub window/document/rAF/
// navigator/localStorage, drive the ACTUAL startGame()/drawHUD(), never a reimplementation.
//
// GATE A's answer (Paul, tools/lowhp-glow-lab.html): shape = edge vignette, alpha 0.20/0.40,
// depth 280, RGB unchanged (mirror intact). Traps:
//   1. globalAlpha/shadowBlur must be checked ONLY inside the glow block, not across all of
//      drawHUD() — the HULL ring pulse and CARGO gold flash legitimately set globalAlpha later
//      in the same function. The glow block runs FIRST, and the very next thing drawHUD() does
//      is a drawText() call whose own first act is `ctx.font = ...` (never touched by the glow),
//      so cutting the recorded ops at the first "font" write isolates the glow block exactly.
//   2. hp=0 is a live precedent (test-cs009-hud.js's "dying"/"gameover" states already set it) —
//      drawHUD() only READS game.ship.hp, so a direct call is safe without going through
//      damageShip/killShip.
"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "orbital-overhaul.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const close = (a, b, eps, msg) => assert(Math.abs(a - b) <= eps, msg + " (got " + a + ")");

// ---- recording 2D context: methods logged as [name, ...args]; tracked property SETS logged as
// [propName, value] — the same shape test-cs009-hud.js uses, extended with the props this test
// needs (fillStyle, shadowBlur) and gradient objects that record their own stops. ----
let recLog = [];
function makeGradient(kind, coords) {
  const g = { kind, coords, stops: [] };
  g.addColorStop = (offset, color) => { g.stops.push([offset, color]); recLog.push(["addColorStop", offset, color]); };
  return g;
}
function makeRecordingCtx() {
  const state = { globalAlpha: 1, shadowBlur: 0 };
  const methods = ["arc", "stroke", "save", "restore", "translate", "rotate", "moveTo", "lineTo",
    "closePath", "beginPath", "fillText", "fillRect", "strokeRect", "fill", "clearRect", "scale"];
  const tracked = ["fillStyle", "strokeStyle", "lineWidth", "globalAlpha", "shadowBlur", "shadowColor",
    "font", "textAlign"];
  return new Proxy(state, {
    get(t, p) {
      if (p === "log") return recLog;
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return s => ({ width: 6 * String(s).length });
      if (p === "createLinearGradient") return (...c) => { const g = makeGradient("linear", c); recLog.push(["createLinearGradient", g, ...c]); return g; };
      if (p === "createRadialGradient") return (...c) => { const g = makeGradient("radial", c); recLog.push(["createRadialGradient", g, ...c]); return g; };
      if (methods.includes(p)) return (...args) => { recLog.push([p, ...args]); };
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) {
      t[p] = v;
      if (tracked.includes(p)) recLog.push([p, v]);
      return true;
    },
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
    connect() { return makeAudioNode(); }, disconnect() {}, setPeriodicWave() {}
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
const performanceStub = { now: () => 100000 };
const rafStub = () => 0;
const navigatorStub = { getGamepads: () => [] };
const lsStore = {};
const localStorageStub = {
  getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: k => { delete lsStore[k]; }
};

const returnList = [
  "startGame", "drawHUD", "game", "settings", "AudioSys", "Capture",
  "SHIP_MAX_HP", "LOW_HP_THRESHOLD",
  "LOWHP_GLOW_ALPHA_MIN", "LOWHP_GLOW_ALPHA_MAX", "LOWHP_GLOW_RADIUS", "LOWHP_GLOW_RGB",
  "VIEW_W", "VIEW_H", "clamp01", "lowhpPulseRate",
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, localStorageStub);
const {
  startGame, drawHUD, game, AudioSys, Capture, SHIP_MAX_HP, LOW_HP_THRESHOLD,
  LOWHP_GLOW_ALPHA_MIN, LOWHP_GLOW_ALPHA_MAX, LOWHP_GLOW_RADIUS, LOWHP_GLOW_RGB, VIEW_W, VIEW_H,
} = A;

AudioSys.init();
startGame();
game.state = "playing"; game.paused = false; Capture.hudVisible = true;

// ---- helpers ----
// The glow block runs FIRST in drawHUD(), and the next thing drawHUD() does is a drawText() call
// whose own first act is `ctx.font = ...` — never touched by the glow block. Cutting the recorded
// ops at the first "font" write (not "fillText") isolates the glow block's OWN ops precisely.
function glowOnly(fn) {
  recLog = [];
  fn();
  const cut = recLog.findIndex(e => e[0] === "font");
  return cut === -1 ? recLog.slice() : recLog.slice(0, cut);
}
function stopAlpha(str) {
  const mm = String(str).match(/rgba\([^,]+,[^,]+,[^,]+,([^)]+)\)/);
  return mm ? parseFloat(mm[1]) : NaN;
}
function firstPeakAlpha(ops) {
  const g = ops.find(e => e[0] === "createLinearGradient");
  return stopAlpha(g[1].stops[0][1]);
}
function pose(hp, phase) {
  game.lowHpSiren = true;
  game.ship.hp = hp;
  game.lowHpPhase = phase;
}
const PEAK_PHASE = Math.PI / 2, TROUGH_PHASE = -Math.PI / 2;

// ---- A. the constants equal GATE A's dump, ported verbatim, not retyped -------------------
// Values as pasted from tools/lowhp-glow-lab.html's dump panel (GATE A, Paul): shape = edge
// vignette, alpha 0.20/0.40, depth 280, RGB unchanged.
assert(LOWHP_GLOW_ALPHA_MIN === 0.20, "LOWHP_GLOW_ALPHA_MIN is GATE A's 0.20");
assert(LOWHP_GLOW_ALPHA_MAX === 0.40, "LOWHP_GLOW_ALPHA_MAX is GATE A's 0.40");
assert(LOWHP_GLOW_RADIUS === 280, "LOWHP_GLOW_RADIUS (now vignette depth) is GATE A's 280");
assert(LOWHP_GLOW_RGB === "255,64,64", "LOWHP_GLOW_RGB keeps the COLOR.lowhp mirror (GATE A A5)");
assert(LOW_HP_THRESHOLD === 100, "LOW_HP_THRESHOLD is untouched by the glow retune");

// ---- B. unreachable when lowHpSiren is false -----------------------------------------------
game.lowHpSiren = false;
game.ship.hp = 40;
const offOps = glowOnly(drawHUD);
assert(offOps.length === 0, "lowHpSiren = false: the glow block draws nothing at all");

// ---- C. shape really moved off radial corners, onto 4 linear-gradient edge bands -----------
pose(50, PEAK_PHASE);
const onOps = glowOnly(drawHUD);
const gradCalls = onOps.filter(e => e[0] === "createLinearGradient" || e[0] === "createRadialGradient");
assert(gradCalls.length === 4, "exactly four gradients drawn (got " + gradCalls.length + ")");
assert(gradCalls.every(e => e[0] === "createLinearGradient"), "all four are LINEAR gradients — A1 moved off radial corners");
const fills = onOps.filter(e => e[0] === "fillRect");
assert(fills.length === 4, "exactly four fillRect calls, one per edge band");

// band geometry: top/bottom/left/right rects at depth D = LOWHP_GLOW_RADIUS, spanning the
// opposite dimension edge-to-edge (the vignette shape's own contract).
const D = LOWHP_GLOW_RADIUS;
const rects = fills.map(e => ({ x: e[1], y: e[2], w: e[3], h: e[4] }));
const has = (x, y, w, h) => rects.some(r => r.x === x && r.y === y && r.w === w && r.h === h);
assert(has(0, 0, VIEW_W, D), "top band: full width, depth D from y=0");
assert(has(0, VIEW_H - D, VIEW_W, D), "bottom band: full width, depth D up from the bottom edge");
assert(has(0, 0, D, VIEW_H), "left band: full height, depth D from x=0");
assert(has(VIEW_W - D, 0, D, VIEW_H), "right band: full height, depth D in from the right edge");

// each gradient: 2 stops, RGB matches LOWHP_GLOW_RGB, stop0 = the peak, stop1 = alpha 0, and
// all four bands share ONE peak alpha per frame (one pulse, one alarm — not four independent ones)
const gradObjs = gradCalls.map(e => e[1]);
for (const g of gradObjs) {
  assert(g.stops.length === 2, "gradient has exactly 2 stops");
  assert(g.stops[0][1].includes(LOWHP_GLOW_RGB), "stop 0 carries LOWHP_GLOW_RGB");
  assert(stopAlpha(g.stops[1][1]) === 0, "stop 1 fades to alpha 0");
  close(g.stops[0][0], 0, 1e-9, "stop 0 sits at the edge (offset 0)");
  close(g.stops[1][0], 1, 1e-9, "stop 1 sits at full depth (offset 1)");
}
const peaks = gradObjs.map(g => stopAlpha(g.stops[0][1]));
assert(peaks.every(p => Math.abs(p - peaks[0]) < 1e-12), "all four bands share the same peak alpha");

// ---- D. alpha at t=0 and t=1 brackets correctly, at the pulse PEAK (gpulse=1.0) ------------
pose(LOW_HP_THRESHOLD, PEAK_PHASE);   // hp = threshold -> t = 0, the weakest/most common case
close(firstPeakAlpha(glowOnly(drawHUD)), LOWHP_GLOW_ALPHA_MIN, 1e-9, "t=0, peak pose: alpha = ALPHA_MIN exactly");
pose(0, PEAK_PHASE);                  // hp = 0 -> t = 1, near death
close(firstPeakAlpha(glowOnly(drawHUD)), LOWHP_GLOW_ALPHA_MAX, 1e-9, "t=1, peak pose: alpha = ALPHA_MAX exactly");

// ---- E. alpha at the pulse TROUGH (gpulse=0.2) — the closest thing to "invisible" ----------
pose(LOW_HP_THRESHOLD, TROUGH_PHASE);
close(firstPeakAlpha(glowOnly(drawHUD)), LOWHP_GLOW_ALPHA_MIN * 0.2, 1e-9, "t=0, trough pose: alpha = ALPHA_MIN x 0.2");
pose(0, TROUGH_PHASE);
close(firstPeakAlpha(glowOnly(drawHUD)), LOWHP_GLOW_ALPHA_MAX * 0.2, 1e-9, "t=1, trough pose: alpha = ALPHA_MAX x 0.2");

// ---- F. peak scales MONOTONICALLY with t, at a fixed pulse phase ---------------------------
{
  const alphaAt = hp => { pose(hp, PEAK_PHASE); return firstPeakAlpha(glowOnly(drawHUD)); };
  const a100 = alphaAt(100), a50 = alphaAt(50), a0 = alphaAt(0);
  assert(a100 < a50 && a50 < a0, "alpha rises monotonically as HP falls (100 < 50 < 0 in urgency)");
}

// ---- G. globalAlpha and shadowBlur are NEVER touched inside the glow block -----------------
// (Scoped to the glow block's own ops — the HULL ring pulse right after it legitimately sets
// globalAlpha, and this must not be mistaken for a leak out of the glow.)
pose(30, PEAK_PHASE);
const ops = glowOnly(drawHUD);
assert(ops.every(e => e[0] !== "globalAlpha"), "the glow block never writes ctx.globalAlpha (alpha rides the gradient stop)");
assert(ops.every(e => e[0] !== "shadowBlur"), "the glow block never sets ctx.shadowBlur (no glowStroke — a FILL, and no perf regression)");
assert(ops.every(e => e[0] !== "fill" && e[0] !== "stroke"), "the glow block strokes nothing — fillRect only, no glowStroke() calls");

// globalAlpha genuinely IS 1 both entering and immediately after the glow block, proving nothing
// leaked out of it either (the invariant's whole point: a later reader must see an untouched value).
assert(recCtx.globalAlpha === 1, "ctx.globalAlpha reads back 1 immediately after the glow block");

// ---- H. still gated on the EXACT SAME predicate as the siren, still driven by the shared phase ----
game.lowHpSiren = true; game.ship.hp = 20; game.lowHpPhase = 0.7;
const onA = glowOnly(drawHUD);
game.lowHpPhase = 2.1;   // a different point on the SAME shared accumulator
const onB = glowOnly(drawHUD);
assert(firstPeakAlpha(onA) !== firstPeakAlpha(onB),
  "moving game.lowHpPhase moves the glow's alpha — it reads the shared accumulator, not a private clock");

// ---- I. Capture's H toggle still hides it (drawHUD lives inside the same gate as before) ---
Capture.hudVisible = false;
recLog = [];
if (Capture.hudVisible) drawHUD();
assert(recLog.length === 0, "Capture.hudVisible = false still skips the whole of drawHUD(), glow included");
Capture.hudVisible = true;

console.log(`\ntest-cs038-p6: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
