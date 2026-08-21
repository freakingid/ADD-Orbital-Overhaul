// Headless test for CS039 P2 — thirteen new telemetry columns + the envelope bump. This phase owns
// the appended TELEMETRY_FIELDS entries (before debugRun/resumedRun), their matching
// Telemetry.push() lines, and the envelope version in both read() and write(). It does NOT own
// TELEMETRY_MAX/tick()'s gates (CS037 P4/CS038 P3) — untouched, not re-verified here.
//   GATE T folded in a FOURTEENTH column, game.stats.cargoSevers, and took the envelope to v:3:
// cargoDamageEvents turned out to be a sawtooth, not a cumulative counter (§H), so P2's original
// list was wrong about it in three places at once. §H is the section that would have caught it.
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
  "delivered", "deliveryScore", "cargoDamageEvents", "cargoSevers",
  "debrisKills", "hunterKills", "saucerKills", "hunterCoalesced",
  "deflects", "hitsTaken",
  "scoreRepairBonus", "scoreScoopBonus",
];
// ⛔ cargoDamageEvents IS NOT IN THIS LIST, and its absence is the point — it is the guard-drop PITY
// counter and it DECREASES (§H). It sat here for the whole of CS039 and §F passed anyway, because §F
// drives the counters by hand and never reaches dropPowerup()'s reset. GATE T's first real capture
// showed 7 decreases in 53 rows. cargoSevers is the cumulative one.
const CUMULATIVE_FIELDS = [
  "delivered", "deliveryScore", "cargoSevers",
  "debrisKills", "hunterKills", "saucerKills", "hunterCoalesced",
  "deflects", "hitsTaken",
  "scoreRepairBonus", "scoreScoopBonus",
];

// ================= (A) TELEMETRY_FIELDS shape: +14, in order, flags still trailing ================
console.log("(A) TELEMETRY_FIELDS grew by exactly 14, ahead of debugRun/resumedRun, nothing else moved");
{
  const X = buildGame();
  eq(X.TELEMETRY_FIELDS.length, P1_FIELDS.length + 14 + 2, "A: field count is P1's 30 + 14 (13 from P2, cargoSevers from GATE T)");
  eq(X.TELEMETRY_FIELDS.slice(0, P1_FIELDS.length).join(","), P1_FIELDS.join(","),
    "A: every pre-existing field keeps its name and position");
  eq(X.TELEMETRY_FIELDS.slice(P1_FIELDS.length, P1_FIELDS.length + 14).join(","), NEW_FIELDS.join(","),
    "A: the 14 new fields land in the documented order, right after the old tail");
  eq(X.TELEMETRY_FIELDS[X.TELEMETRY_FIELDS.indexOf("cargoDamageEvents") + 1], "cargoSevers",
    "A: cargoSevers sits immediately after the pity counter it is the run total of — read together or not at all");
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

// ================= (G) envelope: v:3 written; older blobs read empty, a v:3 blob reads back ========
console.log("(G) the persistence envelope is v:3, and a stale v:1 or v:2 blob resolves to an empty buffer");
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
  eq(env.v, 3, "G: write() stamps the envelope v:3");

  // A seeded v:1 blob (pre-CS039 shape, none of the new keys) reads back empty under the
  // known-value-else-default rule — a v1 row can't be exported without an "undefined" column.
  const staleStore = { [key]: JSON.stringify({ v: 1, rows: [{ t: 1, level: 1, score: 0 }] }) };
  const Y = buildGame({ store: staleStore });
  eq(Y.Telemetry.read().length, 0, "G: a stale v:1 blob resolves to an EMPTY buffer, not a throw or a partial trust");

  // ⛔ AND SO DOES v:2 — that is the whole reason GATE T bumped the envelope instead of reusing it.
  // A v:2 row has 43 keys and no cargoSevers, so accepting it would export the literal "undefined"
  // in that column, which is the exact failure P2 bumped v1 -> v2 to prevent.
  const v2Store = { [key]: JSON.stringify({ v: 2, rows: [{ t: 1, level: 1, score: 0, chainLen: 2, cargoMax: 8 }] }) };
  const W = buildGame({ store: v2Store });
  eq(W.Telemetry.read().length, 0, "G: ⛔ a v:2 blob (43 keys, no cargoSevers) ALSO reads empty — never exported with an undefined column");

  // A seeded v:3 blob round-trips.
  const freshRows = [{ t: 1, level: 1, score: 0, chainLen: 2, cargoMax: 8, cargoSevers: 4 }];
  const v3Store = { [key]: JSON.stringify({ v: 3, rows: freshRows }) };
  const Z = buildGame({ store: v3Store });
  eq(Z.Telemetry.read().length, 1, "G: a v:3 blob reads back its rows");
  eq(Z.Telemetry.read()[0].chainLen, 2, "G: ...with their content intact");

  // read() and write() key off the SAME expression, at both sites.
  const readKeySite = X.Profiles.keyFor(X.TELEMETRY_KEY);
  eq(readKeySite, key, "G: read() and write() resolve the identical key");
}

