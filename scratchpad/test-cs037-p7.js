// Headless test for CS037 P7 — one powerup per dock visit + DELIVERY score knobs
// (PLANNED-FEATURES-CS037.md §7, IMPLEMENTATION-PHASES-CS037.md P7).
//
//   node scratchpad/test-cs037-p7.js
//
// This phase owns: the deliveryCount===8 latch alone (12/16/20 deleted), and the two new
// DEBUG.dockBaseScore/dockBonusStep knobs the score curve now reads. It does not own the
// deliveryCount===12 Heavy Hauler latch or the ===CARGO_CAP_MAX Maxed Out/superMegaDelivery()
// latch — those are driven here only to prove they are untouched, never re-implemented.
//
// Reuses test-cs018-p8.js's deliverN idiom (drive the real dock-offload path inside update(),
// snapshot each new powerup/floater by object identity the frame it's born) via _harness.js.

"use strict";
const { installSeed } = require("./_seeded-random.js");
installSeed(20260819);

const { mkAssert, buildGame, scriptSource } = require("./_harness.js");
const { hasKnob } = require("./test-registry.js");
const A = mkAssert();
const { assert, eq } = A;

const raw = scriptSource();

// ---- (A) syntax --------------------------------------------------------------------------
(function sectionA() {
  console.log("(A) node --check on the extracted <script>");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs037p7_extracted.js");
  fs.writeFileSync(tmp, raw);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ---- (B) registry: the two new DELIVERY knobs --------------------------------------------
(function sectionB() {
  console.log("(B) registry — dockBaseScore/dockBonusStep, DELIVERY section, defaults unchanged from HEAD");
  const X = buildGame();
  hasKnob(X, "dockBaseScore", { def: 50, min: 0, max: 500, step: 5 }, A);
  hasKnob(X, "dockBonusStep", { def: 25, min: 0, max: 200, step: 5 }, A);
  eq(X.DEBUG.dockBaseScore, 50, "B: DEBUG.dockBaseScore resolves to 50 at boot");
  eq(X.DEBUG.dockBonusStep, 25, "B: DEBUG.dockBonusStep resolves to 25 at boot");
  eq(X.DOCK_BASE_SCORE, 50, "B: the shipped const stays in place as the documented default");
  eq(X.DOCK_BONUS_STEP, 25, "B: ...both constants, unchanged");
})();

// Deliver `n` canisters in one dock visit, driving the REAL dock-offload path inside update(),
// same idiom as test-cs018-p8.js's deliverN. cargoMax is forced well past CARGO_CAP_MAX so a
// visit of up to 24 pieces is never blocked by the payload-slot curve.
function deliverN(X, n) {
  X.startGame();
  X.game.state = "playing"; X.game.paused = false;
  X.game.cargoMax = Math.max(n, X.CARGO_CAP_MAX);
  X.game.debris.length = 1;
  X.game.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  X.game.hunters.length = 0; X.game.saucers.length = 0; X.game.bullets.length = 0;
  X.game.garbage.length = 0; X.game.powerups.length = 0; X.game.floaters.length = 0;
  X.game.saucerTimer = 1e6; X.game.healthTimer = 1e6; X.game.hunterTimer = 1e6;
  X.game.ship.x = X.game.dock.x + X.DOCK_RADIUS + 9; X.game.ship.y = X.game.dock.y; X.game.ship.vx = 0; X.game.ship.vy = 0;
  X.game.ship.dead = false;
  X.game.deliveryCount = 0; X.game.offloadTimer = 0;

  for (let i = 0; i < n; i++) {
    X.game.chain.push({ x: X.game.dock.x, y: X.game.dock.y, px: X.game.dock.x, py: X.game.dock.y, spin: 0, spinRate: 0, mass: 1 });
  }
  const seenPowerups = new Set(); const dropped = [];
  const scoreBefore = X.game.score;
  const perCanisterScore = [];
  for (let i = 0; i < n && X.game.chain.length > 0; i++) {
    X.game.offloadTimer = 0;
    const before = X.game.score;
    X.update(1 / 60);
    perCanisterScore.push(X.game.score - before);
    for (const p of X.game.powerups) {
      if (seenPowerups.has(p)) continue;
      seenPowerups.add(p);
      dropped.push({ x: p.x, y: p.y, vx: p.vx, vy: p.vy });
    }
  }
  return {
    powerups: dropped, delivered: X.game.deliveryCount,
    scoreGained: X.game.score - scoreBefore, perCanisterScore,
    fullChainVisit: X.game.stats.fullChainVisit, maxChainVisit: X.game.stats.maxChainVisit,
    fullChains: X.Achievements.lifetime.fullChains, heavyHaulerEvents: X.Achievements.lifetime.heavyHaulerEvents,
  };
}

// ---- (C) exactly one powerup per visit at 8/12/16/20/24, zero at <=7 ----------------------
// At 24 the reward-tier latch is not the only powerup source in play: deliveryCount===CARGO_CAP_MAX
// ALSO fires superMegaDelivery() (untouched by this phase, see §D), whose guaranteed set drops 5
// more (rapid/triple/scoop/magnet/engine — guard excluded from setTypes, no hunters seeded here so
// its per-piece sweep pays nothing extra). So the reward-tier latch's own contribution at 24 is
// isolated as (total - SMD's fixed 5), not read off the raw total.
(function sectionC() {
  console.log("(C) exactly one powerup awarded per visit, at 8/12/16/20/24 (24 net of SMD's own guaranteed set); zero at 1-7");
  for (const n of [8, 12, 16, 20]) {
    const X = buildGame();
    const { powerups, delivered } = deliverN(X, n);
    eq(delivered, n, `C: (setup) a ${n}-canister visit actually delivered ${n} (got ${delivered})`);
    eq(powerups.length, 1, `C: a ${n}-canister visit awards exactly one powerup (got ${powerups.length})`);
  }
  {
    const X = buildGame();
    const { powerups, delivered } = deliverN(X, 24);
    eq(delivered, 24, "C: (setup) a 24-canister visit actually delivered 24");
    const SMD_GUARANTEED = 5;   // rapid, triple, scoop, magnet, engine — POWERUP_DROP_WEIGHTS minus "guard"
    eq(powerups.length, 1 + SMD_GUARANTEED,
      `C: a 24-canister visit awards 1 (reward tier) + ${SMD_GUARANTEED} (SMD guaranteed set) = ${1 + SMD_GUARANTEED} (got ${powerups.length})`);
  }
  for (let n = 1; n <= 7; n++) {
    const X = buildGame();
    const { powerups } = deliverN(X, n);
    eq(powerups.length, 0, `C: a ${n}-canister visit awards no powerup`);
  }
})();

// ---- (D) Heavy Hauler (===12) and Maxed Out/superMegaDelivery (===CARGO_CAP_MAX) untouched --
(function sectionD() {
  console.log("(D) Heavy Hauler still fires at 12; Maxed Out + superMegaDelivery() still fire at CARGO_CAP_MAX");
  const X12 = buildGame();
  const r12 = deliverN(X12, 12);
  assert(r12.fullChainVisit, "D: fullChainVisit set at deliveryCount 12");
  eq(r12.fullChains, 1, "D: Achievements.lifetime.fullChains incremented once at 12");
  eq(r12.heavyHaulerEvents, 1, "D: Achievements.lifetime.heavyHaulerEvents incremented once at 12");
  assert(!r12.maxChainVisit, "D: (control) maxChainVisit NOT set at 12");

  const X24 = buildGame();
  const r24 = deliverN(X24, 24);
  assert(r24.maxChainVisit, "D: maxChainVisit set at deliveryCount === CARGO_CAP_MAX (24)");
  assert(r24.fullChainVisit, "D: (setup) a 24-visit also passes through 12, so fullChainVisit is set too");
  eq(X24.game.cargoFlash, X24.HUD_CAP_FLASH, "D: ⛔ superMegaDelivery()'s sibling cargoFlash effect still fires at 24");

  // superMegaDelivery() itself: unchanged, still guaranteed-set + hunter sweep behaviour, driven for
  // real rather than re-implemented. Confirm its call site is still gated on ===CARGO_CAP_MAX and the
  // Heavy Hauler / Maxed Out blocks are byte-unchanged from HEAD's shape.
  assert(raw.includes("if (game.deliveryCount === 12) { game.stats.fullChainVisit = true; Achievements.lifetime.fullChains++; Achievements.lifetime.heavyHaulerEvents++; }"),
    "D: ⛔ the ===12 Heavy Hauler latch body is byte-unchanged");
  assert(/if \(game\.deliveryCount === CARGO_CAP_MAX\) \{\s*\n\s*game\.stats\.maxChainVisit = true;/.test(raw),
    "D: ⛔ the ===CARGO_CAP_MAX Maxed Out latch is present and unchanged");
  assert(raw.includes("if (game.deliveryCount === CARGO_CAP_MAX) superMegaDelivery();"),
    "D: ⛔ the ===CARGO_CAP_MAX superMegaDelivery() call site is byte-unchanged");
})();

// ---- (E) score curve identical to HEAD's documented table, at every visit size ------------
(function sectionE() {
  console.log("(E) the score curve is untouched — 50 + 25*(N-1) per canister, at every visit size in the reference table");
  // PLANNED-FEATURES-CS037.md §7.3's reference table.
  const REFERENCE = [
    [1, 50], [4, 350], [7, 875], [8, 1100], [12, 2250], [16, 3800], [20, 5750], [24, 8100],
  ];
  for (const [n, wantTotal] of REFERENCE) {
    const X = buildGame();
    const { scoreGained, perCanisterScore } = deliverN(X, n);
    eq(scoreGained, wantTotal, `E: a ${n}-canister visit totals ${wantTotal} score (got ${scoreGained})`);
    for (let i = 0; i < n; i++) {
      const want = 50 + 25 * i;
      eq(perCanisterScore[i], want, `E: ${n}-visit canister #${i + 1} pays ${want} (got ${perCanisterScore[i]})`);
    }
  }
})();

// ---- (F) hand-mutated regressions fail this suite ------------------------------------------
(function sectionF() {
  console.log("(F) hand-mutated regressions actually fail — the assertions above have teeth");

  // Regression 1: reintroducing the 12/16/20 latches (the pre-P7 build) awards more than one powerup.
  const OLD = "if (game.deliveryCount === 8) {";
  assert(raw.includes(OLD), "F: (setup) the new single-condition latch text was located");
  const restored = raw.replace(OLD,
    "if (game.deliveryCount === 8 || game.deliveryCount === 12 ||\n            game.deliveryCount === 16 || game.deliveryCount === 20) {");
  assert(restored !== raw, "F: (setup) the mutation actually changed the source");
  {
    const X = buildGame({ source: restored });
    const { powerups } = deliverN(X, 20);
    assert(powerups.length !== 1, `F: (teeth) the pre-P7 4-latch build awards ${powerups.length} powerups at 20, not 1 — §C would have failed it`);
  }

  // Regression 2: hand-editing the score constants so the curve drifts from the reference table.
  const CONST = "const pts = DEBUG.dockBaseScore + DEBUG.dockBonusStep * (game.deliveryCount - 1);";
  assert(raw.includes(CONST), "F: (setup) the score line was located");
  const drifted = raw.replace(CONST, "const pts = 60 + DEBUG.dockBonusStep * (game.deliveryCount - 1);");
  assert(drifted !== raw, "F: (setup) the drift mutation actually changed the source");
  {
    const X = buildGame({ source: drifted });
    const { scoreGained } = deliverN(X, 1);
    assert(scoreGained !== 50, `F: (teeth) a drifted base score pays ${scoreGained} for one canister, not 50 — §E would have failed it`);
  }
})();

A.report();
