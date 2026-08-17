// Headless test for CS035 P6 — powerup rebalance (PLANNED-FEATURES-CS035.md §5).
//
//   node scratchpad/test-cs035-p6.js
//
// Two independent fixes: guard's DROP weight goes pity-driven (rare unless the player is losing
// cargo), and the Super Mega Delivery flood shrinks (guard leaves the guaranteed set, both dock
// emitters slow launch to a knob, the cap itself is a knob). POWERUP_DROP_TYPES (the budgeted-
// effect list) is untouched — the trap this changeset's own comments call out twice already.
//
// Traps staged for: the eligible() gate composes with the dynamic weight, not replaces it — a bug
// that inflates `total` without inflating the walk would leave some rolls with `type === undefined`
// rather than a guard, so (E) asserts every roll lands on a real non-guard key, not just "no guard".
// The registry COUNT is test-registry.js's job, not this file's.

"use strict";
const { mkAssert, buildGame } = require("./_harness.js");
const { installSeed } = require("./_seeded-random.js");
const { hasKnob } = require("./test-registry.js");
const A = mkAssert();
const { assert, eq } = A;

const NODE = (x, y) => ({ x, y, px: x, py: y, spin: 0, spinRate: 0, mass: 1 });
function layChain(X, n) {
  const g = X.game;
  g.chain.length = 0;
  for (let i = 0; i < n; i++) g.chain.push(NODE(g.ship.x - (i + 1) * X.CHAIN_LINK, g.ship.y));
  return g.chain;
}

// ================= (A) weights x10 — every non-guard ratio unchanged =================
(function sectionA() {
  console.log("(A) POWERUP_DROP_WEIGHTS x10, every non-guard ratio byte-identical to the pre-x10 table");
  const X = buildGame();
  const OLD = { rapid: 3, triple: 3, scoop: 2, magnet: 1, engine: 1 };
  for (const k of Object.keys(OLD)) {
    eq(X.POWERUP_DROP_WEIGHTS[k], OLD[k] * 10, `A: POWERUP_DROP_WEIGHTS.${k} is the old weight x10`);
  }
  // guard's own entry is a placeholder (overwritten at roll time) but stays a plausible number.
  assert(typeof X.POWERUP_DROP_WEIGHTS.guard === "number" && X.POWERUP_DROP_WEIGHTS.guard > 0,
    "A: POWERUP_DROP_WEIGHTS.guard is a plausible placeholder, not a lie like 0 or undefined");
})();

// ================= (B) guardDropWeight(): base / pity / cap =================
(function sectionB() {
  console.log("(B) guardDropWeight(): base at 0 events, base+pity*n, clamped at the cap");
  const X = buildGame(); X.startGame();
  const g = X.game;
  const { chainGuardDropBase: base, chainGuardDropPity: pity, chainGuardDropMax: cap } = X.DEBUG;

  g.stats.cargoDamageEvents = 0;
  eq(X.guardDropWeight(), base, `B: 0 events -> base (${base})`);

  g.stats.cargoDamageEvents = 1;
  eq(X.guardDropWeight(), base + pity, "B: 1 event -> base + pity");

  g.stats.cargoDamageEvents = 3;
  eq(X.guardDropWeight(), base + pity * 3, "B: 3 events -> base + pity*3");

  // Whatever event count it takes to exceed the cap under the shipped knobs, the weight never does.
  const n = Math.ceil((cap - base) / pity) + 5;
  g.stats.cargoDamageEvents = n;
  eq(X.guardDropWeight(), cap, `B: ${n} events clamps at chainGuardDropMax (${cap})`);
  g.stats.cargoDamageEvents = n + 1000;
  eq(X.guardDropWeight(), cap, "B: further events never push it past the cap");
})();

