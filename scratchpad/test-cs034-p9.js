// Headless test for CS034 P9 — closing phase (GATE B, B2).
//
//   node scratchpad/test-cs034-p9.js
//
// This phase owns exactly ONE game-logic change: the incidental (non-chain) delivery floater's
// colour, COLOR.dim -> COLOR.dock, because it read too dim to see at the dock anchor. Position
// (ship vs. dock) was explicitly NOT changed — Paul deferred that to a future gate, since CS029
// already tried and reverted a ship-relative origin for smearing during a visit. Size (12) is the
// only remaining thing distinguishing an incidental from the towed ticker. Also pins the version
// bump this phase owns.

"use strict";
const { mkAssert, buildGame } = require("./_harness.js");
const A = mkAssert();
const { assert, eq, close } = A;

(function sectionA() {
  console.log("(A) GAME_VERSION bumped to 1.0.0.34");
  const X = buildGame();
  eq(X.GAME_VERSION, "1.0.0.34", "A: GAME_VERSION is 1.0.0.34");
})();

(function sectionB() {
  console.log("(B) incidental delivery floater: COLOR.dock (GATE B, B2), still size 12, still dock-anchored");
  const X = buildGame();
  X.startGame();
  const g = X.game;
  g.debris.length = 0; g.hunters.length = 0; g.saucers.length = 0;
  g.ship.x = g.dock.x; g.ship.y = g.dock.y; g.ship.vx = 0; g.ship.vy = 0;
  g.chain.length = 0;
  g.chain.push({ x: g.dock.x + 5, y: g.dock.y, px: g.dock.x, py: g.dock.y, spin: 0, spinRate: 0, mass: 1, towed: false });
  g.floaters.length = 0;
  for (let f = 0; f < 30 && g.chain.length > 0; f++) X.update(1 / 60);

  const inc = g.floaters.find(f => f.size === 12);
  assert(!!inc, "B: (setup) the incidental floater fired");
  eq(inc.color, X.COLOR.dock, "B: ⛔ the incidental floater is COLOR.dock, not COLOR.dim");
  eq(inc.size, 12, "B: ...still size 12 — the one thing left distinguishing it from a real haul");
  close(inc.x, g.dock.x, "B: ...still born at the dock anchor — position was NOT changed this phase");
  eq(g.deliveryCount, 0, "B: ...and still touches no tally");
})();

A.report();
