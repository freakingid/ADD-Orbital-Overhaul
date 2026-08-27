// Headless test for CS040 P2 — pity-driven ambient Health cadence. POWERUP_HEALTH_GAP is retired;
// healthGapRoll() interpolates [DEBUG.healthGapLow/HighHurt .. DEBUG.healthGapLow/HighOk] on
// game.ship.hp / SHIP_MAX_HP, same shape as guardDropWeight(). Four new registry knobs, no LEVERS
// entry (a pacing pity mechanism, not a difficulty ramp — same reasoning as engineBurnSeconds).
//
//   node scratchpad/test-cs040-p2.js

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

// ================= (B) roll at full hull falls in [22, 30] =================
(function sectionB() {
  console.log("(B) full-hull roll falls in [HEALTH_GAP_LOW_OK, HEALTH_GAP_HIGH_OK]");
  const X = buildGame();
  X.game.ship.hp = X.SHIP_MAX_HP;
  for (let i = 0; i < 50; i++) {
    const v = X.healthGapRoll();
    assert(v >= 22 && v <= 30, `B: roll ${v} in [22, 30]`);
  }
})();

// ================= (C) roll at zero hull falls in [6, 10] =================
(function sectionC() {
  console.log("(C) zero-hull roll falls in [HEALTH_GAP_LOW_HURT, HEALTH_GAP_HIGH_HURT]");
  const X = buildGame();
  X.game.ship.hp = 0;
  for (let i = 0; i < 50; i++) {
    const v = X.healthGapRoll();
    assert(v >= 6 && v <= 10, `C: roll ${v} in [6, 10]`);
  }
})();

// ================= (D) half hull falls strictly between the two ranges =================
(function sectionD() {
  console.log("(D) half-hull roll falls between the hurt and ok ranges");
  const X = buildGame();
  X.game.ship.hp = X.SHIP_MAX_HP / 2;
  for (let i = 0; i < 50; i++) {
    const v = X.healthGapRoll();
    assert(v > 10 && v < 22, `D: roll ${v} strictly between 10 and 22`);
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
  hasKnob(X, "healthGapLowOk", { def: 22, min: 1, max: 60, step: 1 }, A);
  hasKnob(X, "healthGapHighOk", { def: 30, min: 1, max: 60, step: 1 }, A);
  hasKnob(X, "healthGapLowHurt", { def: 6, min: 1, max: 60, step: 1 }, A);
  hasKnob(X, "healthGapHighHurt", { def: 10, min: 1, max: 60, step: 1 }, A);
  assert(!X.LEVERS.some(l => l.id.startsWith("healthGap")), "F: no healthGap* lever added");
})();

A.report();
