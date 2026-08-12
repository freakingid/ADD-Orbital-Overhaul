// Headless test for CS028 Phase 1 — the satellite breakup model.
//
//   node scratchpad/test-cs028-p1.js
//
// Under test: SAT_ART's twelve-craft shape and the new SAT_SCRAP table, the DebrisSatellite
// constructor's craft/piece dispatch, and the identity invariants destroyDebris() now holds.
//
// ⛔ Two traps this file is written around:
//   1. A child's piece index CANNOT be inferred from its baked art — Hubble's pieces 1/2 and
//      Skylab's 0/2 share a polyline vertex-count signature. §C therefore asserts `this.piece`
//      on the instance, which is the entire reason that field exists (the draw path never
//      reads it). Inference produced a false 374/400 while the real answer was 600/600.
//   2. §C drives BOTH junkSplit values (2 at level 1, 3 at level 11+) by moving game.wave. A
//      single-level run only ever sees two of the three pieces, so it would pass vacuously
//      against FORK-CS028-A — the very fork this phase resolves.
//
// ⛔ Asserts nothing global — no registry size, no lever count. test-registry.js owns those.
//
// Sections: (A) art-table shape. (B) constructor dispatch. (C) the split invariants, 600
// trials across both junkSplit values. (D) the draw path is untouched.

"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

// ⛔ Above everything: the art tables bake per-instance jitter at construction and §C rolls
// thousands of values after the factory runs, so the seed must be live on both sides of it.
// Checked against this seed: §B sees 11 of the 12 craft in 60 size-3 rolls and §C's level-1
// piece sweep reaches all three indices — neither is a knife-edge, but a reseed should
// re-confirm both rather than assume them.
const { installSeed } = require("./_seeded-random.js");
installSeed(20280101);

const { buildGame, mkAssert, scriptSource, execSource } = require("./_harness.js");

const A = mkAssert();
const { assert, eq } = A;
const X = buildGame();
const src = scriptSource();
const live = execSource(src);          // comment-free TEXT, so a tombstone can't read as live code

// A polyline set's structural fingerprint: open/closed flag + vertex count, per polyline. Enough
// to tell `full` from `pieces[n]` from a scrap shard; deliberately NOT used to identify WHICH
// piece a body is (see trap 1 in the header).
const sig = polys => polys.map(pl => `${pl.closed ? "C" : "O"}${pl.pts.length}`).join(",");

