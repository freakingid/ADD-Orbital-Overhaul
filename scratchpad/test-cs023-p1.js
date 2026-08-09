// Headless test for CS023 Phase 1 — GEOMETRY, WORLD SIZE, AND THE INVERTED RAMP — and its respacing,
// Phase 4c (spec C16).
//
//   node scratchpad/test-cs023-p1.js
//
// WHAT LANDED (PLANNED-FEATURES-CS023 §1.3/§1.4/§4.1/§4.2, Corrections C2-C8 and C16, FORK-CS023-A/G).
// Five moving parts, all of them about what an ORBIT LEVEL CONTAINS and none of them touching a field
// level:
//
//   1. THE WORLD (§1.3, C2). WORLD_SIZE_ORBIT 16 -> 9, i.e. 5120x2880 -> 3840x2160. A VALUE change, not
//      a rename. WORLD_SIZE_MAX is derived (Math.max) and follows; STAR_COUNT is area-derived from THAT
//      and follows (1280 -> 720, C8), while the active-at-field-size count stays ~320 because the field
//      world is 4/9 of a size-9 world's area exactly as it was 1/4 of a size-16 one.
//   2. THE SHELL (§1.3, §4.1; RESPACED BY P4C, C16). ORBIT_INNER_RADIUS 460 -> 400 and ORBIT_RADIUS_STEP
//      276 -> 200, putting the four rings at 400 / 600 / 800 / 1000 and the outermost satellite EDGE at
//      1,046 px against the size-9 world's 1,060 px wrap-clean budget — 14 px of headroom, and a 204 px
//      ceiling on any future step. Ring 1 clears the permanent 88 px dock by 266 px; the INTER-RING
//      radial corridor is 108 px.
//   3. THE DENSITY CURVE GOES FLAT (§1.3). ORBIT_DENSITY -> [0.12, 0.12, 0.12, 0.12]. The full four-ring
//      shell is 18 satellites at EVERY occurrence, against CS022's 65-71 — the ~5x cut that pays for
//      CS023 P2/P3's two new O(n^2) passes.
//   4. ORBIT_FAST_RING BECOMES A LIST (C3, FORK-CS023-G). `3` -> `[2, 4]`, human 1-based ring numbers, ANY
//      length including empty. generateOrbitLayout's parameter is renamed `fastRingIndices` and its
//      `i === fastRingIndex` becomes set membership. Arbitrary length is the point of the type change —
//      P4's speed cap depends on it (C14).
//   5. THE RAMP IS INVERTED (§1.4, FORK-CS023-A). activeRingsFor(level) returns [0], [0,1], [0,1,2],
//      [0,1,2,3] — INNERMOST first, complete at occurrence 4 (level 12) and held. One line of code. Two
//      consequences: level 3's whole shell is ring 1, 266 px off the dock; and layout.rings' ARRAY
//      POSITION is its RING INDEX again, reversing CS022 P3's known issue.
//
// WHAT PHASE 4C CHANGED, AND WHICH OF THIS FILE'S OWN CLAIMS IT REVERSED (spec C16). P4c moves ONE
// constant — ORBIT_RADIUS_STEP 138 -> 200 — and everything else here follows by derivation. Three
// assertions in this file were not merely re-numbered but INVERTED, each with a CORRECTED BY CS023 P4C
// note beside it rather than a deletion, because a claim that quietly disappears is a behaviour the suite
// has stopped watching:
//   * §G — orbitEffectiveCount(5). P1 shipped a FIFTH ring that fitted (998 px inside 1,060) and asserted
//     that as a CHANGE from CS022's clamp-to-4. At a 200 px step a fifth reaches 1,246 px, so the clamp
//     walks back to four and the CS022 reference build AGREES with the live one again. orbitDensity5 is
//     back to being a knob no shipped spawn ever reads.
//   * §C — C5's occurrence curve. P1 found it bought exactly ONE satellite in the whole game (ring 2 at
//     occurrence 3). At a 200 px step it buys ZERO: the rounding in `round(1 + 0.12 * (maxCount - 1))`
//     absorbs the gap-multiplier decay on ALL FOUR rings, so the shell is IDENTICAL at every occurrence
//     from 1 to 21. "Nearly inert" became "inert", and the test moved from "find the one step" to "prove
//     there is no step".
//   * §A — the step's DERIVATION. P1's 138 px was 1.5 large-satellite diameters and this file asserted
//     that as arithmetic. 200 px is ~2.17 diameters: P4c retired the derive-from-satellite-size rule for
//     the STEP (it still sets the corridor), so the assertion is inverted to prove the rule is gone.
//   And one consequence that is a re-numbering rather than a reversal, but is the reason C16 exists: the
//   four-ring outer edge is 1,046 px against a 1,060 px budget. §G pins that 14 px MARGIN as a named
//   value and adds a sandbox proving a 205 px step silently drops the shell to THREE rings — the failure
//   mode the walk-down in orbitEffectiveCount() has no log line for.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL startGame/nextWave/update(1/60)/draw path. NOTHING under test is
// reimplemented — every expectation is recomputed from the same generateOrbitLayout + activeRingsFor +
// levelDef + worldDims the shipped code is wired to, so each is a WIRING check rather than a restated
// literal. The deliberate literal pins are named where they occur: spec §1.4's published table (§B) and
// the retired CS022 geometry the reference build carries (§E).
//
// Sections (spec §6 items 1, 2, 3, 4, 5, 19, 20):
//  (A) item 20 — node --check + source pins for every constant this phase moves and every one it does not
//  (B) item 1  — the §1.4 table at EVERY orbit level 3..63, via a REAL nextWave(), grouped by orbitRadius
//  (C) item 1  — the counts through the GENERATOR, with C5's curve asserted INERT: the shell is
//                identical at every occurrence from 1 to 21 (P4c inverted P1's single-satellite step)
//  (D) item 4  — the fast-ring LIST: keyed by ring index at every occurrence, plus lengths 0/1/3/4
//  (E) item 5  — RAMP DIRECTION as a BEHAVIOURAL claim against a pinned-SHA CS022 reference module,
//                plus rings[k].index === k at every occurrence
//  (F) item 2  — world size: every orbit level 3840x2160, every field level 2560x1440, dmax 1020/660
//  (G) item 3  — the budget and the clamp: outer edge 1046 vs 1060, the 14 px margin as a NAMED value,
//                orbitEffectiveCount(5) === 4 (C6 REVERSED by C16), and the step-205 three-ring sandbox
//  (H) C8      — STAR_COUNT follows WORLD_SIZE_MAX by derivation; active-at-field-size stays ~320
//  (I) TRAPs 1-4, including field levels BYTE-IDENTICAL to the pre-P1 build under one seed
//  (J) item 19 — determinism
//  (K) item 20 — AudioSys.ctx null smoke across a real ramp

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

// A FIXED SHA, never HEAD — the CS017 P6 trap. f9db5c2 is the commit immediately before this phase, and
// its asteroids-deluxe.html is byte-identical to CS022 P4's (b62d950) and to the public HEAD the spec
// names (6654ef6) — that commit touched only the two CS023 planning documents. It is therefore "the
// CS022 build" for every purpose in this file: §E's ramp-direction control and §I's field-level
// byte-identity pin both build from it.
const PRE_P1_REF = "f9db5c2";

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function close(got, want, msg, eps = 1e-9) { assert(Math.abs(got - want) < eps, `${msg} (got ${got}, want ${want})`); }
function noThrow(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.stack); } }

