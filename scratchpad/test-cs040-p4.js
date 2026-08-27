// Headless test for CS040 P4 — recycle-hub resupply (PLANNED-FEATURES-CS040.md §2, FORK-CS040-C c1).
// The hub's own dropPowerup() call (game.deliveryCount === 8) now passes hubBias=true: any budgeted
// type (rapid/triple/magnet/engine, NEVER guard) sitting at game.powerBudget[type] === 0 has its
// weight multiplied by DEBUG.hubDryWeightMult. destroyHunter()/destroySaucer() never pass hubBias —
// their calls stay byte-identical to today's unbiased roll.
//
//   node scratchpad/test-cs040-p4.js
//
// Traps staged for: guard is explicitly excluded from the dry set even though game.powerBudget.guard
// normally rests at 0 (its resting state, not starvation) — §E/§F. All statistics are seeded and run
// at a large enough N that the tolerance bands don't flake; a leaked bias into the non-hub path would
// blow well past them, not graze the edge.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { mkAssert, buildGame } = require("./_harness.js");
const { hasKnob } = require("./test-registry.js");
const { withSeed } = require("./_seeded-random.js");
const A = mkAssert();
const { assert, eq } = A;

const repoRoot = path.join(__dirname, "..");

const DRY_ONLY = new Set(["rapid", "triple", "magnet", "engine"]);
const ALL_BUDGET_KEYS = ["rapid", "triple", "magnet", "engine", "guard"];

function freshBudget(vals) {
  const b = { rapid: 5, triple: 5, magnet: 5, engine: 5, guard: 0 };
  return Object.assign(b, vals);
}

function tally(types) {
  const t = { rapid: 0, triple: 0, scoop: 0, magnet: 0, engine: 0, guard: 0 };
  for (const k of types) t[k] = (t[k] || 0) + 1;
  return t;
}