// ================= (C) the pity counter's one writer: breakChain()'s sever path only =================
(function sectionC() {
  console.log("(C) an unguarded sever increments cargoDamageEvents; a guarded absorb and scatterChain() do not");

  // Unguarded sever: the counter climbs by exactly one per severed break.
  {
    const X = buildGame(); X.startGame();
    const g = X.game;
    layChain(X, 6);
    g.powerBudget.guard = 0;
    assert(!X.powerActive("guard"), "C: (precondition) the guard is not active");
    g.stats.cargoDamageEvents = 0;
    X.breakChain(3);
    eq(g.stats.cargoDamageEvents, 1, "C: an unguarded sever incremented the pity counter");
    layChain(X, 6);
    X.breakChain(2);
    eq(g.stats.cargoDamageEvents, 2, "C: ...and a second sever climbs it again");
  }

  // Guarded absorb: the counter is untouched — the player didn't lose cargo.
  {
    const X = buildGame(); X.startGame();
    const g = X.game;
    layChain(X, 6);
    g.powerBudget.guard = 99;
    assert(X.powerActive("guard"), "C: (precondition) the guard is active");
    g.stats.cargoDamageEvents = 4;
    X.breakChain(3);
    eq(g.stats.cargoDamageEvents, 4, "C: a GUARDED absorb leaves the pity counter untouched");
  }

  // scatterChain(): ship death is its own terminal event and never feeds the pity counter.
  {
    const X = buildGame(); X.startGame();
    const g = X.game;
    layChain(X, 6);
    g.stats.cargoDamageEvents = 7;
    X.scatterChain();
    eq(g.chain.length, 0, "C: (sanity) scatterChain() emptied the chain");
    eq(g.stats.cargoDamageEvents, 7, "C: scatterChain() does not touch the pity counter");
  }
})();

// ================= (D) a guard drop resets the pity counter to 0, before pickup =================
(function sectionD() {
  console.log("(D) a guard drop resets cargoDamageEvents to 0 the instant it's SELECTED, not on pickup");
  const X = buildGame(); X.startGame();
  const g = X.game;
  X.applyDebug("chainGuardMinTow", 0); // guard eligible regardless of chain length
  g.stats.cargoDamageEvents = 12;

  // Force the roll to land on "guard" — it's the LAST key in POWERUP_DROP_WEIGHTS, so a random draw
  // pinned near 1 always lands in its segment once it's eligible.
  const savedRandom = Math.random;
  Math.random = () => 0.999999;
  try {
    g.powerups.length = 0;
    X.dropPowerup(0, 0);
  } finally {
    Math.random = savedRandom;
  }
  eq(g.powerups.length, 1, "D: (sanity) dropPowerup pushed exactly one powerup");
  eq(g.powerups[0].type, "guard", "D: (sanity) the forced roll actually selected guard");
  eq(g.stats.cargoDamageEvents, 0, "D: selecting a guard for drop reset the pity counter to 0");
  X.applyDebug("chainGuardMinTow", 5);
})();

// ================= (E) the eligible() gate still excludes guard below chainGuardMinTow =================
(function sectionE() {
  console.log("(E) below chainGuardMinTow, guard NEVER rolls — in BOTH the running total and the walk");
  const restore = installSeed(20260817);
  const X = buildGame(); X.startGame();
  const g = X.game;
  X.applyDebug("chainGuardMinTow", 10);
  // Pin cargoDamageEvents at a high pity value: if `total` ever forgot to gate guard out (even while
  // the walk correctly skips it), rolls would land on `type === undefined` instead of a real key —
  // a bug this high a phantom weight would make hard to miss.
  g.stats.cargoDamageEvents = 1000;
  layChain(X, 0); // chain.length 0 < chainGuardMinTow 10 -> guard ineligible

  const NONGUARD = new Set(["rapid", "triple", "scoop", "magnet", "engine"]);
  g.powerups.length = 0;
  const ROLLS = 2000;
  for (let i = 0; i < ROLLS; i++) X.dropPowerup(0, 0);
  eq(g.powerups.length, ROLLS, "E: every call pushed a powerup");
  const types = g.powerups.map(p => p.type);
  assert(!types.includes("guard"), "E: guard never appears below the eligibility threshold");
  assert(types.every(t => NONGUARD.has(t)),
    "E: every roll landed on a real non-guard key — a leaked `total` would instead surface `undefined`");
  restore();
  X.applyDebug("chainGuardMinTow", 5);
})();