// ================= (A, part 1) syntax =====================
(function sectionA_syntax() {
  console.log("(A) node --check + source pins");
  const tmp = path.join(repoRoot, "scratchpad", "_cs023p1_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ---- Headless environment (the standing stub idiom) ----
function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    Q: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    threshold: { value: 0, setValueAtTime() {} }, ratio: { value: 1, setValueAtTime() {} },
    attack: { value: 0, setValueAtTime() {} }, release: { value: 0, setValueAtTime() {} },
    detune: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} },
    type: "sine", buffer: null, loop: false, curve: null, playbackRate: { value: 1 }, onended: null,
    connect() { return makeAudioNode(); }, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
function FakeAudioContext() {
  return new Proxy({
    state: "running", currentTime: 0, sampleRate: 44100, destination: makeAudioNode(),
    createGain() { return makeAudioNode(); },
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; },
    createPeriodicWave() { return {}; },
    createWaveShaper() { return makeAudioNode(); },
    createDynamicsCompressor() { return makeAudioNode(); },
    resume() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
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
  "game", "startGame", "update", "draw", "nextWave", "destroyDebris", "levelDef",
  "DebrisSatellite", "Dock",
  // the CS023 P1 surface
  "generateOrbitLayout", "activeRingsFor", "spawnOrbitWave", "spawnFieldSatellites",
  "orbitGapMult", "orbitEffectiveGapMult", "orbitEffectiveCount", "orbitRadiusStepFor",
  "ORBIT_LEVEL_EVERY", "ORBIT_INNER_RADIUS", "ORBIT_RADIUS_STEP", "ORBIT_RING_COUNT",
  "ORBIT_DENSITY", "ORBIT_GAP_MULT", "ORBIT_GAP_MULT_FLOOR", "ORBIT_GAP_MULT_STEP",
  "ORBIT_SAFETY_MARGIN", "ORBIT_ANG_VEL", "ORBIT_FAST_MULT", "ORBIT_FAST_RING", "ORBIT_SPAWN_TRIES",
  // shared constants every expectation derives from — never a restated literal
  "DEBRIS_RADII", "SHIP_RADIUS", "DOCK_RADIUS", "LEVER_DOCK_SIZE", "leverScale",
  "SPAWN_MIN_DIST", "SPAWN_MAX_DIST",
  "WORLD_W", "WORLD_H", "worldDims", "worldSizeFor",
  "WORLD_SIZE_FIELD", "WORLD_SIZE_ORBIT", "WORLD_SIZE_MAX",
  "VIEW_W", "VIEW_H", "STAR_COUNT", "STAR_DENSITY", "stars", "starsActive",
  "TAU", "dist2", "wrapPos", "AudioSys", "GAME_VERSION", "DEBUG", "DEBUG_VARS", "DEBUG_ENTRIES",
];

// `returns` lets the PRE-P1 build be constructed from the same list — every symbol above exists there
// too, since this phase adds no new symbol (it moves values and renames ONE generator parameter).
function buildFrom(src, { audio = true, extra = [], returns = RETURN } = {}) {
  const c = makeCtxStub();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? FakeAudioContext : undefined,
    webkitAudioContext: audio ? FakeAudioContext : undefined
  };
  const store = {};
  const localStorageStub = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + returns.concat(extra).join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
}
function build(opts) { return buildFrom(scriptSrc, opts); }

const preSrc = execFileSync("git", ["show", `${PRE_P1_REF}:asteroids-deluxe.html`],
  { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }).toString().match(/<script>([\s\S]*?)<\/script>/)[1];
function buildPre(opts) { return buildFrom(preSrc, opts); }

// A deterministic LCG — every build and every real spawn runs inside one (spec §6 item 19). The starfield
// is laid down with Math.random() at MODULE LOAD, so without this §H could never be byte-identical.
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function withRandom(gen, fn) {
  const saved = Math.random;
  Math.random = gen;
  try { return fn(); } finally { Math.random = saved; }
}
const seededBuild = (seed, opts) => withRandom(seededRandom(seed), () => build(opts));
const seededBuildPre = (seed, opts) => withRandom(seededRandom(seed), () => buildPre(opts));

// Drive to absolute level `w` through the REAL nextWave(), clearing the field first so the post-call
// array length is that level's ACTUAL spawn count (the standing idiom in this suite).
function atWave(X, w) {
  X.game.wave = w - 1;
  X.game.debris.length = 0;
  X.nextWave();
  return X.game.debris.length;
}

// The shipped generator arguments, exactly as spawnOrbitWave() assembles them — the ramp and the
// multiplier are the caller's, which is the CS021 P2 / CS022 P3 seam this phase does not touch.
function shippedArgs(X, centerX, centerY, gapMult, activeRings) {
  return {
    satelliteDiameter: X.DEBRIS_RADII[3] * 2,
    shipDiameter:      X.SHIP_RADIUS * 2,
    centerX, centerY,
    orbitCount:        X.ORBIT_RING_COUNT,
    innerRadius:       X.ORBIT_INNER_RADIUS,
    radiusStep:        X.orbitRadiusStepFor(X.ORBIT_RING_COUNT),
    safetyMargin:      X.ORBIT_SAFETY_MARGIN,
    minGapMultiplier:  gapMult === undefined ? X.ORBIT_GAP_MULT : gapMult,
    densityByOrbit:    X.ORBIT_DENSITY,
    baseAngVel:        X.ORBIT_ANG_VEL,
    fastRingIndices:   X.ORBIT_FAST_RING.map(n => n - 1),
    fastRingMult:      X.ORBIT_FAST_MULT,
    activeRings,
  };
}
// The same, for the PRE-P1 build, whose generator takes the SCALAR `fastRingIndex`.
function preArgs(P, centerX, centerY, gapMult, activeRings) {
  return {
    satelliteDiameter: P.DEBRIS_RADII[3] * 2,
    shipDiameter:      P.SHIP_RADIUS * 2,
    centerX, centerY,
    orbitCount:        P.ORBIT_RING_COUNT,
    innerRadius:       P.ORBIT_INNER_RADIUS,
    radiusStep:        P.orbitRadiusStepFor(P.ORBIT_RING_COUNT),
    safetyMargin:      P.ORBIT_SAFETY_MARGIN,
    minGapMultiplier:  gapMult === undefined ? P.ORBIT_GAP_MULT : gapMult,
    densityByOrbit:    P.ORBIT_DENSITY,
    baseAngVel:        P.ORBIT_ANG_VEL,
    fastRingIndex:     P.ORBIT_FAST_RING - 1,
    fastRingMult:      P.ORBIT_FAST_MULT,
    activeRings,
  };
}
// The expected spawn at a level, recomputed from the shipped helpers — never a restated literal.
function expectedSpawn(X, level) {
  const ringTotal = withRandom(seededRandom(0xE0E0 + level), () =>
    X.generateOrbitLayout(shippedArgs(X, 1280, 720, X.orbitGapMult(level), X.activeRingsFor(level)))).total;
  const fieldCount = X.levelDef(level).fieldCount;
  return { ringTotal, fieldCount, total: ringTotal + fieldCount };
}
const shippedRadii = X =>
  Array.from({ length: X.ORBIT_RING_COUNT }, (_, i) => X.ORBIT_INNER_RADIUS + i * X.ORBIT_RADIUS_STEP);

// ================= (A, part 2) source pins — spec §6 item 20 =====================
(function sectionA_pins() {
  const X = seededBuild(0xA001);

  // --- the constants this phase MOVES ---------------------------------------------------------------
  eq(X.WORLD_SIZE_ORBIT, 9, "A: WORLD_SIZE_ORBIT is 9 (spec C2 — a VALUE change from 16, never a rename)");
  assert(/^const WORLD_SIZE_ORBIT = 9;/m.test(codeOnly), "A: ...declared as the literal 9 in the source");
  eq(X.ORBIT_INNER_RADIUS, 400, "A: ORBIT_INNER_RADIUS is 400 (was 460)");
  // CORRECTED BY CS023 P4C (spec C16): 138 -> 200. P1 shipped 138 and packed all four rings into a
  // 506 px band; P4c respaces to 200 so they read as four orbits. The 138 is left named here as the
  // value this pin used to carry, so the diff is legible rather than silent.
  eq(X.ORBIT_RADIUS_STEP, 200, "A: P4C — ORBIT_RADIUS_STEP is 200 (276 -> 138 at P1 -> 200 here)");
  assert(/^const ORBIT_RADIUS_STEP   = 200;/m.test(codeOnly),
    "A: ...declared as the literal 200 in the source");
  eq(JSON.stringify(X.ORBIT_DENSITY), "[0.12,0.12,0.12,0.12]", "A: ORBIT_DENSITY is flat 0.12 on all four rings");
  eq(JSON.stringify(X.ORBIT_FAST_RING), "[2,4]", "A: ORBIT_FAST_RING is the LIST [2, 4] (was the scalar 3)");
  assert(Array.isArray(X.ORBIT_FAST_RING), "A: ...and it really is an Array");

  // --- and the ones TRAP 4 says do NOT move ---------------------------------------------------------
  eq(X.WORLD_SIZE_FIELD, 4, "A: TRAP 4 — WORLD_SIZE_FIELD untouched at 4");
  eq(X.ORBIT_RING_COUNT, 4, "A: TRAP 4 — ORBIT_RING_COUNT untouched at 4");
  eq(X.ORBIT_GAP_MULT, 2.5, "A: TRAP 4 — ORBIT_GAP_MULT untouched at 2.5");
  eq(X.ORBIT_GAP_MULT_FLOOR, 1.8, "A: TRAP 4 — ORBIT_GAP_MULT_FLOOR untouched at 1.8");
  eq(X.ORBIT_GAP_MULT_STEP, 0.1, "A: TRAP 4 — ORBIT_GAP_MULT_STEP untouched at 0.1");
  eq(X.ORBIT_SAFETY_MARGIN, 8, "A: TRAP 4 — ORBIT_SAFETY_MARGIN untouched at 8");
  close(X.ORBIT_ANG_VEL, 6 * Math.PI / 180, "A: TRAP 4 — ORBIT_ANG_VEL untouched at 6 deg/s");
  eq(X.ORBIT_FAST_MULT, 3.0, "A: TRAP 4 — ORBIT_FAST_MULT untouched at 3.0");
  eq(X.ORBIT_SPAWN_TRIES, 60, "A: TRAP 4 — ORBIT_SPAWN_TRIES untouched at 60");
  // orbitGapMult's own curve is untouched, checked as a FUNCTION rather than as three constants.
  close(X.orbitGapMult(3), 2.5, "A: TRAP 4 — orbitGapMult(3) still 2.5");
  close(X.orbitGapMult(24), 1.8, "A: TRAP 4 — orbitGapMult(24) still lands on the 1.8 floor");
  close(X.orbitGapMult(63), 1.8, "A: TRAP 4 — ...and still holds there at 63");

  // --- the derived quantities, asserted as DERIVATIONS, not as fresh literals -----------------------
  eq(X.WORLD_SIZE_MAX, Math.max(X.WORLD_SIZE_FIELD, X.WORLD_SIZE_ORBIT), "A: WORLD_SIZE_MAX is Math.max of the table");
  eq(X.WORLD_SIZE_MAX, 9, "A: ...which is 9 now that the orbit size dropped below 16");
  assert(/const WORLD_SIZE_MAX = Math\.max\(WORLD_SIZE_FIELD, WORLD_SIZE_ORBIT\);/.test(codeOnly),
    "A: ...and the source really derives it rather than restating a number");
  eq(JSON.stringify(X.worldDims(X.WORLD_SIZE_ORBIT)), "[3840,2160]", "A: worldDims(orbit) === [3840, 2160]");
  eq(JSON.stringify(X.worldDims(X.WORLD_SIZE_FIELD)), "[2560,1440]", "A: worldDims(field) === [2560, 1440]");

  // --- THE STEP'S DERIVATION, AND THE CORRIDOR FACTS -------------------------------------------------
  // CORRECTED BY CS023 P4C (spec C16). P1 asserted `ORBIT_RADIUS_STEP === 1.5 * satelliteDiameter` as
  // arithmetic — 138 really was 1.5 x 92 — and that assertion is now FALSE. It is INVERTED rather than
  // deleted: P4c retires the derive-the-STEP-from-satellite-size rule outright (200 px is ~2.17
  // diameters, a round number chosen for readable separation and then checked against the budget), and a
  // suite that simply dropped the claim would go quiet on a rule that was deliberately abandoned.
  const satR = X.DEBRIS_RADII[3];
  assert(X.ORBIT_RADIUS_STEP !== 1.5 * satR * 2,
    "A: P4C — the step is NO LONGER 1.5 large-satellite diameters (that rule shipped at P1's 138 and is retired)");
  eq(X.ORBIT_RADIUS_STEP, 200, "A: ...it is a round 200 px");
  close(X.ORBIT_RADIUS_STEP / (satR * 2), 2.174, "A: ...which is ~2.17 diameters, not a satellite-size derivation", 0.001);
  // The satellite diameter still sets the CORRIDOR. That half of the derivation survives.
  const dock = X.DOCK_RADIUS * X.leverScale(X.LEVER_DOCK_SIZE, 1);
  eq(dock, 88, "A: (setup) the dock is a permanent 88 px at every level");
  eq(X.ORBIT_INNER_RADIUS - satR - dock, 266, "A: ring 1 clears the dock by 266 px (spec §4.1) — UNMOVED by P4c");
  eq(X.ORBIT_RADIUS_STEP - satR * 2, 108, "A: P4C — the inter-ring radial corridor is 108 px (was 46 at P1's step)");
  const minRequiredGap = Math.max(X.SHIP_RADIUS * 2 + X.ORBIT_SAFETY_MARGIN, X.SHIP_RADIUS * 2 * X.ORBIT_GAP_MULT);
  eq(minRequiredGap, 65, "A: (setup) the in-ring fairness floor is 65 px at the base multiplier");
  // ...AND THE SECOND REVERSAL IN THE SAME PARAGRAPH. P1 asserted the corridor was NARROWER than the
  // fairness floor and that the mismatch was correct. At 108 px it is WIDER and there is no mismatch
  // left. The RULE the old assertion defended is the durable half and is re-asserted below.
  assert(X.ORBIT_RADIUS_STEP - satR * 2 > minRequiredGap,
    "A: P4C — the 108 px corridor is now WIDER than the 65 px in-ring floor (it was narrower at P1's 46 px)");

  // --- the constants-block comments this phase is required to write --------------------------------
  const constBlock = scriptSrc.slice(scriptSrc.indexOf("// ---------- CS021 P1: ORBIT LEVELS"),
                                     scriptSrc.indexOf("const ORBIT_SPAWN_TRIES"));
  assert(/1,046/.test(constBlock) && /1,060/.test(constBlock),
    "A: P4C — the fitted-radii paragraph names the 1,046 px edge against the 1,060 px budget");
  assert(/14 px/.test(constBlock),
    "A: ...and states the 14 px MARGIN explicitly (spec C16a — the walk-down is silent, so the margin must not be)");
  assert(/204 px/.test(constBlock),
    "A: ...and the 204 px CEILING on any future uniform step at four rings");
  assert(/266/.test(constBlock), "A: ...and ring 1's 266 px clearance over the dock");
  assert(/108 px/.test(constBlock) && /fairness floor/.test(constBlock),
    "A: ...and the 108 px corridor, against the fairness floor it is now WIDER than");
  // The corridor note is a REVERSAL of what P1 wrote there, and must say so rather than quietly restate.
  assert(/REVERSES WHAT THIS NOTE SAID/.test(constBlock),
    "A: ...flagged as a reversal of P1's narrower-than-the-floor argument, not a silent rewrite");
  assert(/never a repair|not a repair/.test(constBlock),
    "A: ...while KEEPING the durable rule — minRequiredGap governs tangential lanes only, so feeding the " +
    "step through it would still be a new rule if a future retune narrows the corridor again");
  // The retired 1.5-diameters derivation is named as retired, not simply absent.
  assert(/RETIRED THE "STEP IS 1\.5 LARGE-SATELLITE DIAMETERS" RULE/.test(constBlock),
    "A: ...and the block records that P4c retired the derive-the-step-from-satellite-size rule");
  // The rhythm sentence is DELETED, not amended — there is no rhythm at a flat curve. Both historical
  // wordings must be gone, and no new one may have appeared in their place.
  assert(!/tight -> breather -> widest -> wide/.test(constBlock) &&
         !/tight -> breather -> wide\/fast -> tightest/.test(constBlock) &&
         !/has rhythm/.test(constBlock),
    "A: the density rhythm sentence is DELETED, in every wording it ever had");
  // C5's finding is recorded in ORBIT_GAP_MULT's own block, and the block still says the curve RUNS.
  const gapBlock = scriptSrc.slice(scriptSrc.indexOf("// THE FAIRNESS FLOOR"),
                                   scriptSrc.indexOf("const ORBIT_GAP_MULT_FLOOR"));
  assert(/C5/.test(gapBlock), "A: the ORBIT_GAP_MULT block cites Correction C5");
  // CORRECTED BY CS023 P4C (spec C16): P1's block said the curve buys ONE satellite in the whole game and
  // this asserted that wording. At a 200 px step it buys ZERO, so the claim is inverted rather than
  // loosened — "nearly inert" and "inert" are different findings and the comment has to pick one.
  assert(/EXACTLY ZERO satellites/.test(gapBlock),
    "A: P4C — ...and states that the whole curve now buys EXACTLY ZERO satellites (was ONE at P1's step)");
  assert(/COMPLETELY INERT/.test(gapBlock),
    "A: ...calling the curve INERT rather than merely quiet");
  assert(/18 AT EVERY OCCURRENCE/.test(gapBlock),
    "A: ...and pinning the shell at 18 satellites at every occurrence");
  assert(/DO NOT retune/.test(gapBlock) && /DO NOT delete/.test(gapBlock),
    "A: ...and says not to retune a silent lever nor delete a working one");
  assert(/activeRingsFor/.test(gapBlock), "A: ...and names the ramp as what now carries escalation");

  // --- the ramp's own comment block: rewritten, and BOTH stale notes corrected ----------------------
  const rampBlock = scriptSrc.slice(scriptSrc.indexOf("// CS022 P3 (spec §1.2/§4.4, FORK-CS022-E), INVERTED"),
                                    scriptSrc.indexOf("function activeRingsFor(level)"));
  assert(rampBlock.length > 500, "A: (setup) the ramp's rationale block was located");
  assert(/INNERMOST FIRST/.test(rampBlock), "A: the ramp block argues INNERMOST first");
  assert(!/OUTERMOST FIRST/.test(rampBlock), "A: ...and no longer argues outermost first anywhere in it");
  assert(/ARRAY POSITION IS ITS RING INDEX AGAIN/.test(rampBlock),
    "A: ...and explicitly corrects the array-position-vs-ring-index note rather than deleting it");
  assert(/now false/.test(rampBlock),
    "A: ...saying in as many words that the two CS022 P3 notes claiming divergence are false");
  // The SECOND site: generateOrbitLayout's outerEdge comment, which claimed a constant 1,334 px "since
  // the ramp fills from the outside in".
  const genBlock = codeOnly.slice(codeOnly.indexOf("function generateOrbitLayout("));
  const genSrcBlock = scriptSrc.slice(scriptSrc.indexOf("function generateOrbitLayout("),
                                      scriptSrc.indexOf("// (Re)place ONE ring's satellites"));
  assert(/INSIDE OUT/.test(genSrcBlock), "A: the outerEdge comment — the second site — now says the ramp fills INSIDE OUT");
  assert(!/since the ramp fills from the outside in/.test(genSrcBlock),
    "A: ...and it no longer ASSERTS the outside-in fill as current fact");
  // The corrected note is required to say what changed rather than quietly drop the old claim — a reader
  // who finds only silence cannot tell whether the constant edge was retired or merely forgotten.
  assert(/REVERSES WHAT THIS USED TO SAY/.test(genSrcBlock),
    "A: ...and it explicitly flags itself as a reversal of the retired claim");
  assert(/446 \/ 646 \/ 846 \/ 1046/.test(genSrcBlock),
    "A: P4C — naming the outer edge's per-occurrence progression rather than a constant (446/584/722/860 at P1's step)");

  // --- the one-line code change, and the fast-ring type change --------------------------------------
  const arf = codeOnly.slice(codeOnly.indexOf("function activeRingsFor(level)"));
  // Trailing `//` comments have to come off too: `codeOnly` only drops lines that START with one, and the
  // fill loop carries `// CS023 P1: innermost first (was: count - 1 - i)` on the same line as the code.
  const arfBody = arf.slice(0, arf.indexOf("\n}\n")).split("\n").map(l => l.replace(/\/\/.*$/, "")).join("\n");
  assert(/rings\.push\(i\)/.test(arfBody), "A: activeRingsFor pushes `i` — innermost first");
  assert(!/count - 1 - i/.test(arfBody), "A: ...and the outermost-first expression survives nowhere in the EXECUTABLE body");
  assert(/orbitEffectiveCount\(DEBUG\.orbitCount\)/.test(arfBody),
    "A: ...and it still walks from the EFFECTIVE ring count, so it composes with the orbitCount knob");
  eq((codeOnly.match(/function activeRingsFor\(/g) || []).length, 1, "A: exactly one activeRingsFor definition");

  const gen = genBlock.slice(0, genBlock.indexOf("\n}\n"));
  assert(/fastRingIndices/.test(gen), "A: generateOrbitLayout's parameter is the plural `fastRingIndices`");
  assert(!/fastRingIndex\b/.test(gen.replace(/fastRingIndices/g, "")),
    "A: ...and the singular `fastRingIndex` survives nowhere in its body");
  assert(/fastIdx\.indexOf\(i\) !== -1/.test(gen), "A: the fast-ring test is set MEMBERSHIP, not `i === fastRingIndex`");
  assert(/const fastIdx = fastRingIndices \|\| \[\];/.test(gen),
    "A: ...normalised once outside the ring loop, with absent behaving as empty");
  assert(/fastRingIndices:\s*ORBIT_FAST_RING\.map\(n => n - 1\)/.test(codeOnly),
    "A: spawnOrbitWave maps the 1-based list to 0-based indices — the spawn's ONE consumer");
  // REPOINTED BY CS023 P4: 2 -> 3. The spec's own retirement ledger (§8) named exactly this third reader
  // when it widened the constant's type — "the one consumer, the one generator test, AND THE DRIFT'S CAP
  // (C14) all move." maxOrbitSpeed() must scan the fast-ring list to find which ring is actually fastest,
  // so it reads ORBIT_FAST_RING directly. A FOURTH mention would still be worth failing over.
  eq((codeOnly.match(/ORBIT_FAST_RING/g) || []).length, 3,
    "A: REPOINTED (P4 landed) — ORBIT_FAST_RING has exactly three source mentions: its declaration, " +
    "spawnOrbitWave's map, and maxOrbitSpeed's ring scan");
  assert(/ORBIT_FAST_RING\.indexOf\(i \+ 1\)/.test(codeOnly),
    "A: ...and the third is a MEMBERSHIP test over the 1-based list, exactly like the generator's");

  // --- resizeWorld's grow comment, corrected per spec C7 --------------------------------------------
  const rw = scriptSrc.slice(scriptSrc.indexOf("function resizeWorld(newSize)"));
  const rwBlock = rw.slice(0, rw.indexOf("const dmax ="));
  assert(/1,020/.test(rwBlock) || /1020/.test(rwBlock), "A: spec C7 — resizeWorld's dmax comment names 1,020 px");
  assert(/CORRECTS WHAT THIS COMMENT USED TO CLAIM/.test(rwBlock),
    "A: ...and flags itself as a correction rather than silently dropping the retired claim");
  assert(!/^\s*\/\/ WORLD_SIZE_ORBIT\. On the GROW almost nothing binds/m.test(rwBlock),
    "A: ...with the retired 'on the GROW almost nothing binds' claim no longer asserted as current fact");
  assert(/BOTH directions/.test(rwBlock), "A: ...replaced by FLAG-CS022-k applying in BOTH directions");
})();

// ================= (B) spec §6 item 1 — THE §1.4 TABLE, VIA A REAL nextWave() =====================
// Every orbit level 3..63 reproduced by a REAL nextWave() spawn, GROUPED BY orbitRadius and never by
// array position. Spec §1.4's published totals are pinned as LITERALS here on purpose — that table is
// the changeset's headline claim, and a wiring check alone would happily agree with a wrong-but-
// self-consistent build.
// REPOINTED BY CS023 P4C (spec C16, amended §1.4): the ring halves rise 3/6/11/16 -> 3/7/12/18 because
// the wider rings carry 3/4/5/6 satellites instead of 3/3/4/5. The FIELD halves are untouched — they come
// from levelDef(n-1).junkCount and have nothing to do with ring geometry.
const WANT_14 = {   // level: [ring, field, total]
  3:  [ 3,  5,  8],
  6:  [ 7,  3, 10],
  9:  [12, 13, 25],
  12: [18,  9, 27],
  15: [18,  5, 23],
  18: [18,  3, 21],
  21: [18, 13, 31],
};
(function sectionB() {
  console.log("(B) spec §6 item 1 — the §1.4 ramp table at EVERY orbit level 3..63, via a real nextWave()");
  const X = seededBuild(0xB001);
  const RAD = shippedRadii(X);
  eq(RAD.join(","), "400,600,800,1000", "B: P4C — the four ring radii are 400 / 600 / 800 / 1000 (was 400/538/676/814)");
  let orbitLevels = 0, peak = 0;
  const seen = [];
  withRandom(seededRandom(0x1403), () => {
    X.startGame();
    for (let n = 3; n <= 63; n += 3) {
      eq(X.levelDef(n).archetype, "orbit", `B: level ${n} is an orbit level`);
      orbitLevels++;
      const spawned = atWave(X, n);
      const want = expectedSpawn(X, n);

      // Grouped by orbitRadius — the ring identity every orbit test keys off, per-ENTITY not per-level.
      const byRadius = {};
      for (const d of X.game.debris) if (d.orbitCenter) byRadius[d.orbitRadius] = (byRadius[d.orbitRadius] || 0) + 1;
      const liveRadii = Object.keys(byRadius).map(Number).sort((a, b) => a - b);
      const railBorne = liveRadii.reduce((s, r) => s + byRadius[r], 0);
      const scatter   = spawned - railBorne;

      // THE RAMP: how many rings, and WHICH ones — INNERMOST first, never re-spaced.
      const occ = n / X.ORBIT_LEVEL_EVERY;
      const wantRings = Math.max(1, Math.min(occ, X.ORBIT_RING_COUNT));
      eq(liveRadii.length, wantRings, `B: level ${n} (occurrence ${occ}): ${wantRings} ring(s) on the board`);
      const wantRadii = RAD.slice(0, wantRings);            // the INNERMOST `wantRings` of them
      eq(liveRadii.join(","), wantRadii.join(","), `B: level ${n}: the rings present are the innermost ${wantRings}`);
      assert(liveRadii.includes(RAD[0]), `B: level ${n}: RING 1 IS ALWAYS PRESENT (FORK-CS023-A)`);
      eq(JSON.stringify(X.activeRingsFor(n)), JSON.stringify(wantRadii.map((_, i) => i)),
         `B: level ${n}: activeRingsFor agrees with what actually spawned, in ascending index order`);

      // THE TOTALS, both halves, recomputed from the shipped helpers.
      eq(railBorne, want.ringTotal, `B: level ${n}: ring population ${want.ringTotal}`);
      eq(scatter, want.fieldCount, `B: level ${n}: field component ${want.fieldCount} = levelDef(${n}).fieldCount`);
      eq(spawned, want.total, `B: level ${n}: total ${want.total}`);
      // ...and the field half really is levelDef(n-1)'s junkCount, per CS022 P3's own rule.
      eq(want.fieldCount, X.levelDef(n - 1).junkCount, `B: level ${n}: ...which is levelDef(${n - 1}).junkCount`);

      // ...and against spec §1.4's published table where it has one.
      if (WANT_14[n]) {
        const [wo, wf, wt] = WANT_14[n];
        eq(railBorne, wo, `B: level ${n}: §1.4 says ${wo} ring`);
        eq(scatter, wf, `B: level ${n}: §1.4 says ${wf} field`);
        eq(spawned, wt, `B: level ${n}: §1.4 says ${wt} total`);
      }
      if (spawned > peak) peak = spawned;
      seen.push({ n, ring: railBorne, field: scatter, total: spawned });
    }
  });
  eq(orbitLevels, 21, "B: 21 orbit levels across 3..63");
  eq(JSON.stringify(seen.slice(0, 4).map(s => s.ring)), "[3,7,12,18]",
    "B: P4C — the ring totals at occurrences 1-4 are 3 / 7 / 12 / 18 (were 3 / 6 / 11 / 16 at P1's step)");
  // From level 12 the ring half is FROZEN — the ramp is complete and the occurrence curve buys nothing
  // more (spec C5; nothing AT ALL after P4c's C16). Levels 12-63 are deliberately flat.
  assert(seen.filter(s => s.n >= 12).every(s => s.ring === 18),
    "B: from level 12 the ring population is frozen at 18 — the 12-63 plateau is deliberate");
  eq(JSON.stringify([...new Set(seen.filter(s => s.n >= 12).map(s => s.total))].sort((a, b) => a - b)), "[21,23,27,31]",
    "B: ...and the level total breathes 21 / 23 / 27 / 31 with the junk cycle alone");
  eq(peak, 31, "B: the peak level total is 31 (84 at CS022's geometry — spec §1.3's ~5x cut survives P4c's +3)");
  eq(JSON.stringify(seen.filter(s => s.total === 31).map(s => s.n)), "[21,30,42,51,63]",
    "B: ...reached at levels 21, 30, 42, 51 and 63");
  console.log("    " + seen.filter(s => s.n <= 24).map(s => `L${s.n}:${s.ring}+${s.field}=${s.total}`).join("  "));
})();

// ================= (C) spec §6 item 1 — THE COUNTS THROUGH THE GENERATOR, AND C5 =====================
// The per-ring counts, computed through the REAL generator across the whole occurrence curve.
//
// CORRECTED BY CS023 P4C (spec C16). P1 asserted Correction C5's finding as arithmetic: the occurrence
// curve moves exactly ONE ring's count by exactly ONE satellite across the entire 63-level game, ring 2
// at occurrence 3. THAT IS NOW FALSE, and it is inverted rather than relaxed. At a 200 px step the
// rounding in `round(1 + 0.12 * (maxCount - 1))` absorbs the gap-multiplier decay on ALL FOUR rings, so
// the shell is IDENTICAL at every occurrence from 1 to 21 and the curve buys NOTHING. The mechanism is
// still asserted to RUN (maxCount really does widen ~13%) — that is the whole point of keeping the
// section: a lever that is silent at today's densities is not a lever that is broken, and deleting the
// evidence either way is how a build loses track of which of its levers are connected.
(function sectionC() {
  console.log("(C) spec §6 item 1 — per-ring counts through the generator; C5's curve, now INERT (P4c)");
  const X = seededBuild(0xC001);

  // The FULL four-ring shell at every occurrence, so the ramp cannot hide a density-driven move.
  const fullAt = level => withRandom(seededRandom(0xC100 + level), () =>
    X.generateOrbitLayout(shippedArgs(X, 1280, 720, X.orbitGapMult(level), null)));

  const perOcc = [];
  for (let occ = 1; occ <= 21; occ++) {
    const L = fullAt(occ * X.ORBIT_LEVEL_EVERY);
    eq(L.rings.length, 4, `C: occurrence ${occ}: the un-ramped control really places all four rings`);
    eq(L.inactive.length, 0, `C: occurrence ${occ}: ...and none is inactive`);
    perOcc.push(L.rings.map(r => r.count));
  }
  eq(JSON.stringify(perOcc[0]), "[3,4,5,6]", "C: P4C — occurrence 1's full shell is 3 / 4 / 5 / 6 (was 3 / 3 / 4 / 5)");
  eq(JSON.stringify(perOcc[20]), "[3,4,5,6]", "C: P4C — occurrence 21's is THE SAME 3 / 4 / 5 / 6 (was 3 / 4 / 4 / 5)");
  eq(perOcc[0].reduce((a, b) => a + b), 18, "C: 18 satellites in the full shell at occurrence 1");
  eq(perOcc[20].reduce((a, b) => a + b), 18, "C: ...and 18 at occurrence 21 — flat, not 15 then 16");

  // C5, STATED AS ARITHMETIC — AND INVERTED BY P4C. Walk the whole curve and collect every place a ring's
  // count changes. P1's version asserted `steps.length === 1` (ring 2, occurrence 3, +1); the claim now is
  // that the list is EMPTY, which is a strictly stronger statement about the same walk.
  const steps = [];
  for (let i = 1; i < perOcc.length; i++) {
    for (let r = 0; r < 4; r++) {
      if (perOcc[i][r] !== perOcc[i - 1][r]) steps.push({ occ: i + 1, ring: r + 1, from: perOcc[i - 1][r], to: perOcc[i][r] });
    }
  }
  eq(steps.length, 0,
    `C: P4C — the occurrence curve changes NO ring's count anywhere in the game (spec C16; saw ${JSON.stringify(steps)})`);
  // Said the other way round, so a future regression fails on the shape as well as on the count: EVERY
  // occurrence's full shell is byte-identical to occurrence 1's.
  const shell1 = JSON.stringify(perOcc[0]);
  for (let occ = 1; occ <= 21; occ++) {
    eq(JSON.stringify(perOcc[occ - 1]), shell1,
      `C: P4C — occurrence ${occ}'s full shell is identical to occurrence 1's`);
  }
  eq(new Set(perOcc.map(p => p.reduce((a, b) => a + b))).size, 1,
    "C: ...so the whole 63-level game has exactly ONE full-shell total, 18");
  // The mechanism itself is untouched and STILL RUNS: maxCount really does widen ~13% across the curve.
  // This is what makes "inert" a finding about the DENSITIES rather than about a broken curve, and it is
  // why the curve is recorded rather than retuned or deleted (spec C5's own instruction).
  const mc1 = fullAt(3).rings.map(r => r.maxCount), mc24 = fullAt(24).rings.map(r => r.maxCount);
  eq(mc1.join("/"), "16/24/32/40", "C: P4C — maxCounts at the base multiplier are 16/24/32/40 (16/21/27/32 at P1's step)");
  eq(mc24.join("/"), "18/27/36/45", "C: ...widening to 18/27/36/45 at the 1.8 floor — the curve is not dead, just inaudible");
  assert(mc24.every((v, i) => v > mc1[i]), "C: ...every ring's maxCount genuinely widened");
  close(mc24.reduce((a, b) => a + b) / mc1.reduce((a, b) => a + b), 1.125, "C: ...by ~13% overall", 0.01);
  // ...and the rounding is what eats it: at every ring, both ends of the curve round to the same count.
  for (let r = 0; r < 4; r++) {
    const lo = Math.round(1 + X.ORBIT_DENSITY[r] * (mc1[r] - 1));
    const hi = Math.round(1 + X.ORBIT_DENSITY[r] * (mc24[r] - 1));
    eq(hi, lo, `C: ring ${r + 1}: round(1 + 0.12 x (maxCount - 1)) is the same at both ends of the curve (${lo})`);
  }

  // The lanes the flat curve produces, and the fact that ALL of them are wide now.
  const L1 = fullAt(3);
  const gaps = L1.rings.map(r => r.actualGapPx);
  close(gaps[0], X.TAU * 400 / 3 - 92, "C: ring 1's lane === circumference/count - satelliteDiameter, exactly", 1e-9);
  close(gaps[0], 745.8, "C: ...which is ~746 px — UNMOVED by P4c, ring 1 did not change", 0.1);
  close(gaps[1], 850.4, "C: P4C — ring 2's is ~850 px (was ~1035 at P1's radius/count)", 0.1);
  close(gaps[2], 913.3, "C: P4C — ring 3's is ~913 px (was ~970)", 0.1);
  close(gaps[3], 955.2, "C: P4C — ring 4's is ~955 px (was ~931)", 0.1);
  assert(gaps.every(g => g > 700), "C: every lane is over 700 px wide");
  assert(gaps[0] === Math.min(...gaps), "C: ring 1 is the tightest of them");
  eq(new Set(L1.rings.map(r => r.density)).size, 1, "C: all four densities are ONE number — the curve is flat");

  // The RAMPED counts, which is what actually spawns: ring 1 is always 3, and the ramp adds rings
  // outward without touching the ones already there.
  const ramped = [3, 6, 9, 12].map(lv => withRandom(seededRandom(0xC200 + lv), () =>
    X.generateOrbitLayout(shippedArgs(X, 1280, 720, X.orbitGapMult(lv), X.activeRingsFor(lv)))));
  eq(JSON.stringify(ramped.map(L => L.rings.map(r => r.count))), "[[3],[3,4],[3,4,5],[3,4,5,6]]",
    "C: P4C — the ramped per-ring counts across occurrences 1-4 (was [[3],[3,3],[3,4,4],[3,4,4,5]])");
  assert(ramped.every(L => L.rings[0].count === 3), "C: ring 1 carries 3 satellites at every occurrence");
  assert(ramped.every(L => L.rings.every(r => r.radius === X.ORBIT_INNER_RADIUS + r.index * X.ORBIT_RADIUS_STEP)),
    "C: ...and every active ring sits at its ORIGINAL radius — the ramp selects, it never re-spaces");
})();

// ================= (D) spec §6 item 4 — THE FAST-RING LIST =====================
(function sectionD() {
  console.log("(D) spec §6 item 4 — the fast-ring LIST, by ring index, at every occurrence");
  const X = seededBuild(0xD001);
  const FAST = X.ORBIT_FAST_RING.map(n => n - 1);
  eq(JSON.stringify(FAST), "[1,3]", "D: (setup) the 1-based [2, 4] maps to 0-based indices [1, 3]");

  // At EVERY occurrence, keyed by RING INDEX — including occurrences 1 and 2, where the fast rings are
  // only partly on the board (FLAG-CS023-l: level 3 lays ring 1 alone, so no fast ring exists yet).
  let sawNoFast = 0, sawSomeFast = 0;
  for (let occ = 1; occ <= 21; occ++) {
    const level = occ * X.ORBIT_LEVEL_EVERY;
    const L = withRandom(seededRandom(0xD100 + level), () =>
      X.generateOrbitLayout(shippedArgs(X, 1280, 720, X.orbitGapMult(level), X.activeRingsFor(level))));
    let fastHere = 0;
    for (const r of L.rings) {
      const wantFast = FAST.indexOf(r.index) !== -1;
      close(r.angVel, X.ORBIT_ANG_VEL * (wantFast ? X.ORBIT_FAST_MULT : 1),
        `D: level ${level} ring ${r.index + 1}: angVel is ${wantFast ? "the fast" : "the base"} rate`);
      if (wantFast) fastHere++;
    }
    if (fastHere === 0) sawNoFast++; else sawSomeFast++;
  }
  eq(sawNoFast, 1, "D: exactly ONE occurrence has no fast ring on the board — occurrence 1 (FLAG-CS023-l)");
  assert(sawSomeFast === 20, "D: (control) every other occurrence does have at least one");

  // ---- THE SHIPPED CALL SITE, BEHAVIOURALLY. Everything above feeds generateOrbitLayout directly with
  // arguments this file assembles, which cannot see a break in spawnOrbitWave's OWN wiring: sending the
  // retired scalar `fastRingIndex` key would make the generator treat the list as absent and quietly
  // spin every ring at the base rate, and only a source pin would notice. So the angular velocities are
  // also read off REAL entities from a REAL nextWave(), grouped by orbitRadius (per-ENTITY, never by
  // array position), at the first level where both a fast and a slow ring are on the board.
  const XR = seededBuild(0xD500);
  withRandom(seededRandom(0xD501), () => { XR.startGame(); atWave(XR, 12); });
  const RADII = shippedRadii(XR);
  const velByRadius = {};
  for (const d of XR.game.debris) if (d.orbitCenter) velByRadius[d.orbitRadius] = Math.abs(d.orbitAngVel);
  eq(Object.keys(velByRadius).length, 4, "D: (setup) a real level-12 spawn puts all four ring radii on the board");
  for (let i = 0; i < 4; i++) {
    const wantFast = FAST.indexOf(i) !== -1;
    close(velByRadius[RADII[i]], XR.ORBIT_ANG_VEL * (wantFast ? XR.ORBIT_FAST_MULT : 1),
      `D: REAL SPAWN — ring ${i + 1}'s satellites carry ${wantFast ? "the fast" : "the base"} angular velocity`);
  }
  const realFast = FAST.map(i => velByRadius[RADII[i]]);
  const realSlow = [0, 1, 2, 3].filter(i => FAST.indexOf(i) === -1).map(i => velByRadius[RADII[i]]);
  assert(realFast.length === 2 && realSlow.length === 2, "D: (setup) two fast rings and two slow ones on the board");
  assert(realFast.every(f => realSlow.every(sl => f > sl)),
    "D: ...and EVERY fast ring really outruns EVERY slow one through the shipped spawn path");
  assert(new Set(realFast).size === 1 && new Set(realSlow).size === 1,
    "D: ...with one rate per class — the multiplier is applied per ring, not accumulated");

  // Occurrence 1 explicitly: ring 1 alone, and it is NOT fast — motion still arrives one occurrence late.
  const L3 = withRandom(seededRandom(0xD003), () =>
    X.generateOrbitLayout(shippedArgs(X, 1280, 720, X.orbitGapMult(3), X.activeRingsFor(3))));
  eq(L3.rings.length, 1, "D: occurrence 1 lays exactly one ring");
  close(L3.rings[0].angVel, X.ORBIT_ANG_VEL, "D: ...and it turns at the BASE rate — no fast ring at level 3");

  // Tangential speeds at the full shell, spec §1.3's own table.
  const LFull = withRandom(seededRandom(0xD0FF), () => X.generateOrbitLayout(shippedArgs(X, 1280, 720, X.ORBIT_GAP_MULT, null)));
  const tang = LFull.rings.map(r => r.angVel * r.radius);
  // REPOINTED BY CS023 P4C: tangential speed is angVel x radius, so widening the rings raised three of the
  // four (ring 1's radius did not move). The last of them IS the drift's speed cap — see test-cs023-p4.js.
  close(tang[0], 41.9, "D: ring 1's tangential speed is ~41.9 px/s — UNMOVED by P4c", 0.1);
  close(tang[1], 188.5, "D: P4C — ring 2's (fast) is ~188.5 px/s (was ~169.0)", 0.1);
  close(tang[2], 83.8, "D: P4C — ring 3's is ~83.8 px/s (was ~70.8)", 0.1);
  close(tang[3], 314.2, "D: P4C — ring 4's (fast) is ~314.2 px/s (was ~255.7) — the fastest a satellite ever moves in orbit", 0.1);
  assert(Math.max(...tang) === tang[3], "D: ...and the maximum falls on ring 4 at THIS list");

  // ---- LISTS OF ANY LENGTH, in a sandbox. Arbitrary-length support is the point of the type change,
  // and P4's speed cap depends on it (spec C14) — including that "the outermost ring is fastest" is a
  // property of [2, 4] and NOT of the mechanism.
  const sandbox = (list) => withRandom(seededRandom(0xDBEE), () => X.generateOrbitLayout(
    Object.assign(shippedArgs(X, 1280, 720, X.ORBIT_GAP_MULT, null), { fastRingIndices: list })));
  const velsOf = L => L.rings.map(r => r.angVel / X.ORBIT_ANG_VEL);

  eq(JSON.stringify(velsOf(sandbox([]))), "[1,1,1,1]", "D: LENGTH 0 — an empty list makes NO ring fast, and does not throw");
  eq(JSON.stringify(velsOf(sandbox([2]))), "[1,1,3,1]", "D: LENGTH 1 — only ring 3 is fast");
  eq(JSON.stringify(velsOf(sandbox([0, 1, 2]))), "[3,3,3,1]", "D: LENGTH 3 — rings 1-3 fast, ring 4 not");
  eq(JSON.stringify(velsOf(sandbox([0, 1, 2, 3]))), "[3,3,3,3]", "D: LENGTH 4 — every ring fast");
  // ABSENT behaves as empty, matching what the retired scalar did when it was undefined.
  const noKey = withRandom(seededRandom(0xDBEF), () => {
    const a = shippedArgs(X, 1280, 720, X.ORBIT_GAP_MULT, null);
    delete a.fastRingIndices;
    return X.generateOrbitLayout(a);
  });
  eq(JSON.stringify(velsOf(noKey)), "[1,1,1,1]", "D: an ABSENT fastRingIndices behaves as empty rather than throwing");
  // Out-of-range entries are simply never matched — no throw, no silent wrap-around onto a real ring.
  eq(JSON.stringify(velsOf(sandbox([9, -1]))), "[1,1,1,1]", "D: out-of-range indices match nothing and do not wrap");

  // C14's own case, as a live control: at [1, 2] the FASTEST satellite is on ring 2, not the outermost.
  const alt = sandbox([0, 1]);
  const altTang = alt.rings.map(r => r.angVel * r.radius);
  close(altTang[1], 188.5, "D: P4C — spec C14: at the 1-based list [1, 2] ring 2 reaches 188.5 px/s (was 169.0)", 0.1);
  close(altTang[3], 104.7, "D: ...while the OUTERMOST ring only reaches 104.7 px/s (was 85.2)", 0.1);
  assert(Math.max(...altTang) === altTang[1],
    "D: ...so the maximum falls on ring 2 — 'just use the outer ring' is a latent bug (C14)");
})();

// ================= (E) spec §6 item 5 — RAMP DIRECTION, BEHAVIOURALLY =====================
// The direction is asserted against the REAL pre-P1 build, not with a source regex: the same call, on
// two builds, lays its one ring at opposite ends of the shell.
(function sectionE() {
  console.log("(E) spec §6 item 5 — ramp direction vs the pinned CS022 reference at " + PRE_P1_REF);
  const X = seededBuild(0xE001);
  const P = seededBuildPre(0xE001);

  // The reference really is the CS022 build, stated positively so a bad SHA cannot pass quietly.
  eq(P.ORBIT_INNER_RADIUS, 460, "E: (setup) the reference build is CS022's geometry — inner radius 460");
  eq(P.ORBIT_RADIUS_STEP, 276, "E: (setup) ...and step 276");
  eq(P.WORLD_SIZE_ORBIT, 16, "E: (setup) ...and its orbit world is size 16");
  eq(P.ORBIT_FAST_RING, 3, "E: (setup) ...and its ORBIT_FAST_RING is still the SCALAR 3");
  eq(P.GAME_VERSION, "1.0.0.22", "E: (setup) ...at GAME_VERSION 1.0.0.22");

  // THE CLAIM: from the SAME call, level 3 lays one ring at each build's INNERMOST radius here and at
  // its OUTERMOST radius there.
  const lvl = X.ORBIT_LEVEL_EVERY;
  const Lnow = withRandom(seededRandom(0xE003), () =>
    X.generateOrbitLayout(shippedArgs(X, 1280, 720, X.orbitGapMult(lvl), X.activeRingsFor(lvl))));
  const Lpre = withRandom(seededRandom(0xE003), () =>
    P.generateOrbitLayout(preArgs(P, 1280, 720, P.orbitGapMult(lvl), P.activeRingsFor(lvl))));

  eq(Lnow.rings.length, 1, "E: level 3 lays exactly ONE ring on the CS023 build");
  eq(Lpre.rings.length, 1, "E: ...and exactly one on the CS022 reference too — the RAMP SHAPE is unchanged");
  eq(Lnow.rings[0].radius, X.ORBIT_INNER_RADIUS,
    "E: the CS023 ring sits at ORBIT_INNER_RADIUS — the INNERMOST (FORK-CS023-A)");
  eq(Lpre.rings[0].radius, P.ORBIT_INNER_RADIUS + 3 * P.ORBIT_RADIUS_STEP,
    "E: the CS022 ring sits at ORBIT_INNER_RADIUS + 3 x step — the OUTERMOST");
  eq(Lnow.rings[0].index, 0, "E: ...index 0 here");
  eq(Lpre.rings[0].index, 3, "E: ...index 3 there — the direction genuinely reversed");

  // The index LISTS themselves, at every occurrence, on both builds.
  for (let occ = 1; occ <= 4; occ++) {
    const n = occ * X.ORBIT_LEVEL_EVERY;
    eq(JSON.stringify(X.activeRingsFor(n)), JSON.stringify(Array.from({ length: occ }, (_, i) => i)),
      `E: CS023 activeRingsFor(${n}) is the innermost ${occ}, ascending`);
    eq(JSON.stringify(P.activeRingsFor(n)), JSON.stringify(Array.from({ length: occ }, (_, i) => 3 - i)),
      `E: CS022 activeRingsFor(${n}) was the outermost ${occ}, descending`);
    assert(JSON.stringify(X.activeRingsFor(n)) !== JSON.stringify(P.activeRingsFor(n)) || occ === 4,
      `E: (control) the two builds genuinely disagree at occurrence ${occ}`);
  }
  // Occurrence 4 is the one place they agree as SETS but not as ORDER — worth saying out loud.
  eq(JSON.stringify(X.activeRingsFor(12)), "[0,1,2,3]", "E: at occurrence 4 CS023 lists them ascending");
  eq(JSON.stringify(P.activeRingsFor(12)), "[3,2,1,0]", "E: ...and CS022 listed the same SET descending");

  // rings[k].index === k AT EVERY OCCURRENCE — the fact §1.4 says reverses the CS022 P3 known issue.
  for (let occ = 1; occ <= 21; occ++) {
    const n = occ * X.ORBIT_LEVEL_EVERY;
    const L = withRandom(seededRandom(0xE100 + n), () =>
      X.generateOrbitLayout(shippedArgs(X, 1280, 720, X.orbitGapMult(n), X.activeRingsFor(n))));
    assert(L.rings.every((r, k) => r.index === k),
      `E: level ${n}: layout.rings[k].index === k — array position IS ring index again`);
  }
  // ...and it genuinely was NOT true on the reference build, which is what makes the claim worth making.
  const Lpre3 = withRandom(seededRandom(0xE0FF), () =>
    P.generateOrbitLayout(preArgs(P, 1280, 720, P.orbitGapMult(3), P.activeRingsFor(3))));
  assert(!Lpre3.rings.every((r, k) => r.index === k),
    "E: (control) on the CS022 build rings[0].index was 3, not 0 — the known issue this reverses");

  // The outer edge follows from that: constant on the reference, growing here.
  const edges = [3, 6, 9, 12].map(n => withRandom(seededRandom(0xE200 + n), () =>
    X.generateOrbitLayout(shippedArgs(X, 1280, 720, X.orbitGapMult(n), X.activeRingsFor(n)))).outerEdge);
  eq(JSON.stringify(edges), "[446,646,846,1046]",
    "E: P4C — the outer edge GROWS 446 / 646 / 846 / 1046 with the occurrence (446/584/722/860 at P1's step)");
  const preEdges = [3, 6, 9, 12].map(n => withRandom(seededRandom(0xE300 + n), () =>
    P.generateOrbitLayout(preArgs(P, 1280, 720, P.orbitGapMult(n), P.activeRingsFor(n)))).outerEdge);
  eq(JSON.stringify(preEdges), "[1334,1334,1334,1334]", "E: (control) on the reference it was a constant 1334");
})();

// ================= (F) spec §6 item 2 — WORLD SIZE =====================
(function sectionF() {
  console.log("(F) spec §6 item 2 — world size across real nextWave() transitions");
  const X = seededBuild(0xF001);
  const [OW, OH] = X.worldDims(X.WORLD_SIZE_ORBIT);
  const [FW, FH] = X.worldDims(X.WORLD_SIZE_FIELD);
  eq(OW, 3840, "F: the orbit world is 3840 wide");
  eq(OH, 2160, "F: ...and 2160 tall");
  eq(FW, 2560, "F: the field world is 2560 wide");
  eq(FH, 1440, "F: ...and 1440 tall");

  // 30 consecutive REAL transitions, live dimensions checked after every one.
  let orbitSeen = 0, fieldSeen = 0;
  withRandom(seededRandom(0xF002), () => {
    X.startGame();
    for (let n = 2; n <= 31; n++) {
      X.game.debris.length = 0;
      X.nextWave();
      const [w, h] = X.worldDims(X.game.worldSize);
      if (X.levelDef(n).archetype === "orbit") {
        orbitSeen++;
        assert(w === 3840 && h === 2160, `F: level ${n} (orbit) runs at exactly 3840x2160`);
      } else {
        fieldSeen++;
        assert(w === 2560 && h === 1440, `F: level ${n} (field) runs at exactly 2560x1440`);
      }
      eq(X.game.worldSize, X.worldSizeFor(n), `F: level ${n}: game.worldSize agrees with worldSizeFor`);
    }
  });
  eq(orbitSeen, 10, "F: 10 orbit levels in 2..31");
  eq(fieldSeen, 20, "F: ...and 20 field levels");
  // The round trip lands on EXACTLY the field dimensions.
  eq(X.WORLD_W, 2560, "F: the run ends on a field level exactly 2560 wide");
  eq(X.WORLD_H, 1440, "F: ...and exactly 1440 tall");

  // dmax, spec C7 — the quantity resizeWorld clamps carried bodies to, at both sizes.
  eq(Math.min(OW, OH) / 2 - 60, 1020, "F: spec C7 — dmax at the orbit size is 1020 px (was 1380 at size 16)");
  eq(Math.min(FW, FH) / 2 - 60, 660, "F: ...and 660 at the field size, unchanged");
  // ...and the consequence C7 names: a carried body's greatest possible reach in the FIELD world is that
  // world's half-diagonal, which now EXCEEDS the orbit dmax, so a real band clamps on the GROW too.
  const fieldReach = Math.hypot(FW / 2, FH / 2);
  close(fieldReach, 1468.6, "F: a field body's greatest reach from a centred ship is ~1468.6 px", 0.1);
  assert(fieldReach > 1020, "F: spec C7 — which EXCEEDS the orbit dmax, so bodies clamp on the GROW as well");
  // The correction is about HOW MUCH binds, not whether anything does — CS022's own comment already
  // conceded 1,468 against 1,380. Quantified as the width of the over-range band, which is what the
  // retired "almost nothing" was a claim about: 88.6 px of reach then, 448.6 px now, ~5x.
  const bandOld = fieldReach - 1380, bandNew = fieldReach - 1020;
  close(bandOld, 88.6, "F: (control) the over-range band at the size-16 dmax was only ~88.6 px of reach", 0.1);
  close(bandNew, 448.6, "F: ...and it is ~448.6 px at the size-9 dmax", 0.1);
  assert(bandNew > 4 * bandOld,
    `F: spec C7 — a MATERIALLY larger band now clamps on the grow (${bandNew.toFixed(1)} px vs ${bandOld.toFixed(1)} px, ${(bandNew / bandOld).toFixed(1)}x)`);

  // spec §6 item 3's first half, checked here because it is a world-size fact: the shell fits.
  const budget = OH / 2 - 20;
  eq(budget, 1060, "F: the orbit world's wrap-clean budget is 1060 px");
  const outerEdge = X.ORBIT_INNER_RADIUS + (X.ORBIT_RING_COUNT - 1) * X.ORBIT_RADIUS_STEP + X.DEBRIS_RADII[3];
  eq(outerEdge, 1046, "F: P4C — the four-ring outer satellite edge is 1,046 px (was 860 at P1's step)");
  assert(outerEdge <= budget, `F: ...which clears the budget with ${budget - outerEdge} px to spare`);
  eq(budget - outerEdge, 14, "F: ...and that margin is exactly 14 px (spec C16 — §G pins it as a named value)");
  assert(outerEdge > FH / 2 - 20,
    "F: (control) and it still does NOT fit the FIELD world's 700 px budget — CS022 P1 stays load-bearing");
})();

// ================= (G) spec §6 item 3 — THE BUDGET AND THE CLAMP (C6, REVERSED BY C16) ===============
// CORRECTED BY CS023 P4C. This whole section is the load-bearing reversal of the phase.
//
// P1 shipped a 138 px step, which put a FIFTH ring's outer edge at 998 px inside the 1,060 px budget, so
// orbitEffectiveCount(5) returned 5 — and P1 asserted that here AS A CHANGE from the CS022 reference,
// which clamped it to 4. P4c's 200 px step puts a fifth ring at 1,246 px and the clamp walks back to
// four, so the live build AGREES with the CS022 reference again and P1's disagreement control has to be
// inverted with it. Every one of those assertions is kept in mirror-image form rather than deleted: a
// suite that simply stops mentioning a five-ring shell has stopped watching whether one can appear.
//
// The 14 px margin (spec C16a) gets its own guard here, because orbitEffectiveCount() walks the count
// DOWN in silence — no throw, no log line. Any later bump to ORBIT_INNER_RADIUS, ORBIT_RADIUS_STEP or
// DEBRIS_RADII[3] would return THREE rings and the shell would just quietly lose a layer. So: the margin
// is asserted as a named value, the 204 px ceiling is asserted as the largest step that still fits, and a
// sandbox build at 205 proves the three-ring collapse is real rather than theoretical.
(function sectionG() {
  console.log("(G) spec §6 item 3 — the budget, the 14 px margin, and orbitEffectiveCount (C6 reversed by C16)");
  const X = seededBuild(0x6001);
  const P = seededBuildPre(0x6001);
  const budget = X.worldDims(X.WORLD_SIZE_ORBIT)[1] / 2 - 20;
  const edgeAt = c => X.ORBIT_INNER_RADIUS + (c - 1) * X.ORBIT_RADIUS_STEP + X.DEBRIS_RADII[3];

  eq(budget, 1060, "G: (setup) the orbit world's wrap-clean budget is 1,060 px");
  eq(edgeAt(4), 1046, "G: P4C — a 4-ring outer edge is 1,046 px (was 860 at P1's step)");
  eq(edgeAt(5), 1246, "G: P4C — a 5-ring outer edge is 1,246 px (was 998, and it FITTED then — spec C6)");
  eq(edgeAt(6), 1446, "G: P4C — a 6-ring outer edge would be 1,446 px (was 1,136)");
  assert(edgeAt(4) <= budget && edgeAt(5) > budget,
    "G: P4C — so FOUR fit and five do not; P1's boundary sat one ring further out");

  // ---- THE 14 px MARGIN, AS A NAMED VALUE (spec C16a) ----------------------------------------------
  // Not left implicit in "edgeAt(4) <= budget": the whole point of C16(a) is that the number is small and
  // the failure is silent, so the number itself is what has to fail a test when it moves.
  const MARGIN = budget - edgeAt(4);
  eq(MARGIN, 14, "G: C16a — the four-ring shell clears the budget by EXACTLY 14 px");
  assert(MARGIN > 0 && MARGIN < X.DEBRIS_RADII[3],
    "G: ...less than one satellite RADIUS of headroom — this geometry has no room left in it");
  // The 204 px ceiling, computed rather than restated: the largest integer uniform step that still fits
  // four rings at ORBIT_INNER_RADIUS 400. Stated in the constants block too (§A pins that).
  const fitsAtStep = s => X.ORBIT_INNER_RADIUS + 3 * s + X.DEBRIS_RADII[3] <= budget;
  let ceiling = X.ORBIT_RADIUS_STEP;
  while (fitsAtStep(ceiling + 1)) ceiling++;
  eq(ceiling, 204, "G: C16a — 204 px is the largest uniform step that still fits four rings");
  assert(fitsAtStep(204) && !fitsAtStep(205), "G: ...and 205 px is the first that does not");
  assert(X.ORBIT_RADIUS_STEP <= ceiling,
    `G: ...so the shipped ${X.ORBIT_RADIUS_STEP} px step is ${ceiling - X.ORBIT_RADIUS_STEP} px under the ceiling`);

  // ---- THE CLAMP ITSELF — P1'S FIVE-RING ASSERTION, INVERTED ---------------------------------------
  eq(X.orbitEffectiveCount(4), 4,
    "G: C16a — orbitEffectiveCount(4) === 4, and THIS is the pin the 14 px margin protects");
  eq(X.orbitEffectiveCount(5), 4,
    "G: P4C — orbitEffectiveCount(5) === 4, REVERSING P1's `=== 5` (spec C6 undone by C16)");
  eq(X.orbitEffectiveCount(6), 4, "G: P4C — orbitEffectiveCount(6) walks down to 4 (was 5)");
  eq(X.orbitEffectiveCount(50), 4, "G: P4C — a wild request lands on the same 4 (was 5)");
  // P1 asserted the live build DISAGREED with the pinned CS022 reference here. It agrees again — and the
  // control is kept in that mirror-image form, because "they agree" is only interesting if something is
  // still checking that the reference genuinely clamps rather than having been mis-built.
  eq(P.orbitEffectiveCount(5), 4, "G: (control) the CS022 reference walked a requested 5 back down to 4");
  eq(X.orbitEffectiveCount(5), P.orbitEffectiveCount(5),
    "G: P4C — ...and the live build AGREES with it again, reversing P1's disagreement control");
  assert(P.ORBIT_INNER_RADIUS !== X.ORBIT_INNER_RADIUS && P.ORBIT_RADIUS_STEP !== X.ORBIT_RADIUS_STEP,
    "G: ...for a genuinely different reason, though — the two builds' geometries are still nothing alike");
  // The shipped count stays a fixed point, which activeRingsFor relies on.
  eq(X.orbitEffectiveCount(X.ORBIT_RING_COUNT), X.ORBIT_RING_COUNT,
    "G: the shipped ring count is still a FIXED POINT of the clamp");

  // The registry's own orbitCount range: P1 recorded that nothing a player could dial clamped any more.
  // P4c puts the ceiling back inside the range, so the hook is load-bearing again. The RANGE is
  // deliberately NOT narrowed to 4 — refusing is the clamp's job, and a range that cannot express the
  // refusal hides it (TRAP 3: no compensating retunes).
  const e = X.DEBUG_ENTRIES.find(v => v.id === "orbitCount");
  eq(e.max, 5, "G: the orbitCount knob's registry max is still 5 — the range is NOT narrowed by this phase");
  eq(e.clampShown(e.max), 4,
    "G: P4C — ...and clampShown now collapses that 5 to 4, reversing P1's 'the whole [3,5] range is achievable'");
  eq(e.clampShown(6), 4, "G: ...and a value past the range clamps to the same 4");
  eq(e.clampShown(3), 3, "G: ...while 3 is genuinely achievable and passes through untouched");

  // A five-ring request can no longer spawn five rings, and the ramp finishes at occurrence 4 again.
  X.DEBUG.orbitCount = 5;
  eq(JSON.stringify(X.activeRingsFor(3)), "[0]", "G: at a requested orbitCount 5, occurrence 1 is still [0]");
  eq(JSON.stringify(X.activeRingsFor(12)), "[0,1,2,3]", "G: ...occurrence 4 is four rings");
  eq(JSON.stringify(X.activeRingsFor(15)), "[0,1,2,3]",
    "G: P4C — ...and occurrence 5 adds NOTHING, reversing P1's fifth ring (activeRingsFor clamps to the effective count)");
  X.DEBUG.orbitCount = X.ORBIT_RING_COUNT;
  eq(JSON.stringify(X.activeRingsFor(15)), "[0,1,2,3]", "G: (control) back at 4, the ramp holds at four rings");
  // orbitDensity5 is therefore back to being a knob NO SHIPPED SPAWN EVER READS — the state P1 briefly
  // took it out of. Said here rather than only in a comment, because the registry entry still exists and
  // a reader has no other way to find out it is inert.
  {
    const d5 = X.DEBUG_ENTRIES.find(v => v.id === "orbitDensity5");
    assert(!!d5, "G: (setup) the orbitDensity5 knob still exists in the registry");
    const L = withRandom(seededRandom(0x6099), () =>
      X.generateOrbitLayout(shippedArgs(X, 1280, 720, X.ORBIT_GAP_MULT, null)));
    eq(L.rings.length, 4,
      "G: P4C — the un-ramped shipped generator lays FOUR rings, so the fifth density is never consumed");
    eq(X.orbitEffectiveCount(5), 4,
      "G: ...and no orbitCount a player can dial makes it five — orbitDensity5 is a dead knob again");
  }

  // ---- THE SILENT WALK-DOWN, MADE LOUD: a 205 px step drops the shell to THREE rings (spec C16a) ----
  // This is the failure mode the margin guard exists to catch, driven for real on a sandbox build rather
  // than argued from arithmetic. Nothing throws, nothing logs — the shell just loses a layer.
  {
    const SRC205 = scriptSrc.replace("const ORBIT_RADIUS_STEP   = 200;", "const ORBIT_RADIUS_STEP   = 205;");
    assert(SRC205 !== scriptSrc, "G: (sandbox) the ORBIT_RADIUS_STEP declaration was found and replaced");
    const S = withRandom(seededRandom(0x6100), () => buildFrom(SRC205));
    eq(S.ORBIT_RADIUS_STEP, 205, "G: (sandbox) the sandbox build really runs at a 205 px step");
    eq(S.ORBIT_INNER_RADIUS, 400, "G: (sandbox) ...with the inner radius untouched");
    eq(S.ORBIT_INNER_RADIUS + 3 * 205 + S.DEBRIS_RADII[3], 1061,
      "G: (sandbox) a four-ring shell at 205 px reaches 1,061 px — ONE px over the budget");
    eq(S.orbitEffectiveCount(4), 3,
      "G: C16a — ...and orbitEffectiveCount(4) SILENTLY RETURNS 3. No throw, no log: the shell just loses a ring");
    eq(S.orbitEffectiveCount(S.ORBIT_RING_COUNT), 3,
      "G: ...so the shipped ring count is no longer a fixed point of the clamp on that build");
    // ...and it is observable end to end, through the real ramp, not only through the clamp helper.
    eq(JSON.stringify(S.activeRingsFor(12)), "[0,1,2]",
      "G: ...the ramp completes at THREE rings at occurrence 4, and never lays a fourth at any level");
    eq(JSON.stringify(S.activeRingsFor(63)), "[0,1,2]", "G: ...still three at level 63");
    const L205 = withRandom(seededRandom(0x6101), () => S.generateOrbitLayout(shippedArgs(S, 1280, 720, S.ORBIT_GAP_MULT,
      S.activeRingsFor(12))));
    eq(L205.rings.length, 3, "G: ...and a real generator call at occurrence 4 lays three rings, not four");
    // The 204 px control: one px less and the fourth ring survives. Without this the assertion above
    // could pass on a build that had lost the fourth ring for some entirely different reason.
    const SRC204 = scriptSrc.replace("const ORBIT_RADIUS_STEP   = 200;", "const ORBIT_RADIUS_STEP   = 204;");
    const S4 = withRandom(seededRandom(0x6102), () => buildFrom(SRC204));
    eq(S4.orbitEffectiveCount(4), 4,
      "G: (control) at 204 px the fourth ring survives — the collapse really is the budget, not the sandbox");
    eq(JSON.stringify(S4.activeRingsFor(12)), "[0,1,2,3]", "G: ...and its ramp still completes at four rings");
  }
})();

// ================= (H) spec C8 — STAR_COUNT FOLLOWS BY DERIVATION =====================
(function sectionH() {
  console.log("(H) spec C8 — STAR_COUNT follows WORLD_SIZE_MAX by derivation");
  const X = seededBuild(0x8001);
  const [MW, MH] = X.worldDims(X.WORLD_SIZE_MAX);
  eq(X.STAR_COUNT, Math.round(X.STAR_DENSITY * (MW * MH) / (X.VIEW_W * X.VIEW_H)),
    "H: STAR_COUNT is the area-derived value for WORLD_SIZE_MAX — a derivation, not a literal");
  eq(X.STAR_COUNT, Math.round(X.STAR_DENSITY * X.WORLD_SIZE_MAX),
    "H: ...which is just STAR_DENSITY per viewport-sized screen, WORLD_SIZE_MAX screens of them");
  eq(X.STAR_COUNT, 720, "H: ...and that is 720 now (1280 while WORLD_SIZE_MAX was 16)");
  eq(X.stars.length, X.STAR_COUNT, "H: the pool really holds that many");
  eq(X.STAR_DENSITY, 80, "H: STAR_DENSITY untouched at 80");

  // The active count at FIELD size stays ~320. It is a uniform SUBSET, so it is a binomial sample around
  // the area-derived expectation rather than an exact number — banded at 5 sigma, the CS022 P1 idiom.
  const [FW, FH] = X.worldDims(X.WORLD_SIZE_FIELD);
  const p = (FW / MW) * (FH / MH);
  close(p, 4 / 9, "H: (setup) the field world is 4/9 of a size-9 world's area", 1e-12);
  const expect = X.STAR_COUNT * p;
  close(expect, 320, "H: ...so the expected active count is exactly 320, unchanged from the size-16 build", 1e-9);
  const sigma = Math.sqrt(X.STAR_COUNT * p * (1 - p));
  eq(X.game.worldSize, X.WORLD_SIZE_FIELD, "H: (setup) the build boots at the field size");
  assert(Math.abs(X.starsActive.length - expect) <= 5 * sigma,
    `H: the live active count (${X.starsActive.length}) is within 5 sigma of 320 (sigma ${sigma.toFixed(1)})`);

  // ...and at the ORBIT size every star is active, since WORLD_SIZE_ORBIT IS the max.
  withRandom(seededRandom(0x8002), () => { X.startGame(); atWave(X, X.ORBIT_LEVEL_EVERY); });
  eq(X.game.worldSize, X.WORLD_SIZE_ORBIT, "H: (setup) driven to an orbit level");
  eq(X.starsActive.length, X.STAR_COUNT, "H: at the orbit size ALL 720 stars are active — the orbit size IS the max");
})();

// ================= (I) THE FOUR TRAPS =====================
(function sectionI() {
  console.log("(I) TRAPs 1-4");
  const X = seededBuild(0x9001);

  // TRAP 1 — the version does not move this phase. P5 owns the bump, and when it lands this pin becomes
  // its mirror image (`!== "1.0.0.22"`), exactly as CS022's own files were treated by CS022 P4.
  eq(X.GAME_VERSION, "1.0.0.22", "I: TRAP 1 — GAME_VERSION is unchanged at 1.0.0.22 (P5 bumps it)");

  // TRAP 3 — REPOINTED BY CS023 P4, to its positive successor rather than deleted (the standing
  // mirror-image treatment). P4 added exactly the TWO knobs this trap always named it would, APPENDED to
  // the ORBIT section (FLAG-CS023-o); what P1 is answerable for — that ITS OWN diff added none — is now
  // the positive claim that the two present are exactly P4's, and no third one crept in with them.
  // REPOINTED AGAIN BY CS023 P4B: orbitGravityAccel -> debrisDriftAccel (spec C15 — the drift is not
  // orbit-scoped, so its id no longer starts with "orbit"). Still the same two entries, same order,
  // same row; only the id — and therefore the /^orbit/i count — changes.
  eq(X.DEBUG_ENTRIES.length, 46, "I: REPOINTED (P4 landed) — the debug registry is 46 value entries");
  eq(X.DEBUG_ENTRIES.filter(e => /gravity|bounce|drift|fastRing/i.test(e.id)).map(e => e.id).join(","),
    "debrisDriftAccel,debrisBounceRestitution",
    "I: P4B — and they are exactly CS023 P4's two, in that order (the first RENAMED by P4B)");
  eq(X.DEBUG_ENTRIES.filter(e => /^orbit/i.test(e.id)).length, 10,
    "I: P4B — ten orbit-prefixed knobs: exactly P3's ten, since debrisDriftAccel no longer matches");
  // The density knobs' defaults follow the shipped constant automatically — the registry convention.
  for (let i = 0; i < 4; i++) {
    const d = X.DEBUG_ENTRIES.find(e => e.id === `orbitDensity${i + 1}`);
    eq(d.def, X.ORBIT_DENSITY[i], `I: orbitDensity${i + 1}'s registry default follows ORBIT_DENSITY[${i}]`);
    eq(X.DEBUG[`orbitDensity${i + 1}`], 0.12, `I: ...and the live DEBUG value is the flat 0.12`);
  }

  // TRAP 2 — no collision pass, no bounce helper, no drift field. Those are P2/P3/P4.
  //
  // REPOINTED BY CS023 P2 — the standing mirror-image treatment (CS022 P3 gave CS022 P1's TRAP 3 exactly
  // this). The two P2 pins are now their POSITIVE successors rather than being deleted: "the symbol does
  // not exist yet" and "the symbol exists exactly once" are the same claim read from opposite ends, and
  // keeping the positive form here means this file goes on guarding against a second definition. The P3
  // and P4 pins below are untouched and still hold.
  eq((codeOnly.match(/function debrisBounce\(/g) || []).length, 1,
    "I: REPOINTED (P2 landed) — debrisBounce is defined exactly once");
  eq((codeOnly.match(/^const DEBRIS_MASS = /gm) || []).length, 1,
    "I: REPOINTED (P2 landed) — DEBRIS_MASS is declared exactly once");
  // REPOINTED BY CS023 P4 — the same mirror-image treatment P2 got above: "the symbol does not exist
  // yet" becomes "the symbol exists exactly once", which is the same claim read from the other end and
  // keeps this file guarding against a SECOND definition creeping in later.
  // REPOINTED AGAIN BY CS023 P4B: ORBIT_GRAVITY_* -> DEBRIS_DRIFT_* (spec C15).
  eq((codeOnly.match(/const DEBRIS_DRIFT_TRIGGER_R = /g) || []).length, 1,
    "I: P4B — DEBRIS_DRIFT_TRIGGER_R (ex-ORBIT_GRAVITY_TRIGGER_R) is declared exactly once");
  eq((codeOnly.match(/const DEBRIS_DRIFT_TARGET_R  = /g) || []).length, 1,
    "I: P4B — DEBRIS_DRIFT_TARGET_R (ex-ORBIT_GRAVITY_TARGET_R) is declared exactly once");
  eq((codeOnly.match(/function maxOrbitSpeed\(/g) || []).length, 1,
    "I: REPOINTED (P4 landed) — maxOrbitSpeed is defined exactly once");
  eq((codeOnly.match(/function updateDebrisDrift\(/g) || []).length, 1,
    "I: REPOINTED (P4 landed) — updateDebrisDrift is defined exactly once");
  assert(/\bdrifting\b/.test(codeOnly), "I: REPOINTED (P4 landed) — the `drifting` field is now real");
  // REPOINTED BY CS023 P3: destroySaucer's awardScore parameter has now landed, exactly as this trap
  // always named it would — flipped to its positive successor rather than deleted.
  assert(/function destroySaucer\(s, awardScore = true\) \{/.test(codeOnly),
    "I: REPOINTED (P3 landed) — destroySaucer now takes awardScore = true");

  // TRAP 4 — FIELD LEVELS COME OUT BYTE-IDENTICAL. Pinned BEHAVIOURALLY against the pre-P1 build under
  // one shared seed, not by eye: eight real field waves, every satellite's position, velocity, size and
  // the ABSENCE of orbit state compared entry by entry.
  const snapshotField = (B, seed) => withRandom(seededRandom(seed), () => {
    B.startGame();
    const out = [];
    for (const n of [1, 2, 4, 5, 7, 8, 10, 11]) {
      B.game.wave = n - 1; B.game.debris.length = 0; B.nextWave();
      out.push(B.game.debris.map(d => [
        +d.x.toFixed(9), +d.y.toFixed(9), +d.vx.toFixed(9), +d.vy.toFixed(9), d.size, d.radius,
        d.orbitCenter === undefined, d.orbitRadius === undefined,
      ]));
    }
    return out;
  });
  const nowField = snapshotField(seededBuild(0x9100), 0x9101);
  const preField = snapshotField(seededBuildPre(0x9100), 0x9101);
  eq(JSON.stringify(nowField), JSON.stringify(preField),
    "I: TRAP 4 — eight real FIELD waves are BYTE-IDENTICAL to the pre-P1 build under one seed");
  assert(nowField.every(w => w.length > 0 && w.every(d => d[6] && d[7])),
    "I: (setup) ...and those waves really carried satellites, none of them rail-borne");
  // The ORBIT control, which MUST differ — otherwise the identity above proves nothing.
  const snapshotOrbit = (B, seed) => withRandom(seededRandom(seed), () => {
    B.startGame();
    B.game.wave = 2; B.game.debris.length = 0; B.nextWave();
    return B.game.debris.length;
  });
  const nowOrbit = snapshotOrbit(seededBuild(0x9200), 0x9201);
  const preOrbit = snapshotOrbit(seededBuildPre(0x9200), 0x9201);
  eq(nowOrbit, 8, "I: (control) a level-3 ORBIT wave spawns 8 on this build");
  eq(preOrbit, 27, "I: (control) ...and 27 on the pre-P1 build — the orbit path really did change");

  // WORLD_SIZE_FIELD's own consequence: every field level still runs at 2560x1440 on both builds.
  eq(X.worldDims(X.WORLD_SIZE_FIELD).join(","), seededBuildPre(0x9300).worldDims(4).join(","),
    "I: TRAP 4 — the FIELD world's dimensions are identical on both builds");
})();

// ================= (J) spec §6 item 19 — DETERMINISM =====================
(function sectionJ() {
  console.log("(J) spec §6 item 19 — determinism under a seeded LCG");
  const run = () => withRandom(seededRandom(0xDE7E), () => {
    const B = build();
    B.startGame();
    const out = [];
    for (let n = 3; n <= 15; n += 3) {
      B.game.wave = n - 1; B.game.debris.length = 0; B.nextWave();
      out.push(B.game.debris.map(d => [+d.x.toFixed(9), +d.y.toFixed(9), d.orbitRadius ?? -1]));
    }
    return JSON.stringify(out);
  });
  const a = run(), b = run(), c = run();
  eq(a, b, "J: two seeded runs of the same orbit ramp are byte-identical");
  eq(b, c, "J: ...and so is a third");
  assert(a.length > 500, "J: (setup) the snapshot is a real one, not an empty string");
  // The only unpinned Math.random() site this file has to care about is the MODULE-LOAD starfield, which
  // is why every build() above is wrapped in a seeded generator. Named, per spec §6 item 19.
  assert(/Math\.random\(\) \* STAR_WORLD_W/.test(codeOnly),
    "J: (named) the starfield is the module-load Math.random() site every build() here is seeded around");
})();

// ================= (K) spec §6 item 20 — AudioSys.ctx NULL SMOKE =====================
(function sectionK() {
  console.log("(K) spec §6 item 20 — AudioSys.ctx null smoke across a real ramp");
  const X = seededBuild(0x1EAF, { audio: false });
  eq(X.AudioSys.ctx, null, "K: (setup) AudioSys.ctx really is null");
  noThrow(() => {
    withRandom(seededRandom(0x1EB0), () => {
      X.startGame();
      X.game.state = "playing"; X.game.paused = false;
      // Walk the whole ramp for real — one ring, two, three, four — updating AND drawing at each.
      for (let n = 2; n <= 13; n++) {
        X.game.debris.length = 0;
        X.game.wave = n - 1;
        X.nextWave();
        X.game.state = "playing"; X.game.paused = false;
        X.game.ship.hp = 250; X.game.ship.invuln = 1e6;
        for (let f = 0; f < 40; f++) { X.update(1 / 60); X.draw(); }
      }
    });
  }, "K: 12 real waves across the whole ramp update AND draw with no audio context");
  assert(X.game.debris.every(d => Number.isFinite(d.x) && Number.isFinite(d.y)),
    "K: every satellite stayed finite");
  assert(Number.isFinite(X.game.ship.x) && Number.isFinite(X.game.ship.y), "K: the ship stayed finite");
})();

console.log(`\ntest-cs023-p1: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
