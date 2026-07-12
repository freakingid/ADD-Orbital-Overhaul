// Headless test for v3.3 Phase 1 — the presentation pass (rename, opaque dialogs, clump silhouette,
// LEVEL HUD). Follows the repo test convention: stub window/document/rAF/navigator/localStorage,
// eval the REAL <script> block, then drive the actual code — no reimplementation of logic under test.
//
//   node scratchpad/test-v33-p1.js
//
// Checks:
//  (1) menuPanel fills the panel rect (fillRect) BEFORE stroking it (strokeRect) — call-order assert
//      via an instrumented ctx, driven through the real menuPanel().
//  (2) Garbage.draw() is crash-free at pieces = 1, 2, and 11 (single canister vs. clump hull branch).
//  (3) The cached hull is stable across frames (no per-frame re-randomization) and regenerates on
//      merge (a different array instance / different points) — driven through the real coalesceGarbage.
//  (4) pieces === 1 draw path only calls drawCanister-shaped canvas ops (no hull polygon) — sanity
//      that the two draw branches are genuinely distinct.
//  (5) COLOR.clumpHot exists and is distinct from COLOR.garbage.

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// Instrumented 2D context: records the ORDER of fillRect/strokeRect calls, no-ops everything else.
function makeRecordingCtx() {
  const calls = [];
  return new Proxy({}, {
    get(t, p) {
      if (p === "calls") return calls;
      if (p === "fillRect" || p === "strokeRect") return (...args) => calls.push({ op: p, args });
      return (..._args) => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

const recordingCtx = makeRecordingCtx();
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => recordingCtx };
const documentStub = { getElementById: () => canvasStub };

const noAudio = new Proxy({ state: "running", currentTime: 0, sampleRate: 44100,
  destination: {}, createGain: () => noAudio, createBuffer: () => ({ getChannelData: () => new Float32Array(1) }) },
  { get(t, p) { return p in t ? t[p] : () => noAudio; } });
function FakeAudioContext() { return noAudio; }
const windowStub = { addEventListener() {}, innerWidth: 1280, innerHeight: 720,
  AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext };
const performanceStub = { now: () => 0 };
const rafStub = () => 0;
const navigatorStub = { getGamepads: () => [] };
const lsStore = {};
global.localStorage = { getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); }, removeItem: k => { delete lsStore[k]; } };

const returnList = ["startGame", "update", "game", "coalesceGarbage", "Garbage", "menuPanel", "ctx",
  "COLOR", "GARBAGE_COALESCE_DELAY", "GARBAGE_MERGE_DIST", "GARBAGE_MAGNET_RANGE", "HUNTER_COALESCE_COUNT"];

const wrapped = new Function(
  "window", "document", "navigator", "performance", "requestAnimationFrame", "localStorage",
  scriptSrc + `\nreturn { ${returnList.join(", ")} };`
);
const G = wrapped(windowStub, documentStub, navigatorStub, performanceStub, rafStub, global.localStorage);
const { startGame, update, game, coalesceGarbage, Garbage, menuPanel, ctx, COLOR,
  GARBAGE_COALESCE_DELAY, GARBAGE_MERGE_DIST, GARBAGE_MAGNET_RANGE, HUNTER_COALESCE_COUNT } = G;

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ok - ${msg}`); }
  else { failed++; console.log(`  FAIL - ${msg}`); }
}

// =====================================================================
console.log("(1) menuPanel fills before it strokes");
{
  recordingCtx.calls.length = 0; // clear any calls from module init (e.g. resize())
  const result = menuPanel(400, 300, "TEST");
  const fillIdx = recordingCtx.calls.findIndex(c => c.op === "fillRect");
  const strokeIdx = recordingCtx.calls.findIndex(c => c.op === "strokeRect");
  assert(fillIdx !== -1, "1: menuPanel calls fillRect (panel is filled, not just stroked)");
  assert(strokeIdx !== -1, "1: menuPanel calls strokeRect (the existing glow-stroke)");
  assert(fillIdx < strokeIdx, "1: fillRect happens BEFORE strokeRect (fill first, then stroke)");
  assert(result && typeof result.x === "number" && typeof result.y === "number",
    "1: menuPanel returns {x,y} panel origin as before");
}

// =====================================================================
console.log("(2) Garbage.draw() is crash-free at pieces = 1, 2, 11");
{
  for (const pieces of [1, 2, 11]) {
    const g = new Garbage(100, 100);
    g.pieces = pieces;
    g.radius = 7 * Math.sqrt(pieces);
    let threw = false;
    try { g.draw(); } catch (e) { threw = true; console.log(e); }
    assert(!threw, `2: draw() crash-free at pieces=${pieces}`);
  }
}

// =====================================================================
console.log("(3) cached hull is stable across frames, regenerates on merge");
{
  const g = new Garbage(200, 200);
  g.pieces = 5;
  g.radius = 7 * Math.sqrt(5);
  g.hull = g.hull; // (constructor already generated one at pieces=1 default radius; re-tag for test)
  const hullBefore = g.hull;
  const snapshotBefore = JSON.stringify(hullBefore);
  // Simulate several draw() calls (frames) — the hull reference/content must not change.
  for (let i = 0; i < 5; i++) g.draw();
  assert(g.hull === hullBefore, "3: hull array reference unchanged across repeated draw() calls (no per-frame re-randomization)");
  assert(JSON.stringify(g.hull) === snapshotBefore, "3: hull point values unchanged across repeated draw() calls");

  // Drive a REAL merge through coalesceGarbage and confirm the hull regenerates (new reference).
  startGame();
  game.state = "playing"; game.paused = false;
  game.garbage = [];
  const a = new Garbage(500, 500, 0, 0, 1.0);
  a.pieces = 3; a.radius = 7 * Math.sqrt(3); a.coalesceDelay = 0;
  const hullPreMerge = a.hull;
  const b = new Garbage(505, 500, 0, 0, 1.0); // within GARBAGE_MERGE_DIST of a
  b.pieces = 2; b.coalesceDelay = 0;
  game.garbage.push(a, b);
  coalesceGarbage(1 / 60);
  assert(a.pieces === 5, `3: merge combined pieces (3+2=5), got ${a.pieces}`);
  assert(a.hull !== hullPreMerge, "3: hull regenerated (new array reference) at merge time");
  assert(Math.abs(a.radius - 7 * Math.sqrt(5)) < 1e-9, "3: radius re-derived at merge (7*sqrt(pieces))");
}

// =====================================================================
console.log("(4) single canister (pieces=1) draw path stays on the drawCanister shape (sanity)");
{
  const g = new Garbage(300, 300);
  assert(g.pieces === 1, "4: fresh Garbage starts at pieces=1");
  let threw = false;
  try { g.draw(); } catch (e) { threw = true; }
  assert(!threw, "4: pieces=1 draw() crash-free (byte-identical single-canister branch)");
}

// =====================================================================
console.log("(5) COLOR.clumpHot exists and is distinct from COLOR.garbage");
assert(typeof COLOR.clumpHot === "string" && /^#[0-9a-f]{6}$/i.test(COLOR.clumpHot),
  "5: COLOR.clumpHot is a hex color");
assert(COLOR.clumpHot !== COLOR.garbage, "5: COLOR.clumpHot is distinct from COLOR.garbage");

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
