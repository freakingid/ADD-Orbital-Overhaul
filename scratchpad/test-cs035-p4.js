// Headless test for CS035 P4 — Hunter volatility, the age clock and the draw-only heartbeat
// (PLANNED-FEATURES-CS035.md §4.1-§4.3). Damage sources are P5's — not tested here.
//
//   node scratchpad/test-cs035-p4.js
//
// This phase owns: this.age (all tiers, from construction, unconditional every update()); volatile()
// (size 3 && age >= DEBUG.hunterVolatileAge); this.pulseScale/pulseUp, advanced ONLY while volatile,
// asymmetric grow/shrink, clamped at hunterPulseMin/Max; and draw() scaling a FRESH vertex array by
// pulseScale/100, never mutating this.shape/this.inner (the collision radius stays honest).
//
// Traps worth knowing: medium/small tiers accrue age too but never read it, so an aged medium/small
// must show pulseScale STILL 100; the clamp-and-flip must never let pulseScale escape [min, max] across
// a long run; and the don't-mutate invariant is checked on this.shape's own array contents; identity
// alone would pass a bug where scaling happens in place. The registry COUNT is test-registry.js's job.

"use strict";
const { mkAssert, buildGame } = require("./_harness.js");
const { hasKnob } = require("./test-registry.js");
const A = mkAssert();
const { assert, eq, close } = A;

const DT = 1 / 60;

function quiet(X) {
  const g = X.game;
  g.state = "playing"; g.paused = false;
  g.debris.length = 1;
  g.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  g.hunters.length = 0; g.saucers.length = 0; g.bullets.length = 0; g.garbage.length = 0;
  g.ship.dead = false; g.ship.vx = 0; g.ship.vy = 0;
  return g;
}

// ================= (A) the five knobs =================
(function sectionA() {
  console.log("(A) the five HUNTER-section registry rows exist with their spec'd bounds");
  const X = buildGame();
  hasKnob(X, "hunterVolatileAge", { def: 30, min: 0, max: 120, step: 1, unit: "s" }, A);
  hasKnob(X, "hunterPulseMin", { def: 92, min: 50, max: 100, step: 1, unit: "%" }, A);
  hasKnob(X, "hunterPulseMax", { def: 115, min: 100, max: 200, step: 1, unit: "%" }, A);
  hasKnob(X, "hunterPulseGrow", { def: 55, min: 5, max: 300, step: 5, unit: "%/s" }, A);
  hasKnob(X, "hunterPulseShrink", { def: 28, min: 5, max: 300, step: 1, unit: "%/s" }, A);
  const ids = X.DEBUG_VARS.map(v => v.header ? `#${v.header}` : v.id);
  const iHunter = ids.indexOf("#HUNTER"), iUfo = ids.indexOf("#UFO");
  for (const id of ["hunterVolatileAge", "hunterPulseMin", "hunterPulseMax", "hunterPulseGrow", "hunterPulseShrink"]) {
    const at = ids.indexOf(id);
    assert(at > iHunter && at < iUfo, `A: ${id} lives inside the HUNTER section`);
  }
})();

// ================= (B) a fresh large: age 0, pulseScale 100 =================
(function sectionB() {
  console.log("(B) a fresh large Hunter starts at age 0, pulseScale 100, pulseUp true");
  const X = buildGame(); X.startGame(); quiet(X);
  const h = new X.HunterSatellite(500, 500, 3);
  eq(h.age, 0, "B: age starts at 0");
  eq(h.pulseScale, 100, "B: pulseScale starts at 100");
  eq(h.pulseUp, true, "B: pulseUp starts true");
  assert(!h.volatile(), "B: not yet volatile at age 0 with the default 30s threshold");
})();

// ================= (C) after hunterVolatileAge seconds, pulseScale moves off 100 =================
(function sectionC() {
  console.log("(C) once age crosses DEBUG.hunterVolatileAge the pulse starts moving");
  const X = buildGame(); X.startGame(); quiet(X);
  const h = new X.HunterSatellite(500, 500, 3);
  const frames = Math.round(X.DEBUG.hunterVolatileAge / DT);
  for (let i = 0; i < frames; i++) h.update(DT);
  assert(!h.volatile(), "C: (boundary) one frame short of the threshold, still not volatile");
  eq(h.pulseScale, 100, "C: ...and pulseScale has not moved yet");
  h.update(DT);
  assert(h.volatile(), "C: the very next frame crosses the threshold");
  h.update(DT);
  assert(h.pulseScale !== 100, "C: ⛔ pulseScale has moved off 100 once volatile");
  assert(h.pulseScale > 100, "C: ...and it grows first (pulseUp starts true)");
})();

