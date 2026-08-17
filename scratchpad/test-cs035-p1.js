// Headless test for CS035 P1 — delivery ticker re-tune (PLANNED-FEATURES-CS035.md §1).
//
//   node scratchpad/test-cs035-p1.js
//
// This phase owns exactly: DELIVERY_FLOAT_ANCHOR_FRAC's new value; the five DEBUG registry
// rows' new `def` with unchanged min/max/step; that the SALVAGE BONUS and MAX HAUL floaters
// are gone while their surviving side effects (dropPowerup, maxChainVisit, cargoFlash) stay;
// and the ticker's per-piece size growth now that sizeStep is nonzero. No registry count
// (test-registry.js's job) — this phase adds no rows.

"use strict";
const { mkAssert, buildGame } = require("./_harness.js");
const A = mkAssert();
const { assert, eq } = A;

// ================= (A) DELIVERY_FLOAT_ANCHOR_FRAC =================
(function sectionA() {
  console.log("(A) DELIVERY_FLOAT_ANCHOR_FRAC re-tuned to 0.50");
  const X = buildGame();
  eq(X.DELIVERY_FLOAT_ANCHOR_FRAC, 0.50, "A: anchor frac is 0.50");
})();

// ================= (B) the five registry rows: new def, unchanged min/max/step =================
(function sectionB() {
  console.log("(B) DELIVERY registry rows: def moved, min/max/step did not");
  const X = buildGame();
  const expected = {
    deliveryFloatRise:     { def: 150, min: 30, max: 600, step: 10 },
    deliveryFloatSize:     { def: 16,  min: 12, max: 64,  step: 1 },
    deliveryFloatSizeStep: { def: 1.0, min: 0,  max: 6,   step: 0.5 },
    deliveryFloatSizeMax:  { def: 48,  min: 16, max: 96,  step: 1 },
    deliveryFloatHold:     { def: 0.00, min: 0, max: 3.0, step: 0.05 },
    deliveryFloatFade:     { def: 1.20, min: 0.1, max: 3.0, step: 0.05 },
  };
  for (const id of Object.keys(expected)) {
    const row = X.DEBUG_VARS.find(v => v.id === id);
    assert(row, `B: (setup) registry row ${id} exists`);
    for (const field of ["def", "min", "max", "step"]) {
      eq(row[field], expected[id][field], `B: ${id}.${field} === ${expected[id][field]}`);
    }
  }
})();

// ================= drive a real dock visit, tracking floaters/powerups per pop =================
function driveDeliveryVisit(X, pieceCount) {
  X.startGame();
  const g = X.game;
  g.hunters.length = 0; g.saucers.length = 0; g.bullets.length = 0;
  g.garbage.length = 0; g.powerups.length = 0; g.floaters.length = 0;
  g.debris.length = 1;
  g.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  g.saucerTimer = 1e6; g.healthTimer = 1e6; g.hunterTimer = 1e6;
  g.ship.x = g.dock.x; g.ship.y = g.dock.y;
  g.comboGrace = X.DEBUG.dockComboGrace;
  g.deliveryCount = 0; g.offloadTimer = 0;
  g.chain.length = 0;
  for (let i = 0; i < pieceCount; i++) {
    g.chain.push({ x: g.ship.x - (i + 1) * X.CHAIN_LINK, y: g.ship.y, px: g.ship.x - (i + 1) * X.CHAIN_LINK - 1,
      py: g.ship.y, spin: 0, spinRate: 0, mass: 1, towed: true });
  }
  const sizeSamples = [];
  let sawSalvage = false, sawMaxHaul = false;
  let lastTicker = null;
  for (let f = 0; f < 900 && g.chain.length > 0; f++) {
    const countBefore = g.deliveryCount;
    X.update(1 / 60);
    if (g.deliveryTicker) lastTicker = g.deliveryTicker;
    if (g.deliveryCount !== countBefore) {
      sizeSamples.push({ n: g.deliveryCount, size: lastTicker.size });
    }
    for (const fl of g.floaters) {
      if (typeof fl.text === "string" && fl.text.includes("SALVAGE")) sawSalvage = true;
      if (typeof fl.text === "string" && fl.text.includes("MAX HAUL")) sawMaxHaul = true;
    }
  }
  return { g, sizeSamples, sawSalvage, sawMaxHaul };
}

// ================= (C) deliveryCount 8: no SALVAGE BONUS floater, powerup still drops =================
(function sectionC() {
  console.log("(C) an 8-piece visit drops a powerup at 8 but pushes no SALVAGE floater");
  const X = buildGame();
  const powerupsBefore = 0;
  const { g, sawSalvage } = driveDeliveryVisit(X, 8);
  eq(g.deliveryCount, 8, "C: (setup) visit reached deliveryCount 8");
  assert(!sawSalvage, "C: no floater text ever contained SALVAGE");
  assert(g.powerups.length > powerupsBefore, "C: the reward-tier dropPowerup() still fired at 8");
})();

// ================= (D) CARGO_CAP_MAX: no MAX HAUL floater, maxChainVisit + cargoFlash still fire =================
(function sectionD() {
  console.log("(D) a CARGO_CAP_MAX visit pushes no MAX HAUL floater but still flags the max haul");
  const X = buildGame();
  const { g, sawMaxHaul } = driveDeliveryVisit(X, X.CARGO_CAP_MAX);
  eq(g.deliveryCount, X.CARGO_CAP_MAX, "D: (setup) visit reached CARGO_CAP_MAX");
  assert(!sawMaxHaul, "D: no floater text ever contained MAX HAUL");
  eq(g.stats.maxChainVisit, true, "D: game.stats.maxChainVisit still set");
  eq(g.cargoFlash, X.HUD_CAP_FLASH, "D: game.cargoFlash still set to HUD_CAP_FLASH");
})();

// ================= (E) ticker size grows per piece: min(48, 16 + 1.0*(n-1)) =================
(function sectionE() {
  console.log("(E) ticker size follows min(48, 16 + 1.0 * (N - 1)) at the shipped defaults");
  const X = buildGame();
  const { sizeSamples } = driveDeliveryVisit(X, X.CARGO_CAP_MAX);
  eq(sizeSamples.length, X.CARGO_CAP_MAX, "E: (setup) one size sample per delivered piece");
  for (const { n, size } of sizeSamples) {
    const expected = Math.min(48, 16 + 1.0 * (n - 1));
    eq(size, expected, `E: piece ${n} ticker size is ${expected}`);
  }
})();

A.report();
