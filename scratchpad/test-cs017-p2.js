// Headless test for CS017 Phase 2 — dev-only difficulty logging + a debug-panel CSV dump. Nothing
// player-visible; nothing persisted (DiffLog never touches localStorage). One snapshot row is pushed by
// the REAL nextWave() (after the P1 cycle/cycleWave derivation), capped at DIFFLOG_MAX (drop oldest),
// cleared by the REAL startGame(), and exported as CSV via a "Dump difficulty log" action row inserted
// into the CS015 P4 debug panel between the value rows and Back.
//
//   node scratchpad/test-cs017-p2.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL nextWave()/startGame()/menuDebug()/drawDebug()/dumpDifficultyLog()
// — never reimplement the logging or CSV logic under test. Section (B) cross-checks each snapshot field
// against the REAL ramp()/difficultyFactor() helpers and live constants, never a re-derived formula.

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
  "cycleValue", "DEBRIS_COUNT_MAX", "DEBRIS_COUNT_HARD_MAX", "DEBRIS_SPEED_PER_WAVE", // CS017 P3 repoint
  "SAUCER_AIM_ERR_FLOOR", "SAUCER_AIM_ERR_CEIL", "SAUCER_ACCURACY_RAMP_SCALE",
  "SAUCER_GAP_FLOOR_MIN", "SAUCER_GAP_CEIL_MIN", "SAUCER_GAP_FLOOR_MAX", "SAUCER_GAP_CEIL_MAX",
  "AudioSys"
];

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
      assert(typeof row[f] === "number" && Number.isFinite(row[f]), `B: wave ${w}: field "${f}" is a finite number (got ${row[f]})`);
    }

    assert(row.wave === g.wave, `B: wave ${w}: row.wave matches game.wave`);
    assert(row.cycle === g.cycle, `B: wave ${w}: row.cycle matches game.cycle`);
    assert(row.cycleWave === g.cycleWave, `B: wave ${w}: row.cycleWave matches game.cycleWave`);
    assert(row.score === g.score, `B: wave ${w}: row.score matches game.score`);
    assert(row.hunterCount === g.hunters.length, `B: wave ${w}: row.hunterCount matches game.hunters.length`);
    assert(row.chainLen === g.chain.length, `B: wave ${w}: row.chainLen matches game.chain.length`);
    assert(row.cargoMax === g.cargoMax, `B: wave ${w}: row.cargoMax matches game.cargoMax`);
    assert(row.scoopLevel === g.scoopLevel, `B: wave ${w}: row.scoopLevel matches game.scoopLevel`);

    // debrisCount/debrisSpeedMul: the SAME expressions nextWave() itself uses to spawn the wave.
    // REPOINTED BY CS017 P3 — both levers now ramp on the cycleWave sawtooth and pass through the
    // cycleValue() spiral. The DIFFLOG_FIELDS list is frozen; only what feeds it moves (see the header
    // note at the DiffLog block). Built from the REAL cycleValue()/constants, never re-derived arithmetic.
    const expCount = Math.min(
      Math.round(A.cycleValue(Math.min(3 + g.cycleWave, A.DEBRIS_COUNT_MAX), g.cycle)),
      A.DEBRIS_COUNT_HARD_MAX);
    const expSpeedMul = A.cycleValue(1 + (g.cycleWave - 1) * A.DEBRIS_SPEED_PER_WAVE, g.cycle);
    assert(row.debrisCount === expCount, `B: wave ${w}: debrisCount expected ${expCount}, got ${row.debrisCount}`);
    assert(Math.abs(row.debrisSpeedMul - expSpeedMul) < 1e-9, `B: wave ${w}: debrisSpeedMul expected ${expSpeedMul}, got ${row.debrisSpeedMul}`);
    assert(g.debris.length === expCount, `B: wave ${w}: sanity — the wave actually spawned debrisCount pieces`);

    // hunterSpeedFrac/hunterTurnFrac: still identical to each other (both HunterSatellite speed/turnRate
    // ramp from the SAME HUNTER_FLOOR_FRAC up to their own per-tier ceiling, so the ceiling cancels out of
    // the ratio), and CS017 P3 repointed both onto the same sawtooth+spiral the ctor now samples.
    const expFrac = A.cycleValue(A.ramp(A.HUNTER_FLOOR_FRAC, 1, g.cycleWave), g.cycle);
    assert(Math.abs(row.hunterSpeedFrac - expFrac) < 1e-9, `B: wave ${w}: hunterSpeedFrac expected ${expFrac}, got ${row.hunterSpeedFrac}`);
    assert(Math.abs(row.hunterTurnFrac - expFrac) < 1e-9, `B: wave ${w}: hunterTurnFrac expected ${expFrac}, got ${row.hunterTurnFrac}`);

    // saucerAimErr/saucerGapMin/saucerGapMax: the SAME ramp() calls as the live saucer aim/spawn sites.
    const expAimErr = A.ramp(A.SAUCER_AIM_ERR_FLOOR, A.SAUCER_AIM_ERR_CEIL, 1 + (g.wave - 1) * A.SAUCER_ACCURACY_RAMP_SCALE);
    const expGapMin = A.ramp(A.SAUCER_GAP_FLOOR_MIN, A.SAUCER_GAP_CEIL_MIN, g.wave);
    const expGapMax = A.ramp(A.SAUCER_GAP_FLOOR_MAX, A.SAUCER_GAP_CEIL_MAX, g.wave);
    assert(Math.abs(row.saucerAimErr - expAimErr) < 1e-9, `B: wave ${w}: saucerAimErr expected ${expAimErr}, got ${row.saucerAimErr}`);
    assert(Math.abs(row.saucerGapMin - expGapMin) < 1e-9, `B: wave ${w}: saucerGapMin expected ${expGapMin}, got ${row.saucerGapMin}`);
    assert(Math.abs(row.saucerGapMax - expGapMax) < 1e-9, `B: wave ${w}: saucerGapMax expected ${expGapMax}, got ${row.saucerGapMax}`);
  }
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
  assert(A.DiffLog.rows[0].wave === 1, `C: the surviving row is wave 1, not a stale wave from before the restart`);
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
  assert(first.wave === totalWaves - A.DIFFLOG_MAX + 1, `D: oldest surviving row is wave ${totalWaves - A.DIFFLOG_MAX + 1} (got ${first.wave})`);
  assert(last.wave === totalWaves, `D: newest row is the last wave pushed (${totalWaves}, got ${last.wave})`);
})();