// ================= (D) mediums and smalls age but never pulse =================
(function sectionD() {
  console.log("(D) a medium and a small, aged well past the threshold, have pulseScale STILL 100");
  const X = buildGame(); X.startGame(); quiet(X);
  const med = new X.HunterSatellite(500, 500, 2);
  const small = new X.HunterSatellite(700, 500, 1);
  const frames = Math.round((X.DEBUG.hunterVolatileAge + 20) / DT);
  for (let i = 0; i < frames; i++) { med.update(DT); small.update(DT); }
  assert(med.age >= X.DEBUG.hunterVolatileAge + 19, "D: (setup) the medium really did age past the threshold");
  assert(small.age >= X.DEBUG.hunterVolatileAge + 19, "D: (setup) ...so did the small");
  assert(!med.volatile(), "D: ⛔ a medium is never volatile, no matter its age");
  assert(!small.volatile(), "D: ⛔ neither is a small");
  eq(med.pulseScale, 100, "D: ...so the medium's pulseScale never left 100");
  eq(small.pulseScale, 100, "D: ...nor the small's");
})();

// ================= (E) pulseScale never escapes [hunterPulseMin, hunterPulseMax] =================
(function sectionE() {
  console.log("(E) across a long run, pulseScale never exceeds the max or falls below the min");
  const X = buildGame(); X.startGame(); quiet(X);
  const h = new X.HunterSatellite(500, 500, 3);
  let worstHigh = -Infinity, worstLow = Infinity;
  let sawUp = false, sawDown = false;
  const frames = Math.round((X.DEBUG.hunterVolatileAge + 30) / DT);
  for (let i = 0; i < frames; i++) {
    h.update(DT);
    if (h.pulseScale > worstHigh) worstHigh = h.pulseScale;
    if (h.pulseScale < worstLow) worstLow = h.pulseScale;
    assert(h.pulseScale <= X.DEBUG.hunterPulseMax + 1e-9, `E: pulseScale ${h.pulseScale} never exceeds hunterPulseMax`);
    assert(h.pulseScale >= X.DEBUG.hunterPulseMin - 1e-9, `E: pulseScale ${h.pulseScale} never falls below hunterPulseMin`);
    if (!h.pulseUp) sawDown = true;
    if (h.pulseUp && sawDown) sawUp = true;
  }
  close(worstHigh, X.DEBUG.hunterPulseMax, "E: the run genuinely reached the ceiling (non-vacuity)", 1e-6);
  close(worstLow, X.DEBUG.hunterPulseMin, "E: ...and genuinely reached the floor", 1e-6);
  assert(sawDown, "E: (non-vacuity) the pulse actually flipped to shrinking at least once");
  assert(sawUp, "E: (non-vacuity) ...and flipped back to growing at least once — a real oscillation");
})();

// ================= (F) draw-only: radius is unchanged before/after the pulse starts =================
(function sectionF() {
  console.log("(F) this.radius is unchanged before and after volatility begins");
  const X = buildGame(); X.startGame(); quiet(X);
  const h = new X.HunterSatellite(500, 500, 3);
  const radiusBefore = h.radius;
  const frames = Math.round((X.DEBUG.hunterVolatileAge + 5) / DT);
  for (let i = 0; i < frames; i++) h.update(DT);
  assert(h.volatile(), "F: (setup) the Hunter is volatile and pulsing");
  assert(h.pulseScale !== 100, "F: (setup) ...pulseScale has genuinely moved");
  eq(h.radius, radiusBefore, "F: ⛔ this.radius never moved — the collision radius stays honest");
})();

// ================= (G) don't-mutate: this.shape's own contents are identical, many frames in =================
(function sectionG() {
  console.log("(G) this.shape array contents are IDENTICAL before and after many frames of pulsing");
  const X = buildGame(); X.startGame(); quiet(X);
  const h = new X.HunterSatellite(500, 500, 3);
  const shapeBefore = h.shape.map(p => [p[0], p[1]]);
  const innerBefore = h.inner ? h.inner.map(p => [p[0], p[1]]) : null;
  // Drive real frames AND real draw() calls — the mutation bug this guards against happens at draw time.
  const frames = Math.round((X.DEBUG.hunterVolatileAge + 10) / DT);
  for (let i = 0; i < frames; i++) { h.update(DT); h.draw(); }
  assert(h.volatile(), "G: (setup) volatile, pulsing, and drawn many times");
  eq(JSON.stringify(h.shape), JSON.stringify(shapeBefore), "G: ⛔ this.shape is byte-identical to its baked-at-construction value");
  if (innerBefore) eq(JSON.stringify(h.inner), JSON.stringify(innerBefore), "G: ⛔ ...and so is this.inner");
})();

A.report();
