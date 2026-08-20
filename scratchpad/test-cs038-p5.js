// Headless test for CS038 Phase 5 — retiring 12 pure-presentation knobs to plain constants
// (PLANNED-FEATURES-CS038.md §4).
//
//   node scratchpad/test-cs038-p5.js
//
// This phase owns: none of the twelve ids in DEBUG_ENTRIES any more; each new CELEB_*/
// DELIVERY_FLOAT_*/HUNTER_PULSE_* constant equals the retired row's own `def`, byte-identical;
// DEBUG_ENTRIES.length is the live 104; every remaining id (and CELEBRATION/DELIVERY/HUNTER's
// other rows) is untouched; and the three affected behaviours — celebration scroll, delivery
// floater growth, hunter pulse envelope — are unchanged end-to-end through real code paths.
//
// Sections: (A) node --check; the twelve ids are gone; count 104; no header emptied.
// (B) each constant equals its old def. (C) celebration scroll, driven through the real
// celebrationScroll()/celebrationMaxScroll(). (D) delivery ticker size growth/clamp, driven
// through a real dock visit. (E) Hunter pulse envelope timing, driven through a real
// HunterSatellite. (F) TRAP: scope pin — the ONLY registry change is the twelve retirements.

"use strict";
const { mkAssert, buildGame, scriptSource, topLevelNames } = require("./_harness.js");
const { ownCommits, changedFiles, outsideScope, parentSource, SKIP_TAG } = require("./_phase-ref.js");

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — "cs038 p4" (the changeset's telemetry phase).
const PARENT_SHA = "65985a34426b219d97bc241a40be4bdaaa62c574";
const PHASE_SUBJECT = "cs038 p5";

const A = mkAssert();
const { assert, eq, close, skip } = A;
const DT = 1 / 60;

const RETIRED_IDS = [
  "celebrationScrollStep", "celebrationEmblemSize",
  "deliveryFloatRise", "deliveryFloatSize", "deliveryFloatSizeStep", "deliveryFloatSizeMax",
  "deliveryFloatHold", "deliveryFloatFade",
  "hunterPulseMin", "hunterPulseMax", "hunterPulseGrow", "hunterPulseShrink",
];
const RETIRED_DEFS = {
  CELEB_SCROLL_STEP: 60, CELEB_EMBLEM_SIZE: 32,
  DELIVERY_FLOAT_RISE: 150, DELIVERY_FLOAT_SIZE: 16, DELIVERY_FLOAT_SIZE_STEP: 1.0,
  DELIVERY_FLOAT_SIZE_MAX: 48, DELIVERY_FLOAT_HOLD: 0.00, DELIVERY_FLOAT_FADE: 1.20,
  HUNTER_PULSE_MIN: 80, HUNTER_PULSE_MAX: 150, HUNTER_PULSE_GROW: 900, HUNTER_PULSE_SHRINK: 20,
};

// ================= (A) node --check; the registry shape =================
(function sectionA() {
  console.log("(A) node --check; none of the twelve ids remain; count 104; no header emptied");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs038p5_extracted.js");
  fs.writeFileSync(tmp, scriptSource());
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  const X = buildGame();
  for (const id of RETIRED_IDS) {
    assert(!X.DEBUG_VARS.some(v => v.id === id), `A: ⛔ ${id} is gone from DEBUG_VARS`);
    eq(X.DEBUG[id], undefined, `A: ...and DEBUG.${id} is undefined`);
  }
  eq(X.DEBUG_ENTRIES.length, 104, "A: DEBUG_ENTRIES.length is the live 104");

  // No section header is emptied — CELEBRATION/DELIVERY/HUNTER all keep other rows.
  let section = null; const rowsOf = { CELEBRATION: [], DELIVERY: [], HUNTER: [] };
  for (const r of X.DEBUG_VARS) {
    if (r.header) { section = r.header; continue; }
    if (section in rowsOf) rowsOf[section].push(r.id);
  }
  for (const header of ["CELEBRATION", "DELIVERY", "HUNTER"]) {
    assert(rowsOf[header].length > 0, `A: ⛔ ${header} is not emptied — it still carries ${rowsOf[header].join(", ")}`);
  }
})();

// ================= (B) each constant equals its old def =================
(function sectionB() {
  console.log("(B) every retired constant equals the row's own old def, byte-identical");
  const X = buildGame();
  for (const [name, def] of Object.entries(RETIRED_DEFS)) {
    eq(X[name], def, `B: ${name} === ${def}`);
  }
})();

// ================= (C) celebration scroll, end to end =================
(function sectionC() {
  console.log("(C) celebration scroll: driven through the real celebrationScroll()/celebrationMaxScroll()");
  const X = buildGame();
  X.startGame();
  X.game.state = "gameover";
  X.game.celebration = { items: Array.from({ length: 12 }, (_, i) => ({
    id: "fake" + i, name: "Fake " + i, desc: "row", tierIdx: undefined, pool: "weekly" })), scroll: 0 };
  const step = X.CELEB_SCROLL_STEP;
  const max = X.celebrationMaxScroll();
  assert(max > step, `C: (setup) 12 rows overflow the clip — maxScroll ${max} > one step ${step}`);
  X.celebrationScroll(1);
  eq(X.game.celebration.scroll, step, "C: one scroll-down moves exactly CELEB_SCROLL_STEP");
  X.celebrationScroll(1);
  eq(X.game.celebration.scroll, 2 * step, "C: ...and again");
  X.celebrationScroll(-1);
  eq(X.game.celebration.scroll, step, "C: scroll-up moves back down one step");
  for (let i = 0; i < 10; i++) X.celebrationScroll(1);
  eq(X.game.celebration.scroll, max, "C: ⛔ scrolling past the bottom clamps at celebrationMaxScroll()");
})();

// ================= (D) delivery ticker growth/clamp, end to end =================
(function sectionD() {
  console.log("(D) delivery ticker size growth/clamp: driven through a real dock visit");
  const X = buildGame();
  X.startGame();
  const g = X.game;
  g.hunters.length = 0; g.saucers.length = 0; g.bullets.length = 0;
  g.garbage.length = 0; g.powerups.length = 0; g.floaters.length = 0;
  g.debris.length = 1;
  g.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  g.saucerTimer = 1e6; g.healthTimer = 1e6; g.hunterTimer = 1e6;
  g.ship.x = g.dock.x; g.ship.y = g.dock.y;
  g.comboGrace = X.DEBUG.dockComboGrace;
  g.deliveryCount = 0; g.offloadTimer = 0;
  const piecesToCap = Math.ceil((X.DELIVERY_FLOAT_SIZE_MAX - X.DELIVERY_FLOAT_SIZE) / X.DELIVERY_FLOAT_SIZE_STEP) + 1;
  const pieceCount = piecesToCap + 2;
  g.chain.length = 0;
  for (let i = 0; i < pieceCount; i++) {
    g.chain.push({ x: g.ship.x - (i + 1) * X.CHAIN_LINK, y: g.ship.y, px: g.ship.x - (i + 1) * X.CHAIN_LINK - 1,
      py: g.ship.y, spin: 0, spinRate: 0, mass: 1, towed: true });
  }
  const samples = []; let lastTicker = null;
  for (let f = 0; f < 900 && g.chain.length > 0; f++) {
    const before = g.deliveryCount;
    X.update(DT);
    if (g.deliveryTicker) lastTicker = g.deliveryTicker;
    if (g.deliveryCount !== before) samples.push({ n: g.deliveryCount, size: lastTicker.size,
      rise: lastTicker.rise, life0: lastTicker.life0, fade: lastTicker.fade });
  }
  eq(samples.length, pieceCount, `D: (setup) ${pieceCount} pieces landed, ${pieceCount} samples taken`);
  for (const s of samples) {
    const expected = Math.min(X.DELIVERY_FLOAT_SIZE_MAX, X.DELIVERY_FLOAT_SIZE + X.DELIVERY_FLOAT_SIZE_STEP * (s.n - 1));
    eq(s.size, expected, `D: piece ${s.n} size is ${expected}`);
    eq(s.rise, X.DELIVERY_FLOAT_RISE, `D: piece ${s.n} rise is the shipped constant`);
    eq(s.life0, X.DELIVERY_FLOAT_HOLD + X.DELIVERY_FLOAT_FADE, `D: piece ${s.n} life0 is hold+fade`);
    eq(s.fade, X.DELIVERY_FLOAT_FADE, `D: piece ${s.n} fade is the shipped constant`);
  }
  assert(samples[samples.length - 1].size === X.DELIVERY_FLOAT_SIZE_MAX,
    "D: ⛔ the clamp is genuinely reached — the last piece sits at DELIVERY_FLOAT_SIZE_MAX");
})();

// ================= (E) Hunter pulse envelope, end to end =================
(function sectionE() {
  console.log("(E) Hunter pulse envelope: driven through a real HunterSatellite");
  const X = buildGame();
  X.startGame();
  const g = X.game;
  g.state = "playing"; g.paused = false;
  g.debris.length = 1;
  g.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  g.hunters.length = 0; g.saucers.length = 0; g.bullets.length = 0; g.garbage.length = 0;
  g.ship.dead = false; g.ship.vx = 0; g.ship.vy = 0;

  const h = new X.HunterSatellite(500, 500, 3);
  eq(h.pulseScale, 100, "E: (setup) a fresh large starts at pulseScale 100");
  let worstHigh = -Infinity, worstLow = Infinity, sawUp = false, sawDown = false;
  const frames = Math.round((X.DEBUG.hunterVolatileAge + 30) / DT);
  for (let i = 0; i < frames; i++) {
    h.update(DT);
    if (h.pulseScale > worstHigh) worstHigh = h.pulseScale;
    if (h.pulseScale < worstLow) worstLow = h.pulseScale;
    assert(h.pulseScale <= X.HUNTER_PULSE_MAX + 1e-9, `E: pulseScale ${h.pulseScale} never exceeds HUNTER_PULSE_MAX`);
    assert(h.pulseScale >= X.HUNTER_PULSE_MIN - 1e-9, `E: pulseScale ${h.pulseScale} never falls below HUNTER_PULSE_MIN`);
    if (!h.pulseUp) sawDown = true;
    if (h.pulseUp && sawDown) sawUp = true;
  }
  close(worstHigh, X.HUNTER_PULSE_MAX, "E: the run genuinely reached the ceiling", 1e-6);
  close(worstLow, X.HUNTER_PULSE_MIN, "E: ...and genuinely reached the floor", 1e-6);
  assert(sawDown && sawUp, "E: (non-vacuity) a real oscillation — grow, then shrink, then grow again");
})();

// ================= (F) TRAP: scope pin — the ONLY registry change is the twelve retirements =====
(function sectionF() {
  console.log("(F) TRAP: scope pin against this phase's own parent");
  const ps = parentSource(PARENT_SHA);
  if (ps === null) {
    skip("F: registry diff against the parent (no git history)");
  } else {
    const OLD = buildGame({ source: ps });
    const X = buildGame();
    const oldIds = OLD.DEBUG_VARS.filter(v => !v.header).map(v => v.id);
    const xIds = X.DEBUG_VARS.filter(v => !v.header).map(v => v.id);
    const oldIdsSansRetired = oldIds.filter(id => !RETIRED_IDS.includes(id));
    eq(xIds.join(","), oldIdsSansRetired.join(","),
      "F: ⛔ the live registry is the parent's, minus EXACTLY the twelve retired ids, same order");
    eq(oldIds.length - xIds.length, 12, "F: ⛔ the registry shrank by exactly twelve rows");
    for (const id of RETIRED_IDS) {
      assert(oldIds.includes(id), `F: (setup) ${id} existed at the parent`);
    }
  }

  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  let changed = null, provisional = false;
  if (shas === null) { skip("F: scope pin (no git history)"); return; }
  if (shas.length === 1) changed = changedFiles(PARENT_SHA, shas[0]);
  else if (shas.length === 0) { changed = changedFiles(PARENT_SHA, null); provisional = changed !== null; }
  else { A.failed++; console.error(`  FAIL: F: ${shas.length} commits match "${PHASE_SUBJECT}" — ambiguous`); return; }
  if (!changed) { skip("F: scope pin (parent diff unavailable)"); return; }
  if (provisional) console.log("  (TRAP measured against the WORKING TREE — this phase is not committed yet)");
  const designDocs = changed.filter(f => f.endsWith(".md") && f !== "STATUS.md");
  eq(designDocs.join(","), "", `F: ⛔ no design doc touched this phase (docs are P7's) (found: ${designDocs.join(", ") || "none"})`);
  const outside = outsideScope(changed);
  eq(outside.join(","), "", `F: nothing outside the game file and scratchpad/ (found: ${outside.join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "F: (setup) the game file is in the diff");
})();

A.report();