// ================= (E) difficultyLogCSV(): header + N lines, values round-trip ==========================
(function sectionE() {
  console.log("(E) difficultyLogCSV() builds a header line + one line per row; values round-trip");
  const { exports: A } = build();
  A.DiffLog.rows = [
    { t: 1.5, wave: 1, cycle: 0, cycleWave: 1, score: 0, debrisCount: 4, debrisSpeedMul: 1, hunterSpeedFrac: 0.58, hunterTurnFrac: 0.58, saucerAimErr: 0.35, saucerGapMin: 20, saucerGapMax: 30, hunterCount: 0, chainLen: 0, cargoMax: 12, scoopLevel: 0 },
    { t: 2.75, wave: 2, cycle: 0, cycleWave: 2, score: 300, debrisCount: 5, debrisSpeedMul: 1.08, hunterSpeedFrac: 0.6, hunterTurnFrac: 0.6, saucerAimErr: 0.34, saucerGapMin: 19.9, saucerGapMax: 29.8, hunterCount: 1, chainLen: 2, cargoMax: 12, scoopLevel: 1 },
    { t: 3.0, wave: 3, cycle: 0, cycleWave: 3, score: 900, debrisCount: 6, debrisSpeedMul: 1.16, hunterSpeedFrac: 0.62, hunterTurnFrac: 0.62, saucerAimErr: 0.33, saucerGapMin: 19.8, saucerGapMax: 29.6, hunterCount: 2, chainLen: 5, cargoMax: 12, scoopLevel: 1 },
  ];
  const csv = A.difficultyLogCSV();
  const lines = csv.split("\n");
  assert(lines.length === 1 + A.DiffLog.rows.length, `E: header + N lines (expected ${1 + A.DiffLog.rows.length}, got ${lines.length})`);
  assert(lines[0] === A.DIFFLOG_FIELDS.join(","), "E: header line is exactly DIFFLOG_FIELDS joined by commas");

  for (let i = 0; i < A.DiffLog.rows.length; i++) {
    const cells = lines[i + 1].split(",");
    assert(cells.length === A.DIFFLOG_FIELDS.length, `E: row ${i}: cell count matches field count (got ${cells.length})`);
    A.DIFFLOG_FIELDS.forEach((f, j) => {
      assert(Number(cells[j]) === A.DiffLog.rows[i][f], `E: row ${i}: field "${f}" round-trips (expected ${A.DiffLog.rows[i][f]}, got ${cells[j]})`);
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

  g.paused = true; g.state = "title"; g.menu.screen = "debug"; g.menu.index = 0;
  let threw = null;
  try {
    A.drawDebug();
    for (let i = 0; i < N; i++) A.menuDebug("down");
    assert(g.menu.index === dumpRow, `G: N downs from row 0 land on the dump row (index ${dumpRow}, got ${g.menu.index})`);
    A.drawDebug();

    A.menuDebug("down");
    assert(g.menu.index === backRow, `G: one more down lands on Back (index ${backRow}, got ${g.menu.index})`);
    A.drawDebug();

    A.menuDebug("down");
    assert(g.menu.index === 0, "G: down wraps from Back back to the first value row");

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