// ================= (A) node --check, and the new surface exists =================
(function sectionA() {
  console.log("(A) node --check, and the new symbols exist");
  const html = fs.readFileSync(path.join(repoRoot, "orbital-overhaul.html"), "utf8");
  const tmp = path.join(repoRoot, "scratchpad", "_cs040p4_extracted.js");
  fs.writeFileSync(tmp, html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  try {
    execSync(`node --check "${tmp}"`, { stdio: "pipe" });
    assert(true, "A: node --check on the extracted <script>");
  } catch (e) {
    assert(false, "A: node --check: " + e.stderr.toString());
  } finally {
    fs.unlinkSync(tmp);
  }
  const X = buildGame();
  eq(X.HUB_DRY_WEIGHT_MULT, 4, "A: HUB_DRY_WEIGHT_MULT is 4");
  eq(X.DEBUG.hubDryWeightMult, 4, "A: DEBUG.hubDryWeightMult defaults to the const");
  hasKnob(X, "hubDryWeightMult", { def: 4, min: 1, max: 20, step: 1 }, A);
  assert(!X.LEVERS.some(l => l.id === "hubDryWeightMult"), "A: hubDryWeightMult is not a lever");
})();

// ================= (B) all four budgets non-zero: hub roll == today's roll =================
(function sectionB() {
  console.log("(B) with every budget non-zero, the hub's hubBias=true roll is byte-identical to hubBias=false");
  const X = buildGame(); X.startGame();
  const g = X.game;
  g.powerBudget = freshBudget({});
  g.chain.length = 0; // guard stays ineligible (below chainGuardMinTow) on both sides alike

  const ROLLS = 500;
  const biased = withSeed(20260826, () => {
    g.powerups.length = 0;
    for (let i = 0; i < ROLLS; i++) X.dropPowerup(0, 0, 0, 0, true);
    return g.powerups.map(p => p.type);
  });
  const unbiased = withSeed(20260826, () => {
    g.powerups.length = 0;
    for (let i = 0; i < ROLLS; i++) X.dropPowerup(0, 0, 0, 0);
    return g.powerups.map(p => p.type);
  });
  eq(JSON.stringify(biased), JSON.stringify(unbiased),
    "B: identical random draws produce identical type sequences — no budget sits at 0, so isDry() never fires");
})();

// ================= (C) rapid at 0: the hub roll's rapid share rises, the plain roll's doesn't =================
(function sectionC() {
  console.log("(C) rapid dry: hub share of rapid rises by HUB_DRY_WEIGHT_MULT, the non-hub roll is unmoved");
  const X = buildGame(); X.startGame();
  const g = X.game;
  g.chain.length = 0; // guard ineligible throughout

  const ROLLS = 4000;
  // Baseline: rapid budgeted but non-zero — establishes the un-dried share to compare against.
  g.powerBudget = freshBudget({});
  const baseline = tally(withSeed(11, () => {
    g.powerups.length = 0;
    for (let i = 0; i < ROLLS; i++) X.dropPowerup(0, 0, 0, 0, true);
    return g.powerups.map(p => p.type);
  }));
  const baselineShare = baseline.rapid / ROLLS;
  // rapid=30 of a 100 total (rapid+triple+scoop+magnet+engine=30+30+20+10+10) -> ~30%.
  assert(Math.abs(baselineShare - 0.30) < 0.04, `C: baseline (all budgets armed) rapid share ~30% (got ${baselineShare})`);

  // Dry: rapid budget at 0. The PLAIN roll (hubBias false) must not move.
  g.powerBudget = freshBudget({ rapid: 0 });
  const plainDry = tally(withSeed(11, () => {
    g.powerups.length = 0;
    for (let i = 0; i < ROLLS; i++) X.dropPowerup(0, 0, 0, 0);
    return g.powerups.map(p => p.type);
  }));
  const plainDryShare = plainDry.rapid / ROLLS;
  assert(Math.abs(plainDryShare - baselineShare) < 0.04,
    `C: dry rapid budget does not move the PLAIN (non-hub) roll's rapid share (got ${plainDryShare} vs baseline ${baselineShare})`);

  // The HUB roll (hubBias true) with rapid dry: weight 30*4=120 of a 190 total -> ~63.2%.
  const hubDry = tally(withSeed(11, () => {
    g.powerups.length = 0;
    for (let i = 0; i < ROLLS; i++) X.dropPowerup(0, 0, 0, 0, true);
    return g.powerups.map(p => p.type);
  }));
  const hubDryShare = hubDry.rapid / ROLLS;
  const expected = (30 * X.DEBUG.hubDryWeightMult) / (30 * X.DEBUG.hubDryWeightMult + 30 + 20 + 10 + 10);
  assert(Math.abs(hubDryShare - expected) < 0.04,
    `C: hub roll's dry rapid share matches the weighted formula (got ${hubDryShare}, want ~${expected})`);
  assert(hubDryShare - plainDryShare > 0.2,
    `C: the hub roll's rapid share is markedly higher than the plain roll's (hub ${hubDryShare} vs plain ${plainDryShare})`);
})();

// ================= (D) destroyHunter / destroySaucer stay unbiased even while every weapon is dry =================
(function sectionD() {
  console.log("(D) destroyHunter/destroySaucer never pass hubBias — their drops stay flat even at full dryness");
  const X = buildGame(); X.startGame();
  const g = X.game;
  g.chain.length = 0; // guard ineligible

  // Every budgeted type dry — the scenario where a hub-biased roll would swing hardest.
  g.powerBudget = freshBudget({ rapid: 0, triple: 0, magnet: 0, engine: 0 });

  const ROLLS = 3000;
  const saucerTypes = withSeed(2026, () => {
    g.powerups.length = 0;
    for (let i = 0; i < ROLLS; i++) X.destroySaucer({ x: 0, y: 0, vx: 0, vy: 0, small: false }, false);
    return g.powerups.map(p => p.type);
  });
  const saucerShare = tally(saucerTypes).rapid / ROLLS;
  // Flat table over the five non-guard types: rapid 30/100 = 30%, nowhere near the ~63% a hub-biased
  // roll at full rapid dryness would produce (spec §2.2's whole "only at the hub call site" rule).
  assert(Math.abs(saucerShare - 0.30) < 0.04,
    `D: destroySaucer()'s rapid share stays ~30% while fully dry (got ${saucerShare}) — no hub bias leaked in`);

  const hunterTypes = withSeed(2027, () => {
    g.powerups.length = 0;
    for (let i = 0; i < ROLLS; i++) X.destroyHunter({ x: 0, y: 0, vx: 0, vy: 0, size: 3 }, false);
    return g.powerups.map(p => p.type);
  });
  const hunterShare = tally(hunterTypes).rapid / ROLLS;
  assert(Math.abs(hunterShare - 0.30) < 0.04,
    `D: destroyHunter()'s large-core drop's rapid share stays ~30% while fully dry (got ${hunterShare}) — no hub bias leaked in`);
})();

// ================= (E) guard eligibility + pity weighting still compose at the hub call =================
(function sectionE() {
  console.log("(E) guard's eligibility gate and guardDropWeight() pity substitution both still apply, composed with the hub bias");
  const X = buildGame(); X.startGame();
  const g = X.game;

  // Below chainGuardMinTow: guard stays out of the roll even with hubBias true and every weapon dry.
  X.applyDebug("chainGuardMinTow", 10);
  g.chain.length = 0;
  g.powerBudget = freshBudget({ rapid: 0, triple: 0, magnet: 0, engine: 0 });
  const belowThreshold = withSeed(3030, () => {
    g.powerups.length = 0;
    for (let i = 0; i < 1500; i++) X.dropPowerup(0, 0, 0, 0, true);
    return g.powerups.map(p => p.type);
  });
  assert(!belowThreshold.includes("guard"), "E: guard never rolls below chainGuardMinTow, even hub-biased and fully dry");

  // At/above the threshold, with a maxed-out pity counter: guard's weight is guardDropWeight()
  // ALONE — not multiplied by hubDryWeightMult, and not affected by every other type being dry.
  for (let i = 0; i < 24; i++) g.chain.push({ x: 0, y: 0, px: 0, py: 0, spin: 0, spinRate: 0, mass: 1 });
  g.stats.cargoDamageEvents = 1e6; // clamps guardDropWeight() at chainGuardDropMax
  const guardWeight = X.guardDropWeight();
  const dryTotal = (30 + 30 + 10 + 10) * X.DEBUG.hubDryWeightMult + 20; // rapid+triple+magnet+engine (dry) + scoop (never dry)
  const expectedGuardShare = guardWeight / (guardWeight + dryTotal);
  // A wrongly-dried guard (had it entered the dry set) would instead read guardWeight*mult here —
  // the two predictions are far enough apart that this line alone would catch that regression.
  const wronglyDriedShare = (guardWeight * X.DEBUG.hubDryWeightMult) / (guardWeight * X.DEBUG.hubDryWeightMult + dryTotal);
  assert(Math.abs(expectedGuardShare - wronglyDriedShare) > 0.1,
    "E: (sanity) the two hypotheses are far enough apart for the roll below to distinguish them");

  const ROLLS = 4000;
  const eligible = tally(withSeed(3031, () => {
    g.powerups.length = 0;
    // dropPowerup() zeroes cargoDamageEvents the instant guard is SELECTED (CS035 P6's pity reset,
    // "before pickup") — re-pin it every roll so guardDropWeight() stays at the cap for the whole loop.
    for (let i = 0; i < ROLLS; i++) { g.stats.cargoDamageEvents = 1e6; X.dropPowerup(0, 0, 0, 0, true); }
    return g.powerups.map(p => p.type);
  }));
  const guardShare = eligible.guard / ROLLS;
  assert(Math.abs(guardShare - expectedGuardShare) < 0.04,
    `E: guard's share matches guardDropWeight() alone (got ${guardShare}, want ~${expectedGuardShare}) — F: guard was NOT drawn into the dry set`);
  assert(Math.abs(guardShare - wronglyDriedShare) > 0.08,
    `E: ...and is nowhere near what a leaked guard-in-the-dry-set bug would have produced (${wronglyDriedShare})`);

  X.applyDebug("chainGuardMinTow", 5);
})();

A.report();
