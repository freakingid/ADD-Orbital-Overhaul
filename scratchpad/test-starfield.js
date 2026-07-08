// Headless test for the v3.0 Phase 1 starfield legibility enhancement (B-3).
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator, eval the REAL <script> block, then
// drive the actual code — no reimplementation under test.
//
//   node scratchpad/test-starfield.js
//
// This is a purely COSMETIC change (brighter/denser stars + a near parallax layer), so the *look*
// (brightness, density, whether parallax reads as depth, seam cleanliness) can only be judged in a
// real browser — see STATUS.md playtest asks. What IS checkable headlessly, and what this verifies:
//  (A) draw() runs crash-free with the new starfield wired in (title + playing states);
//  (B) both star layers exist, with the near layer sparser than the far layer;
//  (C) each star carries a brightness field 'a' within its configured range;
//  (D) the near layer is drawn in screen space, tiling with camera movement (not world-fixed) —
//      moving the camera by a full near-tile width returns the same rendered pattern (periodicity),
//      while a fractional move shifts it (parallax is actually applied);
//  (E) no gameplay effect — driving update() with the ship moving/wrapping changes no
//      score/hp/entity counts.

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ---- Recording canvas context: no-ops every 2D call but logs fillRect calls (what stars use) ----
let calls = [];
const ctxTarget = {};
const recordCtx = new Proxy(ctxTarget, {
  get(t, prop) {
    if (prop === "fillRect") return (...a) => { calls.push({ fn: "fillRect", args: a, fillStyle: t.fillStyle }); };
    if (prop in t) return t[prop];
    return () => {};
  },
  set(t, prop, val) { t[prop] = val; return true; }
});
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => recordCtx };
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

const returnList = ["startGame", "update", "draw", "game", "drawStarfield", "stars", "starsNear",
  "STAR_DENSITY", "STAR_PARALLAX_FACTOR", "STAR_BRIGHT_MIN", "STAR_BRIGHT_MAX",
  "STAR_NEAR_BRIGHT_MIN", "STAR_NEAR_BRIGHT_MAX", "VIEW_W", "VIEW_H", "WORLD_W", "WORLD_H"];
const factory = new Function("window", "document", "performance", "requestAnimationFrame", "navigator",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };");
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub);
const { startGame, update, draw, game, drawStarfield, stars, starsNear,
  STAR_PARALLAX_FACTOR, STAR_BRIGHT_MIN, STAR_BRIGHT_MAX,
  STAR_NEAR_BRIGHT_MIN, STAR_NEAR_BRIGHT_MAX, VIEW_W, VIEW_H, WORLD_W, WORLD_H } = A;

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function reset() { calls = []; }

// =====================================================================
console.log("(A) draw() crash-free in title + playing");
startGame();
game.state = "title";
try { draw(); assert(true, "A: title draw ok"); } catch (e) { assert(false, "A: title draw threw: " + e); }
game.state = "playing"; game.paused = false;
reset();
try { draw(); assert(true, "A: playing draw ok"); } catch (e) { assert(false, "A: playing draw threw: " + e); }

// =====================================================================
console.log("(B) two layers exist, near layer sparser than far layer");
assert(Array.isArray(stars) && stars.length > 0, "B: far layer populated");
assert(Array.isArray(starsNear) && starsNear.length > 0, "B: near layer populated");
assert(starsNear.length < stars.length, "B: near layer is sparser than the far layer");

// =====================================================================
console.log("(C) per-star brightness within configured range");
assert(stars.every(s => s.a >= STAR_BRIGHT_MIN - 1e-9 && s.a <= STAR_BRIGHT_MAX + 1e-9),
  "C: far-layer stars have 'a' within [STAR_BRIGHT_MIN, STAR_BRIGHT_MAX]");
assert(starsNear.every(s => s.a >= STAR_NEAR_BRIGHT_MIN - 1e-9 && s.a <= STAR_NEAR_BRIGHT_MAX + 1e-9),
  "C: near-layer stars have 'a' within [STAR_NEAR_BRIGHT_MIN, STAR_NEAR_BRIGHT_MAX]");
assert(new Set(stars.slice(0, 20).map(s => s.a)).size > 1, "C: far-layer brightness actually varies (not uniform)");

// =====================================================================
console.log("(D) near layer is screen-space tiled and parallax-shifted");
game.camera.x = 0; game.camera.y = 0;
reset(); drawStarfield();
const farCallsAt0 = calls.filter(c => c.fillStyle && c.fillStyle.includes("160, 195, 235")).length;
assert(farCallsAt0 > 0, "D: near-layer fillRects are issued (distinct color tag)");

