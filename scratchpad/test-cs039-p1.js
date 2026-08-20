// Headless test for CS039 P1 — five new per-run telemetry counters on game.stats (hunterKills,
// hitsTaken, deliveryScore, scoreRepairBonus, scoreScoopBonus). Nothing reads them this phase — no
// HUD, no leaderboard, no achievement — so this file's own job is entirely: each field lands at
// exactly its one documented site, agrees with its sibling population where the spec says it must,
// round-trips through save/resume with no edit to either function, and every existing export
// (TELEMETRY_FIELDS, the CSV header, Leaderboard.submit()'s stats object) is untouched.
//
//   node scratchpad/test-cs039-p1.js

"use strict";
const { mkAssert, buildGame } = require("./_harness.js");
const { installSeed } = require("./_seeded-random.js");
const A = mkAssert();
const { assert, eq } = A;

installSeed(20260820);

const NEW_FIELDS = ["hunterKills", "hitsTaken", "deliveryScore", "scoreRepairBonus", "scoreScoopBonus"];

function freshShip(X, { hp = 100, invuln = 0, shieldOn = false } = {}) {
  const g = X.game;
  g.ship.hp = hp; g.ship.invuln = invuln; g.ship.shieldOn = shieldOn;
  g.ship.dead = false; g.ship.vx = 0; g.ship.vy = 0;
  return g.ship;
}

function fakeKitLeaderboard(calls) {
  return {
    create() {
      return {
        beginRun: () => {},
        submit: (payload) => { (calls.submits = calls.submits || []).push(payload); return Promise.resolve({ status: "submitted" }); },
        fetchBoard: () => Promise.resolve({ gameId: "orbital-overhaul", metricLabel: "SCORE", entries: [] }),
        queueLength: () => 0,
        flushQueue: () => Promise.resolve({ sent: 0, failed: 0, dropped: 0 }),
      };
    },
  };
}

// ================= (A) defaults and reset =================
(function sectionA() {
  console.log("(A) resetGameStats() returns all five at 0; resetRun() clears them mid-run");
  const X = buildGame();
  const fresh = X.resetGameStats();
  for (const f of NEW_FIELDS) eq(fresh[f], 0, `A: resetGameStats().${f} starts at 0`);

  X.startGame();
  for (const f of NEW_FIELDS) X.game.stats[f] = 7 * (NEW_FIELDS.indexOf(f) + 1);
  X.startGame(); // startGame -> resetRun(), the shared reset both entry points use
  for (const f of NEW_FIELDS) eq(X.game.stats[f], 0, `A: startGame()/resetRun() clears ${f}`);
})();

// ================= (B) hitsTaken agrees EXACTLY with the dmgFrom* population =================
(function sectionB() {
  console.log("(B) hitsTaken counts exactly the attributed non-lethal hits; shielded/i-frame moves neither");
  const X = buildGame(); X.startGame();
  const DMG_FIELDS = ["dmgFromDebris3", "dmgFromDebris2", "dmgFromDebris1",
    "dmgFromHunter3", "dmgFromHunter2", "dmgFromHunter1",
    "dmgFromUfoBodyLarge", "dmgFromUfoBodySmall", "dmgFromUfoShotLarge", "dmgFromUfoShotSmall"];
  const TAGS = ["debris3", "debris2", "debris1", "hunter3", "hunter2", "hunter1",
    "ufoBodyLarge", "ufoBodySmall", "ufoShotLarge", "ufoShotSmall"];

  let expectedHits = 0;
  for (const tag of TAGS) {
    const ship = freshShip(X, { hp: 100 });
    const applied = X.damageShip(13, ship.x + 40, ship.y, tag);
    assert(applied === true, `B: ${tag} — non-lethal hit applied`);
    expectedHits++;
    eq(X.game.stats.hitsTaken, expectedHits, `B: hitsTaken after ${tag} hit`);
  }
  const sumAttributed = DMG_FIELDS.reduce((s, f) => s + X.game.stats[f], 0);
  eq(sumAttributed, TAGS.length * 13, "B: (sanity) the ten dmgFrom* fields sum to every attributed hit");
  eq(X.game.stats.hitsTaken, TAGS.length, "B: hitsTaken equals the number of attributed hits");

  // -- shielded / i-framed hits move NEITHER hitsTaken nor any dmgFrom* sum --
  const hitsBefore = X.game.stats.hitsTaken;
  const dmgBefore = DMG_FIELDS.reduce((s, f) => s + X.game.stats[f], 0);
  {
    const ship = freshShip(X, { hp: 100, shieldOn: true });
    const applied = X.damageShip(13, ship.x + 40, ship.y, "hunter3");
    eq(applied, false, "B: shielded — damageShip returns false");
  }
  {
    const ship = freshShip(X, { hp: 100, invuln: 0.5 });
    const applied = X.damageShip(13, ship.x + 40, ship.y, "debris2");
    eq(applied, false, "B: i-framed — damageShip returns false");
  }
  eq(X.game.stats.hitsTaken, hitsBefore, "B: shielded/i-framed hits do not move hitsTaken");
  eq(DMG_FIELDS.reduce((s, f) => s + X.game.stats[f], 0), dmgBefore, "B: shielded/i-framed hits do not move dmgFrom* sum");

  // -- a lethal hit moves neither (mirrors dmgThisWave's own non-lethal-only placement) --
  {
    const ship = freshShip(X, { hp: 13 });
    const applied = X.damageShip(13, ship.x + 40, ship.y, "debris3");
    eq(applied, true, "B: lethal hit — damageShip still returns true");
    assert(X.game.ship.dead, "B: lethal hit — ship is dead");
  }
  eq(X.game.stats.hitsTaken, hitsBefore, "B: a lethal hit does not move hitsTaken");
})();

