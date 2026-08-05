// Headless test for CS017 Phase 2 — dev-only difficulty logging + a debug-panel CSV dump. Nothing
// player-visible; nothing persisted (DiffLog never touches localStorage). One snapshot row is pushed by
// the REAL nextWave(), capped at DIFFLOG_MAX (drop oldest), cleared by the REAL startGame(), and exported
// as CSV via a "Dump difficulty log" action row inserted into the CS015 P4 debug panel between the value
// rows and Back. All of that MECHANISM is P2's contract and is unchanged.
//
// **REPOINTED BY CS018 P4 — the COLUMN LIST changed.** P2 declared DIFFLOG_FIELDS frozen, which was right
// while the cycle clock was the thing being observed; P4 retires that clock, so four columns (`cycle`,
// `cycleWave`, `hunterSpeedFrac`, `hunterTurnFrac`) described machinery that no longer exists — the last
// two would log a fixed 0.58 forever now that Hunter speed/turn are frozen constants. They are replaced by
// what the level table actually decides: level/phase/rel/junkCount/junkSpeedMul/maxLargeHunters, the seven
// tier NAMES, and prevLevelSecs (FLAG-k). Sections (B), (D) and (E) follow the new shape; (C), (F), (G) and
// (H) test the mechanism and are untouched.
//
//   node scratchpad/test-cs017-p2.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL nextWave()/startGame()/menuDebug()/drawDebug()/dumpDifficultyLog()
// — never reimplement the logging or CSV logic under test. Section (B) cross-checks each snapshot field
// against the REAL levelDef()/junkSpeedMul()/ramp() helpers and live constants, never a re-derived formula.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs017p2_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try {
    execSync(`node --check "${tmp}"`, { stdio: "pipe" });
    passed++;
  } catch (e) {
    failed++;
    console.error("  FAIL: node --check: " + e.stderr.toString());
  } finally {
    fs.unlinkSync(tmp);
  }
})();

// A canvas ctx robust enough for the full draw()/menuPanel() path headless: measureText returns a width,
// gradients return an addColorStop-able object, everything else no-ops.
function makeCtx(canvasStub) {
  return new Proxy({}, {
    get(t, prop) {
      if (prop === "measureText") return () => ({ width: 0 });
      if (prop === "canvas") return canvasStub;
      if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => ({ addColorStop: () => {} });
      return () => {};
    },
    set() { return true; }
  });
}

const RETURN = [
  "startGame", "update", "nextWave", "game", "settings",
  "DiffLog", "DIFFLOG_MAX", "DIFFLOG_FIELDS",
  "logDifficultySnapshot", "difficultyLogCSV", "dumpDifficultyLog",
  "DEBUG_VARS", "menuDebug", "drawDebug", "debugReturn",
  "ramp", "difficultyFactor", "HUNTER_FLOOR_FRAC",
  "levelDef", "junkSpeedMul", "largeHunterCap",                                        // CS018 P4 repoint
  "DEBUG",                                                    // CS018 P6 (section B: tiered saucer gap)
  "ufoAccuracyRad",                                    // CS018 P7 (section B: tiered saucer aim error)
  "SAUCER_GAP_FLOOR_MIN", "SAUCER_GAP_CEIL_MIN", "SAUCER_GAP_FLOOR_MAX", "SAUCER_GAP_CEIL_MAX",
  "AudioSys",
  // CS021 P2 REPOINT (section B): the orbit archetype's total is occurrence-scaled now, not the fixed 40
  // P1 shipped — orbitTotalAt() below recomputes it from these.
  "generateOrbitLayout", "orbitGapMult", "activeRingsFor", "SHIP_RADIUS", "DEBRIS_RADII",
  "ORBIT_RING_COUNT", "ORBIT_INNER_RADIUS", "ORBIT_RADIUS_STEP", "ORBIT_SAFETY_MARGIN",
  "ORBIT_DENSITY", "ORBIT_ANG_VEL", "ORBIT_FAST_RING", "ORBIT_FAST_MULT"
];

