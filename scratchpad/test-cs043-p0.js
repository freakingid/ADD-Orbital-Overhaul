// scratchpad/test-cs043-p0.js — CS043 P0: five stale comments fixed, comments only.
//
//   node scratchpad/test-cs043-p0.js
//
// §A the five stale strings are gone from the live build / suite.
// §B ⛔ CORE PROOF: execSource() (the character-scanner comment stripper, never the two-regex
//    idiom — CLAUDE.md, Test rules) run over the current build is byte-identical to execSource()
//    run over the literal parent's build. Comments-only, proven, not asserted.
// §C non-vacuous: the parent DOES carry all five stale strings, so §A is a real fix, not a no-op.
// §D the build still parses (buildGame() throws on a syntax error; this is the harness's
//    equivalent of `node --check` on the extracted script).
// §E the phase-local scope pin: nothing outside the standing allowlist moved.

"use strict";
const { buildGame, mkAssert, scriptSource, execSource } = require("./_harness.js");
const { parentSource, ownCommits, changedFiles, outsideScope, SKIP_TAG } = require("./_phase-ref.js");
const fs = require("fs");
const path = require("path");
const { repoRoot } = require("./_phase-ref.js");

// ⛔ LITERAL, never HEAD (CLAUDE.md, phase-local pins). This phase's own parent commit.
const PARENT_SHA = "82e3419a0dc9e3f5fc22989fa56e7f83ac83d56a";
const PHASE_SUBJECT = "cs043 p0:";

const A = mkAssert();
const { assert, eq, skip, report } = A;

const src = scriptSource();
const bare = execSource(src);

const parentSrc = parentSource(PARENT_SHA);

// The five stale strings this phase removes, and the corrected text each is replaced by.
const STALE = [
  "42 times in a\n  // 63-level run",
  "RAMP_WAVES is the single knob",
  "(isoYear*52 + isoWeek) % 15;",
  "NOT persisted yet (later phase)",
];
const F9_STALE = "(isoYear*52+isoWeek) % 15";

// ================= (A) the five stale strings are gone =====================
(function sectionA() {
  console.log("(A) the five stale strings are gone from the live build / suite");
  for (const s of STALE) {
    assert(!src.includes(s), `A: build no longer contains stale string ${JSON.stringify(s)}`);
  }
  const f9 = fs.readFileSync(path.join(repoRoot, "scratchpad", "test-f9.js"), "utf8");
  assert(!f9.includes(F9_STALE), `A: test-f9.js header no longer contains stale string ${JSON.stringify(F9_STALE)}`);

  // The corrections landed, worded as the phase prompt describes them.
  assert(src.includes("worldSizeFor() now has two return values and one"),
    "A: nextWave()'s comment now describes worldSizeFor()'s actual once-per-run boundary");
  assert(src.includes("Only a real change resizes"),
    "A: nextWave()'s comment still states the guard rule — a field level following a field level moves nothing");
  assert(src.includes("RAMP_WAVES was the single knob at the time"),
    "A: the v1.5 history note no longer claims RAMP_WAVES is (present tense) the single knob");
  assert(src.includes("(isoYear*52 + isoWeek) % 16;"),
    "A: the weekly-rotation modulus comment now reads % 16 (matches the 16-entry WEEKLY pool)");
  assert(f9.includes("(isoYear*52+isoWeek) % 16"),
    "A: test-f9.js header's modulus now reads % 16 too");
  assert(src.includes('Persisted since CS011 P3'),
    "A: the settings object's voiceStyle/captions comments now say they ARE persisted");
})();

// ================= (B) comment-stripped: byte-identical to the parent =====================
(function sectionB() {
  console.log("(B) execSource(current) === execSource(parent) — comments-only change, proven");
  if (parentSrc === null) { skip("B: comment-stripped comparison (no git history)"); return; }
  const pBare = execSource(parentSrc);
  eq(bare.length, pBare.length,
    "B: comment-stripped current build is the same LENGTH as the comment-stripped parent");
  eq(bare, pBare,
    "B: ⛔ comment-stripped current build is BYTE-IDENTICAL to the comment-stripped parent — " +
    "not one byte of executable code changed");
})();

// ================= (C) non-vacuous: the parent actually had the stale text =====================
(function sectionC() {
  console.log("(C) (non-vacuous) the parent build actually carried the stale strings");
  if (parentSrc === null) { skip("C: non-vacuous parent check (no git history)"); return; }
  for (const s of STALE) {
    assert(parentSrc.includes(s), `C: (non-vacuous) parent DOES contain stale string ${JSON.stringify(s)}`);
  }
  let parentF9 = null;
  try {
    parentF9 = require("child_process").execFileSync(
      "git", ["show", PARENT_SHA + ":scratchpad/test-f9.js"],
      { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] }).toString();
  } catch (e) { /* leave null — reported below */ }
  if (parentF9 === null) { skip("C: non-vacuous parent test-f9.js check (no git history)"); return; }
  assert(parentF9.includes(F9_STALE),
    `C: (non-vacuous) parent's test-f9.js DOES contain stale string ${JSON.stringify(F9_STALE)}`);
})();

// ================= (D) the build still parses =====================
(function sectionD() {
  console.log("(D) buildGame() still constructs the live build without throwing");
  let threw = null;
  try { buildGame(); } catch (e) { threw = e; }
  assert(threw === null, `D: buildGame() did not throw (${threw && threw.message})`);
})();

// ================= (E) the phase-local scope pin =====================
(function sectionE() {
  console.log("(E) this phase's own diff: comments + the new test + doc updates, nothing else");
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
  if (provisional) console.log("  (measured against the WORKING TREE — this phase is not committed yet)");

  eq(outsideScope(changed).join(","), "",
    `E: nothing outside the standing allowlist (found: ${outsideScope(changed).join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "E: (setup) the game file is in this phase's diff");
  assert(changed.includes("scratchpad/test-f9.js"), "E: (setup) ...including the test-f9.js header fix");
  assert(changed.includes("scratchpad/test-cs043-p0.js"), "E: (setup) ...including this test file");
  assert(changed.includes("STATUS.md"), "E: (setup) ...including the STATUS.md update");
})();

report();
