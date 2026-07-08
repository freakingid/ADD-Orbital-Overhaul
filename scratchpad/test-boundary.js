// Headless test for the dotted world-boundary line (v2.1).
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator, eval the REAL <script> block, then
// drive the actual code — no reimplementation under test.
//
//   node scratchpad/test-boundary.js
//
// The boundary is purely COSMETIC, so what can only be judged in a real browser is whether the line
// reads clearly at the seam and isn't too bright/distracting (see STATUS.md playtest asks). What IS
// checkable headlessly, and what this verifies:
//  (A) draw() runs crash-free with the boundary wired in (title + playing states);
//  (B) drawWorldBoundary sets a line dash, strokes a WORLD_W x WORLD_H rect, and restores the dash;
//  (C) the rect's nearest-image corner (ox/oy) puts the seam on-screen from EITHER side of it, and
//      the seam stays continuous as the camera crosses the wrap (no jump, no disappearance);
//  (D) it is drawn INSIDE the camera transform, beneath entities (a save/translate precedes it);
//  (E) the boundary has no gameplay effect — update() over the seam changes no score/hp/entities.

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ---- Recording canvas context: no-ops every 2D call but logs the ones we assert on ----
let calls = [];        // { fn, args } in draw order
let dashStack = [];     // current setLineDash value (last set)
const recordCtx = new Proxy({}, {
  get(_t, prop) {
    if (prop === "setLineDash") return (arr) => { calls.push({ fn: "setLineDash", args: [arr.slice()] }); };
    if (prop === "rect")        return (...a) => { calls.push({ fn: "rect", args: a }); };
    if (prop === "translate")   return (...a) => { calls.push({ fn: "translate", args: a }); };
    if (prop === "save")        return () => { calls.push({ fn: "save", args: [] }); };
    if (prop === "restore")     return () => { calls.push({ fn: "restore", args: [] }); };
    if (prop === "stroke")      return () => { calls.push({ fn: "stroke", args: [] }); };
    // any other property: writable field OR a no-op method
    return () => {};
  },
  set() { return true; }
});
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => recordCtx };
const documentStub = { getElementById: () => canvasStub };

const noAudio = new Proxy({ state: "running", currentTime: 0, sampleRate: 44100,
  destination: {}, createGain: () => noAudio, createBuffer: () => ({ getChannelData: () => new Float32Array(1) }) },
  { get(t, p) { return p in t ? t[p] : () => noAudio; } });
function FakeAudioContext() { return noAudio; }
const windowStub = { addEventListener() {}, innerWidth: 1280, innerHeight: 720,
  AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext };
const performanceStub = { now: () => 0 };   // fixed so title blink is deterministic
const rafStub = () => 0;
const navigatorStub = { getGamepads: () => [] };
const lsStore = {};
global.localStorage = { getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); }, removeItem: k => { delete lsStore[k]; } };

const returnList = ["startGame", "update", "draw", "game", "drawWorldBoundary", "wrapOffset",
  "WORLD_W", "WORLD_H", "VIEW_W", "VIEW_H", "BOUNDARY_DASH", "BOUNDARY_GAP", "BOUNDARY_WIDTH"];
const factory = new Function("window", "document", "performance", "requestAnimationFrame", "navigator",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };");
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub);
const { startGame, update, draw, game, drawWorldBoundary, wrapOffset,
  WORLD_W, WORLD_H, VIEW_W, VIEW_H, BOUNDARY_DASH, BOUNDARY_GAP, BOUNDARY_WIDTH } = A;

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function reset() { calls = []; }
function lastRect() { return calls.filter(c => c.fn === "rect").pop(); }

// =====================================================================
// (A) draw() is crash-free with the boundary wired in
// =====================================================================
console.log("(A) draw() crash-free in title + playing");
startGame();
game.state = "title";
try { draw(); assert(true, "A: title draw ok"); } catch (e) { assert(false, "A: title draw threw: " + e); }
game.state = "playing"; game.paused = false;
reset();
try { draw(); assert(true, "A: playing draw ok"); } catch (e) { assert(false, "A: playing draw threw: " + e); }

// =====================================================================
// (B) drawWorldBoundary sets a dash, strokes a WORLD-sized rect, resets the dash
// =====================================================================
console.log("(B) dash + rect + dash-reset");
const setDashes = calls.filter(c => c.fn === "setLineDash");
assert(setDashes.length >= 2, "B: at least one set + one reset of the line dash");
const on = setDashes.find(c => c.args[0].length === 2 && c.args[0][0] === BOUNDARY_DASH);
assert(on && on.args[0][1] === BOUNDARY_GAP, "B: dash pattern is [BOUNDARY_DASH, BOUNDARY_GAP]");
assert(setDashes.some(c => c.args[0].length === 0), "B: dash reset to [] afterward");
const r = lastRect();
assert(r && Math.abs(r.args[2] - WORLD_W) < 1e-9 && Math.abs(r.args[3] - WORLD_H) < 1e-9,
  "B: rect is WORLD_W x WORLD_H");

