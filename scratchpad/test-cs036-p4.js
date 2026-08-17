// Headless test for CS036 P4 — the Hunter heartbeat punch (PLANNED-FEATURES-CS036.md §2).
//
//   node scratchpad/test-cs036-p4.js
//
// This phase owns: the raised hunterPulseGrow bound (300 -> 5000 %/s) and the four retuned defs
// (80/150/900/20). No new mechanism — CS035 P4's asymmetric grow/shrink/clamp/flip is unchanged, so
// this file re-runs its don't-mutate and radius-unmoved invariants against the new numbers (a much
// faster grow rate is exactly the kind of change that would expose an in-place mutation) plus new
// cycle-timing pins: the steady-state grow leg completes in a handful of frames, the shrink leg takes
// tens of times longer, and cranking hunterPulseGrow to its raised bound clears the whole envelope in
// a single 60 fps frame — the "effectively instantaneous" claim in spec §2 and the registry comment.

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

// ================= (A) the raised bound and the four retuned defs =================
(function sectionA() {
  console.log("(A) hunterPulseGrow's raised bound, and the four CS036 P4 defs");
  const X = buildGame();
  hasKnob(X, "hunterVolatileAge", { def: 60, min: 0, max: 120, step: 1, unit: "s" }, A);
  hasKnob(X, "hunterPulseMin", { def: 80, min: 50, max: 100, step: 1, unit: "%" }, A);
  hasKnob(X, "hunterPulseMax", { def: 150, min: 100, max: 200, step: 1, unit: "%" }, A);
  hasKnob(X, "hunterPulseGrow", { def: 900, min: 5, max: 5000, step: 5, unit: "%/s" }, A);
  hasKnob(X, "hunterPulseShrink", { def: 20, min: 5, max: 300, step: 1, unit: "%/s" }, A);
})();

// ================= (B) a fresh large: age 0, pulseScale 100 =================
(function sectionB() {
  console.log("(B) a fresh large Hunter starts at age 0, pulseScale 100, pulseUp true");
  const X = buildGame(); X.startGame(); quiet(X);
  const h = new X.HunterSatellite(500, 500, 3);
  eq(h.age, 0, "B: age starts at 0");
  eq(h.pulseScale, 100, "B: pulseScale starts at 100");
  eq(h.pulseUp, true, "B: pulseUp starts true");
  assert(!h.volatile(), "B: not yet volatile at age 0 with the default threshold");
})();

// ================= (C) after hunterVolatileAge seconds, pulseScale moves off 100, fast =================
(function sectionC() {
  console.log("(C) once age crosses DEBUG.hunterVolatileAge the pulse starts moving, and moves hard");
  const X = buildGame(); X.startGame(); quiet(X);
  const h = new X.HunterSatellite(500, 500, 3);
  const frames = Math.round(X.DEBUG.hunterVolatileAge / DT);
  for (let i = 0; i < frames; i++) h.update(DT);
  assert(!h.volatile(), "C: (boundary) one frame short of the threshold, still not volatile");
  eq(h.pulseScale, 100, "C: ...and pulseScale has not moved yet");
  h.update(DT);
  assert(h.volatile(), "C: the very next frame crosses the threshold");
  h.update(DT);
  assert(h.pulseScale !== 100, "C: pulseScale has moved off 100 once volatile");
  assert(h.pulseScale > 100, "C: ...and it grows first (pulseUp starts true)");
  // Two dt's of growth have landed by this point (the crossing frame's own update applies the first
  // one) — at the 900 %/s def that's 2 * 900/60 = 30 points, a visible jump after a single frame of play.
  close(h.pulseScale, 130, "C: ⛔ two frames in, pulseScale has already jumped 30 points", 1e-6);
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
  assert(!med.volatile(), "D: a medium is never volatile, no matter its age");
  assert(!small.volatile(), "D: ...neither is a small");
  eq(med.pulseScale, 100, "D: ...so the medium's pulseScale never left 100");
  eq(small.pulseScale, 100, "D: ...nor the small's");
})();

// ================= (E) pulseScale never escapes [hunterPulseMin, hunterPulseMax] =================
(function sectionE() {
  console.log("(E) across a long run, pulseScale never exceeds the new max or falls below the new min");
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
  console.log("(F) this.radius is unchanged before and after volatility begins, at the new rates");
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
  // Drive real frames AND real draw() calls, at the much faster grow rate — the mutation bug this
  // guards against happens at draw time and a faster rate is exactly what would expose it in place.
  const frames = Math.round((X.DEBUG.hunterVolatileAge + 10) / DT);
  for (let i = 0; i < frames; i++) { h.update(DT); h.draw(); }
  assert(h.volatile(), "G: (setup) volatile, pulsing, and drawn many times");
  eq(JSON.stringify(h.shape), JSON.stringify(shapeBefore), "G: ⛔ this.shape is byte-identical to its baked-at-construction value");
  if (innerBefore) eq(JSON.stringify(h.inner), JSON.stringify(innerBefore), "G: ⛔ ...and so is this.inner");
})();

