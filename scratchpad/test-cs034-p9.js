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
  // REPOINTED BY CS035 P2 (§2.4): this section's subject — the INCIDENTAL delivery floater whose
  // colour GATE B (B2) moved from COLOR.dim to COLOR.dock — no longer exists. The dock lockout makes
  // the incidental category empty by construction (a piece cannot be hooked inside the ring at all),
  // so the branch that pushed that floater was unreachable and was deleted with the `towed` tag. The
  // claim inverts, in the same shape CS035 P1 used for the SALVAGE BONUS / MAX HAUL floaters: no
  // size-12 delivery floater is pushed at the dock any more, whatever the popped node carries — and
  // B2's actual outcome (a delivery floater at the dock reads in COLOR.dock) is now carried by the
  // only floater left, the towed ticker, which is asserted here so the gate answer keeps a subject.
  console.log("(B) the incidental delivery floater is GONE (CS035 P2); the ticker carries GATE B's COLOR.dock");
  const X = buildGame();
  X.startGame();
  const g = X.game;
  g.debris.length = 0; g.hunters.length = 0; g.saucers.length = 0;
  g.ship.x = g.dock.x; g.ship.y = g.dock.y; g.ship.vx = 0; g.ship.vy = 0;
  g.chain.length = 0;
  // `towed: false` deliberately kept on the seeded node: the field is dead, and a stale one must not
  // resurrect a demoted delivery. This pop takes the one and only branch there is now.
  g.chain.push({ x: g.dock.x + 5, y: g.dock.y, px: g.dock.x, py: g.dock.y, spin: 0, spinRate: 0, mass: 1, towed: false });
  g.floaters.length = 0;
  for (let f = 0; f < 30 && g.chain.length > 0; f++) X.update(1 / 60);

  assert(!g.floaters.some(f => f.size === 12),
    "B: \u26d4 no size-12 incidental floater is pushed — the branch is deleted (CS035 P2)");
  const tick = g.floaters.find(f => /^\+\d+$/.test(f.text));
  assert(!!tick, "B: (setup) the delivery ticker fired instead");
  eq(tick.color, X.COLOR.dock, "B: \u26d4 GATE B's B2 answer survives in the ticker — a dock delivery floater is COLOR.dock");
  close(tick.x, g.dock.x, "B: ...still born at the dock anchor — position was NOT changed at that gate either");
  eq(g.deliveryCount, 1, "B: \u26d4 and a stale `towed: false` no longer demotes anything — the pop counted");
})();

A.report();
