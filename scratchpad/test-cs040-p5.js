// Headless test for CS040 P5 — telemetry v4 (PLANNED-FEATURES-CS040.md §3). This phase owns
// TELEMETRY_FIELDS (44 -> 49), the matching Telemetry.push() lines, TELEMETRY_MAX (400 -> 800),
// TELEMETRY_PERSIST_EVERY, Telemetry.flush() and its killShip() call site, the wrapped/endFlushed
// latches, the envelope at v:4, and the header block at nine lines.
//
// ⛔ THE TRAP THIS FILE EXISTS FOR (§C): scoopHits is a SAWTOOTH. damageShip() zeroes it on every
// scoop LEVEL LOSS, so it counts hits since the last loss, never the run — the second column in this
// schema with that shape, after cargoDamageEvents. Both were/are easy to document as cumulative:
// cargoDamageEvents was, in three places at once, for the whole of CS039, and GATE T's first real
// capture showed 7 decreases in 53 rows. §C drives a REAL level loss rather than trusting the name,
// and the monotonicity walk excludes both columns BY NAME.
// Second trap (§D): killShip() runs in update()'s collision pass and Telemetry.tick() runs later in
// the SAME frame, so a flush on a frame a snapshot was already due must not land two rows.
//
//   node scratchpad/test-cs040-p5.js

"use strict";
const { installSeed } = require("./_seeded-random.js");
installSeed(20260826);

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const A = mkAssert();
const { assert, eq } = A;

const DT = 1 / 60;
const repoRoot = path.join(__dirname, "..");

// The 49 columns, pinned as a literal in the order the CSV emits them (spec §3.1-§3.4).
const FIELDS_V4 = [
  "t", "level", "score", "hp", "speed",
  "rapidLeft", "tripleLeft", "magnetLeft", "engineLeft", "guardLeft", "scoopLevel",
  "rapidPicked", "triplePicked", "healthPicked", "magnetPicked", "enginePicked", "scoopPicked", "guardPicked",
  "dmgDebris3", "dmgDebris2", "dmgDebris1",
  "dmgHunter3", "dmgHunter2", "dmgHunter1",
  "dmgUfoBodyLarge", "dmgUfoBodySmall", "dmgUfoShotLarge", "dmgUfoShotSmall",
  "chainLen", "cargoMax",
  "hunterCount", "debrisCount", "garbageCount", "healthBanked",
  "delivered", "deliveryScore", "cargoDamageEvents", "cargoSevers",
  "debrisKills", "hunterKills", "saucerKills", "hunterCoalesced",
  "deflects", "hitsTaken", "hpWasted",
  "scoreScoopBonus", "scoopHits",
  "debugRun", "resumedRun",
];
// ⛔ NEITHER cumulative NOR instantaneous. Excluded from every monotonicity walk BY NAME (§C).
const SAWTOOTH = ["cargoDamageEvents", "scoopHits"];
// The cumulative group as of v4 — hpWasted joins it, scoreRepairBonus leaves the schema entirely.
const CUMULATIVE = [
  "delivered", "deliveryScore", "cargoSevers",
  "debrisKills", "hunterKills", "saucerKills", "hunterCoalesced",
  "deflects", "hitsTaken", "hpWasted", "scoreScoopBonus",
];

const capture = (X) => { X.startGame(); X.applyDebug("telemetryCapture", 1); return X.game; };
const lastRow = (X) => X.Telemetry.rows[X.Telemetry.rows.length - 1];
const hdr = (X, rows, from) => X.telemetryHeaderLines(rows, from);
// A hit that really reaches damageShip()'s body: no auto-shield save, no shield, no i-frame.
function hit(X, amount = 1) {
  X.settings.autoShield = false;
  X.game.ship.shieldOn = false;
  X.game.ship.invuln = 0;
  return X.damageShip(amount, X.game.ship.x + 30, X.game.ship.y, "debris1");
}

