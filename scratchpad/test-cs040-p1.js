// Headless test for CS040 P1 — the score milestone no longer heals or pays; below max hull it SPAWNS a
// Health powerup through the ambient placement path, at max hull it does nothing at all, and
// game.nextRepair advances on both. REPAIR_AMOUNT, REPAIR_FULL_BONUS and game.stats.scoreRepairBonus
// are DELETED, not parked.
//
//   node scratchpad/test-cs040-p1.js
//
// Two traps worth stating, because neither is visible from the changed lines:
//   - THE ONE-HEALTH-AT-A-TIME GATE IS NOT PART OF THIS. It lives at the AMBIENT call site in update(),
//     not inside spawnHealthPowerup(), so a milestone legitimately puts a SECOND health powerup on the
//     field. §E pins that deliberately, so nobody "fixes" it into a gate.
//   - The telemetry column scoreRepairBonus SURVIVES this phase emitting a literal 0 (§F). CS040 P5
//     owns the schema change that removes it; P1 only guarantees the cell is never an empty one.

"use strict";
const { mkAssert, buildGame } = require("./_harness.js");
const { installSeed } = require("./_seeded-random.js");
const A = mkAssert();
const { assert, eq } = A;

installSeed(20260826);

const healthOnField = g => g.powerups.filter(p => p.type === "health").length;

// Park the ship at a known spot at a chosen hull, with the field and the powerups cleared, then set
// score one point short of the next crossing. Every section starts from here.
function armed(X, hp) {
  const g = X.game;
  g.ship.hp = hp; g.ship.dead = false; g.ship.x = X.WORLD_W / 2; g.ship.y = X.WORLD_H / 2;
  g.powerups = [];
  g.score = g.nextRepair - 1;
  return g;
}

// ================= (A) the three retired symbols are GONE, not dormant =================
(function sectionA() {
  console.log("(A) REPAIR_AMOUNT / REPAIR_FULL_BONUS / game.stats.scoreRepairBonus are deleted outright");
  const X = buildGame();
  // The harness harvests every top-level declaration out of the COMMENT-STRIPPED source, so a name that
  // survives only inside CS040's tombstone comment cannot show up here.
  assert("REPAIR_MILESTONE" in X, "A: (non-vacuity) the harvest really does see this constant family");
  assert(!("REPAIR_AMOUNT" in X), "A: REPAIR_AMOUNT is no longer declared");
  assert(!("REPAIR_FULL_BONUS" in X), "A: REPAIR_FULL_BONUS is no longer declared");
  assert(!("scoreRepairBonus" in X.resetGameStats()),
    "A: resetGameStats() no longer initialises scoreRepairBonus — the key is gone, not zeroed");
  X.startGame();
  assert(!("scoreRepairBonus" in X.game.stats), "A: a live run's stats carries no scoreRepairBonus key");
})();

// ================= (B) below max hull: exactly one health spawn, no score, threshold advances ========
(function sectionB() {
  console.log("(B) a crossing below SHIP_MAX_HP spawns exactly one Health powerup and pays nothing");
  const X = buildGame(); X.startGame();
  let pings = 0; X.AudioSys.shieldPing = () => { pings++; };
  const g = armed(X, X.SHIP_MAX_HP - 50);
  const hpBefore = g.ship.hp, nextBefore = g.nextRepair, scoreBefore = g.score;
  const before = healthOnField(g), allBefore = g.powerups.length;

  X.addScore(1);

  assert(g.nextRepair > nextBefore, "B: (sanity) the milestone actually fired");
  eq(g.nextRepair, nextBefore + X.REPAIR_MILESTONE, "B: nextRepair advanced by exactly one REPAIR_MILESTONE");
  eq(g.score, scoreBefore + 1, "B: ⛔ score moved by the awarded points ALONE — the milestone is not a score event");
  eq(g.ship.hp, hpBefore, "B: ⛔ the hull is NOT repaired — REPAIR_AMOUNT is gone");
  eq(healthOnField(g) - before, 1, "B: exactly one Health powerup was spawned");
  eq(g.powerups.length - allBefore, 1, "B: ...and nothing else was pushed alongside it");
  eq(pings, 1, "B: FORK-CS040-A — the ping fires, once, on the spawn");
})();

