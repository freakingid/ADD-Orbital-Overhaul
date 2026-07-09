// Headless test for v3.1 Phase 2 — fix the wrap jump discontinuity (drop the undocumented +120).
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator, eval the REAL <script> block, then
// drive the actual wrap()/wrapNode() code against real entities/chain nodes — no reimplementation.
//
//   node scratchpad/test-v31-wrap.js
//
// Checks:
//  (A) wrap(): an entity approaching the x seam from below sees shortDelta to a fixed partner
//      stay continuous (no ~120px jump) across the wrap crossing; lands in [0, WORLD_W).
//  (B) wrap(): same for the y seam, lands in [0, WORLD_H).
//  (C) wrapNode(): a chain node wrapping across the x seam shifts px by the same delta as x
//      (implied velocity survives the teleport, GDD §3 rule); lands in [0, WORLD_W).
//  (D) wrapNode(): same for the y seam.

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

const noopCtx = new Proxy({}, { get() { return () => {}; }, set() { return true; } });
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => noopCtx };
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

const returnList = ["wrap", "wrapNode", "shortDelta", "WORLD_W", "WORLD_H"];

const wrapped = new Function(
  "window", "document", "navigator", "performance", "requestAnimationFrame", "localStorage",
  scriptSrc + `\nreturn { ${returnList.join(", ")} };`
);
const G = wrapped(windowStub, documentStub, navigatorStub, performanceStub, rafStub, global.localStorage);
const { wrap, wrapNode, shortDelta, WORLD_W, WORLD_H } = G;

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ok - ${msg}`); }
  else { failed++; console.log(`  FAIL - ${msg}`); }
}

// =====================================================================
console.log("(A) wrap(): x-seam crossing keeps shortDelta continuous, no ~120px jump");
{
  const partner = { x: 100, y: 700 };
  const entity = { x: -61, y: 700 }; // just past the trigger margin
  const [dxBefore] = shortDelta(entity.x, entity.y, partner.x, partner.y);
  wrap(entity);
  const [dxAfter] = shortDelta(entity.x, entity.y, partner.x, partner.y);
  assert(entity.x >= 0 && entity.x < WORLD_W, `A: wrapped x (${entity.x}) lands in [0, WORLD_W)`);
  assert(Math.abs(dxAfter - dxBefore) < 1e-9, `A: shortDelta continuous across x wrap (before=${dxBefore}, after=${dxAfter})`);
}
{
  // approaching from the high side
  const partner = { x: WORLD_W - 100, y: 700 };
  const entity = { x: WORLD_W + 61, y: 700 };
  const [dxBefore] = shortDelta(entity.x, entity.y, partner.x, partner.y);
  wrap(entity);
  const [dxAfter] = shortDelta(entity.x, entity.y, partner.x, partner.y);
  assert(entity.x >= 0 && entity.x < WORLD_W, `A: wrapped x (${entity.x}) lands in [0, WORLD_W) (high side)`);
  assert(Math.abs(dxAfter - dxBefore) < 1e-9, `A: shortDelta continuous across x wrap, high side (before=${dxBefore}, after=${dxAfter})`);
}

// =====================================================================
console.log("(B) wrap(): y-seam crossing keeps shortDelta continuous, no ~120px jump");
{
  const partner = { x: 700, y: 100 };
  const entity = { x: 700, y: -61 };
  const [, dyBefore] = shortDelta(entity.x, entity.y, partner.x, partner.y);
  wrap(entity);
  const [, dyAfter] = shortDelta(entity.x, entity.y, partner.x, partner.y);
  assert(entity.y >= 0 && entity.y < WORLD_H, `B: wrapped y (${entity.y}) lands in [0, WORLD_H)`);
  assert(Math.abs(dyAfter - dyBefore) < 1e-9, `B: shortDelta continuous across y wrap (before=${dyBefore}, after=${dyAfter})`);
}
{
  const partner = { x: 700, y: WORLD_H - 100 };
  const entity = { x: 700, y: WORLD_H + 61 };
  const [, dyBefore] = shortDelta(entity.x, entity.y, partner.x, partner.y);
  wrap(entity);
  const [, dyAfter] = shortDelta(entity.x, entity.y, partner.x, partner.y);
  assert(entity.y >= 0 && entity.y < WORLD_H, `B: wrapped y (${entity.y}) lands in [0, WORLD_H) (high side)`);
  assert(Math.abs(dyAfter - dyBefore) < 1e-9, `B: shortDelta continuous across y wrap, high side (before=${dyBefore}, after=${dyAfter})`);
}

// =====================================================================
console.log("(C) wrapNode(): x-seam wrap shifts px by the same delta as x (velocity survives)");
{
  const n = { x: -61, y: 700, px: -63, py: 698 }; // implied velocity (x-px, y-py) = (2, 2)
  const xBefore = n.x, pxBefore = n.px;
  wrapNode(n);
  const xDelta = n.x - xBefore;
  const pxDelta = n.px - pxBefore;
  assert(n.x >= 0 && n.x < WORLD_W, `C: wrapped node x (${n.x}) lands in [0, WORLD_W)`);
  assert(Math.abs(xDelta - pxDelta) < 1e-9, `C: px shifted by same delta as x (xDelta=${xDelta}, pxDelta=${pxDelta})`);
  assert(Math.abs((n.x - n.px) - (xBefore - pxBefore)) < 1e-9, `C: implied velocity (x-px) unchanged by wrap`);
}

// =====================================================================
console.log("(D) wrapNode(): y-seam wrap shifts py by the same delta as y (velocity survives)");
{
  const n = { x: 700, y: WORLD_H + 61, px: 698, py: WORLD_H + 63 };
  const yBefore = n.y, pyBefore = n.py;
  wrapNode(n);
  const yDelta = n.y - yBefore;
  const pyDelta = n.py - pyBefore;
  assert(n.y >= 0 && n.y < WORLD_H, `D: wrapped node y (${n.y}) lands in [0, WORLD_H)`);
  assert(Math.abs(yDelta - pyDelta) < 1e-9, `D: py shifted by same delta as y (yDelta=${yDelta}, pyDelta=${pyDelta})`);
  assert(Math.abs((n.y - n.py) - (yBefore - pyBefore)) < 1e-9, `D: implied velocity (y-py) unchanged by wrap`);
}

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
