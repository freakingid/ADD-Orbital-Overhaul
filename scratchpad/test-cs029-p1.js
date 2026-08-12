// Headless test for CS029 Phase 1 — THE RENAME: asteroids-deluxe.html -> orbital-overhaul.html.
//
//   node scratchpad/test-cs029-p1.js
//
// ⛔ §2.3 item 3 is checked as the REAL invariant, not the plan's estimate literally: the plan
// said "every remaining legacy occurrence sits on a line naming a *_REF/PRE_* identifier," but the
// live grep also turned up ~24 lines in already-closed CS025-27 phases' OWN scope pins (both
// `changed.includes("asteroids-deluxe.html")` assertions and the comments beside them) that
// correctly compare against a PRE_-rename PARENT_SHA..ownCommit range without naming a *_REF token
// on that exact line. Those are historically true and must not be touched (rewriting them would
// make an old phase's diff-assertion false). §C below tests what item 3 actually protects — no
// code path LOADS THE LIVE BUILD under the retired name — rather than the naming heuristic.
//
// Sections: (A) the file itself. (B) git log --follow survives the mv. (C) no live-path read of
// the legacy name remains. (D) SCOPE_BASE names the new file (and keeps the old one for historical
// diffs). (E) gameFileAt().

"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const { mkAssert } = require("./_harness.js");
const REF = require("./_phase-ref.js");
const { ownCommits, changedFiles, outsideScope, SCOPE_BASE,
        GAME_FILE, GAME_FILE_LEGACY, gameFileAt, repoRoot } = REF;

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — cs-28 p2 (closing phase, v1.0.0.28).
const PARENT_SHA = "533365a11c8a538ee4bff3bc042820bd80059937";
const PHASE_SUBJECT = "cs-29 p1:";

const A = mkAssert();
const { assert, eq } = A;

// ================= (A) the file itself =====================
(function sectionA() {
  console.log("(A) orbital-overhaul.html exists at root; asteroids-deluxe.html does not");
  assert(fs.existsSync(path.join(repoRoot, "orbital-overhaul.html")),
    "A: orbital-overhaul.html exists at the repo root");
  assert(!fs.existsSync(path.join(repoRoot, "asteroids-deluxe.html")),
    "A: asteroids-deluxe.html no longer exists at the repo root");
})();

// ================= (B) git log --follow reaches pre-rename history =====================
(function sectionB() {
  console.log("(B) git log --follow on the new path reaches pre-rename history");
  let log;
  try {
    log = execFileSync("git", ["log", "--follow", "--format=%H", "--", "orbital-overhaul.html"],
      { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] }).toString().trim().split("\n").filter(Boolean);
  } catch (e) {
    A.skip("B: --follow history (no git checkout)");
    return;
  }
  if (log.length === 0) {
    // Working-tree-only rename: the mv is staged but not yet a commit, so --follow (which walks
    // COMMITS) has nothing to walk yet. This is the expected pre-commit state, not a failure — the
    // real assertion below only means something once the phase has landed.
    A.skip("B: --follow reaches pre-rename history (not committed yet)");
    return;
  }
  assert(log.includes(PARENT_SHA) || log.some(sha => sha.startsWith(PARENT_SHA)),
    `B: ⛔ --follow's history includes this phase's own parent (${PARENT_SHA}) — the rename kept history attached`);
  assert(log.length > 1, "B: (non-vacuous) --follow found more than just this phase's own commit");
})();

// ================= (C) no live-path read of the legacy name remains =====================
(function sectionC() {
  console.log("(C) no scratchpad/*.js file loads the LIVE build under the retired name");
  const dir = path.join(repoRoot, "scratchpad");
  // This file is excluded from its own scan: its regexes and comments QUOTE the retired name in
  // order to explain and detect it, which is exactly the "about the path, not a live read of it"
  // case the scan means to ignore. Same convention as test-cs025-p5.js's TRAP 3.
  const self = path.basename(__filename);
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".js") && f !== self);
  const liveLoadHits = [];
  const headReadHits = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    text.split("\n").forEach((line, i) => {
      if (!line.includes("asteroids-deluxe.html")) return;
      // A live filesystem load of the retired name (path.join(..., "asteroids-deluxe.html")).
      if (/path\.join\([^)]*asteroids-deluxe\.html/.test(line)) liveLoadHits.push(`${f}:${i + 1}`);
      // A bare HEAD read of the retired name — HEAD always carries today's name from this phase on.
      if (/HEAD:asteroids-deluxe\.html/.test(line)) headReadHits.push(`${f}:${i + 1}`);
    });
  }
  eq(liveLoadHits.join(", "), "",
    `C: ⛔ no scratchpad file path.joins the retired name to load the current build (found: ${liveLoadHits.join(", ") || "none"})`);
  eq(headReadHits.join(", "), "",
    `C: ⛔ no scratchpad file reads HEAD under the retired name (found: ${headReadHits.join(", ") || "none"})`);

  // Non-vacuous: the historical-SHA reads (group b, §2.3) are still there, still legacy-named, and
  // still marked — this section is checking a real, still-present pattern, not an empty file set.
  const settledMarked = files.filter(f =>
    fs.readFileSync(path.join(dir, f), "utf8").includes("SETTLED: legacy path is CORRECT here"));
  assert(settledMarked.length >= 10,
    `C: (non-vacuous) at least ten files still carry a group-b SETTLED marker (found ${settledMarked.length})`);
})();