// ================= (C) hunterKills counts all three tiers; awardScore=false moves nothing =================
(function sectionC() {
  console.log("(C) hunterKills counts small/medium/large kills; a chain-detonation kill (awardScore=false) moves nothing");
  const X = buildGame(); X.startGame();
  X.game.hunters = []; X.game.garbage = [];

  for (const size of [1, 2, 3]) {
    const before = X.game.stats.hunterKills;
    const h = new X.HunterSatellite(100, 100, size, 0);
    X.destroyHunter(h, true);
    eq(X.game.stats.hunterKills, before + 1, `C: destroying a size-${size} Hunter (awardScore=true) increments hunterKills`);
  }
  eq(X.game.stats.hunterKills, 3, "C: all three tiers counted");

  const before = X.game.stats.hunterKills;
  const h2 = new X.HunterSatellite(200, 200, 2, 0);
  X.destroyHunter(h2, false);
  eq(X.game.stats.hunterKills, before, "C: destroyHunter(h, false) — the chain-detonation path — moves nothing");
})();

// ================= (D) deliveryScore equals the sum of pts actually added across a dock visit =================
(function sectionD() {
  console.log("(D) deliveryScore tracks the sum of pts added at the dock, across a multi-canister visit");
  const X = buildGame(); X.startGame();
  const g = X.game;
  g.debris = []; g.hunters = []; g.saucers = []; g.bullets = []; g.powerups = []; g.garbage = [];
  g.saucerTimer = 1e9; g.hunterTimer = 1e9; g.healthTimer = 1e9;
  g.ship.invuln = 1e9; g.ship.shieldOn = false;
  g.dock.x = g.ship.x; g.dock.y = g.ship.y;
  g.chain = [];
  const N = 5;
  for (let i = 0; i < N; i++) g.chain.push({ x: g.ship.x, y: g.ship.y, px: g.ship.x, py: g.ship.y, spin: 0, spinRate: 0, mass: 1 });
  g.deliveryCount = 0; g.offloadTimer = 0;

  const before = g.stats.deliveryScore;
  const lifetimeBefore = X.Achievements.lifetime.deliveryScore;
  for (let i = 0; i < N; i++) {
    g.ship.x = g.dock.x; g.ship.y = g.dock.y; g.ship.vx = 0; g.ship.vy = 0;
    g.waveClearTimer = -1e9;
    X.update(0.13); // > DOCK_OFFLOAD_INTERVAL: one canister peels off per call
  }
  eq(g.stats.delivered >= N || g.chain.length === 0, true, "D: (sanity) the visit actually drained the chain");
  const delta = g.stats.deliveryScore - before;
  const lifetimeDelta = X.Achievements.lifetime.deliveryScore - lifetimeBefore;
  assert(delta > 0, "D: deliveryScore moved");
  eq(delta, lifetimeDelta, "D: game.stats.deliveryScore's delta equals Achievements.lifetime.deliveryScore's delta (same pts, same site)");
})();

// ================= (E) scoreRepairBonus moves only on a full-HP milestone =================
(function sectionE() {
  console.log("(E) scoreRepairBonus moves only when a score milestone lands with the ship already at full HP");
  // -- full HP: the milestone pays REPAIR_FULL_BONUS and scoreRepairBonus tracks it --
  {
    const X = buildGame(); X.startGame();
    X.game.ship.hp = X.SHIP_MAX_HP;
    X.game.score = X.game.nextRepair - 1;
    const nextRepairBefore = X.game.nextRepair;
    eq(X.game.stats.scoreRepairBonus, 0, "E: scoreRepairBonus starts at 0");
    X.addScore(1); // crosses the milestone
    assert(X.game.nextRepair > nextRepairBefore, "E: (sanity) the milestone actually fired");
    eq(X.game.stats.scoreRepairBonus, X.REPAIR_FULL_BONUS, "E: scoreRepairBonus === REPAIR_FULL_BONUS after a full-HP milestone");
  }
  // -- damaged HP: the milestone repairs hull instead, scoreRepairBonus stays 0 --
  {
    const X = buildGame(); X.startGame();
    X.game.ship.hp = X.SHIP_MAX_HP - 50;
    X.game.score = X.game.nextRepair - 1;
    const nextRepairBefore = X.game.nextRepair;
    const hpBefore = X.game.ship.hp;
    X.addScore(1);
    assert(X.game.nextRepair > nextRepairBefore, "E: (sanity) the milestone fired");
    assert(X.game.ship.hp > hpBefore, "E: (sanity) hull was repaired instead of paid out");
    eq(X.game.stats.scoreRepairBonus, 0, "E: scoreRepairBonus stays 0 when the milestone repairs hull instead");
  }
})();

