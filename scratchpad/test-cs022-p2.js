// Headless test for CS022 Phase 2 — geometry helper re-derivation.
// Spec: PLANNED-FEATURES-CS022.md Correction C3, §6, §9.
//
//   node scratchpad/test-cs022-p2.js
//
// Scope is exactly two functions and one retirement (per the phase prompt) — no ORBIT_* constant, no
// levelDef/nextWave change, no ramp. Follows the standing rule (CLAUDE.md): stub window/document/rAF/
// navigator/localStorage, eval the REAL <script> block, drive the ACTUAL functions — nothing under test
// is reimplemented.
//
// Sections:
//  (A) node --check + source pins: orbitRadiusStepFor no longer branches on `count`; orbitEffectiveCount
//      reads worldDims(WORLD_SIZE_ORBIT) rather than the live WORLD_H, with a comment explaining why;
//      ORBIT_RADIUS_STEP_PAD keeps its declaration but has zero remaining readers; the three TRAPs
//      (GAME_VERSION, every ORBIT_* constant, no P3 material) all hold.
//  (B) orbitRadiusStepFor: returns ORBIT_RADIUS_STEP at counts 1-5, and is bit-identical to the RETIRED
//      pre-P2 formula's own count-4 answer (both give 150 — the shipped geometry does not move).
//  (C) orbitEffectiveCount at the CS021 (shipped, still-live) geometry: a locally-built expectation
//      function — cross-validated against the REAL exported one across counts 1-20 — proves the accept/
//      reject boundary sits at 8/9, not at the retired rule's 3/4 boundary.
//  (D) the SAME cross-validated expectation function, now fed the CS022 (460/276, not-yet-landed)
//      geometry as plain arithmetic: pins the spec's own numbers (edge 1334 accepted at count 4, edge
//      1610 rejected at count 5, walking down to 4) — documentation of the rule P3 will exercise for
//      real, not an exercise of live code (ORBIT_INNER_RADIUS/ORBIT_RADIUS_STEP stay P3's to move).
//  (E) ORBIT_RADIUS_STEP_PAD has zero readers — a direct source-count check.

"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];
const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ok - ${msg}`); }
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
function eq(a, b, msg) { assert(a === b, `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }

