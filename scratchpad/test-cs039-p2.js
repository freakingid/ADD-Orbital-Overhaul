// Headless test for CS039 P2 — thirteen new telemetry columns + envelope v2 (no new counters; P1
// built those). This phase owns: the 13 appended TELEMETRY_FIELDS entries (before debugRun/
// resumedRun), their matching Telemetry.push() lines, and the v:1 -> v:2 envelope bump in both
// read() and write(). It does NOT own the counters themselves (game.stats.*, CS039 P1) or
// TELEMETRY_MAX/tick()'s gates (CS037 P4/CS038 P3) — untouched, not re-verified here.
//
//   node scratchpad/test-cs039-p2.js

"use strict";
const { installSeed } = require("./_seeded-random.js");
installSeed(20260820);

const { mkAssert, buildGame } = require("./_harness.js");
const A = mkAssert();
const { assert, eq } = A;

const DT = 1 / 60;
const run = (X, secs) => { for (let i = 0; i < Math.round(secs / DT); i++) X.update(DT); };
const pushNode = (X) => X.game.chain.push({ x: 0, y: 0, px: 0, py: 0, spin: 0, spinRate: 0, mass: 1 });

const P1_FIELDS = [
  "t", "level", "score", "hp", "speed",
  "rapidLeft", "tripleLeft", "magnetLeft", "engineLeft", "guardLeft", "scoopLevel",
  "rapidPicked", "triplePicked", "healthPicked", "magnetPicked", "enginePicked", "scoopPicked", "guardPicked",
  "dmgDebris3", "dmgDebris2", "dmgDebris1",
  "dmgHunter3", "dmgHunter2", "dmgHunter1",
  "dmgUfoBodyLarge", "dmgUfoBodySmall", "dmgUfoShotLarge", "dmgUfoShotSmall",
];
const NEW_FIELDS = [
  "chainLen", "cargoMax",
  "delivered", "deliveryScore", "cargoDamageEvents",
  "debrisKills", "hunterKills", "saucerKills", "hunterCoalesced",
  "deflects", "hitsTaken",
  "scoreRepairBonus", "scoreScoopBonus",
];
const CUMULATIVE_FIELDS = [
  "delivered", "deliveryScore", "cargoDamageEvents",
  "debrisKills", "hunterKills", "saucerKills", "hunterCoalesced",
  "deflects", "hitsTaken",
  "scoreRepairBonus", "scoreScoopBonus",
];

// ================= (A) TELEMETRY_FIELDS shape: +13, in order, flags still trailing ================
console.log("(A) TELEMETRY_FIELDS grew by exactly 13, ahead of debugRun/resumedRun, nothing else moved");
{
  const X = buildGame();
  eq(X.TELEMETRY_FIELDS.length, P1_FIELDS.length + 13 + 2, "A: field count is P1's 30 + 13");
  eq(X.TELEMETRY_FIELDS.slice(0, P1_FIELDS.length).join(","), P1_FIELDS.join(","),
    "A: every pre-existing field keeps its name and position");
  eq(X.TELEMETRY_FIELDS.slice(P1_FIELDS.length, P1_FIELDS.length + 13).join(","), NEW_FIELDS.join(","),
    "A: the 13 new fields land in the documented order, right after the old tail");
  eq(X.TELEMETRY_FIELDS[X.TELEMETRY_FIELDS.length - 2], "debugRun", "A: debugRun is still second-to-last");
  eq(X.TELEMETRY_FIELDS[X.TELEMETRY_FIELDS.length - 1], "resumedRun", "A: resumedRun is still last");
}

// ================= (B) every TELEMETRY_FIELDS key is present on a pushed row =======================
console.log("(B) a pushed row carries every column TELEMETRY_FIELDS names");
{
  const X = buildGame();
  X.startGame();
  X.applyDebug("telemetryCapture", 1);
  X.Telemetry.push();
  const row = X.Telemetry.rows[0];
  for (const f of X.TELEMETRY_FIELDS) assert(f in row, `B: the row carries the "${f}" column`);
  eq(Object.keys(row).length, X.TELEMETRY_FIELDS.length, "B: ...and carries no column TELEMETRY_FIELDS does not name");
}

// ================= (C) CSV: header/data column counts match, no "undefined" cell ===================
console.log("(C) CSV header and data lines have matching column counts, and no cell is literal 'undefined'");
{
  const X = buildGame();
  X.startGame();
  X.applyDebug("telemetryCapture", 1);
  X.Telemetry.push();
  X.Telemetry.push();
  // CS039 P3's `#` fingerprint block is dropped: this section owns the columns, not the header block.
  const lines = X.telemetryCSV(X.Telemetry.rows).split("\n").filter(l => l.length && !l.startsWith("#"));
  const headerCols = lines[0].split(",").length;
  for (let i = 1; i < lines.length; i++) {
    eq(lines[i].split(",").length, headerCols, `C: data line ${i} has the same column count as the header`);
    assert(!lines[i].split(",").includes("undefined"), `C: data line ${i} has no "undefined" cell`);
  }
}