// CS021 P2 REPOINT helper (section B): see test-cs017-p1.js's identical helper for the full rationale —
// the total now climbs from 40 (occurrence 1) to 45 (the floor), recomputed from the same generator +
// occurrence-scaled multiplier nextWave() is wired to, rather than a restated level-40 literal.
// EXTENDED BY CS022 P3 — the third rewrite of this helper, and the reason it is a helper at all: it
// recomputes what an orbit level's nextWave() ACTUALLY SPAWNS from the same generator, ramp and level
// table the shipped code is wired to, so a geometry or schedule move fails as a wiring mismatch rather
// than as a stale literal. Two parts are new this changeset:
//   * THE RING RAMP (FORK-CS022-E) — activeRingsFor(level) selects rings outermost-first, so occurrence 1
//     lays only ring 4 and all four are present from occurrence 4 (level 12) onward;
//   * THE FIELD COMPONENT (FORK-CS022-F) — levelDef(level).fieldCount ordinary scatter satellites ON TOP
//     of the rings, which is exactly what retires CS021's "junkCount is not consumed on an orbit level"
//     rule (spec Correction C6) and is why this returns a SUM rather than layout.total.
function orbitTotalAt(A, level) {
  const ringTotal = A.generateOrbitLayout({
    satelliteDiameter: A.DEBRIS_RADII[3] * 2,
    shipDiameter:      A.SHIP_RADIUS * 2,
    centerX: 0, centerY: 0,
    orbitCount:        A.ORBIT_RING_COUNT,
    innerRadius:       A.ORBIT_INNER_RADIUS,
    radiusStep:        A.ORBIT_RADIUS_STEP,
    safetyMargin:      A.ORBIT_SAFETY_MARGIN,
    minGapMultiplier:  A.orbitGapMult(level),
    densityByOrbit:    A.ORBIT_DENSITY,
    baseAngVel:        A.ORBIT_ANG_VEL,
    // REPOINTED BY CS023 P1 (spec C3): ORBIT_FAST_RING is a LIST of 1-based ring numbers and the
    // generator's parameter is the plural `fastRingIndices`. This helper only reads `.total`, so the
    // stale scalar key would have gone on passing while quietly making every ring slow — a wiring
    // mismatch that means nothing here today and would mislead the moment anyone read angVel off it.
    fastRingIndices:   A.ORBIT_FAST_RING.map(n => n - 1),
    fastRingMult:      A.ORBIT_FAST_MULT,
    activeRings:       A.activeRingsFor(level),   // CS022 P3: the ramp, read from the shipped helper
  }).total;
  return ringTotal + A.levelDef(level).fieldCount; // CS022 P3: rings PLUS the field component
}

// documentStub.createElement is tag-aware (unlike earlier CS015/CS017-P1 tests, which always returned
// the canvas stub): "a" gets a real-enough anchor object (href/download/click) so the dump's download
// path can be exercised end-to-end without throwing, and its result inspected.
function build() {
  const canvasStub = { width: 1280, height: 720, style: {} };
  canvasStub.getContext = () => makeCtx(canvasStub);
  const created = [];
  const documentStub = {
    getElementById: () => canvasStub,
    createElement: (tag) => {
      created.push(tag);
      if (tag === "a") return { href: "", download: "", _clicked: false, click() { this._clicked = true; } };
      return canvasStub;
    }
  };
  const listeners = {};
  const windowStub = {
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    innerWidth: 1280, innerHeight: 720,
    AudioContext: undefined, webkitAudioContext: undefined
  };
  const performanceStub = { now: () => 100000 };
  const rafStub = () => 0;
  const navigatorStub = { getGamepads: () => [] };
  const lsStore = {};
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  const exports = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, localStorageStub);
  return { exports, created };
}

// The seven graded levers log a TIER NAME, not a number — the one non-numeric column group in the row.
const TIER_FIELDS = ["junkSpeed", "ufoAppearFreq", "ufoFlightSpeed", "ufoDirChangeFreq",
                     "ufoFireFreq", "ufoAccuracy", "ufoShotSpeed"];
const TIER_NAMES = ["low", "normal", "high"];