// ================= (A) the art tables =====================
(function sectionA() {
  console.log("(A) SAT_ART / SAT_SCRAP shape: 12 craft, 3 pieces each, unit space, no `small`");

  const tmp = path.join(__dirname, "_cs028p1_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  eq(X.SAT_ART.length, 12, "A: SAT_ART holds twelve craft");
  eq(X.SAT_SCRAP.length, 3, "A: SAT_SCRAP holds three generic shards");

  let worst = 0, worstAt = "", badShape = [];
  const polylines = (polys, where) => {
    if (!Array.isArray(polys) || polys.length === 0) { badShape.push(where + " (empty)"); return; }
    polys.forEach((pl, k) => {
      if (typeof pl.closed !== "boolean") badShape.push(`${where}[${k}].closed`);
      if (!Array.isArray(pl.pts) || pl.pts.length < 2) { badShape.push(`${where}[${k}].pts`); return; }
      for (const p of pl.pts) {
        if (p.length !== 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
          badShape.push(`${where}[${k}].pts (non-finite)`); return;
        }
        const r = Math.hypot(p[0], p[1]);
        if (r > worst) { worst = r; worstAt = where; }
      }
    });
  };

  let okFull = 0, okPieces = 0, okNoSmall = 0;
  X.SAT_ART.forEach((e, i) => {
    if (Array.isArray(e.full) && e.full.length > 0) okFull++;
    if (Array.isArray(e.pieces) && e.pieces.length === 3) okPieces++;
    if (!("small" in e)) okNoSmall++;
    polylines(e.full, `craft${i}.full`);
    (e.pieces || []).forEach((p, j) => polylines(p, `craft${i}.pieces[${j}]`));
  });
  X.SAT_SCRAP.forEach((s, i) => polylines(s, `scrap${i}`));

  eq(okFull, 12, "A: every craft has a non-empty `full` silhouette");
  eq(okPieces, 12, "A: ⛔ every craft shatters into EXACTLY three pieces");
  eq(okNoSmall, 12, "A: no craft retains the retired per-craft `small` field");
  eq(badShape.join(", "), "", "A: every polyline is { pts: [[x,y]...] (>=2), closed: bool }");
  assert(worst <= 1,
    `A: every authored point sits inside the unit circle (worst |p| ${worst.toFixed(4)} at ${worstAt})`);
  assert(!/artDef\.small/.test(live),
    "A: the retired `artDef.small` read is gone from live code (comments aside)");
})();

// ================= (B) constructor dispatch =====================
(function sectionB() {
  console.log("(B) dispatch: size 3 -> full, size 2 -> pieces[piece], size 1 -> generic scrap");
  const N = 60;

  // --- size 3: rolls its own craft, draws `full`, piece does not apply.
  let okCraft = 0, okPiece = 0, okArt = 0;
  const rolled = new Set();
  for (let i = 0; i < N; i++) {
    const d = new X.DebrisSatellite(0, 0, 3);
    if (Number.isInteger(d.craft) && d.craft >= 0 && d.craft < X.SAT_ART.length) { okCraft++; rolled.add(d.craft); }
    if (d.piece === -1) okPiece++;
    if (X.SAT_ART[d.craft] && sig(d.art) === sig(X.SAT_ART[d.craft].full)) okArt++;
  }
  eq(okCraft, N, "B: size 3 always rolls a valid craft index");
  eq(okPiece, N, "B: size 3 stores the -1 piece sentinel (piece does not apply to a whole craft)");
  eq(okArt, N, "B: size 3 bakes that craft's `full` silhouette");
  assert(rolled.size >= 8, `B: ...and the roll actually varies (${rolled.size} distinct craft in ${N})`);

  // --- size 2 with an explicit craft/piece: every (craft, piece) pair, exhaustively.
  let okPair = 0, pairs = 0;
  for (let c = 0; c < X.SAT_ART.length; c++) {
    for (let p = 0; p < 3; p++) {
      pairs++;
      const d = new X.DebrisSatellite(0, 0, 2, 100, c, p);
      if (d.craft === c && d.piece === p && sig(d.art) === sig(X.SAT_ART[c].pieces[p])) okPair++;
    }
  }
  eq(okPair, pairs, `B: size 2 draws pieces[piece] of the craft it was handed (all ${pairs} pairs)`);

  // --- modulo, not a clamp: the split site's rotating offset relies on this.
  const wrapped = new X.DebrisSatellite(0, 0, 2, 100, 5, 4);
  eq(wrapped.piece, 4 % 3, "B: a piece index past the end wraps by modulo (4 -> 1)");
  eq(sig(wrapped.art), sig(X.SAT_ART[5].pieces[1]), "B: ...and it bakes pieces[1], not pieces[4]");

  // --- size 1: identity abandoned, generic scrap, even when a craft is handed down.
  const scrapSigs = X.SAT_SCRAP.map(sig);
  let okScrap = 0, okSentinel = 0;
  const shards = new Set();
  for (let i = 0; i < N; i++) {
    const d = new X.DebrisSatellite(0, 0, 1);
    if (scrapSigs.includes(sig(d.art))) { okScrap++; shards.add(sig(d.art)); }
    if (d.craft === -1 && d.piece === -1) okSentinel++;
  }
  eq(okScrap, N, "B: size 1 bakes one of the three SAT_SCRAP shards");
  eq(okSentinel, N, "B: size 1 abandons identity — craft AND piece both stay -1");
  const ignored = new X.DebrisSatellite(0, 0, 1, 100, 7, 2);
  eq(ignored.craft, -1, "B: size 1 ignores an inherited craft (the medium -> small step still passes one)");
  eq(ignored.piece, -1, "B: ...and an inherited piece with it");
  assert(scrapSigs.includes(sig(ignored.art)), "B: ...and still draws generic scrap");
})();

// ================= (C) the split invariants =====================
(function sectionC() {
  console.log("(C) split invariants: craft inherited, pieces in range and distinct, both junkSplit values");
  X.startGame();

  // Clear only what a kill fills; startGame() has already built the rest of the world.
  const clear = () => { X.game.debris.length = 0; X.game.garbage.length = 0; X.game.particles.length = 0; };

  const TRIALS = 300;   // x2 levels = the 600 splits archive/PLANNED-FEATURES-CS028.md §4 pre-verified
  for (const [level, wantChildren] of [[1, 2], [15, 3]]) {
    X.game.wave = level;
    let okCount = 0, okSize = 0, okCraft = 0, okRange = 0, okDistinct = 0;
    for (let t = 0; t < TRIALS; t++) {
      const parent = new X.DebrisSatellite(500, 500, 3);
      clear();
      X.destroyDebris(parent);
      const kids = X.game.debris;
      if (kids.length === wantChildren) okCount++;
      if (kids.length && kids.every(k => k.size === 2)) okSize++;
      if (kids.length && kids.every(k => k.craft === parent.craft)) okCraft++;
      if (kids.length && kids.every(k => Number.isInteger(k.piece) && k.piece >= 0 && k.piece < 3)) okRange++;
      if (kids.length && new Set(kids.map(k => k.piece)).size === Math.min(kids.length, 3)) okDistinct++;
    }
    eq(okCount, TRIALS, `C: level ${level} — junkSplit yields ${wantChildren} children every kill`);
    eq(okSize, TRIALS, `C: level ${level} — every child is a medium`);
    eq(okCraft, TRIALS, `C: level ${level} — ⛔ every child inherits the parent's craft, ${TRIALS}/${TRIALS}`);
    eq(okRange, TRIALS, `C: level ${level} — every child's piece is in [0,3)`);
    eq(okDistinct, TRIALS, `C: level ${level} — a kill's children take DISTINCT pieces`);
  }

  // FORK-CS028-A's whole point: at junkSplit 2 a fixed `piece = i` could never reach piece 2.
  X.game.wave = 1;
  const seen = new Set();
  for (let t = 0; t < 200; t++) {
    const parent = new X.DebrisSatellite(500, 500, 3);
    clear();
    X.destroyDebris(parent);
    for (const k of X.game.debris) seen.add(k.piece);
  }
  eq([...seen].sort().join(","), "0,1,2",
    "C: ⛔ FORK-CS028-A — the rotating offset reaches all three pieces at junkSplit 2 (a fixed `i` reaches 0 and 1 only)");

  // The medium -> small step: destroyDebris still passes a craft down; the constructor drops it.
  X.game.wave = 15;
  clear();
  X.destroyDebris(new X.DebrisSatellite(500, 500, 2, 100, 7, 0));
  const smalls = X.game.debris;
  assert(smalls.length > 0 && smalls.every(k => k.size === 1 && k.craft === -1 && k.piece === -1),
    "C: the medium -> small step drops identity, inherited craft and all");
})();

// ================= (D) the draw path is untouched =====================
(function sectionD() {
  console.log("(D) draw path: DEBRIS_RADII, drawPoly/glowStroke, the radius-scaled bake");
  eq(X.DEBRIS_RADII[3], 46, "D: DEBRIS_RADII large is still 46");
  eq(X.DEBRIS_RADII[2], 26, "D: DEBRIS_RADII medium is still 26");
  eq(X.DEBRIS_RADII[1], 13, "D: DEBRIS_RADII small is still 13");

  assert(live.includes("function drawPoly(points, x, y, angle, color, closed = true) {"),
    "D: drawPoly's signature is unchanged");
  assert(live.includes("function glowStroke(color, width = 1.6, blur = 10) {"),
    "D: glowStroke's signature is unchanged");
  eq(X.drawPoly.length, 5, "D: ...and drawPoly's arity agrees (5 params before the default)");
  eq(X.glowStroke.length, 1, "D: ...and glowStroke's does too (1 before the defaults)");
  assert(/drawPoly\(pl\.pts, this\.x, this\.y, this\.angle, COLOR\.debris, pl\.closed\)/.test(live),
    "D: DebrisSatellite.draw() still iterates the baked art through drawPoly");

  // The bake still scales unit space by this.radius. Worst authored |p| is 0.988 and the jitter is
  // +-4.5% of radius per axis, so a baked point can reach ~1.07 x radius and no further.
  for (const size of [3, 2, 1]) {
    const d = new X.DebrisSatellite(0, 0, size, 100, 4, 1);
    let mx = 0;
    for (const pl of d.art) for (const [px, py] of pl.pts) mx = Math.max(mx, Math.hypot(px, py));
    assert(mx <= d.radius * 1.08 && mx > d.radius * 0.4,
      `D: size ${size} art is baked in radius-${d.radius} px space (max |p| ${mx.toFixed(2)})`);
  }
})();

A.report();
