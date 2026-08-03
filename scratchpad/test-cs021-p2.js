// Headless test for CS021 Phase 2 — OCCURRENCE-SCALED ORBIT GAP MULTIPLIER.
//
//   node scratchpad/test-cs021-p2.js
//
// WHAT LANDED (PLANNED-FEATURES-CS021 §5). P1 shipped the orbit archetype's fairness floor as ONE fixed
// multiplier (ORBIT_GAP_MULT, 2.5x) for every occurrence. P2 makes it occurrence-scaled:
//
//     occurrence = level / ORBIT_LEVEL_EVERY
//     gapMult    = max(ORBIT_GAP_MULT_FLOOR, ORBIT_GAP_MULT - (occurrence - 1) * ORBIT_GAP_MULT_STEP)
//
// Level 3 (occurrence 1) still ships at 2.5x; the multiplier decays 0.1x per further occurrence and is
// clamped at the hard 1.8x floor, first reached at occurrence 8 (level 24) and held through level 63.
// ONE variable scales — ORBIT_DENSITY and both ORBIT_ANG_VEL/ORBIT_FAST_MULT stay fixed across
// occurrences (spec §5's "change one variable at a time" rule); tightening the multiplier only widens
// each ring's maxCount, which is what steps the total from 40 (occurrence 1) to 45 (at and past the
// floor) — FORK-CS021-D's bonanza, stepping up further.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL startGame/update(1/60)/nextWave path where a real-wiring proof is
// needed. Nothing under test is reimplemented — every expectation is computed from the shipped
// orbitGapMult()/generateOrbitLayout(), never a restated literal.
//
// Sections:
//  (A) node --check + source pins, incl. TRAP 1 (GAME_VERSION untouched)
//  (B) gapMult PINNED at levels 3 / 24 / 63, plus the decay shape and the "one variable scales" invariant
//  (C) SATELLITE TOTALS across the scaling range — 40 at occurrence 1, 45 at the floor, maxCount widening
//      7/13/19/25 -> 8/14/21/28 — through BOTH the pure generator and the REAL nextWave() wiring
//  (D) THE FAIRNESS SWEEP RE-RUN at occurrence-scaled values — spec §8 items 1-4, at EVERY orbit level
//      3..63, against the FIXED absolute floor (not a re-invocation of the value under test)
//  (E) MUTANT CHECK — with the 1.8 clamp removed, a deep level's real geometry violates the true floor,
//      proving (D)'s assertion has teeth

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = process.env.CS021_HTML || path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function close(got, want, msg, eps = 1e-9) { assert(Math.abs(got - want) < eps, `${msg} (got ${got}, want ${want})`); }