// ================= (B) one row per nextWave(), every field present/finite, matches the live sites =====
(function sectionB() {
  console.log("(B) logDifficultySnapshot: one row per nextWave(), fields match the SAME live expressions");
  const { exports: A } = build();
  const g = A.game;
  A.startGame(); // wave 1 -> one row
  assert(A.DiffLog.rows.length === 1, `B: startGame() (which calls nextWave() once) pushed exactly one row (got ${A.DiffLog.rows.length})`);

  for (let w = 2; w <= 15; w++) {
    g.debris = []; // simulate the field-clear precondition nextWave() itself doesn't enforce (CS017 P1 test convention)
    A.nextWave();
    assert(A.DiffLog.rows.length === w, `B: wave ${w}: exactly one new row per nextWave() call (got ${A.DiffLog.rows.length})`);

    const row = A.DiffLog.rows[A.DiffLog.rows.length - 1];
    for (const f of A.DIFFLOG_FIELDS) {
      assert(f in row, `B: wave ${w}: row has field "${f}"`);
      if (TIER_FIELDS.includes(f)) {
        assert(TIER_NAMES.includes(row[f]), `B: wave ${w}: tier field "${f}" is a tier name (got ${row[f]})`);
      } else {
        assert(typeof row[f] === "number" && Number.isFinite(row[f]), `B: wave ${w}: field "${f}" is a finite number (got ${row[f]})`);
      }
    }

    assert(row.level === g.wave, `B: wave ${w}: row.level matches game.wave`);
    assert(row.score === g.score, `B: wave ${w}: row.score matches game.score`);
    assert(row.hunterCount === g.hunters.length, `B: wave ${w}: row.hunterCount matches game.hunters.length`);
    assert(row.chainLen === g.chain.length, `B: wave ${w}: row.chainLen matches game.chain.length`);
    assert(row.cargoMax === g.cargoMax, `B: wave ${w}: row.cargoMax matches game.cargoMax`);
    assert(row.scoopLevel === g.scoopLevel, `B: wave ${w}: row.scoopLevel matches game.scoopLevel`);
    assert(!("cycle" in row) && !("cycleWave" in row), `B: wave ${w}: the retired cycle columns are gone from the row`);
    assert(!("hunterSpeedFrac" in row) && !("hunterTurnFrac" in row), `B: wave ${w}: the retired Hunter-fraction columns are gone`);

    // REPOINTED BY CS018 P4: the level-table columns must agree with ONE levelDef(game.wave) call, so a
    // row can never disagree with itself about which level it describes. Built from the REAL levelDef()
    // and junkSpeedMul(), never re-derived arithmetic.
    const def = A.levelDef(g.wave);
    assert(row.phase === def.phase, `B: wave ${w}: row.phase expected ${def.phase}, got ${row.phase}`);
    assert(row.rel === def.rel, `B: wave ${w}: row.rel expected ${def.rel}, got ${row.rel}`);
    assert(row.junkCount === def.junkCount, `B: wave ${w}: junkCount expected ${def.junkCount}, got ${row.junkCount}`);
    // REPOINTED BY CS021 P1. The DiffLog's junkCount column still reports what the LEVEL TABLE decides
    // (asserted immediately above, unchanged); what changed is that only a FIELD level spawns that many
    // pieces. An ORBIT level (every 3rd — FORK-CS021-E) lays a ring layout around the dock, so the
    // sanity check is split rather than dropped.
    //
    // REPOINTED AGAIN BY CS022 P3, and this is the reversal spec Correction C6 names. An orbit level now
    // ALSO spawns levelDef(n-1).junkCount ordinary scatter satellites on top of its rings, so "every
    // satellite carries orbit state" is false by design. The claim becomes the SPLIT it always should
    // have been: the rail-borne population is exactly the ramp's ring total, the stateless population is
    // exactly the field component, and together they are the whole spawn. The DiffLog row above still
    // reports the level's OWN junkCount, which is now unread by the spawn (FLAG-CS022-g) and is still
    // asserted, because that column means "what the table says".
    if (def.archetype === "orbit") {
      const wantTotal = orbitTotalAt(A, g.wave);   // CS022 P3: rings (ramped) + the field component
      assert(g.debris.length === wantTotal, `B: wave ${w}: ORBIT level spawned the ${wantTotal}-satellite layout (got ${g.debris.length})`);
      const railBorne = g.debris.filter(d => !!d.orbitCenter).length;
      const scatter   = g.debris.length - railBorne;
      assert(scatter === def.fieldCount,
        `B: wave ${w}: the stateless population is exactly fieldCount (${def.fieldCount}, got ${scatter})`);
      assert(railBorne === wantTotal - def.fieldCount,
        `B: wave ${w}: ...and the rest (${railBorne}) all carry orbit state — the two populations account for the whole spawn`);
      assert(def.fieldCount === A.levelDef(g.wave - 1).junkCount,
        `B: wave ${w}: fieldCount is the PREVIOUS level's junkCount (spec §1.4)`);
    } else {
      assert(g.debris.length === row.junkCount, `B: wave ${w}: sanity — the FIELD level actually spawned junkCount pieces`);
      assert(g.debris.every(d => d.orbitCenter === undefined), `B: wave ${w}: no FIELD-level satellite carries orbit state`);
    }
    assert(Math.abs(row.junkSpeedMul - A.junkSpeedMul()) < 1e-9, `B: wave ${w}: junkSpeedMul matches the live helper`);
    assert(row.maxLargeHunters === def.maxLargeHunters, `B: wave ${w}: maxLargeHunters expected ${def.maxLargeHunters}, got ${row.maxLargeHunters}`);
    assert(row.maxLargeHunters === A.largeHunterCap(), `B: wave ${w}: maxLargeHunters equals the live largeHunterCap()`);
    for (const f of TIER_FIELDS) {
      assert(row[f] === def[f], `B: wave ${w}: tier "${f}" expected ${def[f]}, got ${row[f]}`);
    }

    // REPOINTED BY CS018 P7 (mirror-image of the old claim): saucerAimErr no longer mirrors
    // ramp()+SAUCER_ACCURACY_RAMP_SCALE — it logs the tier-derived ufoAccuracyRad() value directly.
    const expAimErr = A.ufoAccuracyRad();
    assert(Math.abs(row.saucerAimErr - expAimErr) < 1e-9, `B: wave ${w}: saucerAimErr expected ${expAimErr}, got ${row.saucerAimErr}`);
    // REPOINTED BY CS018 P6 (mirror-image of the old claim): saucerGapMin/saucerGapMax no longer mirror
    // ramp() — they log the jittered-interval bounds around the ufoAppearFreq TIER centre.
    const appearTier = def.ufoAppearFreq;
    const appearCenter = appearTier === "low" ? A.DEBUG.ufoAppearFreqLow : appearTier === "high" ? A.DEBUG.ufoAppearFreqHigh : A.DEBUG.ufoAppearFreqNormal;
    const appearJitter = A.DEBUG.freqJitter / 100;
    const expGapMin = appearCenter * (1 - appearJitter);
    const expGapMax = appearCenter * (1 + appearJitter);
    assert(Math.abs(row.saucerGapMin - expGapMin) < 1e-9, `B: wave ${w}: saucerGapMin expected ${expGapMin}, got ${row.saucerGapMin}`);
    assert(Math.abs(row.saucerGapMax - expGapMax) < 1e-9, `B: wave ${w}: saucerGapMax expected ${expGapMax}, got ${row.saucerGapMax}`);
    assert(row.prevLevelSecs === 0, `B: wave ${w}: prevLevelSecs is 0 when no frames were simulated`);
  }

  // CS018 P4 / FLAG-k: prevLevelSecs is game.waveTime captured BEFORE nextWave() zeroes it — the duration
  // of the level that just ENDED. This is the field's only reader, and it is the reason the capture has to
  // happen before the reset: reading game.waveTime after it would log a constant 0 forever.
  for (let i = 0; i < 90; i++) A.update(1 / 60);   // ~1.5 s of real play on the current level
  const elapsed = g.waveTime;
  assert(elapsed > 1.4 && elapsed < 1.6, `B: sanity — ~1.5 s accumulated on the level (got ${elapsed})`);
  g.debris = [];
  A.nextWave();
  const advanced = A.DiffLog.rows[A.DiffLog.rows.length - 1];
  assert(Math.abs(advanced.prevLevelSecs - elapsed) < 1e-9,
    `B: prevLevelSecs logs the FINISHED level's duration (expected ${elapsed}, got ${advanced.prevLevelSecs})`);
  assert(g.waveTime === 0, "B: game.waveTime itself is still zeroed for the new level");
})();

