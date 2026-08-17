// Headless test for CS027 Phase 6 — CLOSE: version 1.0.0.27, TRAP-CS027-A, the scope pin.
//
//   node scratchpad/test-cs027-p6.js
//
// ⛔ TRAP-CS027-A, MEASURED — NOT WHAT THE PLAN CLAIMED. archive/PLANNED-FEATURES-CS027.md §2 states the
// <script> block differs from 89a9a3a by "exactly one line: the GAME_VERSION string." §B diffs it
// for real and finds THREE changed lines, not one: the GAME_VERSION swap, plus two doc-path
// comments ("PLANNED-FEATURES-CS026.md" -> "archive/PLANNED-FEATURES-CS026.md") that P0's own
// phase prompt explicitly authorized ("Do not touch asteroids-deluxe.html except for doc-path
// references inside comments"). The plan's "exactly one line" undercounted its own P0 scope. §B
// asserts the TRUE invariant — the delta is EXACTLY these three known substitutions and nothing
// else — by reconstructing a5ef9f4 from 89a9a3a and requiring byte equality (CS028 P1 made that
// second end a literal; it used to read the live build, which only worked while HEAD was a5ef9f4).
// A fourth, unlisted change fails this test for real. Recorded in STATUS.md, not silently absorbed.
//
// Sections: (A) node --check; GAME_VERSION "1.0.0.27"; HighScores stamps it. (B) TRAP-CS027-A,
// reconstructed and measured; registry/levers unmoved (85/18). (C) the closing scope pin.

"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const { buildGame, mkAssert, scriptSource } = require("./_harness.js");
const { parentSource, ownCommits, changedFiles, outsideScope } = require("./_phase-ref.js");
const { COUNTS } = require("./test-registry.js");   // the one file allowed to name these numbers

const repoRoot = path.join(__dirname, "..");
const scriptSrc = scriptSource();

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — cs-27 p5b (destroyHunter marker reclass).
const PARENT_SHA = "ccf0df43a73507dd0dbb2133843ff4997881a3e6";
const PHASE_SUBJECT = "cs-27 p6:";

// The changeset's OWN start point — CS026 P6, what TRAP-CS027-A measures against (per the plan).
const CS027_START_SHA = "89a9a3ae8fe857e255c921ca911c1ca0e01bfcbe";

// ⛔ REPOINTED BY CS028 P1 — the pin's TARGET was a moving reference, which is the one defect
// _phase-ref.js exists to stop. §B's claim is about CS027's OWN diff (89a9a3a -> a5ef9f4), and it
// compared the reconstruction to the LIVE build, which is only the same thing while HEAD is still
// a5ef9f4. CS028 P1's first code change broke it — not because CS027's diff changed, but because
// HEAD moved. Both ends are literals now, so the claim is permanently measurable. THE CLAIM IS
// UNCHANGED. What stayed pointed at HEAD is the part that genuinely tracks it: registry/levers
// unmoved, and GAME_VERSION having moved off the parent's.
const CS027_CLOSE_SHA = "a5ef9f47557b5b82dc050db6cd54169ea16d1fa1";

const A = mkAssert();
const { assert, eq } = A;