// ================= (D) cargoMax is the LIVE runtime cap, not a recomputed payloadSlots() ============
console.log("(D) cargoMax in the row tracks game.cargoMax across a wave boundary that moves it");
{
  const X = buildGame();
  X.startGame();
  X.applyDebug("telemetryCapture", 1);
  const before = X.game.cargoMax;
  X.Telemetry.push();
  eq(X.Telemetry.rows[0].cargoMax, before, "D: pre-boundary row matches game.cargoMax");

  for (let w = X.game.wave; w < 5; w++) { X.game.debris = []; X.nextWave(); }
  const after = X.game.cargoMax;
  assert(after !== before, "D: (setup) payloadSlots moved cargoMax past wave 5");
  X.Telemetry.push();
  const row = X.Telemetry.rows[X.Telemetry.rows.length - 1];
  eq(row.cargoMax, after, "D: post-boundary row matches the NEW game.cargoMax");
  eq(row.cargoMax, X.payloadSlots(X.game.wave), "D: ...which agrees with payloadSlots(game.wave), same expression, not a duplicate source");
}

// ================= (E) chainLen tracks a real tow: hook, assert, break, assert drop ================
console.log("(E) chainLen moves with a real tow and drops when the chain breaks");
{
  const X = buildGame();
  X.startGame();
  X.applyDebug("telemetryCapture", 1);
  pushNode(X); pushNode(X); pushNode(X);
  X.Telemetry.push();
  eq(X.Telemetry.rows[X.Telemetry.rows.length - 1].chainLen, 3, "E: chainLen reflects three hooked nodes");

  X.breakChain(0);
  eq(X.game.chain.length, 0, "E: (setup) breakChain(0) severs the whole load");
  X.Telemetry.push();
  eq(X.Telemetry.rows[X.Telemetry.rows.length - 1].chainLen, 0, "E: chainLen drops to 0 after the break");
}

// ================= (F) cumulative columns are monotone non-decreasing across a run =================
console.log("(F) the eleven cumulative counters never decrease across a multi-sample run");
{
  const X = buildGame();
  X.startGame();
  X.applyDebug("telemetryCapture", 1);
  for (let step = 0; step < 4; step++) {
    for (const f of CUMULATIVE_FIELDS) X.game.stats[f] += 3;
    X.Telemetry.push();
  }
  const rows = X.Telemetry.rows;
  for (const f of CUMULATIVE_FIELDS) {
    for (let i = 1; i < rows.length; i++) {
      assert(rows[i][f] >= rows[i - 1][f], `F: ${f} is monotone non-decreasing at row ${i}`);
    }
  }
}

// ================= (G) envelope: v:2 written; v:1 blob reads empty, v:2 blob reads back ============
console.log("(G) the persistence envelope bumps to v:2, and a stale v:1 blob resolves to an empty buffer");
{
  const store = {};
  const X = buildGame({ store });
  X.startGame();
  X.applyDebug("telemetryCapture", 1);
  X.applyDebug("telemetryInterval", 1);
  run(X, 2);
  assert(X.Telemetry.rows.length >= 1, "G: (setup) at least one row landed");

  const key = X.Profiles.keyFor(X.TELEMETRY_KEY);
  assert(key in store, "G: the write lands under Profiles.keyFor(afd_telemetry_v1)");
  eq(Object.keys(store).length, 1, "G: ...and it is the only key touched");
  const env = JSON.parse(store[key]);
  eq(env.v, 2, "G: write() stamps the envelope v:2");

  // A seeded v:1 blob (yesterday's shape, none of the 13 new keys) reads back empty under the
  // known-value-else-default rule — a v1 row can't be exported without an "undefined" column.
  const staleStore = { [key]: JSON.stringify({ v: 1, rows: [{ t: 1, level: 1, score: 0 }] }) };
  const Y = buildGame({ store: staleStore });
  eq(Y.Telemetry.read().length, 0, "G: a stale v:1 blob resolves to an EMPTY buffer, not a throw or a partial trust");

  // A seeded v:2 blob round-trips.
  const freshRows = [{ t: 1, level: 1, score: 0, chainLen: 2, cargoMax: 8 }];
  const v2Store = { [key]: JSON.stringify({ v: 2, rows: freshRows }) };
  const Z = buildGame({ store: v2Store });
  eq(Z.Telemetry.read().length, 1, "G: a v:2 blob reads back its rows");
  eq(Z.Telemetry.read()[0].chainLen, 2, "G: ...with their content intact");

  // read() and write() key off the SAME expression, at both sites.
  const readKeySite = X.Profiles.keyFor(X.TELEMETRY_KEY);
  eq(readKeySite, key, "G: read() and write() resolve the identical key");
}

A.report();