// ================= (C) startGame() clears the buffer ====================================================
(function sectionC() {
  console.log("(C) startGame() clears DiffLog.rows (only the fresh wave-1 row survives)");
  const { exports: A } = build();
  const g = A.game;
  A.startGame();
  for (let w = 2; w <= 6; w++) { g.debris = []; A.nextWave(); }
  assert(A.DiffLog.rows.length === 6, `C: sanity — 6 rows accumulated before restart (got ${A.DiffLog.rows.length})`);

  A.startGame(); // clears the buffer, then nextWave() (wave 1) pushes exactly one fresh row
  assert(A.DiffLog.rows.length === 1, `C: startGame() left exactly one row (the fresh wave 1 snapshot), got ${A.DiffLog.rows.length}`);
  assert(A.DiffLog.rows[0].level === 1, `C: the surviving row is level 1, not a stale level from before the restart`);
})();

// ================= (D) DIFFLOG_MAX caps the buffer, dropping oldest =====================================
(function sectionD() {
  console.log("(D) the buffer caps at DIFFLOG_MAX, dropping the oldest rows, and never exceeds it");
  const { exports: A } = build();
  const g = A.game;
  assert(A.DIFFLOG_MAX === 2000, `D: sanity — DIFFLOG_MAX is 2000 (got ${A.DIFFLOG_MAX})`);
  A.startGame(); // wave 1

  const totalWaves = A.DIFFLOG_MAX + 50; // push 50 more rows than the cap allows
  for (let w = 2; w <= totalWaves; w++) A.nextWave(); // debris left to accumulate; irrelevant to the cap test

  assert(A.DiffLog.rows.length === A.DIFFLOG_MAX, `D: buffer never exceeds DIFFLOG_MAX (got ${A.DiffLog.rows.length})`);
  const first = A.DiffLog.rows[0], last = A.DiffLog.rows[A.DiffLog.rows.length - 1];
  assert(first.level === totalWaves - A.DIFFLOG_MAX + 1, `D: oldest surviving row is level ${totalWaves - A.DIFFLOG_MAX + 1} (got ${first.level})`);
  assert(last.level === totalWaves, `D: newest row is the last level pushed (${totalWaves}, got ${last.level})`);
})();

