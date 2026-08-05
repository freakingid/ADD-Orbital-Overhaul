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
//  (C) orbitEffectiveCount at the SHIPPED geometry: a locally-built expectation function —
//      cross-validated against the REAL exported one across counts 1-20 — proves where the accept/reject
//      boundary actually sits. It has moved twice: 8/9 at CS021's 180/150, 4/5 at CS022's 460/276, and
//      5/6 at CS023's 400/138 (spec C6). The RULE never changed; only the geometry it measures did.
//  (D) the SAME cross-validated expectation function, fed the RETIRED CS022 (460/276) geometry as plain
//      arithmetic: pins that build's own numbers (edge 1334 accepted at count 4, edge 1610 rejected at
//      count 5) to show the walk-down rule is GEOMETRY-GENERAL rather than fitted to what ships, with a
//      control asserting the live build disagrees with those figures.
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

  // TRAP 1 — REPOINTED BY CS022 P4: the bump has landed, so this becomes its mirror image.
  assert(X.GAME_VERSION !== "1.0.0.21", "A: TRAP 1 — GAME_VERSION moved off the pre-CS022 baseline (P4 bumped it)");

  // TRAP 2 — REPOINTED BY CS022 P3, the standing mirror-image treatment. P2 asserted that ITS OWN diff
  // moved no ORBIT_* constant; P3 is the phase that owns them and has now moved three, so the surviving
  // claim is that they landed on the values P2's own section (D) predicted — the same numbers, read from
  // the other side. ORBIT_RING_COUNT and ORBIT_GAP_MULT genuinely did not move and stay as they were.
  eq(X.ORBIT_INNER_RADIUS, 400, "A: REPOINTED BY CS023 P1 — ORBIT_INNER_RADIUS is now 400 (180 -> 460 -> 400)");
  eq(X.ORBIT_RADIUS_STEP, 138, "A: REPOINTED BY CS023 P1 — ORBIT_RADIUS_STEP is now 138 (150 -> 276 -> 138)");
  eq(X.ORBIT_RING_COUNT, 4, "A: ORBIT_RING_COUNT untouched (P3 relocated its declaration, not its value)");
  eq(X.ORBIT_GAP_MULT, 2.5, "A: ORBIT_GAP_MULT untouched — the occurrence curve is not part of CS022");
  eq(JSON.stringify(X.ORBIT_DENSITY), "[0.12,0.12,0.12,0.12]", "A: REPOINTED BY CS023 P1 — the density curve is FLAT at 0.12 (spec §1.3)");

  // TRAP 3 — REPOINTED BY CS022 P3, same treatment: P2 asserted none of the ramp material existed YET.
  // P3 landed all four pieces, so each "not yet" becomes its positive successor at the same strength.
  assert(/activeRings/.test(codeOnly), "A: REPOINTED BY CS022 P3 — the activeRings ring filter now exists");
  assert(/fieldCount/.test(codeOnly), "A: REPOINTED BY CS022 P3 — levelDef now carries a fieldCount column");
  assert(/orbitRings/.test(codeOnly), "A: REPOINTED BY CS022 P3 — levelDef now carries an orbitRings column");
  assert(/function spawnFieldSatellites\(/.test(codeOnly), "A: REPOINTED BY CS022 P3 — the field-spawn extraction has landed");
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
  // REPOINTED BY CS022 P3: the two literals below were 150 / 225 at P2's still-CS021 geometry. The CLAIM
  // is unchanged and is deliberately NOT weakened — the retired rule still reproduces the shipped step
  // exactly at the shipped count and still widens it at any other — but the numbers it produces are now
  // 276 / 414, and they are derived from the live constants rather than restated, so a future geometry
  // move cannot make this control silently stale again. 414 is the figure spec Correction C3 names.
  function retiredFormula(count) {
    if (count <= 1) return X.ORBIT_RADIUS_STEP;
    const outerRadius = X.ORBIT_INNER_RADIUS + (X.ORBIT_RING_COUNT - 1) * X.ORBIT_RADIUS_STEP;
    return (outerRadius - X.ORBIT_INNER_RADIUS) / (count - 1);
  }
  eq(retiredFormula(4), X.ORBIT_RADIUS_STEP, "B: (control) the retired formula's own count-4 answer is still the shipped step");
  eq(retiredFormula(4), 138, "B: (control) ...which at the CS023 P1 geometry is 138 (150 through P2, 276 through CS022)");
  eq(X.orbitRadiusStepFor(4), retiredFormula(4), "B: count 4 is bit-identical to the pre-P2 (retired) value — the shipped geometry did not move");
  // ...but the retired formula and the new rule now DISAGREE everywhere else, proving P2 is a real change.
  eq(retiredFormula(3), 207, "B: (control) the retired formula widens count 3 to 207 (414 at CS022's geometry — CS022 Correction C3's own figure)");
  assert(X.orbitRadiusStepFor(3) !== retiredFormula(3), "B: the new rule disagrees with the retired one at count 3 (138 vs 207) — Correction C3 in effect");
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
  // REPOINTED BY CS023 P1: WORLD_SIZE_ORBIT 16 -> 9, so the budget is 2160/2 - 20 = 1060, not 1420.
  eq(orbitBudget, 1060, "C: the orbit-world wrap-clean budget is 1060px (worldDims(9)[1]/2 - 20)");

  for (let requested = 1; requested <= 20; requested++) {
    const want = expectedEffectiveCount(X.ORBIT_INNER_RADIUS, X.ORBIT_RADIUS_STEP, X.DEBRIS_RADII[3], orbitBudget, requested);
    eq(X.orbitEffectiveCount(requested), want, `C: orbitEffectiveCount(${requested}) matches the budget-derived expectation (${want})`);
  }

  // The concrete boundary at THIS geometry.
  //
  // REPOINTED BY CS022 P3, and this is the repoint P2's own STATUS note predicted verbatim. At the
  // still-CS021 180/150 geometry the 1420px budget was so generous that NOTHING in the debug panel's own
  // [3,5] range clamped — the walk-down first bit at a requested 9, well past the registry ceiling. P3's
  // 460/276 geometry RE-ARMS exactly the same rule where the spec (§6) says it should: 4 rings fit at an
  // edge of 1334px, a 5th would sit at 1610px, so a requested 5 now walks back down to 4. The rule did
  // not change between P2 and P3 — only the geometry it is measuring did — which is why the sweep above
  // (1..20 against the cross-validated helper) is the load-bearing assertion and these four are its
  // named boundary cases. The two literals are read off the live constants below, never restated.
  // REPOINTED AGAIN BY CS023 P1, and the boundary MOVED OUT BY ONE RING (spec C6). At 400/138 a fifth
  // ring's edge is 998px against the 1,060px budget, so a requested 5 is now accepted outright and it is
  // the SIXTH that walks back down. The rule is untouched in both repoints — only the geometry it
  // measures moved — which is why the 1..20 sweep above against the cross-validated helper is the
  // load-bearing assertion and these are its named boundary cases.
  const edge4 = X.ORBIT_INNER_RADIUS + 3 * X.ORBIT_RADIUS_STEP + X.DEBRIS_RADII[3];
  const edge5 = X.ORBIT_INNER_RADIUS + 4 * X.ORBIT_RADIUS_STEP + X.DEBRIS_RADII[3];
  const edge6 = X.ORBIT_INNER_RADIUS + 5 * X.ORBIT_RADIUS_STEP + X.DEBRIS_RADII[3];
  assert(edge4 <= orbitBudget, `C: the shipped 4-ring outer edge (${edge4}px) clears the ${orbitBudget}px budget`);
  assert(edge5 <= orbitBudget, `C: a 5th ring's edge (${edge5}px) clears it too now (spec C6)`);
  assert(edge6 > orbitBudget, `C: a 6th ring's edge (${edge6}px) does not`);
  eq(X.orbitEffectiveCount(4), 4, "C: requested 4 — the shipped ORBIT_RING_COUNT — is accepted outright");
  eq(X.orbitEffectiveCount(5), 5, "C: requested 5 is accepted outright too at the CS023 P1 geometry (it walked to 4 at CS022's)");
  eq(X.orbitEffectiveCount(6), 5, "C: requested 6 walks down to 5 — the clamp still bites, one ring further out");
  eq(X.orbitEffectiveCount(20), 5, "C: a wildly over-requested count lands on the same 5");
  eq(X.orbitEffectiveCount(X.ORBIT_RING_COUNT), X.ORBIT_RING_COUNT,
    "C: the shipped ring count is a FIXED POINT of the clamp — activeRingsFor() can rely on that");
})();