// ================= (A, part 1) syntax =====================
(function sectionA_syntax() {
  console.log("(A) node --check + source pins");
  const tmp = path.join(repoRoot, "scratchpad", "_cs021p2_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ---- Headless environment (the standing stub idiom) ----
function makeCtxStub() {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null,
    shadowBlur: 0, shadowColor: null, globalAlpha: 1 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return s => ({ width: 6 * String(s).length });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

const RETURN = [
  "game", "startGame", "update", "nextWave", "levelDef",
  "generateOrbitLayout", "spawnOrbitWave", "orbitGapMult",
  "ORBIT_LEVEL_EVERY", "ORBIT_INNER_RADIUS", "ORBIT_RADIUS_STEP", "ORBIT_RING_COUNT",
  "ORBIT_DENSITY", "ORBIT_GAP_MULT", "ORBIT_GAP_MULT_FLOOR", "ORBIT_GAP_MULT_STEP",
  "ORBIT_SAFETY_MARGIN", "ORBIT_ANG_VEL", "ORBIT_FAST_MULT", "ORBIT_FAST_RING",
  "DEBRIS_RADII", "SHIP_RADIUS", "WORLD_W", "WORLD_H", "TAU", "dist2", "wrapPos", "DOCK_RADIUS", "LEVER_DOCK_SIZE",
  "leverScale", "AudioSys", "GAME_VERSION", "DEBUG_VARS",
];

function build({ audio = false, store = {} } = {}) {
  const c = makeCtxStub();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: undefined, webkitAudioContext: undefined
  };
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

// A deterministic LCG, same idiom as test-cs021-p1.js.
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function withRandom(gen, fn) {
  const saved = Math.random;
  Math.random = gen;
  try { return fn(); } finally { Math.random = saved; }
}

// The shipped generator arguments, exactly as spawnOrbitWave() assembles them — EXCEPT minGapMultiplier,
// which P1 hardcoded to ORBIT_GAP_MULT and P2 now derives from orbitGapMult(level). Passed explicitly so
// every call site in this file is honest about which level's multiplier it is using.
function shippedArgs(X, centerX, centerY, gapMult) {
  return {
    satelliteDiameter: X.DEBRIS_RADII[3] * 2,
    shipDiameter:      X.SHIP_RADIUS * 2,
    centerX, centerY,
    orbitCount:        X.ORBIT_RING_COUNT,
    innerRadius:       X.ORBIT_INNER_RADIUS,
    radiusStep:        X.ORBIT_RADIUS_STEP,
    safetyMargin:      X.ORBIT_SAFETY_MARGIN,
    minGapMultiplier:  gapMult,
    densityByOrbit:    X.ORBIT_DENSITY,
    baseAngVel:        X.ORBIT_ANG_VEL,
    fastRingIndex:     X.ORBIT_FAST_RING - 1,
    fastRingMult:      X.ORBIT_FAST_MULT,
  };
}

// Drive the game to absolute level `w` through the REAL nextWave(), clearing the field first so the
// post-call array length is that level's ACTUAL spawn count (same idiom as test-cs021-p1.js).
function atWave(X, w) {
  X.game.wave = w - 1;
  X.game.debris.length = 0;
  X.nextWave();
  return X.game.debris.length;
}

// ================= (A, part 2) source pins =====================
(function sectionA_pins() {
  const X = build();
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");

  // TRAP 1 — REPOINTED BY CS021 P5: the bump has landed, so this becomes its mirror image.
  assert(X.GAME_VERSION !== "1.0.0.20", "A: TRAP 1 — GAME_VERSION moved off the pre-CS021 baseline (P5 bumped it)");

  // The occurrence-scaled multiplier exists exactly once, and reads exactly the constants spec §5 names.
  eq((scriptSrc.match(/function orbitGapMult\(/g) || []).length, 1, "A: exactly one orbitGapMult definition");
  assert(/occurrence\s*=\s*level\s*\/\s*ORBIT_LEVEL_EVERY/.test(codeOnly),
    "A: orbitGapMult computes occurrence = level / ORBIT_LEVEL_EVERY");
  assert(/Math\.max\(ORBIT_GAP_MULT_FLOOR,\s*ORBIT_GAP_MULT\s*-\s*\(occurrence\s*-\s*1\)\s*\*\s*ORBIT_GAP_MULT_STEP\)/.test(codeOnly),
    "A: orbitGapMult clamps at ORBIT_GAP_MULT_FLOOR via Math.max, decaying by ORBIT_GAP_MULT_STEP per occurrence");

  // The two new constants, at spec §5's values, each declared exactly once.
  eq(X.ORBIT_GAP_MULT_FLOOR, 1.8, "A: ORBIT_GAP_MULT_FLOOR ships at the hard 1.8x floor");
  eq(X.ORBIT_GAP_MULT_STEP, 0.1, "A: ORBIT_GAP_MULT_STEP ships at 0.1x per occurrence");
  eq(X.ORBIT_GAP_MULT, 2.5, "A: ORBIT_GAP_MULT is still the occurrence-1 base value (unchanged by P2)");
  eq((codeOnly.match(/const ORBIT_GAP_MULT_FLOOR\s*=/g) || []).length, 1, "A: ORBIT_GAP_MULT_FLOOR declared exactly once");
  eq((codeOnly.match(/const ORBIT_GAP_MULT_STEP\s*=/g) || []).length, 1, "A: ORBIT_GAP_MULT_STEP declared exactly once");

  // THE WIRING (STATUS.md's own P1 note: "do not push a constant read down into the generator" — the
  // generator itself must stay unaware of occurrence; only the CALL SITE changes).
  assert(!/generateOrbitLayout[\s\S]{0,50}orbitGapMult/.test(codeOnly),
    "A: generateOrbitLayout() itself does not call orbitGapMult — it stays pure, unaware of occurrence");
  assert(/function spawnOrbitWave\(speedMul,\s*gapMult\)/.test(codeOnly),
    "A: spawnOrbitWave() takes gapMult as its second parameter");
  assert(/minGapMultiplier:\s*gapMult,/.test(codeOnly),
    "A: spawnOrbitWave() feeds the PARAMETER to minGapMultiplier, not a literal");
  assert(!/minGapMultiplier:\s*ORBIT_GAP_MULT,/.test(codeOnly),
    "A: the fixed ORBIT_GAP_MULT no longer reaches minGapMultiplier directly (P1's wiring is gone)");
  // REPOINTED BY CS021 P3: the call site now goes through orbitEffectiveGapMult(), which reads the SAME
  // orbitGapMult(level) curve unless the debug slider has been moved off its default (spec §6 table) —
  // untouched (every test in this file, which never calls applyDebug), the two are behaviourally
  // identical, which is exactly what (C2) below drives and asserts against real nextWave() totals.
  assert(/spawnOrbitWave\(speedMul,\s*orbitEffectiveGapMult\(game\.wave\)\)/.test(codeOnly),
    "A: REPOINTED BY CS021 P3 — nextWave()'s orbit branch calls spawnOrbitWave with orbitEffectiveGapMult(game.wave)");
  eq((scriptSrc.match(/function orbitEffectiveGapMult\(/g) || []).length, 1,
    "A: REPOINTED BY CS021 P3 — exactly one orbitEffectiveGapMult() definition");
  // Exactly one DEFINITION and one CALL — "spawnOrbitWave(" itself matches both, so count them apart by
  // whether "function " precedes the match.
  const spawnOrbitWaveHits = codeOnly.match(/(function )?spawnOrbitWave\(/g) || [];
  eq(spawnOrbitWaveHits.filter(h => h.startsWith("function")).length, 1, "A: exactly one spawnOrbitWave() definition");
  eq(spawnOrbitWaveHits.filter(h => !h.startsWith("function")).length, 1, "A: exactly one spawnOrbitWave() CALL site");
})();

// ================= (B) gapMult PINNED at levels 3 / 24 / 63 =====================
(function sectionB() {
  console.log("(B) gapMult pinned: level 3 -> 2.5, level 24 -> 1.8 (first floor level), level 63 -> 1.8");
  const X = build();

  close(X.orbitGapMult(3), 2.5, "B: level 3 (occurrence 1) -> 2.5x, the shipped occurrence-1 base");
  close(X.orbitGapMult(24), 1.8, "B: level 24 (occurrence 8) -> 1.8x, the FIRST level at the floor");
  close(X.orbitGapMult(63), 1.8, "B: level 63 (occurrence 21, the last orbit level) -> 1.8x, held at the floor");

  // The step just before the floor is still above it, so 24 really is the first floor level, not an
  // early clamp.
  close(X.orbitGapMult(21), 1.9, "B: level 21 (occurrence 7) -> 1.9x, one step short of the floor");
  assert(X.orbitGapMult(21) > X.ORBIT_GAP_MULT_FLOOR, "B: (control) level 21 has not yet reached the floor");

  // The full decay shape across every occurrence 1..21 (levels 3..63, step 3): non-increasing, matches
  // the closed form exactly until the clamp binds, and never drops below the floor.
  let prev = Infinity;
  for (let occ = 1; occ <= 21; occ++) {
    const level = occ * 3;
    const got = X.orbitGapMult(level);
    const unclamped = 2.5 - (occ - 1) * 0.1;
    close(got, Math.max(1.8, unclamped), `B: occurrence ${occ} (level ${level}): gapMult matches the closed form`);
    assert(got <= prev + 1e-9, `B: occurrence ${occ}: gapMult is non-increasing (prev ${prev}, got ${got})`);
    assert(got >= X.ORBIT_GAP_MULT_FLOOR - 1e-9, `B: occurrence ${occ}: never below the floor`);
    prev = got;
  }
  // Past the plateau (levels > LEVEL_MAX still read the unclamped level per FORK-CS021-E) the multiplier
  // stays pinned at the floor rather than going negative or throwing.
  for (const level of [66, 99, 300, 6009]) {
    close(X.orbitGapMult(level), 1.8, `B: level ${level} (deep past the plateau) still clamps at the floor`);
  }

  // ONE VARIABLE SCALES (spec §5): the density curve and both angular velocities are read as CONSTANTS,
  // not functions of level — orbitGapMult() is the only level-dependent input to the generator.
  eq(JSON.stringify(X.ORBIT_DENSITY), "[0.75,0.45,0.35,0.85]",
    "B: ORBIT_DENSITY is still the fixed curve — untouched by occurrence scaling");
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
  assert(!/ORBIT_DENSITY\s*=\s*[^,;]*orbitGapMult/.test(codeOnly) && !/ORBIT_ANG_VEL\s*=\s*[^,;]*orbitGapMult/.test(codeOnly),
    "B: (source) neither the density curve nor the base angular velocity is derived from orbitGapMult");
  // Two real orbit waves at different occurrences: same density-derived ring shape, same angVel per ring,
  // only the SPACING differs.
  withRandom(seededRandom(0xB2B2), () => {
    X.startGame();
    atWave(X, 3);
    const angVel3 = [...new Set(X.game.debris.map(d => d.orbitAngVel))].sort((a, b) => a - b);
    atWave(X, 24);
    const angVel24 = [...new Set(X.game.debris.map(d => d.orbitAngVel))].sort((a, b) => a - b);
    eq(JSON.stringify(angVel3), JSON.stringify(angVel24),
      "B: the SET of ring angular velocities at level 3 and level 24 is identical (angVel does not scale)");
  });
})();

// ================= (C) SATELLITE TOTALS across the scaling range =====================
(function sectionC() {
  console.log("(C) satellite totals: 40 at occurrence 1, 45 at the floor, maxCount widening 7/13/19/25 -> 8/14/21/28");
  const X = build();

  // -- (C1) the pure generator, fed orbitGapMult() directly --
  const L1  = withRandom(seededRandom(0xC001), () => X.generateOrbitLayout(shippedArgs(X, 1280, 720, X.orbitGapMult(3))));
  const L24 = withRandom(seededRandom(0xC024), () => X.generateOrbitLayout(shippedArgs(X, 1280, 720, X.orbitGapMult(24))));
  const L63 = withRandom(seededRandom(0xC063), () => X.generateOrbitLayout(shippedArgs(X, 1280, 720, X.orbitGapMult(63))));

  eq(L1.total, 40, "C1: occurrence 1 (level 3) totals 40 (unchanged from P1)");
  eq(L24.total, 45, "C1: occurrence 8 (level 24, the floor) totals 45");
  eq(L63.total, 45, "C1: occurrence 21 (level 63) still totals 45 — held at the floor");

  const WANT_MAXCOUNT_1  = [7, 13, 19, 25];
  const WANT_MAXCOUNT_24 = [8, 14, 21, 28];
  const WANT_COUNT_24    = [6, 7, 8, 24];
  L1.rings.forEach((r, i) => eq(r.maxCount, WANT_MAXCOUNT_1[i], `C1: occurrence 1 ring ${i + 1} maxCount unchanged at ${WANT_MAXCOUNT_1[i]}`));
  L24.rings.forEach((r, i) => {
    eq(r.maxCount, WANT_MAXCOUNT_24[i], `C1: occurrence 8 ring ${i + 1} maxCount widened to ${WANT_MAXCOUNT_24[i]}`);
    eq(r.count, WANT_COUNT_24[i], `C1: occurrence 8 ring ${i + 1} count is ${WANT_COUNT_24[i]}`);
  });
  eq(L63.rings.map(r => r.maxCount).join("/"), WANT_MAXCOUNT_24.join("/"), "C1: level 63's maxCounts match the floor's (8/14/21/28)");

  // The density curve itself never changed — only maxCount (a function of gapMult) moved, which is what
  // pushes round(1 + density * (maxCount - 1)) to a new integer for rings 2-4.
  eq(JSON.stringify(L1.rings.map(r => r.density)), JSON.stringify(L24.rings.map(r => r.density)),
    "C1: per-ring density is identical at occurrence 1 and occurrence 8 — only maxCount widened");

  // -- (C2) THE REAL WIRING: drive nextWave() itself and check the ACTUAL spawn, not just the pure
  //    generator fed a hand-picked value. This is what proves spawnOrbitWave() really receives
  //    orbitGapMult(game.wave) rather than still being hardwired to the fixed ORBIT_GAP_MULT (in which
  //    case every occurrence would still total 40, exactly the P1 behaviour this phase supersedes).
  withRandom(seededRandom(0xC2C2), () => {
    X.startGame();
    const n3  = atWave(X, 3);
    const n24 = atWave(X, 24);
    const n63 = atWave(X, 63);
    eq(n3, 40, "C2: a REAL level-3 wave (occurrence 1) spawns 40 satellites");
    eq(n24, 45, "C2: a REAL level-24 wave (occurrence 8, the floor) spawns 45 satellites");
    eq(n63, 45, "C2: a REAL level-63 wave (occurrence 21) spawns 45 satellites");

    // Per-ring counts from the REAL spawn at the floor, grouped by orbitRadius (the ring identity),
    // matching (6, 7, 8, 24) exactly — the granular proof, not just the total.
    const byRadius = {};
    for (const d of X.game.debris) byRadius[d.orbitRadius] = (byRadius[d.orbitRadius] || 0) + 1;
    const radii = Object.keys(byRadius).map(Number).sort((a, b) => a - b);
    eq(radii.length, 4, "C2: (setup) the real level-63 wave has four distinct ring radii");
    const gotCounts = radii.map(r => byRadius[r]);
    eq(JSON.stringify(gotCounts), JSON.stringify(WANT_COUNT_24),
      `C2: the REAL spawn's per-ring counts at the floor are 6/7/8/24 (got ${gotCounts.join("/")})`);
  });

  // -- (C3) the climb is MONOTONIC (non-decreasing) across occurrences 1..21, from 40 up to 45, never
  //    overshooting or oscillating.
  let prevTotal = 0;
  for (let occ = 1; occ <= 21; occ++) {
    const level = occ * 3;
    const L = withRandom(seededRandom(0xC300 + occ), () => X.generateOrbitLayout(shippedArgs(X, 1280, 720, X.orbitGapMult(level))));
    assert(L.total >= prevTotal, `C3: occurrence ${occ} (level ${level}): total ${L.total} is non-decreasing (prev ${prevTotal})`);
    assert(L.total >= 40 && L.total <= 45, `C3: occurrence ${occ}: total ${L.total} stays within [40, 45]`);
    prevTotal = L.total;
  }
  eq(prevTotal, 45, "C3: the climb really does reach 45 by occurrence 21");
})();

// ================= (D) THE FAIRNESS SWEEP RE-RUN — spec §8 items 1-4, occurrence-scaled ===============
(function sectionD() {
  console.log("(D) fairness sweep re-run at occurrence-scaled values: spec §8 items 1-4, EVERY orbit level 3..63");
  const X = build();
  const shipDiameter = X.SHIP_RADIUS * 2;
  const satR = X.DEBRIS_RADII[3];
  const budget = X.WORLD_H / 2 - 20;
  const wave1Dock = X.DOCK_RADIUS * X.leverScale(X.LEVER_DOCK_SIZE, 1);
  const absoluteFloorPx = shipDiameter * X.ORBIT_GAP_MULT_FLOOR;   // the TRUE, fixed fairness floor (46.8 px)

  // item 1 IS A TWO-PART CLAIM, and only together do the parts mean "the fairness floor holds":
  //   1a. the MULTIPLIER itself never drops below ORBIT_GAP_MULT_FLOOR (the clamp's own job) — this is
  //       the half (E) below shows has teeth; without it, deep occurrences drift arbitrarily low.
  //   1b. the generator's actualGapPx self-consistently honours WHATEVER multiplier it is given — true
  //       by construction (maxCount = floor(circumference / spacePerSatellite)), so this half alone
  //       proves nothing about fairness — a saboteur could feed it 0.1x and it would still "hold".
  // Only 1a+1b together transitively guarantee actualGapPx >= shipDiameter x 1.8 at every shipped level.
  let orbitLevels = 0, worstGap = Infinity, worstEdge = 0;
  for (let n = 1; n <= 63; n++) {
    if (X.levelDef(n).archetype !== "orbit") continue;
    orbitLevels++;
    const gapMult = X.orbitGapMult(n);
    // item 1a — the value-level floor: orbitGapMult() itself never drops below the clamp.
    assert(gapMult >= X.ORBIT_GAP_MULT_FLOOR - 1e-9,
      `D: level ${n}: orbitGapMult (${gapMult.toFixed(2)}) never drops below ORBIT_GAP_MULT_FLOOR (${X.ORBIT_GAP_MULT_FLOOR})`);
    const L = withRandom(seededRandom(0xD0D0 + n), () => X.generateOrbitLayout(shippedArgs(X, 1280, 720, gapMult)));
    for (const r of L.rings) {
      // item 1b — self-consistency: the generator honours WHATEVER multiplier it was asked for.
      assert(r.actualGapPx >= shipDiameter * gapMult - 1e-9,
        `D: level ${n} ring ${r.index + 1}: arc gap ${r.actualGapPx.toFixed(2)} >= shipDiameter x ${gapMult.toFixed(2)} (${(shipDiameter * gapMult).toFixed(2)})`);
      // 1a+1b together: every ring, at every occurrence, clears the TRUE fixed floor (46.8 px).
      assert(r.actualGapPx >= absoluteFloorPx - 1e-9,
        `D: level ${n} ring ${r.index + 1}: arc gap ${r.actualGapPx.toFixed(2)} >= the absolute fairness floor (${absoluteFloorPx.toFixed(2)} px)`);
      // item 2 — the count is inside its own bound, and the §1.1 guard never fired
      assert(r.maxCount >= 1, `D: level ${n} ring ${r.index + 1}: maxCount >= 1`);
      assert(r.count >= 1 && r.count <= r.maxCount,
        `D: level ${n} ring ${r.index + 1}: 1 <= count (${r.count}) <= maxCount (${r.maxCount})`);
      worstGap = Math.min(worstGap, r.actualGapPx);
    }
    // item 3 — the Correction-C3 failure can never regress in (radii are fixed, so this is level-invariant,
    // but re-asserted at every occurrence so a future radius change can't silently break it there)
    assert(L.outerEdge <= budget, `D: level ${n}: outermost satellite edge ${L.outerEdge} <= ${budget}`);
    worstEdge = Math.max(worstEdge, L.outerEdge);
    // item 4 — the inner ring clears a wave-1 dock (also level-invariant; re-asserted per occurrence)
    assert(X.ORBIT_INNER_RADIUS - satR >= wave1Dock,
      `D: level ${n}: innerRadius - satRadius (${X.ORBIT_INNER_RADIUS - satR}) >= wave-1 dock radius (${wave1Dock})`);
    eq(L.rejected.length, 0, `D: level ${n}: no ring was rejected`);
  }
  eq(orbitLevels, 21, "D: 21 orbit levels across 1..63 (FORK-CS021-E — every 3rd)");
  assert(worstGap >= absoluteFloorPx - 1e-9,
    `D: the tightest lane across ALL 21 occurrences (${worstGap.toFixed(2)} px) never drops below the absolute floor (${absoluteFloorPx.toFixed(2)} px)`);
  console.log(`    tightest lane across all 21 occurrences: ${worstGap.toFixed(2)} px (absolute floor ${absoluteFloorPx.toFixed(2)}); widest edge ${worstEdge} px (budget ${budget})`);

  // -- also re-run at the debug-range extremes P3 will expose (spec §6: orbitGapMult 1.5-4.0), so this
  //    sweep does not silently depend on the SHIPPED occurrence curve ever staying inside [1.8, 2.5].
  for (const extreme of [1.5, 4.0]) {
    const L = withRandom(seededRandom(0xD0EE), () => X.generateOrbitLayout(shippedArgs(X, 1280, 720, extreme)));
    for (const r of L.rings) {
      assert(r.actualGapPx >= shipDiameter * extreme - 1e-9,
        `D: (debug-range extreme ${extreme}x) ring ${r.index + 1}: arc gap ${r.actualGapPx.toFixed(2)} >= ${(shipDiameter * extreme).toFixed(2)}`);
    }
    eq(L.rejected.length, 0, `D: (debug-range extreme ${extreme}x) no ring was rejected`);
  }
})();

// ================= (E) MUTANT CHECK — the 1.8 clamp removed =====================
// Per the suite's convention: prove (D)'s item-1a assertion — "orbitGapMult(level) never drops below
// ORBIT_GAP_MULT_FLOOR" — has TEETH by showing that without the Math.max clamp, it demonstrably does not
// hold at real, in-range orbit levels. This does NOT patch and re-eval the HTML source (the mutation is a
// one-line arithmetic change); instead it computes the SAME closed-form formula orbitGapMult() uses,
// minus the clamp, and shows the counterfactual value itself falls under the floor.
//
// A NOTE ON WHAT THIS DOES NOT SHOW, RECORDED HONESTLY RATHER THAN GLOSSED OVER: an earlier draft of this
// section tried to prove the clamp's removal produces a GEOMETRIC violation (some ring's actualGapPx
// dropping below shipDiameter x 1.8 = 46.8 px) by feeding the unclamped VALUE into the real, unmodified
// generateOrbitLayout(). It does not — measured, not assumed. At the shipped ORBIT_DENSITY curve (max
// 0.85, never 1.0) every ring's rounded COUNT stays enough below its maxCount that actualGapPx never
// drops under ~54 px even as minGapMultiplier is pushed arbitrarily low (generateOrbitLayout's own
// ADDITIVE floor, shipDiameter + ORBIT_SAFETY_MARGIN = 34 px, caps how tight minRequiredGap can ever get,
// and 34 px still leaves enough slack at these densities that no ring's count ever reaches the point
// where the arc gap would bite). So the geometric self-consistency check (D's item 1b, "actualGapPx >=
// shipDiameter x gapMult(level)") is NOT what the clamp protects here — it holds trivially by
// construction regardless of what value it is fed, clamped or not. What the clamp actually protects is
// the VALUE itself: without it, orbitGapMult(level) would report a multiplier below 1.8 (or negative) as
// the level's "fairness floor", which is a false, misleading number even though the generator it feeds
// happens to still produce a wide-enough gap at THIS density curve. That is exactly what (D)'s item 1a
// checks and what this section falsifies under the mutation — real teeth, just at the value level rather
// than the geometry.
(function sectionE() {
  console.log("(E) mutant check: remove the 1.8 clamp -> the reported multiplier itself violates the floor");
  const X = build();

  function unclampedGapMult(level) {
    const occurrence = level / X.ORBIT_LEVEL_EVERY;
    return X.ORBIT_GAP_MULT - (occurrence - 1) * X.ORBIT_GAP_MULT_STEP;   // NO Math.max floor
  }

  // (setup) the two formulas agree everywhere ABOVE the floor — the mutation only ever matters once the
  // raw expression would have dipped under 1.8, so this isn't a blanket rewrite that "changes everything".
  for (const level of [3, 6, 9, 12, 15, 18, 21]) {
    close(X.orbitGapMult(level), unclampedGapMult(level),
      `E: (setup) level ${level} (above the floor): clamped and unclamped formulas agree`);
  }

  // THE POINT: at and past occurrence 9 (level 27) — still WELL inside the shipped 3..63 range — the
  // unclamped formula reports a multiplier below ORBIT_GAP_MULT_FLOOR. The REAL, shipped orbitGapMult()
  // does not (it is what (D)'s item 1a sweeps and confirms holds at every one of the 21 orbit levels).
  let violations = 0;
  for (let n = 3; n <= 63; n += 3) {
    const real = X.orbitGapMult(n);
    const mutant = unclampedGapMult(n);
    assert(real >= X.ORBIT_GAP_MULT_FLOOR - 1e-9, `E: CONTROL — the REAL orbitGapMult(${n}) never violates the floor (got ${real.toFixed(2)})`);
    if (mutant < X.ORBIT_GAP_MULT_FLOOR - 1e-9) violations++;
  }
  assert(violations > 0,
    `E: WITHOUT the clamp, ${violations} of the 21 orbit levels report a multiplier below the floor — (D)'s item-1a assertion has teeth`);
  close(unclampedGapMult(63), 0.5, "E: at level 63 specifically, the unclamped formula would report 0.5x — nonsensical as a 'fairness floor'");
  assert(unclampedGapMult(63) < 0 === false && unclampedGapMult(63) < X.ORBIT_GAP_MULT_FLOOR,
    "E: ... which is a real, demonstrable violation of the 1.8x floor (0.5 < 1.8)");

  // And even deeper than the shipped range, the unclamped formula goes negative — a "fairness multiplier"
  // that is not just under the floor but nonsensical on its face, which is exactly the failure mode the
  // clamp exists to prevent from ever reaching the generator.
  assert(unclampedGapMult(300) < 0, "E: past the shipped range, the unclamped formula goes NEGATIVE (level 300)");
  close(X.orbitGapMult(300), 1.8, "E: CONTROL — the REAL orbitGapMult(300) still clamps at 1.8, however deep the level");
})();

console.log(`\ntest-cs021-p2: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