// ================= (E) difficultyLogCSV(): header + N lines, values round-trip ==========================
(function sectionE() {
  console.log("(E) difficultyLogCSV() builds a header line + one line per row; values round-trip");
  const { exports: A } = build();
  // REPOINTED BY CS018 P4: the synthetic rows are built from the REAL levelDef() for their table columns
  // (hand-authoring 23 fields three times is exactly how a column list and a fixture drift apart), with the
  // runtime columns set to distinct literals so a wrong-column bug can't hide behind an equal value. Three
  // levels are chosen to span two phases and to move the tier columns off "low".
  A.DiffLog.rows = [1, 22, 63].map((lvl, i) => {
    const def = A.levelDef(lvl);
    const row = {
      t: 1000 + i, level: def.level, phase: def.phase, rel: def.rel,
      score: 300 * i, prevLevelSecs: 12.5 + i,
      junkCount: def.junkCount, junkSpeedMul: 0.8 + i * 0.1,
      maxLargeHunters: def.maxLargeHunters, hunterCount: i,
      saucerAimErr: 0.35 - i * 0.01, saucerGapMin: 20 - i, saucerGapMax: 30 - i,
      chainLen: 2 * i, cargoMax: 8 + i, scoopLevel: i,
    };
    for (const f of TIER_FIELDS) row[f] = def[f];
    return row;
  });
  // The fixture must cover the column list exactly — this is what stops a future column from being added
  // to the build and silently untested here.
  for (const f of A.DIFFLOG_FIELDS) assert(f in A.DiffLog.rows[0], `E: fixture covers column "${f}"`);
  assert(Object.keys(A.DiffLog.rows[0]).length === A.DIFFLOG_FIELDS.length,
    `E: fixture has no extra columns (fixture ${Object.keys(A.DiffLog.rows[0]).length} vs list ${A.DIFFLOG_FIELDS.length})`);
  assert(A.DiffLog.rows[2].junkSpeed === "high", "E: sanity — the level-63 fixture row is off the 'low' tier");

  const csv = A.difficultyLogCSV();
  const lines = csv.split("\n");
  assert(lines.length === 1 + A.DiffLog.rows.length, `E: header + N lines (expected ${1 + A.DiffLog.rows.length}, got ${lines.length})`);
  assert(lines[0] === A.DIFFLOG_FIELDS.join(","), "E: header line is exactly DIFFLOG_FIELDS joined by commas");

  for (let i = 0; i < A.DiffLog.rows.length; i++) {
    const cells = lines[i + 1].split(",");
    assert(cells.length === A.DIFFLOG_FIELDS.length, `E: row ${i}: cell count matches field count (got ${cells.length})`);
    A.DIFFLOG_FIELDS.forEach((f, j) => {
      const want = A.DiffLog.rows[i][f];
      // Tier columns are names, so they round-trip as text; every other column round-trips numerically.
      const got = TIER_FIELDS.includes(f) ? cells[j] : Number(cells[j]);
      assert(got === want, `E: row ${i}: field "${f}" round-trips (expected ${want}, got ${cells[j]})`);
    });
  }
})();

