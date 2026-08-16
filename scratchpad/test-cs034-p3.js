// Headless test for CS034 P3 — Hunter Satellites shed no Debris at the large/medium tiers.
// PLANNED-FEATURES-CS034.md §2: HUNTER_GARBAGE is now {3:0, 2:0, 1:1} — the small tier's pile is
// unchanged (it spawns no children, so the Debris is its whole payload); the 3-way split and the
// large core's powerup drop are untouched.
//
//   node scratchpad/test-cs034-p3.js
//
// Drives the REAL destroyHunter(); nothing under test is reimplemented.

"use strict";
const { installSeed } = require("./_seeded-random.js");
const restore = installSeed(34003);
const { mkAssert, buildGame } = require("./_harness.js");
const A = mkAssert();
const { assert, eq } = A;

(function sectionA() {
  console.log("(A) HUNTER_GARBAGE is the three-key table {3:0, 2:0, 1:1}");
  const X = buildGame({ store: {} });
  eq(X.HUNTER_GARBAGE[3], 0, "A: large tier emits 0");
  eq(X.HUNTER_GARBAGE[2], 0, "A: medium tier emits 0");
  eq(X.HUNTER_GARBAGE[1], 1, "A: small tier still emits 1");
  eq(Object.keys(X.HUNTER_GARBAGE).length, 3, "A: table keeps all three keys, not collapsed");
})();

(function sectionB() {
  console.log("(B) a size-3 (large) kill: no Debris, 3-way split, one powerup");
  const X = buildGame({ store: {} });
  X.startGame();
  const [w, h] = require("./_harness.js").worldDims(X);
  const h3 = new X.HunterSatellite(w / 2, h / 2, 3);
  const g0 = X.game.garbage.length, hu0 = X.game.hunters.length, p0 = X.game.powerups.length;
  X.destroyHunter(h3, true);
  eq(X.game.garbage.length - g0, 0, "B: no Debris added by a large kill");
  eq(X.game.hunters.length - hu0, 3, "B: three children spawned");
  eq(X.game.powerups.length - p0, 1, "B: the large core drops exactly one powerup");
})();

(function sectionC() {
  console.log("(C) a size-2 (medium) kill: no Debris, 3-way split, no powerup");
  const X = buildGame({ store: {} });
  X.startGame();
  const [w, h] = require("./_harness.js").worldDims(X);
  const h2 = new X.HunterSatellite(w / 2, h / 2, 2);
  const g0 = X.game.garbage.length, hu0 = X.game.hunters.length, p0 = X.game.powerups.length;
  X.destroyHunter(h2, true);
  eq(X.game.garbage.length - g0, 0, "C: no Debris added by a medium kill");
  eq(X.game.hunters.length - hu0, 3, "C: three children spawned");
  eq(X.game.powerups.length - p0, 0, "C: only the large core drops a powerup, not medium");
})();

(function sectionD() {
  console.log("(D) a size-1 (small) kill: one low-mass Debris piece, no children, no powerup");
  const X = buildGame({ store: {} });
  X.startGame();
  const [w, h] = require("./_harness.js").worldDims(X);
  const h1 = new X.HunterSatellite(w / 2, h / 2, 1);
  const g0 = X.game.garbage.length, hu0 = X.game.hunters.length, p0 = X.game.powerups.length;
  X.destroyHunter(h1, true);
  eq(X.game.garbage.length - g0, 1, "D: exactly one Debris piece added by a small kill");
  eq(X.game.hunters.length - hu0, 0, "D: no children — the small tier spawns none");
  eq(X.game.powerups.length - p0, 0, "D: small kill drops no powerup");
  const piece = X.game.garbage[X.game.garbage.length - 1];
  eq(piece.mass, X.HUNTER_SMALL_MASS, "D: the piece carries HUNTER_SMALL_MASS");
})();

restore();
A.report();