// ================= (A) the schema: 49 columns, and scoreRepairBonus is gone everywhere ============
(function sectionA() {
  console.log("(A) TELEMETRY_FIELDS is 49 columns in the v4 order; scoreRepairBonus is gone everywhere");
  const html = fs.readFileSync(path.join(repoRoot, "orbital-overhaul.html"), "utf8");
  const tmp = path.join(repoRoot, "scratchpad", "_cs040p5_extracted.js");
  fs.writeFileSync(tmp, html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  try {
    execSync(`node --check "${tmp}"`, { stdio: "pipe" });
    assert(true, "A: node --check on the extracted <script>");
  } catch (e) {
    assert(false, "A: node --check: " + e.stderr.toString());
  } finally { fs.unlinkSync(tmp); }

  const X = buildGame();
  eq(X.TELEMETRY_FIELDS.length, 49, "A: 49 columns (44 - scoreRepairBonus + 6)");
  eq(X.TELEMETRY_FIELDS.join(","), FIELDS_V4.join(","), "A: ⛔ the column ORDER is the pinned v4 order");

  // ⛔ The row shape and the column order are one source of truth, so push() must agree with the list
  // key for key AND in order — not merely overlap with it.
  capture(X);
  X.Telemetry.push();
  const row = lastRow(X);
  eq(Object.keys(row).join(","), FIELDS_V4.join(","),
    "A: ⛔ push()'s own key order IS TELEMETRY_FIELDS — the two are edited in lockstep");

  const csv = X.telemetryCSV(X.Telemetry.rows, "this run").split("\n").filter(l => l.length && !l.startsWith("#"));
  eq(csv[0], FIELDS_V4.join(","), "A: the CSV header line is that same order");
  eq(csv[1].split(",").length, 49, "A: ...and a data line has 49 cells");

  assert(!X.TELEMETRY_FIELDS.includes("scoreRepairBonus"), "A: scoreRepairBonus is not a column");
  assert(!("scoreRepairBonus" in row), "A: ...not a key on a pushed row");
  assert(!csv[0].includes("scoreRepairBonus"), "A: ...and not in the exported header");
  // The identifier itself is gone from live code — only comments (stripped here) still name it.
  eq(execSource(scriptSource()).split("scoreRepairBonus").length - 1, 0,
    "A: ⛔ zero live occurrences of the identifier anywhere in the build");
})();

// ================= (B) the six new columns read their real sources ================================
(function sectionB() {
  console.log("(B) the four population/reserve columns, hpWasted and scoopHits read the live state");
  const X = buildGame();
  const g = capture(X);

  // Real entities into the real arrays, then one snapshot: the columns are the arrays' own lengths.
  g.debris = [new X.DebrisSatellite(100, 100, 3), new X.DebrisSatellite(200, 200, 2)];
  g.hunters = [new X.HunterSatellite(300, 300, 3), new X.HunterSatellite(310, 300, 2),
               new X.HunterSatellite(320, 300, 1)];
  g.garbage = [new X.Garbage(400, 400)];
  g.healthBank = 1;
  g.stats.hpWasted = 7;
  g.scoopLevel = 2; g.scoopHits = 3;
  X.Telemetry.push();
  const r = lastRow(X);
  // ⛔ INVERTED VOCABULARY, ON PURPOSE: game.debris holds GARBAGE SATELLITES and game.garbage holds
  // towable DEBRIS (CLAUDE.md). The columns carry the build's names; the assertions pin the ARRAYS.
  eq(r.debrisCount, g.debris.length, "B: debrisCount tracks game.debris (the Garbage Satellites)");
  eq(r.debrisCount, 2, "B: ...at its actual length");
  eq(r.garbageCount, g.garbage.length, "B: garbageCount tracks game.garbage (the towable Debris)");
  eq(r.hunterCount, g.hunters.length, "B: hunterCount tracks game.hunters");
  eq(r.hunterCount, 3, "B: ...at its actual length");
  eq(r.healthBanked, 1, "B: healthBanked is game.healthBank");
  eq(r.hpWasted, 7, "B: hpWasted is game.stats.hpWasted (CS040 P3's counter)");
  eq(r.scoopHits, 3, "B: scoopHits is game.scoopHits");

  // They are INSTANTANEOUS — a later snapshot reports the field as it then is, not a running total.
  g.debris.pop(); g.hunters.length = 0; g.healthBank = 0;
  X.Telemetry.push();
  const r2 = lastRow(X);
  eq(r2.debrisCount, 1, "B: ⛔ debrisCount FALLS with the array — instantaneous, not cumulative");
  eq(r2.hunterCount, 0, "B: hunterCount falls to 0 with the array");
  eq(r2.healthBanked, 0, "B: healthBanked falls when the charge is spent");
})();

// ================= (C) ⛔ THE TRAP: scoopHits is a SAWTOOTH ======================================
(function sectionC() {
  console.log("(C) ⛔ scoopHits RESETS on a scoop level loss — driven through the real damageShip()");
  const X = buildGame();
  const g = capture(X);
  const per = X.DEBUG.scoopHitsPerLevel;
  assert(per >= 2, "C: (setup) the knob leaves room for a rise before the loss");

  g.ship.hp = X.SHIP_MAX_HP;
  g.scoopLevel = 2;
  g.scoopHits = 0;
  // One snapshot per hit, all the way through a genuine level loss.
  for (let i = 0; i < per; i++) {
    assert(hit(X, 1), `C: (setup) hit ${i + 1} landed on the hull`);
    X.Telemetry.push();
  }
  const seq = X.Telemetry.rows.map(r => r.scoopHits);
  eq(g.scoopLevel, 1, "C: (setup) the scoop level was really lost");
  eq(seq[per - 2], per - 1, "C: the column climbs with the hits");
  eq(seq[per - 1], 0, "C: ⛔ AND FALLS TO 0 ON THE LOSS — a sawtooth, not a counter");
  assert(seq[per - 1] < seq[per - 2], "C: ⛔ a strictly DECREASING step exists in a real capture");
  eq(g.scoopHits, 0, "C: ...matching the live counter the column reads");

  // ⛔ And the walk that would have caught cargoDamageEvents: every cumulative column is monotone,
  // and the two sawtooths are excluded BY NAME rather than by hoping they behave.
  for (const f of SAWTOOTH) assert(X.TELEMETRY_FIELDS.includes(f), `C: ${f} is a column at all`);
  const Y = buildGame();
  const gy = capture(Y);
  gy.ship.hp = Y.SHIP_MAX_HP;
  gy.scoopLevel = 3; gy.scoopHits = 0;
  for (let step = 0; step < per * 2; step++) {
    for (const f of CUMULATIVE) gy.stats[f] += 2;
    hit(Y, 1);
    Y.Telemetry.push();
  }
  const rows = Y.Telemetry.rows;
  assert(rows.length > per, "C: (setup) the walk has rows spanning at least one loss");
  for (const f of CUMULATIVE) {
    for (let i = 1; i < rows.length; i++)
      assert(rows[i][f] >= rows[i - 1][f], `C: ${f} is monotone non-decreasing at row ${i}`);
  }
  let dips = 0;
  for (let i = 1; i < rows.length; i++) if (rows[i].scoopHits < rows[i - 1].scoopHits) dips++;
  assert(dips >= 1, "C: ⛔ the excluded column really does dip in that same run (else §C proves nothing)");
})();

// ================= (D) the game-over flush: one row, on the real frame ===========================
(function sectionD() {
  console.log("(D) killShip() flushes one final row, and a snapshot due the same frame does not double it");
  // The control: the identical frame WITHOUT a death does land its scheduled row.
  {
    const X = buildGame();
    const g = capture(X);
    X.applyDebug("telemetryInterval", 5);
    X.Telemetry.acc = X.DEBUG.telemetryInterval - DT / 2;   // a snapshot is due THIS frame
    X.update(DT);
    eq(X.Telemetry.rows.length, 1, "D: (control) the scheduled snapshot lands on that frame");
    eq(g.stats.gameEnded, false, "D: (control) ...with nobody dying");
  }
  // The real thing: a lethal collision in update()'s own collision pass, on a frame a snapshot was
  // already due. killShip() flushes; Telemetry.tick() runs LATER in the same frame and must not push.
  {
    const X = buildGame();
    const g = capture(X);
    X.applyDebug("telemetryInterval", 5);
    X.settings.autoShield = false;
    g.levelEndSafe = false;
    g.ship.invuln = 0; g.ship.shieldOn = false; g.ship.hp = 1;
    const rock = new X.DebrisSatellite(g.ship.x, g.ship.y, 1);
    assert(rock.damage >= 1, "D: (setup) the hazard's contact damage is lethal at 1 HP");
    g.debris = [rock];
    X.Telemetry.acc = X.DEBUG.telemetryInterval - DT / 2;   // ...and a snapshot is due, as above
    X.update(DT);
    assert(g.ship.dead, "D: (setup) the collision really killed the ship");
    eq(g.stats.gameEnded, true, "D: ...and the run is flagged over");
    eq(X.Telemetry.rows.length, 1, "D: ⛔ EXACTLY ONE ROW — the flush, not the flush plus the snapshot");
    eq(lastRow(X).hp, 0, "D: ...and it is the death frame: the hull reads 0");
    eq(X.Telemetry.endFlushed, true, "D: the latch the header reports is set");
    assert(X.Telemetry.acc < X.DEBUG.telemetryInterval, "D: the accumulator was zeroed, not left due");
    eq(hdr(X, X.Telemetry.rows, "this run")[6], "# finalRowIsGameOver=true",
      "D: ⛔ the header says the last row IS the game over");

    // A second call cannot double it — killShip() early-returns on an already-dead ship.
    X.killShip();
    eq(X.Telemetry.rows.length, 1, "D: a second killShip() adds nothing");
  }
  // Capture OFF: the flush is gated exactly like tick(), so an off session stays silent.
  {
    const store = {};
    const X = buildGame({ store });
    X.startGame();
    eq(X.DEBUG.telemetryCapture, 0, "D: (setup) capture is off");
    X.game.ship.hp = 1;
    hit(X, 50);
    eq(X.game.stats.gameEnded, true, "D: (setup) the ship still died");
    eq(X.Telemetry.rows.length, 0, "D: ⛔ no flush row with capture off");
    eq(X.Telemetry.endFlushed, false, "D: ...and the latch stays clear");
    assert(!(X.Profiles.keyFor(X.TELEMETRY_KEY) in store), "D: ...and afd_telemetry_v1 is untouched");
  }
})();

// ================= (E) the persist cadence, and the flush's override of it =======================
(function sectionE() {
  console.log("(E) one write per four snapshots (FORK-CS040-D) — and the flush always writes");
  const store = {};
  const X = buildGame({ store });
  capture(X);
  const key = X.Profiles.keyFor(X.TELEMETRY_KEY);
  eq(X.TELEMETRY_PERSIST_EVERY, 4, "E: the cadence const is 4");
  eq(X.Telemetry.sincePersist, 0, "E: a fresh run starts the cycle at 0");

  for (let i = 1; i <= 3; i++) {
    X.Telemetry.push();
    assert(!(key in store), `E: snapshot ${i} of 4 does NOT write`);
    eq(X.Telemetry.sincePersist, i, `E: ...and the counter stands at ${i}`);
  }
  X.Telemetry.push();
  assert(key in store, "E: ⛔ the FOURTH snapshot writes");
  eq(X.Telemetry.sincePersist, 0, "E: ...and the cycle restarts");
  eq(JSON.parse(store[key]).rows.length, 4, "E: the whole buffer went out, not just the new row");

  // Mid-cycle, the flush writes anyway — this is the row that cannot wait for a snapshot that will
  // never come, because the run is over.
  X.Telemetry.push(); X.Telemetry.push();
  eq(X.Telemetry.sincePersist, 2, "E: (setup) the counter is mid-cycle");
  eq(JSON.parse(store[key]).rows.length, 4, "E: (setup) ...and the store still lags at 4 rows");
  X.Telemetry.flush();
  eq(X.Telemetry.rows.length, 7, "E: the flush pushed its row");
  eq(JSON.parse(store[key]).rows.length, 7, "E: ⛔ AND PERSISTED IT, mid-cycle");
  eq(X.Telemetry.sincePersist, 0, "E: ...restarting the cycle, since the buffer really was persisted");
  eq(JSON.parse(store[key]).endFlushed, true, "E: the envelope carries the game-over latch");

  // reset() clears the counter with everything else.
  X.Telemetry.push();
  eq(X.Telemetry.sincePersist, 1, "E: (setup) the counter is off zero");
  X.Telemetry.reset();
  eq(X.Telemetry.sincePersist, 0, "E: ⛔ reset() clears the persist counter");
  eq(X.Telemetry.rows.length, 0, "E: ...with the buffer");
  eq(X.Telemetry.endFlushed, false, "E: ...and the game-over latch");
})();

// ================= (F) the 800-row ring and the wrapped latch ====================================
(function sectionF() {
  console.log("(F) TELEMETRY_MAX is 800; the 801st push drops the oldest and latches wrapped");
  const X = buildGame();
  const g = capture(X);
  eq(X.TELEMETRY_MAX, 800, "F: the cap is 800 rows (FORK-CS040-D, was 400)");

  for (let i = 0; i < 800; i++) { g.score = i; X.Telemetry.push(); }
  eq(X.Telemetry.rows.length, 800, "F: 800 pushes fill the ring exactly");
  eq(X.Telemetry.rows[0].score, 0, "F: ...with the very first row still in it");
  eq(X.Telemetry.wrapped, false, "F: ⛔ a full-but-not-overrun ring has NOT wrapped");
  eq(hdr(X, X.Telemetry.rows, "this run")[5], "# ringWrapped=false", "F: ...and the header says so");

  g.score = 800; X.Telemetry.push();
  eq(X.Telemetry.rows.length, 800, "F: the 801st push does not grow the buffer");
  eq(X.Telemetry.rows[0].score, 1, "F: ⛔ the OLDEST row rolled off");
  eq(X.Telemetry.rows[799].score, 800, "F: ...and the newest is kept");
  eq(X.Telemetry.wrapped, true, "F: ⛔ the wrap is LATCHED — the log's opening is missing");
  eq(hdr(X, X.Telemetry.rows, "this run")[5], "# ringWrapped=true", "F: ...and the header reports it");

  // The latch is per-run: it survives further pushes and dies with the buffer.
  X.Telemetry.push();
  eq(X.Telemetry.wrapped, true, "F: the latch stays set for the rest of the run");
  X.Telemetry.reset();
  eq(X.Telemetry.wrapped, false, "F: ⛔ reset() clears it — a fresh run has not wrapped");
  eq(hdr(X, [], "this run")[5], "# ringWrapped=false", "F: ...and the header agrees");
})();

// ================= (G) the header block: nine lines, v4, and a storage export tells the truth =====
(function sectionG() {
  console.log("(G) nine header lines in the §3.6 order; a storage export reads both latches back");
  const X = buildGame();
  const lines = hdr(X, [], "this run");
  eq(lines.length, 9, "G: nine header lines (was seven)");
  for (const l of lines) assert(l.startsWith("# "), `G: every line is a # comment ("${l}")`);
  eq(lines[0], "# orbital-overhaul telemetry v4", "G: line 1 names the format and the envelope's v");
  eq(lines[4], "# rows=0", "G: rows= is still line 5");
  eq(lines[5].split("=")[0], "# ringWrapped", "G: ⛔ ringWrapped is line 6, above source=");
  eq(lines[6].split("=")[0], "# finalRowIsGameOver", "G: ⛔ finalRowIsGameOver is line 7");
  eq(lines[7], "# source=this run", "G: source= moved down to line 8");
  eq(lines[8].split("=")[0], "# levers", "G: levers= is still last");

  // ⛔ THE MORNING-AFTER CASE. The live ring is empty and the persisted one holds a wrapped,
  // death-terminated run: reading the live latches here would report it as neither.
  const store = {};
  const key = "afd_telemetry_v1";
  store[key] = JSON.stringify({ v: 4, rows: [{ t: 1, level: 3, score: 9 }], wrapped: true, endFlushed: true });
  const Y = buildGame({ store });
  const src = Y.telemetryExportRows();
  eq(src.from, "storage", "G: (setup) the export falls back to storage");
  eq(src.rows.length, 1, "G: (setup) ...and recovers the stored row");
  eq(Y.Telemetry.wrapped, false, "G: (setup) the LIVE latches are both clear this session");
  eq(Y.Telemetry.endFlushed, false, "G: (setup) ...both of them");
  const sh = hdr(Y, src.rows, "storage");
  eq(sh[5], "# ringWrapped=true", "G: ⛔ the header reports the STORED run's wrap, not the live one");
  eq(sh[6], "# finalRowIsGameOver=true", "G: ⛔ ...and its game-over flush");
  eq(sh[7], "# source=storage", "G: ...and names where that came from");

  // The envelope is v:4, and a v:3 blob (scoreRepairBonus, none of the six new keys) reads EMPTY —
  // exporting it would print the literal "undefined" in six columns.
  const store2 = {};
  const Z = buildGame({ store: store2 });
  capture(Z);
  for (let i = 0; i < 4; i++) Z.Telemetry.push();
  eq(JSON.parse(store2[Z.Profiles.keyFor(Z.TELEMETRY_KEY)]).v, 4, "G: write() stamps the envelope v:4");
  store2[key] = JSON.stringify({ v: 3, rows: [{ t: 1, scoreRepairBonus: 0 }] });
  const W = buildGame({ store: store2 });
  eq(W.Telemetry.read().length, 0, "G: ⛔ a v:3 blob reads back EMPTY — never exported with undefined columns");
  eq(W.Telemetry.readEnvelope().wrapped, false, "G: ...and its latches degrade to false with it");
})();

A.report();