// ================= (C) at exactly SHIP_MAX_HP: nothing at all, but the threshold still advances ======
(function sectionC() {
  console.log("(C) a crossing at exactly SHIP_MAX_HP spawns nothing, pays nothing and makes no sound");
  const X = buildGame(); X.startGame();
  let pings = 0; X.AudioSys.shieldPing = () => { pings++; };
  const g = armed(X, X.SHIP_MAX_HP);
  const nextBefore = g.nextRepair, scoreBefore = g.score;

  X.addScore(1);

  eq(g.nextRepair, nextBefore + X.REPAIR_MILESTONE,
    "C: ⛔ nextRepair advances on EVERY crossing, hull regardless — the full-hull case skips the reward, never the bookkeeping");
  eq(g.score, scoreBefore + 1, "C: ⛔ no REPAIR_FULL_BONUS — the full-hull milestone pays nothing at all");
  eq(g.ship.hp, X.SHIP_MAX_HP, "C: hull unchanged");
  eq(g.powerups.length, 0, "C: no powerup of any kind was spawned");
  eq(pings, 0, "C: FORK-CS040-A — a milestone that does nothing also makes no sound");
})();

// ================= (D) the spawn is the AMBIENT placement path, reused ==============================
(function sectionD() {
  console.log("(D) the spawned powerup lands in the ambient ring around the ship, wrap-aware");
  const X = buildGame(); X.startGame();
  X.AudioSys.shieldPing = () => {};
  // Park the ship hard against the world seam: a second, hand-written placement path would almost
  // certainly forget wrapPos(), and this is where that shows up as a distance far outside the ring.
  const g = armed(X, 10);
  g.ship.x = X.WORLD_W - 4; g.ship.y = 6;
  g.score = g.nextRepair - 1;

  X.addScore(1);

  eq(healthOnField(g), 1, "D: (sanity) one Health powerup on the field");
  const p = g.powerups[g.powerups.length - 1];
  const d = Math.sqrt(X.dist2(p, g.ship));   // wrap-aware, per CLAUDE.md's math rule
  assert(d >= X.POWERUP_HEALTH_MIN_DIST - 1e-6 && d <= X.POWERUP_HEALTH_MAX_DIST + 1e-6,
    `D: distance ${d.toFixed(2)} sits inside [${X.POWERUP_HEALTH_MIN_DIST}, ${X.POWERUP_HEALTH_MAX_DIST}] — spawnHealthPowerup()'s own ring`);
  assert(p.x >= 0 && p.x <= X.WORLD_W && p.y >= 0 && p.y <= X.WORLD_H,
    `D: ...and the point was wrapped into the world (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
})();

// ================= (E) the milestone is NOT gated by a health powerup already on the field ==========
(function sectionE() {
  console.log("(E) a milestone spawns even with a Health powerup already out — the one-at-a-time gate is the AMBIENT site's");
  const X = buildGame(); X.startGame();
  X.AudioSys.shieldPing = () => {};
  const g = armed(X, X.SHIP_MAX_HP - 50);
  X.spawnHealthPowerup();                       // one already on the field, the ambient way
  eq(healthOnField(g), 1, "E: (setup) one Health powerup is out");
  g.score = g.nextRepair - 1;

  X.addScore(1);

  eq(healthOnField(g), 2,
    "E: ⛔ the crossing spawned a SECOND one — `!game.powerups.some(p => p.type === 'health')` lives at the ambient call site in update(), not inside spawnHealthPowerup()");
})();

// ================= (F) repeated crossings, and the telemetry column P5 still owns ====================
(function sectionF() {
  console.log("(F) four crossings in a row each spawn once and never touch the score; the retired column emits a literal 0");
  const X = buildGame(); X.startGame();
  X.AudioSys.shieldPing = () => {};
  const g = armed(X, X.SHIP_MAX_HP - 100);
  g.score = 0; g.nextRepair = X.REPAIR_MILESTONE;
  g.powerups = [];

  let expected = 0;
  for (let i = 0; i < 4; i++) { expected += X.REPAIR_MILESTONE; X.addScore(X.REPAIR_MILESTONE); }
  eq(g.score, expected, "F: ⛔ score is EXACTLY the sum of the awarded points across four crossings — no milestone income of any kind");
  eq(g.nextRepair, X.REPAIR_MILESTONE * 5, "F: nextRepair advanced once per crossing");
  eq(healthOnField(g), 4, "F: one Health powerup per crossing");

  // The COLUMN outlives its counter by design: CS040 P5 removes it from TELEMETRY_FIELDS. P1's only
  // claim is that the cell is a literal 0 and never the empty string a deleted counter would serialise
  // to. This does NOT assert the column list — that belongs to whichever phase owns the schema.
  X.applyDebug("telemetryCapture", 1);
  X.Telemetry.push();
  const row = X.Telemetry.rows[X.Telemetry.rows.length - 1];
  eq(row.scoreRepairBonus, 0, "F: the row's scoreRepairBonus cell is a literal 0");
  const cells = X.telemetryCSV([row]).split("\n").filter(l => l.length && !l.startsWith("#"));
  const col = cells[0].split(",").indexOf("scoreRepairBonus");
  assert(col >= 0, "F: (sanity) the column is still in the header this phase");
  eq(cells[1].split(",")[col], "0", "F: ...and it exports as \"0\", not as an empty cell");
})();

A.report();
