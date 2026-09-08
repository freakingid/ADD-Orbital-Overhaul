// Headless test for CS040 P2 — pity-driven ambient Health cadence. POWERUP_HEALTH_GAP is retired;
// healthGapRoll() interpolates [DEBUG.healthGapLow/HighHurt .. DEBUG.healthGapLow/HighOk] on
// game.ship.hp / SHIP_MAX_HP, same shape as guardDropWeight(). Four new registry knobs, no LEVERS
// entry (a pacing pity mechanism, not a difficulty ramp — same reasoning as engineBurnSeconds).
//
//   node scratchpad/test-cs040-p2.js
//
// ⛔ WIDENED BY CS042 P6 (spec §2.3 e), which moved all four defaults — [6, 10] -> [10, 16] at zero
// hull and [22, 30] -> [30, 45] at full hull, a `def` change with no mechanism behind it. Every bound
// below is now READ OFF THE BUILD's own constants instead of retyped as a literal, so this file pins
// the SHAPE (lerp on hull fraction, clamped at both ends, monotone) rather than one changeset's
// numbers. §D's "strictly between the two ranges" needed real widening: at the new defaults the
// half-hull interval is [20, 30.5] and overlaps the full-hull range's floor, so it is stated as the
// interpolation it actually is, plus the half that still carries the meaning — a half-hull player
// always waits longer than a zero-hull one.

"use strict";
const { mkAssert, buildGame } = require("./_harness.js");
const { hasKnob } = require("./test-registry.js");
const { installSeed } = require("./_seeded-random.js");
const A = mkAssert();
const { assert, eq } = A;

installSeed(20260826);

// ================= (A) POWERUP_HEALTH_GAP has zero consumers =================
(function sectionA() {
  console.log("(A) POWERUP_HEALTH_GAP is retired outright");
  const X = buildGame();
  assert(typeof X.POWERUP_HEALTH_GAP === "undefined", "A: POWERUP_HEALTH_GAP no longer exists");
  assert(typeof X.healthGapRoll === "function", "A: healthGapRoll exists");
})();

// ================= (B) roll at full hull falls in the OK pair =================
(function sectionB() {
  console.log("(B) full-hull roll falls in [HEALTH_GAP_LOW_OK, HEALTH_GAP_HIGH_OK]");
  const X = buildGame();
  X.game.ship.hp = X.SHIP_MAX_HP;
  for (let i = 0; i < 50; i++) {
    const v = X.healthGapRoll();
    assert(v >= X.HEALTH_GAP_LOW_OK && v <= X.HEALTH_GAP_HIGH_OK,
      `B: roll ${v} in [${X.HEALTH_GAP_LOW_OK}, ${X.HEALTH_GAP_HIGH_OK}]`);
  }
})();

// ================= (C) roll at zero hull falls in the HURT pair =================
(function sectionC() {
  console.log("(C) zero-hull roll falls in [HEALTH_GAP_LOW_HURT, HEALTH_GAP_HIGH_HURT]");
  const X = buildGame();
  X.game.ship.hp = 0;
  for (let i = 0; i < 50; i++) {
    const v = X.healthGapRoll();
    assert(v >= X.HEALTH_GAP_LOW_HURT && v <= X.HEALTH_GAP_HIGH_HURT,
      `C: roll ${v} in [${X.HEALTH_GAP_LOW_HURT}, ${X.HEALTH_GAP_HIGH_HURT}]`);
  }
})();

// ================= (D) half hull rolls the half-way interpolation of the two pairs =================
(function sectionD() {
  console.log("(D) half-hull roll sits on the interpolation, and always above the hurt range");
  const X = buildGame();
  X.game.ship.hp = X.SHIP_MAX_HP / 2;
  const lo = (X.HEALTH_GAP_LOW_HURT + X.HEALTH_GAP_LOW_OK) / 2;
  const hi = (X.HEALTH_GAP_HIGH_HURT + X.HEALTH_GAP_HIGH_OK) / 2;
  for (let i = 0; i < 50; i++) {
    const v = X.healthGapRoll();
    assert(v >= lo && v <= hi, `D: roll ${v} inside the half-way interval [${lo}, ${hi}]`);
    assert(v > X.HEALTH_GAP_HIGH_HURT,
      `D: ...and above every zero-hull roll (${v} > ${X.HEALTH_GAP_HIGH_HURT}) — a hurt ship still waits least`);
  }
})();

// ================= (E) monotone non-increasing as hp falls =================
(function sectionE() {
  console.log("(E) the roll's range is monotone non-increasing as hp falls");
  const X = buildGame();
  const sampleMax = hp => {
    X.game.ship.hp = hp;
    let m = -Infinity;
    for (let i = 0; i < 30; i++) m = Math.max(m, X.healthGapRoll());
    return m;
  };
  const points = [X.SHIP_MAX_HP, X.SHIP_MAX_HP * 0.75, X.SHIP_MAX_HP * 0.5, X.SHIP_MAX_HP * 0.25, 0];
  let prev = Infinity;
  for (const hp of points) {
    const m = sampleMax(hp);
    assert(m <= prev + 1e-9, `E: sampled max at hp=${hp} (${m}) <= previous (${prev})`);
    prev = m;
  }
})();

// ================= (F) the four registry knobs exist, LEVERS untouched =================
(function sectionF() {
  console.log("(F) four POWERUPS registry knobs, each def-derived from its const; no LEVERS entry");
  const X = buildGame();
  // CS042 P6 repoint: the four defs moved with spec §2.3 e. They are still asserted as exact numbers
  // — a knob's def IS a shipped value — and still cross-checked against the consts they derive from.
  hasKnob(X, "healthGapLowOk", { def: 30, min: 1, max: 60, step: 1 }, A);
  hasKnob(X, "healthGapHighOk", { def: 45, min: 1, max: 60, step: 1 }, A);
  hasKnob(X, "healthGapLowHurt", { def: 10, min: 1, max: 60, step: 1 }, A);
  hasKnob(X, "healthGapHighHurt", { def: 16, min: 1, max: 60, step: 1 }, A);
  eq(X.DEBUG_ENTRIES.find(v => v.id === "healthGapLowOk").def, X.HEALTH_GAP_LOW_OK, "F: healthGapLowOk's def IS the const");
  eq(X.DEBUG_ENTRIES.find(v => v.id === "healthGapHighOk").def, X.HEALTH_GAP_HIGH_OK, "F: healthGapHighOk's def IS the const");
  eq(X.DEBUG_ENTRIES.find(v => v.id === "healthGapLowHurt").def, X.HEALTH_GAP_LOW_HURT, "F: healthGapLowHurt's def IS the const");
  eq(X.DEBUG_ENTRIES.find(v => v.id === "healthGapHighHurt").def, X.HEALTH_GAP_HIGH_HURT, "F: healthGapHighHurt's def IS the const");
  assert(!X.LEVERS.some(l => l.id.startsWith("healthGap")), "F: no healthGap* lever added");
})();

A.report();