// ===== (H) the sawtooth: cargoDamageEvents RESETS on a guard DROP, cargoSevers never does =========
// The section §F could not be: it drives the REAL paths (breakChain's sever, dropPowerup's reset)
// instead of incrementing game.stats by hand, which is why §F passed for a whole changeset while
// asserting something the build violates on every guard drop. TRAP: the reset fires when a guard is
// SELECTED TO DROP, not when one is picked up (CS035 P6 / FORK-T) — so it lands with guardPicked
// still 0, and a log can show more resets than pickups. GATE T's capture: 7 resets, 6 guardPicked.
console.log("(H) cargoDamageEvents is a sawtooth pity counter; cargoSevers is the cumulative run total");
{
  const X = buildGame();
  X.startGame();
  const g = X.game;
  // A tow long enough to clear DEBUG.chainGuardMinTow, so "guard" is eligible in the drop roll at all.
  const fill = n => { for (let i = 0; i < n; i++) pushNode(X); };
  const minTow = X.DEBUG.chainGuardMinTow;

  fill(minTow + 1); X.breakChain(0);
  eq(g.stats.cargoDamageEvents, 1, "H: a sever bumps the pity counter");
  eq(g.stats.cargoSevers, 1, "H: ...and the cumulative counter, on the same event");
  fill(minTow + 1); X.breakChain(0);
  eq(g.stats.cargoDamageEvents, 2, "H: (setup) pity at 2");
  eq(g.stats.cargoSevers, 2, "H: (setup) cumulative at 2");

  // Roll drops until one selects "guard". guardDropWeight() rises with the pity counter, so this
  // terminates fast; the bound is a runaway guard, not a tuning assumption.
  fill(minTow + 1);
  const picked0 = g.stats.guardPicked;
  let rolls = 0;
  while (g.stats.cargoDamageEvents > 0 && rolls < 5000) { X.dropPowerup(100, 100); rolls++; }
  assert(rolls < 5000, "H: (setup) a guard was selected to drop");

  eq(g.stats.cargoDamageEvents, 0, "H: ⛔ a guard DROP zeroes the pity counter — it DECREASES, it is not cumulative");
  eq(g.stats.guardPicked, picked0, "H: ⛔ ...with guardPicked UNMOVED — the reset is on selection, never on pickup");
  eq(g.stats.cargoSevers, 2, "H: ⛔ cargoSevers is untouched by the reset — it is the run total an analysis reads");

  // And the telemetry row carries both, so an offline reader can see the sawtooth for what it is.
  X.applyDebug("telemetryCapture", 1);
  X.Telemetry.push();
  const row = X.Telemetry.rows[X.Telemetry.rows.length - 1];
  eq(row.cargoDamageEvents, 0, "H: the row carries the live pity value");
  eq(row.cargoSevers, 2, "H: ...alongside the run total, in the adjacent column");
}

A.report();