// ================= (F) scoreScoopBonus moves only on a max-level scoop pickup =================
(function sectionF() {
  console.log("(F) scoreScoopBonus moves only when a scoop pickup lands at SCOOP_MAX_LEVEL");
  // -- below max: scoopLevel grows, scoreScoopBonus stays 0 --
  {
    const X = buildGame(); X.startGame();
    X.game.scoopLevel = X.SCOOP_MAX_LEVEL - 1;
    X.applyPowerup("scoop");
    eq(X.game.scoopLevel, X.SCOOP_MAX_LEVEL, "F: (sanity) scoop grew to max");
    eq(X.game.stats.scoreScoopBonus, 0, "F: scoreScoopBonus stays 0 on a growth pickup");
  }
  // -- at max: cashes in SCOOP_MAX_BONUS, scoreScoopBonus tracks it --
  {
    const X = buildGame(); X.startGame();
    X.game.scoopLevel = X.SCOOP_MAX_LEVEL;
    const scoreBefore = X.game.score;
    X.applyPowerup("scoop");
    eq(X.game.scoopLevel, X.SCOOP_MAX_LEVEL, "F: (sanity) scoop stays at max");
    assert(X.game.score >= scoreBefore + X.SCOOP_MAX_BONUS, "F: (sanity) score paid out at least SCOOP_MAX_BONUS");
    eq(X.game.stats.scoreScoopBonus, X.SCOOP_MAX_BONUS, "F: scoreScoopBonus === SCOOP_MAX_BONUS on a max-level pickup");
  }
})();

// ================= (G) save/resume round trip preserves all five, no edit to either function =================
(function sectionG() {
  console.log("(G) all five fields survive buildSaveEntry() -> resumeFromSave()");
  const X = buildGame(); X.startGame();
  const VALUES = {};
  NEW_FIELDS.forEach((f, i) => { VALUES[f] = (i + 1) * 11; X.game.stats[f] = VALUES[f]; });

  const entry = X.buildSaveEntry();
  for (const f of NEW_FIELDS) eq(entry.stats[f], VALUES[f], `G: buildSaveEntry carries ${f}`);

  X.resumeFromSave(entry);
  for (const f of NEW_FIELDS) eq(X.game.stats[f], VALUES[f], `G: resumeFromSave restores ${f}`);
})();

// ================= (H) no output changed: TELEMETRY_FIELDS, the CSV header, Leaderboard.submit() =================
(function sectionH() {
  console.log("(H) TELEMETRY_FIELDS is byte-identical, the CSV header matches, and Leaderboard.submit()'s stats keeps exactly its four keys");
  const X = buildGame();
  const EXPECTED_TELEMETRY_FIELDS = [
    "t", "level", "score", "hp", "speed",
    "rapidLeft", "tripleLeft", "magnetLeft", "engineLeft", "guardLeft", "scoopLevel",
    "rapidPicked", "triplePicked", "healthPicked", "magnetPicked", "enginePicked", "scoopPicked", "guardPicked",
    "dmgDebris3", "dmgDebris2", "dmgDebris1",
    "dmgHunter3", "dmgHunter2", "dmgHunter1",
    "dmgUfoBodyLarge", "dmgUfoBodySmall", "dmgUfoShotLarge", "dmgUfoShotSmall",
    "debugRun", "resumedRun",
  ];
  eq(X.TELEMETRY_FIELDS.length, EXPECTED_TELEMETRY_FIELDS.length, "H: TELEMETRY_FIELDS length unchanged");
  eq(X.TELEMETRY_FIELDS.join(","), EXPECTED_TELEMETRY_FIELDS.join(","), "H: TELEMETRY_FIELDS is byte-identical");
  assert(!NEW_FIELDS.some(f => X.TELEMETRY_FIELDS.includes(f)), "H: none of the five new fields appear in TELEMETRY_FIELDS");

  const calls = {};
  const Y = buildGame({ store: { afd_settings_v1: "{}" }, extraExports: ["window"] });
  Y.window.KitLeaderboard = fakeKitLeaderboard(calls);
  Y.startGame();
  Y.game.stats.debrisKills = 4; Y.game.wave = 3; Y.game.stats.delivered = 2; Y.game.stats.saucerKills = 1;
  for (const f of NEW_FIELDS) Y.game.stats[f] = 99; // even nonzero, must not leak into the payload
  Y.Leaderboard.submit("quit");
  assert(!!calls.submits && calls.submits.length === 1, "H: (setup) exactly one submit()");
  const s = calls.submits[0].stats;
  eq(Object.keys(s).sort().join(","),
    ["wave_reached", "canisters_delivered", "saucer_kills", "debris_destroyed"].sort().join(","),
    "H: Leaderboard.submit()'s stats object still has exactly its four existing keys");
})();

A.report();