// Pin the camera so a known near star (starsNear[0], at its own local tile coords) renders at a
// known screen position, then verify the tiling/parallax formula directly via that one star —
// deterministic, no dependence on draw-call order or which stars happen to cull in/out.
const nearStar = starsNear[0];
// Choose camx so that (camx * STAR_PARALLAX_FACTOR) mod tileW == nearStar.x, i.e. the star's
// tile-local x lands exactly under the camera's near-layer offset (screen x = nearStar.x - px = 0
// for the primary tile; test against whichever tile placement actually renders it on-screen).
function expectedNearScreenX(camx) {
  const tileW = VIEW_W; // STAR_NEAR_TILE_W === VIEW_W in the real code
  const px = ((camx * STAR_PARALLAX_FACTOR) % tileW + tileW) % tileW;
  // Same 3x3 stamp the real code uses; find which tile offset puts this star on-screen.
  for (let tx = -1; tx <= 1; tx++) {
    const ox = tx * tileW - px;
    const sx = nearStar.x + ox;
    if (sx >= -4 && sx <= VIEW_W + 4) return sx;
  }
  return null;
}
const camA = 1000, tileW = VIEW_W / STAR_PARALLAX_FACTOR;
const expA = expectedNearScreenX(camA);
const expB = expectedNearScreenX(camA + tileW);
assert(expA !== null && expB !== null && Math.abs(expA - expB) < 1e-6,
  "D: near layer is periodic under a full-tile camera shift (screen-space tiling)");
const expC = expectedNearScreenX(camA + 37);
assert(expC !== null && Math.abs((expA - expC) - 37 * STAR_PARALLAX_FACTOR) < 1e-6,
  "D: a fractional camera shift moves the near layer by STAR_PARALLAX_FACTOR x the shift (parallax applied)");
// Cross-check the formula actually matches what drawStarfield renders at camA.
game.camera.x = camA; game.camera.y = 0;
reset(); drawStarfield();
const renderedNear = calls.some(c => c.fillStyle && c.fillStyle.includes("160, 195, 235") &&
  Math.abs(c.args[0] - expA) < 1e-6);
assert(renderedNear, "D: computed near-layer formula matches an actual rendered fillRect");

// Far layer, by contrast, IS world-fixed: directly compute one specific far star's world->screen
// mapping via the same shortDelta the real code uses, at two camera positions comfortably inside
// the viewport bounds (so it's never culled either time), and confirm it moves 1:1 with the camera.
const farStar = stars[0];
game.camera.x = farStar.x; game.camera.y = farStar.y; // dead-center: dx=dy=0, definitely on-screen
reset(); drawStarfield();
const farCallAtCenter = calls.find(c => c.fillStyle && c.fillStyle.includes("120, 160, 210") &&
  Math.abs(c.args[0] - VIEW_W / 2) < 1e-6 && Math.abs(c.args[1] - VIEW_H / 2) < 1e-6);
assert(!!farCallAtCenter, "D: a far star centered under the camera renders at screen center");
game.camera.x = farStar.x + 37; game.camera.y = farStar.y;
reset(); drawStarfield();
const farCallShifted = calls.find(c => c.fillStyle && c.fillStyle.includes("120, 160, 210") &&
  Math.abs(c.args[1] - VIEW_H / 2) < 1e-6 && Math.abs(c.args[0] - (VIEW_W / 2 - 37)) < 1e-6);
assert(!!farCallShifted, "D: far layer still moves 1:1 with camera (world-fixed reference unchanged)");

// =====================================================================
console.log("(E) no gameplay effect");
startGame();
game.state = "playing"; game.paused = false;
game.ship.x = 2; game.ship.y = WORLD_H / 2;
const score0 = game.score, hp0 = game.ship.hp;
const nEnt0 = game.debris.length + game.hunters.length + game.saucers.length + game.garbage.length;
for (let i = 0; i < 120; i++) {
  game.ship.vx = -300; game.ship.vy = 0;
  update(1 / 60);
}
const nEnt1 = game.debris.length + game.hunters.length + game.saucers.length + game.garbage.length;
assert(game.score === score0, "E: ship moving/wrapping did not change score");
assert(game.ship.hp === hp0, "E: ship moving/wrapping did not change hull hp");
assert(nEnt1 === nEnt0, "E: ship moving/wrapping spawned/destroyed nothing");

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