// ================= (F) dumpDifficultyLog(): success clears + downloads; empty is a silent no-op =========
(function sectionF() {
  console.log("(F) dumpDifficultyLog(): non-empty dumps, downloads, and clears; empty buffer no-ops (no download, no throw)");

  // --- empty buffer: negative blip only, no download attempt, no throw ---
  {
    const { exports: A, created } = build();
    const uiCalls = [];
    A.AudioSys.ui = up => uiCalls.push(up);
    assert(A.DiffLog.rows.length === 0, "F: sanity — fresh buffer starts empty");
    let threw = null;
    try { A.dumpDifficultyLog(); } catch (e) { threw = e; }
    assert(!threw, "F: dumping an empty buffer does not throw" + (threw ? ": " + threw : ""));
    assert(uiCalls.length === 1 && uiCalls[0] === false, `F: empty dump plays exactly one negative blip (got ${JSON.stringify(uiCalls)})`);
    assert(created.length === 0, "F: empty dump never calls document.createElement (no download attempted)");
  }

  // --- non-empty buffer: full download path (real Blob/URL are Node globals here), then clears ---
  {
    const { exports: A, created } = build();
    const g = A.game;
    A.startGame();
    for (let w = 2; w <= 5; w++) { g.debris = []; A.nextWave(); }
    assert(A.DiffLog.rows.length === 5, "F: sanity — 5 rows queued before the dump");
    const uiCalls = [];
    A.AudioSys.ui = up => uiCalls.push(up);
    let threw = null;
    try { A.dumpDifficultyLog(); } catch (e) { threw = e; }
    assert(!threw, "F: dumping a non-empty buffer does not throw" + (threw ? ": " + threw : ""));
    assert(A.DiffLog.rows.length === 0, "F: a successful dump clears the buffer");
    assert(uiCalls.length === 1 && uiCalls[0] === true, `F: a successful dump plays exactly one positive blip (got ${JSON.stringify(uiCalls)})`);
    assert(created.includes("a"), "F: a successful dump created a download anchor");
  }

  // --- guard proof: even without Blob/URL in scope (simulated headless/no-DOM), it still doesn't throw
  //     and the buffer still clears (the try/catch treats a failed download attempt as a no-op, not a
  //     blocker — only an EMPTY buffer skips the clear). Blob/URL are real Node globals in this test
  //     process (confirmed present), so they're removed here for the duration of this one call only.
  {
    const { exports: A } = build();
    const g = A.game;
    A.startGame();
    for (let w = 2; w <= 3; w++) { g.debris = []; A.nextWave(); }
    const uiCalls = [];
    A.AudioSys.ui = up => uiCalls.push(up);

    const hadBlob = "Blob" in globalThis, hadURL = "URL" in globalThis;
    const savedBlob = globalThis.Blob, savedURL = globalThis.URL;
    delete globalThis.Blob; delete globalThis.URL;
    let threw = null;
    try { A.dumpDifficultyLog(); } catch (e) { threw = e; }
    if (hadBlob) globalThis.Blob = savedBlob; else delete globalThis.Blob;
    if (hadURL) globalThis.URL = savedURL; else delete globalThis.URL;

    assert(!threw, "F: dumping with no Blob/URL global (simulated no-DOM) does not throw" + (threw ? ": " + threw : ""));
    assert(A.DiffLog.rows.length === 0, "F: the guarded download path still clears the buffer on the way out");
    assert(uiCalls.length === 1 && uiCalls[0] === true, "F: still plays the positive blip (a swallowed download failure is not treated as an empty-buffer no-op)");
  }
})();