// =====================================================================
// (C) nearest-image corner: seam on-screen from either side, continuous across the wrap
// =====================================================================
console.log("(C) seam visibility + continuity across the wrap");
// Screen-x of the left/right vertical seam given a camera x. The rect corner is at world ox, so
// inside the camera transform screen-x = (VIEW_W/2 - cam.x) + edge. Left edge = ox, right = ox+WORLD_W.
function seamScreenXs(camx) {
  game.camera.x = camx; game.camera.y = WORLD_H / 2; // y centered => no horizontal seam nearby
  reset(); drawWorldBoundary();
  const rr = lastRect();
  const ox = rr.args[0];
  const base = VIEW_W / 2 - camx;
  return [base + ox, base + ox + WORLD_W];
}
// A seam is "visible" if one of its two edges falls within [0, VIEW_W].
function visibleSeamX(camx) {
  return seamScreenXs(camx).filter(x => x >= 0 && x <= VIEW_W);
}
// Near x=0 (from inside): left edge visible.
assert(visibleSeamX(120).length === 1, "C: near x=0 shows exactly one vertical seam");
// Near x=WORLD_W (the same seam, approached from the other side): still visible.
assert(visibleSeamX(WORLD_W - 120).length === 1, "C: near x=WORLD_W shows exactly one vertical seam");
// Deep interior (x=WORLD_W/2): no vertical seam on-screen.
assert(visibleSeamX(WORLD_W / 2).length === 0, "C: interior shows no vertical seam");
// Continuity: crossing the wrap at x=0, the on-screen seam position must not jump.
const justInside = visibleSeamX(4)[0];              // cam.x = 4  (just right of the seam)
const justWrapped = visibleSeamX(WORLD_W - 4)[0];    // cam.x ~ 0- wrapped to WORLD_W-4
assert(Math.abs(justInside - VIEW_W / 2) < 12, "C: seam sits ~screen-center at cam.x≈0+");
assert(Math.abs(justWrapped - VIEW_W / 2) < 12, "C: seam sits ~screen-center at cam.x≈WORLD_W-");
assert(Math.abs(justInside - justWrapped) < 20, "C: seam position continuous across the wrap");
// Same logic holds for the horizontal (y) seam.
function seamScreenYs(camy) {
  game.camera.x = WORLD_W / 2; game.camera.y = camy;
  reset(); drawWorldBoundary();
  const rr = lastRect(); const oy = rr.args[1]; const base = VIEW_H / 2 - camy;
  return [base + oy, base + oy + WORLD_H].filter(y => y >= 0 && y <= VIEW_H);
}
assert(seamScreenYs(100).length === 1, "C: near y=0 shows one horizontal seam");
assert(seamScreenYs(WORLD_H - 100).length === 1, "C: near y=WORLD_H shows one horizontal seam");
assert(seamScreenYs(WORLD_H / 2).length === 0, "C: interior shows no horizontal seam");

// =====================================================================
// (D) boundary is drawn inside the camera transform, before any entity
// =====================================================================
console.log("(D) drawn inside the camera transform, beneath entities");
game.state = "playing"; game.paused = false;
game.camera.x = 100; game.camera.y = 100;
reset(); draw();
const translateIdx = calls.findIndex(c => c.fn === "translate");
const dashIdx = calls.findIndex(c => c.fn === "setLineDash" && c.args[0].length === 2);
assert(translateIdx >= 0 && dashIdx > translateIdx, "D: line dash set AFTER the camera translate");

// =====================================================================
// (E) purely cosmetic — no gameplay effect
// =====================================================================
console.log("(E) no gameplay effect");
startGame();
game.state = "playing"; game.paused = false;
// Park the ship right on the x=0 seam, drifting across it, and step the sim.
game.ship.x = 2; game.ship.y = WORLD_H / 2;
const score0 = game.score, hp0 = game.ship.hp;
const nEnt0 = game.debris.length + game.hunters.length + game.saucers.length + game.garbage.length;
let wrapped = false;
for (let i = 0; i < 120; i++) {          // hold velocity each frame (ship applies drag) to cross the seam
  game.ship.vx = -300; game.ship.vy = 0;
  const before = game.ship.x;
  update(1 / 60);
  if (game.ship.x > before + 100) wrapped = true; // a big positive jump == a wrap add
}
const nEnt1 = game.debris.length + game.hunters.length + game.saucers.length + game.garbage.length;
assert(game.score === score0, "E: crossing the seam did not change score");
assert(game.ship.hp === hp0, "E: crossing the seam did not change hull hp");
assert(nEnt1 === nEnt0, "E: crossing the seam spawned/destroyed nothing");
assert(wrapped && game.ship.x > 0 && game.ship.x < WORLD_W, "E: ship wrapped across the seam into world bounds normally");

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