// ================= (H) steady-state cycle timing: a hard punch out, a slow settle back =================
(function sectionH() {
  console.log("(H) steady-state grow leg is a handful of frames; the shrink leg is tens of times longer");
  const X = buildGame(); X.startGame(); quiet(X);
  const h = new X.HunterSatellite(500, 500, 3);
  const preFrames = Math.round(X.DEBUG.hunterVolatileAge / DT) + 1;
  for (let i = 0; i < preFrames; i++) h.update(DT);
  assert(h.volatile(), "H: (setup) volatile");
  // pulseUp flips exactly on the frame the clamp lands (pulseScale is set to the exact min/max
  // literal that same call) — detect the FLIP rather than comparing pulseScale to a target with an
  // epsilon, which drifts out of sync with the clamp's own float arithmetic over hundreds of frames.
  function runToFlip(maxGuard) {
    let frames = 0;
    const wantUp = !h.pulseUp;
    while (h.pulseUp !== wantUp) {
      h.update(DT);
      if (++frames > maxGuard) throw new Error("H: never flipped — runaway guard tripped");
    }
    return frames;
  }
  // pulseUp is still true here (the partial first grow leg from the 100 starting value hasn't
  // finished) — run two flips (ceiling, then floor) to reach the steady-state min<->max envelope
  // before measuring anything.
  assert(h.pulseUp, "H: (setup) still on the partial first grow leg");
  runToFlip(100000); // -> ceiling
  runToFlip(100000); // -> floor
  eq(h.pulseScale, X.DEBUG.hunterPulseMin, "H: (setup) steady state established exactly at the floor");
  // Measure the next grow leg, floor -> ceiling.
  const growFrames = runToFlip(100000);
  eq(h.pulseScale, X.DEBUG.hunterPulseMax, "H: the grow leg reaches the ceiling exactly");
  const envelope = X.DEBUG.hunterPulseMax - X.DEBUG.hunterPulseMin;
  const expectGrow = envelope / X.DEBUG.hunterPulseGrow / DT;
  assert(Math.abs(growFrames - expectGrow) <= 2, `H: ⛔ grow leg took ${growFrames} frames, expected ~${expectGrow.toFixed(1)} (a punch, not a ramp)`);
  assert(growFrames <= 6, `H: ⛔ grow leg (${growFrames} frames) reads as a punch at 60 fps`);
  // Measure the next shrink leg, ceiling -> floor.
  const shrinkFrames = runToFlip(100000);
  eq(h.pulseScale, X.DEBUG.hunterPulseMin, "H: the shrink leg reaches the floor exactly");
  const expectShrink = envelope / X.DEBUG.hunterPulseShrink / DT;
  assert(Math.abs(shrinkFrames - expectShrink) <= 2, `H: ⛔ shrink leg took ${shrinkFrames} frames, expected ~${expectShrink.toFixed(1)} (a slow settle)`);
  assert(shrinkFrames >= growFrames * 30, `H: ⛔ the settle (${shrinkFrames} frames) is tens of times slower than the punch (${growFrames} frames)`);
})();

// ================= (I) at the raised bound, the sweep is a single 60 fps frame =================
(function sectionI() {
  console.log("(I) cranking hunterPulseGrow to its raised bound clears the envelope in one frame");
  const X = buildGame(); X.startGame(); quiet(X);
  const entry = X.DEBUG_ENTRIES.find(v => v.id === "hunterPulseGrow");
  assert(entry && entry.max === 5000, "I: (setup) the raised bound reads 5000 from the registry row itself");
  X.DEBUG.hunterPulseGrow = entry.max;
  const h = new X.HunterSatellite(500, 500, 3);
  const frames = Math.round(X.DEBUG.hunterVolatileAge / DT);
  for (let i = 0; i < frames; i++) h.update(DT);
  assert(!h.volatile(), "I: (setup, boundary) one frame short of the threshold, still not volatile");
  eq(h.pulseScale, 100, "I: (setup) pulseScale has not moved yet");
  h.update(DT);
  assert(h.volatile(), "I: this frame crosses the threshold");
  eq(h.pulseScale, X.DEBUG.hunterPulseMax, "I: ⛔ the SAME frame that crosses into volatility clamps straight to the ceiling at the raised bound — effectively instantaneous");
})();

A.report();