// ---------------------------------------------------------------- harness (standing stub idiom)
function makeCtxStub() {
  return new Proxy({}, {
    get(t, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return () => ({ width: 10 });
      if (p === "createLinearGradient" || p === "createRadialGradient")
        return () => ({ addColorStop: () => {} });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

const RETURN = [
  "orbitRadiusStepFor", "orbitEffectiveCount",
  "ORBIT_INNER_RADIUS", "ORBIT_RADIUS_STEP", "ORBIT_RADIUS_STEP_PAD", "ORBIT_RING_COUNT",
  "ORBIT_DENSITY", "ORBIT_GAP_MULT", "ORBIT_GAP_MULT_FLOOR", "ORBIT_LEVEL_EVERY",
  "DEBRIS_RADII", "worldDims", "WORLD_SIZE_FIELD", "WORLD_SIZE_ORBIT", "WORLD_SIZE_MAX",
  "WORLD_W", "WORLD_H", "GAME_VERSION", "DEBUG_VARS", "DEBUG_ENTRIES", "levelDef",
];

function build() {
  const c = makeCtxStub();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: undefined, webkitAudioContext: undefined
  };
  const store = {};
  const localStorageStub = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
}

const X = build();

// ================================== (A) node --check + source pins ==================================
(function sectionA() {
  console.log("(A) node --check + source pins");
  const tmp = path.join(repoRoot, "scratchpad", "_cs022p2_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); passed++; console.log("  ok - node --check"); }
  catch (e) { failed++; console.log("  FAIL - node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  const stepBody = codeOnly.slice(
    codeOnly.indexOf("function orbitRadiusStepFor"),
    codeOnly.indexOf("function orbitEffectiveCount")
  );
  assert(/function orbitRadiusStepFor\(count\)\s*\{\s*return ORBIT_RADIUS_STEP;\s*\}/.test(stepBody),
    "A: orbitRadiusStepFor's body is exactly `return ORBIT_RADIUS_STEP;` — no branch on count, no gap math");
  assert(!/count\s*-\s*1/.test(stepBody), "A: orbitRadiusStepFor no longer divides by count - 1");
  assert(!/ORBIT_RING_COUNT/.test(stepBody), "A: orbitRadiusStepFor no longer reaches for ORBIT_RING_COUNT (the retired outer-edge anchor)");

  const countBody = codeOnly.slice(
    codeOnly.indexOf("function orbitEffectiveCount"),
    codeOnly.indexOf("function orbitEffectiveGapMult")
  );
  assert(/worldDims\(WORLD_SIZE_ORBIT\)/.test(countBody),
    "A: orbitEffectiveCount reads worldDims(WORLD_SIZE_ORBIT) — the orbit-run size from the table");
  assert(!/\bWORLD_H\b/.test(countBody),
    "A: orbitEffectiveCount does NOT read the live WORLD_H (would be 1440 mid-field-level and clamp to nonsense)");
  assert(!/ORBIT_RADIUS_STEP_PAD/.test(countBody),
    "A: orbitEffectiveCount no longer reads the retired ORBIT_RADIUS_STEP_PAD floor");
  // The phase prompt requires this world-dimension-from-the-table choice to be explained in a comment,
  // since it's the one place in the changeset that reads a size from the table rather than the live var.
  const countComment = scriptSrc.slice(
    scriptSrc.indexOf("function orbitEffectiveCount") - 1400,
    scriptSrc.indexOf("function orbitEffectiveCount")
  );
  assert(/live WORLD_H/.test(countComment) && /field level/i.test(countComment),
    "A: a comment explains why worldDims(WORLD_SIZE_ORBIT) is read instead of the live WORLD_H");

  // ORBIT_RADIUS_STEP_PAD: declaration survives, comment marks it retired, zero OTHER occurrences.
  assert(/const ORBIT_RADIUS_STEP_PAD = 40;/.test(codeOnly), "A: ORBIT_RADIUS_STEP_PAD is still defined (left in place, per the DEBRIS_COUNT_MAX precedent)");
  assert(/RETIRED IN CS022 P2/.test(scriptSrc), "A: a RETIRED comment marks it, following the DEBRIS_COUNT_MAX (CS018 P3) precedent");
  const padOccurrences = (codeOnly.match(/ORBIT_RADIUS_STEP_PAD/g) || []).length;
  eq(padOccurrences, 1, "A: ORBIT_RADIUS_STEP_PAD appears exactly once in non-comment code — its own declaration, no readers");

  // TRAP 1 — GAME_VERSION does not move this phase.
  eq(X.GAME_VERSION, "1.0.0.21", "A: TRAP 1 — GAME_VERSION unchanged (P4 owns the bump to 1.0.0.22)");

  // TRAP 2 — no ORBIT_* constant value moved.
  eq(X.ORBIT_INNER_RADIUS, 180, "A: TRAP 2 — ORBIT_INNER_RADIUS untouched (P3 owns 460)");
  eq(X.ORBIT_RADIUS_STEP, 150, "A: TRAP 2 — ORBIT_RADIUS_STEP untouched (P3 owns 276)");
  eq(X.ORBIT_RING_COUNT, 4, "A: TRAP 2 — ORBIT_RING_COUNT untouched");
  eq(X.ORBIT_GAP_MULT, 2.5, "A: TRAP 2 — ORBIT_GAP_MULT untouched");
  eq(JSON.stringify(X.ORBIT_DENSITY), "[0.75,0.45,0.35,0.85]", "A: TRAP 2 — ORBIT_DENSITY untouched (P3 owns the halving)");

  // TRAP 3 — no ramp / levelDef / nextWave material has landed yet (that's P3's).
  assert(!/activeRings/.test(codeOnly), "A: TRAP 3 — no activeRings filter yet");
  assert(!/fieldCount/.test(codeOnly), "A: TRAP 3 — levelDef has no fieldCount column yet");
  assert(!/orbitRings/.test(codeOnly), "A: TRAP 3 — levelDef has no orbitRings column yet");
  assert(!/function spawnFieldSatellites\(/.test(codeOnly), "A: TRAP 3 — the field-spawn extraction is P3's, not this phase's");
  eq((codeOnly.match(/function levelDef\(/g) || []).length, 1, "A: exactly one levelDef definition, unchanged in count");
})();

// ============ (B) orbitRadiusStepFor: fixed step, bit-identical to the retired rule at count 4 ========
(function sectionB() {
  console.log("(B) orbitRadiusStepFor holds ORBIT_RADIUS_STEP fixed at every count");
  for (const count of [1, 2, 3, 4, 5]) {
    eq(X.orbitRadiusStepFor(count), X.ORBIT_RADIUS_STEP, `B: orbitRadiusStepFor(${count}) === ORBIT_RADIUS_STEP`);
  }
  // The RETIRED CS021 P3 formula, restated here ONLY as a control to prove count 4's answer didn't move —
  // this is the formula orbitRadiusStepFor(count) used to compute, not a copy of what it computes now.
  function retiredFormula(count) {
    if (count <= 1) return X.ORBIT_RADIUS_STEP;
    const outerRadius = X.ORBIT_INNER_RADIUS + (X.ORBIT_RING_COUNT - 1) * X.ORBIT_RADIUS_STEP;
    return (outerRadius - X.ORBIT_INNER_RADIUS) / (count - 1);
  }
  eq(retiredFormula(4), 150, "B: (control) the retired formula's own count-4 answer was 150");
  eq(X.orbitRadiusStepFor(4), retiredFormula(4), "B: count 4 is bit-identical to the pre-P2 (retired) value — the shipped geometry did not move");
  // ...but the retired formula and the new rule now DISAGREE everywhere else, proving P2 is a real change.
  eq(retiredFormula(3), 225, "B: (control) the retired formula widened count 3 to 225");
  assert(X.orbitRadiusStepFor(3) !== retiredFormula(3), "B: the new rule disagrees with the retired one at count 3 (150 vs 225) — Correction C3 in effect");
})();

// == (C) orbitEffectiveCount at the CS021 (live) geometry: cross-validate a local expectation function ==
// This helper mirrors the exact walk-down rule the spec states (§6): walk `count` down while the
// outermost satellite EDGE exceeds the wrap-clean budget of the world an orbit level actually runs at.
// It is proven equivalent to the REAL exported orbitEffectiveCount below before it is ever trusted, so
// re-using it against a hypothetical geometry in section (D) is not "reimplementing untested logic".
function expectedEffectiveCount(innerRadius, step, satRadius, budget, requested) {
  let count = Math.round(requested);
  while (count > 1 && innerRadius + (count - 1) * step + satRadius > budget) count--;
  return count;
}

(function sectionC() {
  console.log("(C) orbitEffectiveCount at the shipped CS021 geometry: accept/reject boundary via a cross-validated helper");
  const orbitBudget = X.worldDims(X.WORLD_SIZE_ORBIT)[1] / 2 - 20;
  eq(orbitBudget, 1420, "C: the orbit-world wrap-clean budget is 1420px (worldDims(16)[1]/2 - 20)");

  for (let requested = 1; requested <= 20; requested++) {
    const want = expectedEffectiveCount(X.ORBIT_INNER_RADIUS, X.ORBIT_RADIUS_STEP, X.DEBRIS_RADII[3], orbitBudget, requested);
    eq(X.orbitEffectiveCount(requested), want, `C: orbitEffectiveCount(${requested}) matches the budget-derived expectation (${want})`);
  }

  // The concrete boundary at THIS geometry: every registry count (3-5) and quite a few beyond it are
  // untouched — the walk-down only shows up well past the debug panel's own [3,5] ceiling.
  eq(X.orbitEffectiveCount(5), 5, "C: requested 5 is NOT clamped at the shipped geometry (edge 826px clears 1420px) — unlike the retired rule's 5->4");
  eq(X.orbitEffectiveCount(8), 8, "C: requested 8 still fits (edge 1276px)");
  eq(X.orbitEffectiveCount(9), 8, "C: requested 9 does not (edge 1426px) — walks down to 8, the first that fits");
  eq(X.orbitEffectiveCount(20), 8, "C: a wildly over-requested count still lands on the same 8");
})();

// =========== (D) the SAME cross-validated helper, fed the not-yet-landed CS022 (460/276) geometry ======
(function sectionD() {
  console.log("(D) CS022 (460/276) geometry, as documented arithmetic — not an exercise of live code (P3 owns these constants)");
  const orbitBudget = X.worldDims(X.WORLD_SIZE_ORBIT)[1] / 2 - 20; // 1420, same world either way — only the ring geometry is hypothetical here
  const CS022_INNER = 460, CS022_STEP = 276; // PLANNED-FEATURES-CS022.md §1.3 — P3 lands these; NOT read from X

  const edge4 = CS022_INNER + 3 * CS022_STEP + X.DEBRIS_RADII[3];
  const edge5 = CS022_INNER + 4 * CS022_STEP + X.DEBRIS_RADII[3];
  eq(edge4, 1334, "D: spec's own figure — the CS022 4-ring outer edge is 1334px");
  eq(edge5, 1610, "D: spec's own figure — a hypothetical 5th ring's outer edge would be 1610px");
  assert(edge4 <= orbitBudget, "D: 1334px clears the 1420px orbit-world budget — 4 rings fit");
  assert(edge5 > orbitBudget, "D: 1610px does NOT clear the budget — a requested 5th ring would be rejected");

  eq(expectedEffectiveCount(CS022_INNER, CS022_STEP, X.DEBRIS_RADII[3], orbitBudget, 4), 4,
    "D: at the CS022 geometry, requesting 4 is accepted outright");
  eq(expectedEffectiveCount(CS022_INNER, CS022_STEP, X.DEBRIS_RADII[3], orbitBudget, 5), 4,
    "D: at the CS022 geometry, requesting 5 walks down to 4 — the boundary the shipped rule protects once P3 lands");
})();

// ============================ (E) ORBIT_RADIUS_STEP_PAD: zero readers ================================
(function sectionE() {
  console.log("(E) ORBIT_RADIUS_STEP_PAD has zero readers");
  const readerLines = codeOnly.split("\n").filter(l =>
    l.includes("ORBIT_RADIUS_STEP_PAD") && !/^\s*const ORBIT_RADIUS_STEP_PAD\s*=/.test(l));
  eq(readerLines.length, 0, "E: no line other than the declaration itself references ORBIT_RADIUS_STEP_PAD");
})();

console.log(`\ntest-cs022-p2: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