// ================= (G) debug panel: navigation reaches the dump row, Back still works ====================
(function sectionG() {
  console.log("(G) menuDebug()/drawDebug(): the dump row is reachable; Back still works; indices derive from DEBUG_VARS.length");
  const { exports: A } = build();
  const g = A.game;
  const N = A.DEBUG_VARS.length, dumpRow = N, backRow = N + 1; // derived, never a literal (CS015 P5 lesson)

  // CS018 P2: the registry now interleaves non-selectable section-header entries, and up/down SKIP them, so
  // the cursor no longer starts at row 0 and "N downs" no longer equals "N rows travelled". dumpRow/backRow
  // are still N and N+1 (headers are registry entries; DEBUG_ROWS maps the registry 1:1 and appends the two
  // action rows) — step until we arrive instead of counting, and take the first row off the registry.
  const firstVar = A.DEBUG_VARS.findIndex(v => !v.header);
  g.paused = true; g.state = "title"; g.menu.screen = "debug"; g.menu.index = firstVar;
  let threw = null;
  try {
    A.drawDebug();
    for (let i = 0; i <= N && g.menu.index !== dumpRow; i++) A.menuDebug("down");
    assert(g.menu.index === dumpRow, `G: down reaches the dump row (index ${dumpRow}, got ${g.menu.index})`);
    A.drawDebug();

    A.menuDebug("down");
    assert(g.menu.index === backRow, `G: one more down lands on Back (index ${backRow}, got ${g.menu.index})`);
    A.drawDebug();

    A.menuDebug("down");
    assert(g.menu.index === firstVar, "G: down wraps from Back back to the first value row");

    A.menuDebug("up");
    assert(g.menu.index === backRow, "G: up wraps back to Back");

    // left/right on the dump row are inert (no value, no chevrons) — no crash, no state change.
    g.menu.index = dumpRow;
    A.menuDebug("left"); A.menuDebug("right");
    assert(g.menu.index === dumpRow, "G: left/right on the dump row is a no-op");
    A.drawDebug();
  } catch (e) { threw = e; }
  assert(!threw, "G: drawDebug()/menuDebug() did not throw while exercising the new row" + (threw ? ": " + threw : ""));

  // Confirm on the dump row triggers a dump (buffer clears) without leaving the panel.
  A.startGame();
  for (let w = 2; w <= 4; w++) { g.debris = []; A.nextWave(); }
  g.paused = true; g.state = "playing"; g.menu.screen = "debug"; g.menu.index = dumpRow;
  A.menuDebug("confirm");
  assert(A.DiffLog.rows.length === 0, "G: confirm on the dump row actually dumped (buffer cleared)");
  assert(g.menu.screen === "debug", "G: confirming the dump row does NOT leave the debug panel");

  // Confirm on Back still returns to context, from a paused live game.
  g.menu.index = backRow;
  A.menuDebug("confirm");
  assert(g.menu.screen === "root", "G: confirm on Back still routes to the root menu (Options) from a paused game");
  assert(g.paused === true, "G: still paused (a live game stays paused at its root)");
})();

// ================= (H) AudioSys.ctx null: full smoke across many waves + a dump, no crash ================
(function sectionH() {
  console.log("(H) AudioSys.ctx null: startGame()/nextWave()/dumpDifficultyLog() smoke, no throw");
  const { exports: A } = build();
  assert(A.AudioSys.ctx === null, "H: sanity — no AudioContext stub means AudioSys.ctx is null");
  const g = A.game;
  let threw = null;
  try {
    A.startGame();
    for (let w = 2; w <= 20; w++) { g.debris = []; A.nextWave(); }
    A.dumpDifficultyLog();
    assert(A.DiffLog.rows.length === 0, "H: the dump cleared the buffer under AudioSys.ctx === null too");
    A.dumpDifficultyLog(); // empty-buffer path, also under a null ctx
  } catch (e) { threw = e; }
  assert(!threw, "H: startGame()/nextWave()/dumpDifficultyLog() ran headless with AudioSys.ctx null without throwing" + (threw ? ": " + threw : ""));
})();

console.log(`\ntest-cs017-p2: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