// ======= (D) the SAME cross-validated helper, at the RETIRED CS022 (460/276) geometry ================
// REPOINTED BY CS023 P1 — and the section's ROLE returns to what P2 wrote it for. P2 authored it as
// documented arithmetic for a geometry that had not landed; CS022 P3 landed 460/276 and the section
// briefly described the LIVE build; CS023 P1 has moved the build on to 400/138, so 460/276 is a retired
// geometry again and this is once more the second, non-live geometry the cross-validated helper is
// exercised against. That is the section's actual value: it proves the walk-down rule is GEOMETRY-GENERAL
// rather than fitted to whatever happens to be shipping. The literals stay literals on purpose — they are
// CS022's own published figures — and the live build is now asserted to DISAGREE with them, which is the
// CS023 change stated as a control rather than as prose.
(function sectionD() {
  console.log("(D) the RETIRED CS022 (460/276) geometry — the same helper, proving the rule is geometry-general");
  const CS022_BUDGET = X.worldDims(16)[1] / 2 - 20;                  // the size-16 world CS022 ran orbits in
  const CS022_INNER = 460, CS022_STEP = 276; // PLANNED-FEATURES-CS022.md §1.3 — spec literals, on purpose
  eq(CS022_BUDGET, 1420, "D: CS022's orbit world was size 16, budget 1420px");

  // The live build is NOT that geometry any more, and saying so here is what stops this section quietly
  // turning back into a description of the shipped constants.
  assert(X.ORBIT_INNER_RADIUS !== CS022_INNER && X.ORBIT_RADIUS_STEP !== CS022_STEP,
    "D: (control) the LIVE build is no longer CS022's 460/276 — CS023 P1 moved it to 400/138");
  assert(X.WORLD_SIZE_ORBIT !== 16, "D: (control) ...and the orbit world is no longer size 16 either");

  const edge4 = CS022_INNER + 3 * CS022_STEP + X.DEBRIS_RADII[3];
  const edge5 = CS022_INNER + 4 * CS022_STEP + X.DEBRIS_RADII[3];
  eq(edge4, 1334, "D: CS022's own figure — its 4-ring outer edge was 1334px");
  eq(edge5, 1610, "D: CS022's own figure — a 5th ring's outer edge would have been 1610px");
  assert(edge4 <= CS022_BUDGET, "D: 1334px cleared the 1420px size-16 budget — 4 rings fit");
  assert(edge5 > CS022_BUDGET, "D: 1610px did NOT clear it — a requested 5th ring was rejected there");

  eq(expectedEffectiveCount(CS022_INNER, CS022_STEP, X.DEBRIS_RADII[3], CS022_BUDGET, 4), 4,
    "D: at the CS022 geometry the helper accepts 4 outright");
  eq(expectedEffectiveCount(CS022_INNER, CS022_STEP, X.DEBRIS_RADII[3], CS022_BUDGET, 5), 4,
    "D: at the CS022 geometry the helper walks 5 down to 4 — the boundary that build's rule protected");
  // And the same helper, at the LIVE geometry, agrees with the LIVE function at every count — which is
  // the cross-validation that licenses trusting it on a geometry the build no longer runs.
  const liveBudget = X.worldDims(X.WORLD_SIZE_ORBIT)[1] / 2 - 20;
  for (let requested = 1; requested <= 20; requested++) {
    eq(X.orbitEffectiveCount(requested),
       expectedEffectiveCount(X.ORBIT_INNER_RADIUS, X.ORBIT_RADIUS_STEP, X.DEBRIS_RADII[3], liveBudget, requested),
       `D: the LIVE orbitEffectiveCount(${requested}) matches the same helper at the LIVE geometry`);
  }
  // The two geometries genuinely disagree, so the section cannot pass by coincidence.
  assert(expectedEffectiveCount(CS022_INNER, CS022_STEP, X.DEBRIS_RADII[3], CS022_BUDGET, 5) !== X.orbitEffectiveCount(5),
    "D: (control) the retired and live geometries give DIFFERENT answers at a requested 5 (4 vs 5)");
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