// ================= (F) superMegaDelivery(): the guaranteed set drops to 5, guard excluded =================
(function sectionF() {
  console.log("(F) superMegaDelivery()'s guaranteed set is exactly 5 types, none of them guard");
  const X = buildGame(); X.startGame();
  const g = X.game;
  g.hunters = []; // no sweep targets — isolates the guaranteed set
  g.powerups.length = 0;
  X.superMegaDelivery();
  eq(g.powerups.length, 5, "F: exactly 5 powerups (the guaranteed set) with no sweep targets");
  const types = g.powerups.map(p => p.type).sort();
  eq(JSON.stringify(types), JSON.stringify(["engine", "magnet", "rapid", "scoop", "triple"].sort()),
    `F: the guaranteed set is {rapid,triple,scoop,magnet,engine} — got ${JSON.stringify(types)}`);
  assert(!types.includes("guard"), "F: guard is not in the guaranteed set");
})();

// ================= (G) the per-piece sweep pool still contains 7 entries, including guard =================
(function sectionG() {
  console.log("(G) the per-piece sweep pool re-adds guard explicitly — still 7 types, guard reachable");
  const restore = installSeed(20260817);
  const X = buildGame(); X.startGame();
  const g = X.game;
  X.applyDebug("sweepPowerupCap", 3005); // budget headroom so every piece pays out
  g.hunters = [];
  // Small-tier (size 1) Hunters: destroyHunter() doesn't split them further and doesn't self-drop
  // for them (that's the size-3 large-core-only drop), so every survivor's payout is a PER-PIECE
  // sweep roll and nothing else.
  const N = 3000;
  for (let i = 0; i < N; i++) g.hunters.push(new X.HunterSatellite(0, 0, 1));
  g.powerups.length = 0;
  X.superMegaDelivery();

  const perPiece = g.powerups.slice(5).map(p => p.type); // [0..4] are the guaranteed set
  eq(perPiece.length, N, "G: every one of the N small Hunters paid its one per-piece powerup");
  const POOL = new Set(["rapid", "triple", "scoop", "magnet", "engine", "guard", "health"]);
  assert(perPiece.every(t => POOL.has(t)), "G: every per-piece roll landed inside the 7-type pool");
  assert(new Set(perPiece).size === 7, `G: all 7 pool types were actually reached in ${N} rolls (got ${new Set(perPiece).size})`);
  assert(perPiece.includes("guard"),
    "G: guard IS reachable during a sweep — the pool's whole point (§5.4)");
  restore();
})();

// ================= (H) POWERUP_DROP_TYPES is UNCHANGED — the append-only trap, again =================
(function sectionH() {
  console.log("(H) ⛔ POWERUP_DROP_TYPES did not move — it is a DIFFERENT structure from POWERUP_DROP_WEIGHTS");
  const X = buildGame();
  eq(X.POWERUP_DROP_TYPES.length, 5, "H: POWERUP_DROP_TYPES is still length 5");
  eq(JSON.stringify(X.POWERUP_DROP_TYPES), JSON.stringify(["rapid", "triple", "magnet", "engine", "guard"]),
    "H: ...and in the same order (HUD row indices are unmoved)");
})();

// ================= (I) the five new/retuned knobs =================
(function sectionI() {
  console.log("(I) the registry rows: three pity knobs (CHAIN GUARD) + two volume knobs (POWERUPS)");
  const X = buildGame();
  hasKnob(X, "chainGuardDropBase", { def: 4, min: 0, max: 60, step: 1, unit: "" }, A);
  hasKnob(X, "chainGuardDropPity", { def: 8, min: 0, max: 40, step: 1, unit: "" }, A);
  hasKnob(X, "chainGuardDropMax", { def: 40, min: 0, max: 120, step: 1, unit: "" }, A);
  hasKnob(X, "sweepPowerupCap", { def: 24, min: 0, max: 64, step: 1, unit: "" }, A);
  hasKnob(X, "dockPowerupSpeed", { def: 180, min: 40, max: 400, step: 10, unit: "px/s" }, A);
})();

A.report();