// ================= (D) SCOPE_BASE =====================
(function sectionD() {
  console.log("(D) SCOPE_BASE names the new file, and keeps the old one for pre-rename diffs");
  assert(SCOPE_BASE.includes("orbital-overhaul.html"), "D: SCOPE_BASE names the new game file");
  assert(SCOPE_BASE.includes("asteroids-deluxe.html"),
    "D: ⛔ SCOPE_BASE ALSO keeps the legacy name — already-closed phases' own scope pins diff a " +
    "pre-rename PARENT_SHA..ownCommit range that legitimately lists the old name as changed");
  eq(outsideScope(["asteroids-deluxe.html", "orbital-overhaul.html", "STATUS.md"]).join(","), "",
    "D: outsideScope() treats both spellings as in-scope");
})();

// ================= (E) gameFileAt() =====================
(function sectionE() {
  console.log("(E) gameFileAt(): legacy for a pre-rename SHA, new for HEAD once committed");
  eq(gameFileAt(null), null, "E: gameFileAt(null) is null, not a throw");

  // A pre-rename SHA (this phase's own parent) always resolves to the legacy name — that commit's
  // tree genuinely has no orbital-overhaul.html.
  let atParent;
  try {
    atParent = gameFileAt(PARENT_SHA);
  } catch (e) {
    atParent = null;
  }
  if (atParent === null) {
    A.skip("E: gameFileAt(parent) (no git history)");
  } else {
    eq(atParent, GAME_FILE_LEGACY, "E: gameFileAt(this phase's parent) resolves to the legacy name");
  }

  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  if (shas === null) { A.skip("E: gameFileAt(HEAD) (no git history)"); return; }
  if (shas.length > 1) {
    A.failed++;
    console.error(`  FAIL: E: ${shas.length} commits share the subject "${PHASE_SUBJECT}" — the pin no longer names one commit`);
    return;
  }
  if (shas.length === 0) {
    A.skip("E: gameFileAt(HEAD) (not committed yet — HEAD still has the legacy tree)");
    return;
  }
  const atHead = gameFileAt("HEAD");
  eq(atHead, GAME_FILE, "E: ⛔ gameFileAt(HEAD) resolves to the new name once this phase is committed");
})();

// ================= (F) the phase-local scope pin =====================
(function sectionF() {
  console.log("(F) this phase's own diff: the rename, doc sweep, _phase-ref.js, and the new test");
  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  if (shas === null) { A.skip("F: scope pin (no git history)"); return; }
  if (shas.length > 1) {
    A.failed++;
    console.error(`  FAIL: F: ${shas.length} commits share the subject "${PHASE_SUBJECT}" — the pin no longer names one commit`);
    return;
  }
  const provisional = shas.length === 0;
  const changed = changedFiles(PARENT_SHA, provisional ? null : shas[0]);
  if (changed === null) { A.skip("F: scope pin (changedFiles unavailable)"); return; }
  if (provisional) console.log("  (measured against the WORKING TREE — this phase is not committed yet)");

  // PLANNED-FEATURES-CS029.md / IMPLEMENTATION-PHASES-CS029.md landed in "Doc additions before
  // cs029" (a6a4537), between PARENT_SHA and this phase's own commit — CS029's own planning
  // scaffolding, not this phase's edit, but inside the diff range because PARENT_SHA is pinned to
  // the CS028 close rather than that intervening commit.
  const EXTRA = ["CLAUDE.md", "EXTERNAL-FILES.md", "RATIONALE.md", "ORBITAL-OVERHAUL-GDD.md",
    "tools/", "PLANNED-FEATURES-CS029.md", "IMPLEMENTATION-PHASES-CS029.md"];
  eq(outsideScope(changed, EXTRA).join(","), "",
    `F: nothing outside the base allowlist plus the doc/tool sweep (found: ${outsideScope(changed, EXTRA).join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "F: (setup) the renamed game file is in this phase's diff");
  assert(changed.includes("scratchpad/_phase-ref.js"), "F: (setup) ...including the landmine fix and gameFileAt()");
  assert(changed.includes("scratchpad/test-cs029-p1.js"), "F: (setup) ...including this test file");
})();

A.report();
