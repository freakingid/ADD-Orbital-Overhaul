// Headless test for v3.3 Phase 1 — the presentation pass (rename, opaque dialogs, clump silhouette,
// LEVEL HUD). Follows the repo test convention: stub window/document/rAF/navigator/localStorage,
// eval the REAL <script> block, then drive the actual code — no reimplementation of logic under test.
//
//   node scratchpad/test-v33-p1.js
//
// Checks:
//  (1) menuPanel fills the panel rect (fillRect) BEFORE stroking it (strokeRect) — call-order assert
//      via an instrumented ctx, driven through the real menuPanel().
//  (2) Garbage.draw() is crash-free at pieces = 1, 2, and 11 (single canister vs. scaled-clump branch).
//  (3) v3.5 P2 (reverses v3.3 P1's cached-hull assertions): no `hull` field exists on a fresh Garbage,
//      after a real coalesceGarbage merge, or on a real partial-scoop leftover (driven through the
//      real update()); makeClumpHull is gone from the source entirely.
//  (4) pieces > 1 renders as ONE drawCanister scaled by sqrt(pieces) (= this.radius / 7) — the drawn
//      body/stripe extent (via a recording ctx capturing moveTo/lineTo args) tracks this.radius.
//  (5) drawCanister's default scale (no trailing arg — the single-canister and chain-node call sites)
//      draws at the unscaled ±7/±5 extent, byte-identical to pre-P2 rendering — the load-bearing
//      regression guard for the two untouched call sites.
//  (6) the clumpHot tint still lerps with pieces (COLOR.clumpHot exists, distinct from COLOR.garbage).

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// Instrumented 2D context: records fillRect/strokeRect/moveTo/lineTo calls (order + args), tracks the
// last strokeStyle assignment as a synthetic "call" too, no-ops everything else.
function makeRecordingCtx() {
  const calls = [];
  const recorded = new Set(["fillRect", "strokeRect", "moveTo", "lineTo"]);
  return new Proxy({}, {
    get(t, p) {
      if (p === "calls") return calls;
      if (recorded.has(p)) return (...args) => calls.push({ op: p, args });
      return (..._args) => {};
    },
    set(t, p, v) {
      t[p] = v;
      if (p === "strokeStyle") calls.push({ op: "strokeStyle", args: [v] });
      return true;
    }
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
  "COLOR", "GARBAGE_COALESCE_DELAY", "GARBAGE_MERGE_DIST", "GARBAGE_MAGNET_RANGE", "HUNTER_COALESCE_COUNT",
  "drawCanister"];

const wrapped = new Function(
  "window", "document", "navigator", "performance", "requestAnimationFrame", "localStorage",
  scriptSrc + `\nreturn { ${returnList.join(", ")} };`
);
const G = wrapped(windowStub, documentStub, navigatorStub, performanceStub, rafStub, global.localStorage);
const { startGame, update, game, coalesceGarbage, Garbage, menuPanel, ctx, COLOR,
  GARBAGE_COALESCE_DELAY, GARBAGE_MERGE_DIST, GARBAGE_MAGNET_RANGE, HUNTER_COALESCE_COUNT,
  drawCanister } = G;

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
console.log("(3) v3.5 P2: no cached hull anywhere — fresh, merged, or partial-scoop leftover");
{
  const fresh = new Garbage(50, 50);
  assert(!("hull" in fresh), "3: a fresh Garbage has no hull field");
  assert(!/function makeClumpHull/.test(scriptSrc), "3: makeClumpHull is gone from the source entirely");

  // Drive a REAL merge through coalesceGarbage and confirm no hull field appears on the survivor.
  startGame();
  game.state = "playing"; game.paused = false;
  game.garbage = [];
  const a = new Garbage(500, 500, 0, 0, 1.0);
  a.pieces = 3; a.radius = 7 * Math.sqrt(3); a.coalesceDelay = 0;
  const b = new Garbage(505, 500, 0, 0, 1.0); // within GARBAGE_MERGE_DIST of a
  b.pieces = 2; b.coalesceDelay = 0;
  game.garbage.push(a, b);
  coalesceGarbage(1 / 60);
  assert(a.pieces === 5, `3: merge combined pieces (3+2=5), got ${a.pieces}`);
  assert(Math.abs(a.radius - 7 * Math.sqrt(5)) < 1e-9, "3: radius re-derived at merge (7*sqrt(pieces))");
  assert(!("hull" in a), "3: no hull field on the merge survivor");

  // Drive a REAL partial scoop through update() and confirm no hull field on the leftover.
  game.chain = [];
  game.cargoMax = 3; // only 3 free slots -> a partial, lossy scoop
  const clumpMass = 10;
  const clump = new Garbage(game.ship.x + 6, game.ship.y, 0, 0);
  clump.pieces = 10; clump.mass = clumpMass; clump.radius = 7 * Math.sqrt(10); clump.coalesceDelay = 0;
  game.garbage = [clump];
  update(1 / 60);
  assert(game.chain.length === 3 && !clump.dead && clump.pieces === 7,
    `3: partial scoop left a live 7-piece leftover (chain=${game.chain.length}, pieces=${clump.pieces}, dead=${clump.dead})`);
  assert(!("hull" in clump), "3: no hull field on the partial-scoop leftover");
}

// =====================================================================
console.log("(4) pieces > 1 draws ONE canister scaled by sqrt(pieces) (= radius/7); extent tracks radius");
{
  for (const pieces of [2, 5, 11]) {
    const g = new Garbage(300, 300);
    g.pieces = pieces;
    g.radius = 7 * Math.sqrt(pieces);
    g.spin = 0;
    recordingCtx.calls.length = 0;
    g.draw();
    const pts = recordingCtx.calls.filter(c => c.op === "moveTo" || c.op === "lineTo");
    assert(pts.length > 0, `4: pieces=${pieces} draw() emits moveTo/lineTo path ops`);
    const maxAbsX = Math.max(...pts.map(c => Math.abs(c.args[0])));
    assert(Math.abs(maxAbsX - g.radius) < 1e-9,
      `4: pieces=${pieces} drawn extent (${maxAbsX}) matches this.radius (${g.radius})`);
  }
}

// =====================================================================
console.log("(5) drawCanister's default scale is the unscaled ±7/±5 extent (byte-identical call sites)");
{
  recordingCtx.calls.length = 0;
  drawCanister(0, 0, 0, 1, COLOR.garbage); // no trailing scale arg — as the single-canister/chain-node sites call it
  const pts = recordingCtx.calls.filter(c => c.op === "moveTo" || c.op === "lineTo");
  const maxAbsX = Math.max(...pts.map(c => Math.abs(c.args[0])));
  assert(maxAbsX === 7, `5: default-scale drawCanister extent is exactly 7 (got ${maxAbsX})`);
}

// =====================================================================
console.log("(6) COLOR.clumpHot exists, is distinct from COLOR.garbage, and the tint lerps with pieces");
{
  assert(typeof COLOR.clumpHot === "string" && /^#[0-9a-f]{6}$/i.test(COLOR.clumpHot),
    "6: COLOR.clumpHot is a hex color");
  assert(COLOR.clumpHot !== COLOR.garbage, "6: COLOR.clumpHot is distinct from COLOR.garbage");

  const low = new Garbage(300, 300); low.pieces = 2; low.radius = 7 * Math.sqrt(2); low.spin = 0;
  const high = new Garbage(300, 300); high.pieces = HUNTER_COALESCE_COUNT - 1;
  high.radius = 7 * Math.sqrt(high.pieces); high.spin = 0;

  recordingCtx.calls.length = 0;
  low.draw();
  const lowStroke = recordingCtx.calls.filter(c => c.op === "strokeStyle").pop();

  recordingCtx.calls.length = 0;
  high.draw();
  const highStroke = recordingCtx.calls.filter(c => c.op === "strokeStyle").pop();

  assert(lowStroke && highStroke, "6: both draws set a strokeStyle");
  assert(lowStroke.args[0] !== highStroke.args[0],
    `6: the tint differs between a near-fresh clump (${lowStroke && lowStroke.args[0]}) and a near-Hunter one (${highStroke && highStroke.args[0]})`);
}

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