// ================= (A) node --check; the version =====================
(function sectionA() {
  console.log("(A) node --check; GAME_VERSION is \"1.0.0.27\" in the build and in the source literal");
  const tmp = path.join(__dirname, "_cs027p6_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  const X = buildGame();
  // ⚠ SETTLED (CLAUDE.md): a phase-local version pin flips to its standing mirror image at a later
  // bump, permanently true — it is not re-pointed to a new literal. GAME_VERSION was "1.0.0.27" for
  // CS027 P6 itself; every later phase (CS028 P2 first) makes these three assertions !== instead.
  assert(X.GAME_VERSION !== "1.0.0.27", "A: GAME_VERSION has moved off CS027 P6's own \"1.0.0.27\"");
  assert(scriptSrc.match(/const GAME_VERSION = "([^"]+)"/)[1] !== "1.0.0.27", "A: ...in the source literal too");
  assert(X.GAME_VERSION.split(".")[3] !== "27", "A: the 4th segment is no longer CS027's changeset number");
  assert(/SKIPPED DELIBERATELY/.test(scriptSrc), "A: CS024 P7's \".23 is skipped\" tombstone survives");

  const rec = X.HighScores.add({ initials: "AAA", score: 100, wave: 1, delivered: 1 });
  assert(rec.build !== "1.0.0.27", "A: a fresh HighScores.add() no longer stamps CS027 P6's build \"1.0.0.27\"");
})();

// ================= (B) TRAP-CS027-A, reconstructed and measured =====================
(function sectionB() {
  console.log("(B) TRAP-CS027-A: the <script> delta from 89a9a3a, measured against a full reconstruction");
  const ps = parentSource(CS027_START_SHA);
  const closeSrc = parentSource(CS027_CLOSE_SHA);   // CS028 P1: the pin's other end, now a literal too
  if (!ps || !closeSrc) { A.skip("§B TRAP-CS027-A (no git history)"); return; }

  // The exact, enumerated substitutions found by measurement — see the header. Anything else that
  // changed will make `reconstructed !== scriptSrc` below and fail this test for real.
  const SUBS = [
    [
      'const GAME_VERSION = "1.0.0.26";',
      '// CS027 P6: "1.0.0.26" -> "1.0.0.27". Still tracking the changeset number.\nconst GAME_VERSION = "1.0.0.27";',
    ],
    [
      '// CS026 P2 (PLANNED-FEATURES-CS026.md §1, FORK-CS026-A -> (b)): the BRANCHING FACTOR of the debris',
      '// CS026 P2 (archive/PLANNED-FEATURES-CS026.md §1, FORK-CS026-A -> (b)): the BRANCHING FACTOR of the debris',
    ],
    [
      "// CS026 P4 (spec §3, PLANNED-FEATURES-CS026.md §3.3a/§3.4): the delivery floaters' own rise/life,",
      "// CS026 P4 (spec §3, archive/PLANNED-FEATURES-CS026.md §3.3a/§3.4): the delivery floaters' own rise/life,",
    ],
  ];

  let reconstructed = ps;
  for (const [from, to] of SUBS) {
    const before = reconstructed;
    reconstructed = reconstructed.split(from).join(to);
    eq(before === reconstructed, false, `B: (setup) substitution target found verbatim in the parent: ${JSON.stringify(from.slice(0, 60))}...`);
  }

  eq(reconstructed, closeSrc,
    "B: ⛔ the ONLY differences between 89a9a3a and a5ef9f4 are the three enumerated substitutions — GAME_VERSION plus P0's two doc-path repoints. " +
    "archive/PLANNED-FEATURES-CS027.md §2 undercounted this as \"exactly one line\"; the true count is three, all legitimate CS027 diffs.");

  // The corollary the plan actually cares about: no LOGIC changed. Registry and levers unmoved.
  const OLD = buildGame({ source: ps, exports: ["DEBUG_ENTRIES", "LEVERS", "GAME_VERSION"] });
  const X = buildGame({ exports: ["DEBUG_ENTRIES", "LEVERS", "GAME_VERSION"] });
  // REPOINTED BY CS030 P3: the registry held from the CS027 start point through CS030 P2, but P3
  // added its two CELEBRATION knobs — a later phase's rows, named rather than re-litigated.
  // REPOINTED BY CS034 P8: net +4 more (deliveryFloatLife retired, five new DELIVERY rows added).
  // REPOINTED BY CS035 P2: +1 more (dockBounceSpeed, the dock lockout's push speed).
  // REPOINTED BY CS035 P3: +4 more (the level-end protection window's CELEBRATION rows).
  // REPOINTED BY CS035 P4: +5 more (the Hunter volatility clock/heartbeat's HUNTER rows).
  // REPOINTED BY CS035 P6: +5 more (the powerup rebalance's CHAIN GUARD/POWERUPS rows).
  // REPOINTED BY CS036 P2: −1 — levelEndHold RETIRED (the pre-nextWave() hold is player-paced now).
  eq(OLD.DEBUG_ENTRIES.length + 2 + 4 + 1 + 4 + 5 + 5 - 1, X.DEBUG_ENTRIES.length, "B: ⛔ registry unchanged from the CS027 start point (bar CS030 P3's two, CS034 P8's net four, CS035 P2's one, CS035 P3's four, CS035 P4's five, CS035 P6's five and CS036 P2's one retirement later) — no OTHER phase added a knob");
  eq(X.DEBUG_ENTRIES.length, COUNTS.registryEntries, "B: ...and it's test-registry.js's own count (the only file allowed to name it)");
  eq(OLD.LEVERS.length, X.LEVERS.length, "B: ⛔ LEVERS unchanged from the CS027 start point — no phase moved a lever");
  eq(X.LEVERS.length, COUNTS.levers, "B: ...and it's test-registry.js's own count too");
  eq(JSON.stringify(X.LEVERS), JSON.stringify(OLD.LEVERS), "B: ⛔ every lever byte-identical to the CS027 start point");
  assert(X.GAME_VERSION !== OLD.GAME_VERSION, "B: ⛔ GAME_VERSION DID move — P6 owns the changeset's only bump");
})();

// ================= (C) the closing-phase scope pin =====================
(function sectionC() {
  console.log("(C) this phase's own diff: doc sweep + this test file, nothing outside scope");
  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  if (shas === null) { A.skip("§C scope pin (no git history)"); return; }
  if (shas.length > 1) {
    A.failed++;
    console.error(`  FAIL: C: ${shas.length} commits share the subject "${PHASE_SUBJECT}" — the pin no longer names one commit`);
    return;
  }
  const provisional = shas.length === 0;
  const changed = changedFiles(PARENT_SHA, provisional ? null : shas[0]);
  if (changed === null) { A.skip("§C scope pin (changedFiles unavailable)"); return; }
  if (provisional) console.log("  (measured against the WORKING TREE — this phase is not committed yet)");

  const EXTRA = ["ORBITAL-OVERHAUL-GDD.md", "archive/",
    "PLANNED-FEATURES-CS027.md", "IMPLEMENTATION-PHASES-CS027.md"];   // moved to archive/ this phase
  eq(outsideScope(changed, EXTRA).join(","), "",
    `C: nothing outside the base allowlist plus GDD/archive (found: ${outsideScope(changed, EXTRA).join(", ") || "none"})`);
  assert(changed.includes("asteroids-deluxe.html"), "C: (setup) the version bump is in this phase's diff");
  assert(changed.includes("scratchpad/test-cs027-p6.js"), "C: (setup) ...including this test file");
})();

A.report();
