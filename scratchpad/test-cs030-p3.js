// Headless test for CS030 Phase 3 — ACH_EMBLEM + drawEmblem(): pastes P2's lab export
// verbatim and adds the one draw helper. No panel yet (archive/PLANNED-FEATURES-CS030.md §4.2).
//
//   node scratchpad/test-cs030-p3.js
//
// Sections: (A) node --check. (B) all 8 designs exist, every point |p| <= 1.0 (unit-space
// contract). (C) drawEmblem routes tierIdx 0 to Bronze, not the untiered emblem — the
// truthiness trap the phase prompt calls out by name. (D) the two new DEBUG_VARS rows.
// (E) TRAP: scope pin against this phase's own parent (cs-30 p2).

"use strict";
const { buildGame, mkAssert, scriptSource } = require("./_harness.js");
const { ownCommits, changedFiles, outsideScope, parentSource } = require("./_phase-ref.js");

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — "cs-30 p2: tools/emblem-lab.html ...".
const PARENT_SHA = "30c7b27fd0a2085c1403f50fa41912384bf5a8e1";
const PHASE_SUBJECT = "cs-30 p3:";

const A = mkAssert();
const { assert, eq, close, skip } = A;

const src = scriptSource();

// ================= (A) node --check =====================
(function sectionA() {
  console.log("(A) node --check");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs030p3_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ================= (B) 8 designs, every point inside the unit circle =====================
(function sectionB() {
  console.log("(B) ACH_EMBLEM has 8 designs, every point |p| <= 1.0");
  const X = buildGame();
  const E = X.ACH_EMBLEM;
  assert(E && Array.isArray(E.tier), "B: (setup) ACH_EMBLEM.tier is an array");
  eq(E.tier.length, 6, "B: six tier rungs");
  const pools = ["weekly", "lifetime"];
  for (const k of pools) assert(Array.isArray(E[k]), `B: (setup) ACH_EMBLEM.${k} is an array`);

  const allDesigns = [...E.tier, ...pools.map(k => E[k])];
  eq(allDesigns.length, 8, "B: eight designs total (6 tier + weekly + lifetime)");

  let worst = 0;
  for (const design of allDesigns) {
    for (const poly of design) {
      for (const p of poly.pts) worst = Math.max(worst, Math.hypot(p[0], p[1]));
    }
  }
  assert(worst <= 1.0 + 1e-9, `B: worst point norm ${worst} is within the unit circle (<= 1.0)`);
})();

// ================= (C) drawEmblem: tierIdx 0 is Bronze, not the untiered emblem =====================
(function sectionC() {
  console.log("(C) drawEmblem(cx, cy, r, 0, pool) routes to Bronze, never the untiered emblem");
  const X = buildGame();

  X.drawEmblem(0, 0, 32, 0, undefined);
  eq(X.probe("ctx.strokeStyle"), X.TIER_COLOR[0],
    "C: tierIdx 0 strokes in TIER_COLOR[0] (Bronze), not COLOR.ach — typeof, not truthiness");

  X.drawEmblem(0, 0, 32, undefined, "weekly");
  eq(X.probe("ctx.strokeStyle"), X.probe("COLOR.ach"),
    "C: (contrast) an untiered unlock strokes in COLOR.ach");

  X.drawEmblem(0, 0, 32, 2, undefined);
  eq(X.probe("ctx.strokeStyle"), X.TIER_COLOR[2],
    "C: (contrast) a non-zero tier still routes correctly");
})();

// ================= (D) the two celebration knobs — RETIRED by CS038 P5 to plain constants =====================
(function sectionD() {
  console.log("(D) celebrationScrollStep / celebrationEmblemSize: retired (spec §4), values survive as constants");
  const X = buildGame();
  // REPOINTED BY CS038 P5 (spec §4): both rows are retired outright to CELEB_SCROLL_STEP /
  // CELEB_EMBLEM_SIZE — pure presentation, no gameplay effect. ⛔ NO VALUE CHANGE: this section's
  // own def/min/max/step live values (60 and 32) land byte-identical on the constants; the
  // assertion moves rather than disappearing.
  assert(!X.DEBUG_VARS.some(v => v.id === "celebrationScrollStep"),
    "D: ⛔ celebrationScrollStep no longer exists — retired by CS038 P5");
  assert(!X.DEBUG_VARS.some(v => v.id === "celebrationEmblemSize"),
    "D: ⛔ celebrationEmblemSize no longer exists — retired by CS038 P5");
  eq(X.CELEB_SCROLL_STEP, 60, "D: CELEB_SCROLL_STEP carries this phase's 60 forward, unchanged");
  eq(X.CELEB_EMBLEM_SIZE, 32, "D: CELEB_EMBLEM_SIZE carries this phase's 32 forward, unchanged");
})();

// ================= (E) TRAP: scope pin against this phase's own parent =====================
(function sectionE() {
  console.log("(E) TRAP: scope pin against this phase's own parent (cs-30 p2)");
  const ps = parentSource(PARENT_SHA);
  if (ps === null) skip("E: parent source (no git history)");

  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  if (shas === null) { skip("E: scope pin (no git history)"); return; }
  if (shas.length > 1) {
    A.failed++;
    console.error(`  FAIL: E: ${shas.length} commits share the subject "${PHASE_SUBJECT}" — the pin no longer names one commit`);
    return;
  }
  const provisional = shas.length === 0;
  const changed = changedFiles(PARENT_SHA, provisional ? null : shas[0]);
  if (changed === null) { skip("E: scope pin (changedFiles unavailable)"); return; }
  if (provisional) console.log("  (E measured against the WORKING TREE — this phase is not committed yet)");

  const designDocs = changed.filter(f => f.endsWith(".md") && f !== "STATUS.md");
  eq(designDocs.join(","), "", `E: ⛔ no design doc was touched (found: ${designDocs.join(", ") || "none"})`);
  const outside = outsideScope(changed, []);
  eq(outside.join(","), "", `E: nothing outside the game file, scratchpad/ and STATUS.md (found: ${outside.join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "E: (setup) the game file is in this phase's diff");
})();

A.report();
