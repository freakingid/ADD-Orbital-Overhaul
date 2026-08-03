// Headless test for CS022 Phase 3 — THE ORBIT RING RAMP.
//
//   node scratchpad/test-cs022-p3.js
//
// WHAT LANDED (PLANNED-FEATURES-CS022 §1.2/§1.3/§1.4/§4.4/§4.5/§4.6/§4.7, forks E/F/G). Five moving
// parts, all of which change what an ORBIT LEVEL CONTAINS and none of which touch a field level:
//
//   1. THE GEOMETRY (§1.3, gate Q1 + FORK-CS022-A). ORBIT_INNER_RADIUS 180 -> 460 (5 large-satellite
//      diameters, centre-to-centre) and ORBIT_RADIUS_STEP 150 -> 276 (3 more per ring), putting the four
//      rings at 460 / 736 / 1012 / 1288 and the outermost satellite EDGE at 1,334 px against the ORBIT
//      world's 1,420 px wrap-clean budget. It does NOT fit the field world's 700 px one, which is why
//      CS022 P1 (per-archetype world size) had to land first.
//   2. THE RAMP (§1.2, FORK-CS022-E). One ring per OCCURRENCE of the archetype, OUTERMOST FIRST —
//      activeRingsFor(level) returns [3], [3,2], [3,2,1], [3,2,1,0] — complete at occurrence 4 (level
//      12) and held. Radii never move: the ramp SELECTS rings, it does not re-space them.
//   3. THE HALVING (FORK-CS022-G). ORBIT_DENSITY[3] 0.85 -> 0.42, taken on FRAME BUDGET, not fairness:
//      an exact halving of ring 4's count at both ends of the occurrence curve (44 -> 22 at level 3,
//      49 -> 25 at the 1.8 floor), taking the peak level total from 108 to 84.
//   4. THE FIELD COMPONENT (§1.4, FORK-CS022-F). An orbit level now spawns levelDef(n-1).junkCount
//      ordinary scatter satellites ON TOP of its rings, through the same ship-relative loop a field
//      level uses — extracted verbatim into spawnFieldSatellites(). This RETIRES CS021's "junkCount is
//      not consumed on an orbit level" rule (spec Correction C6).
//   5. THE TABLE COLUMNS (§4.5). levelDef gains orbitRings and fieldCount, both from the UNCLAMPED n,
//      and fieldCount is the function's ONE recursive call (FLAG-CS022-e).
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL startGame/nextWave/update(1/60)/destroyDebris/killShip path.
// NOTHING under test is reimplemented — every expectation is recomputed from the same generateOrbitLayout
// + activeRingsFor + levelDef the shipped code is wired to, so each is a WIRING check rather than a
// restated literal. The two exceptions are named where they occur: spec §4.7's published totals (§B) and
// the retired 0.85 density (§D), both of which are pinned as literals ON PURPOSE.
//
// Sections:
//  (A) node --check + source pins, incl. all three TRAPs
//  (B) spec §8 item 1 — THE §4.7 RAMP TABLE at EVERY orbit level 3..63, via a REAL nextWave() spawn
//  (C) spec §8 item 2 — THE FIELD COMPONENT: count, spawn ring, and no orbit state
//  (D) spec §8 item 3 — THE HALVING, pinned both ways against the RETIRED 0.85 density
//  (E) spec §4.6 — spawnFieldSatellites is a PURE EXTRACTION (source pin + byte-identity behaviour pin)
//  (F) spec §8 item 7 — geometry guards, at the ORBIT world size
//  (G) spec §8 item 8 — wrap correctness at 5120x2880, with a naive-arithmetic control
//  (H) ⛔ FRAME-BUDGET GATE (spec §8 item 9, FLAG-CS022-f) — a DETERMINISTIC counter, plus reported timings
//  (I) spec §8 item 10 — FIELD LEVELS UNTOUCHED
//  (J) spec §8 item 11 — DETERMINISM
//  (K) levelDef's two new columns + the one recursive call (FLAG-CS022-e)
//  (L) AudioSys.ctx null smoke across a real ramp

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];
const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");

// A FIXED SHA, never HEAD — the CS017 P6 trap. ae60720 is the CS022 P2 commit, i.e. the last build
// BEFORE this phase, and it is what §E's pure-extraction and §I's byte-identity pins compare against.
const PRE_P3_REF = "ae60720";

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function close(got, want, msg, eps = 1e-9) { assert(Math.abs(got - want) < eps, `${msg} (got ${got}, want ${want})`); }
function noThrow(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.stack); } }

// ================= (A, part 1) syntax =====================
(function sectionA_syntax() {
  console.log("(A) node --check + source pins");
  const tmp = path.join(repoRoot, "scratchpad", "_cs022p3_extracted.js");
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
  "game", "startGame", "update", "draw", "nextWave", "destroyDebris", "killShip",
  "DebrisSatellite", "Dock", "levelDef",
  // the CS022 P3 surface
  "generateOrbitLayout", "activeRingsFor", "spawnFieldSatellites", "spawnOrbitWave",
  "orbitGapMult", "orbitEffectiveGapMult", "orbitEffectiveCount", "orbitRadiusStepFor",
  "ORBIT_LEVEL_EVERY", "ORBIT_INNER_RADIUS", "ORBIT_RADIUS_STEP", "ORBIT_RING_COUNT",
  "ORBIT_DENSITY", "ORBIT_GAP_MULT", "ORBIT_GAP_MULT_FLOOR", "ORBIT_SAFETY_MARGIN",
  "ORBIT_ANG_VEL", "ORBIT_FAST_MULT", "ORBIT_FAST_RING",
  // shared constants every expectation derives from — never a restated literal
  "DEBRIS_RADII", "SHIP_RADIUS", "SHIP_MAX_HP", "DOCK_RADIUS", "LEVER_DOCK_SIZE", "leverScale",
  "SPAWN_MIN_DIST", "SPAWN_MAX_DIST", "JUNK_CYCLE", "LEVEL_MAX", "PHASE_LEN",
  "WORLD_W", "WORLD_H", "worldDims", "WORLD_SIZE_FIELD", "WORLD_SIZE_ORBIT",
  "TAU", "dist2", "wrapPos", "AudioSys", "GAME_VERSION", "DEBUG", "DEBUG_VARS", "DEBUG_ENTRIES",
];

// `returns` lets the PRE-P3 build be constructed from a narrower list — activeRingsFor and
// spawnFieldSatellites do not exist at PRE_P3_REF, and naming them would throw a ReferenceError inside
// the factory's own return statement (the standing FIXED-build-only-symbol idiom).
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

// A deterministic LCG — every section that drives a real spawn runs inside one (spec §8 item 11).
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function withRandom(gen, fn) {
  const saved = Math.random;
  Math.random = gen;
  try { return fn(); } finally { Math.random = saved; }
}

// Drive the game to absolute level `w` through the REAL nextWave(), clearing the field first so the
// post-call array length is that level's ACTUAL spawn count (the standing idiom in this suite).
function atWave(X, w) {
  X.game.wave = w - 1;
  X.game.debris.length = 0;
  X.nextWave();
  return X.game.debris.length;
}

// The shipped generator arguments, exactly as spawnOrbitWave() assembles them — the ramp and the
// multiplier are the caller's, which is the P2/P3 seam.
function shippedArgs(X, centerX, centerY, gapMult, activeRings) {
  return {
    satelliteDiameter: X.DEBRIS_RADII[3] * 2,
    shipDiameter:      X.SHIP_RADIUS * 2,
    centerX, centerY,
    orbitCount:        X.ORBIT_RING_COUNT,
    innerRadius:       X.ORBIT_INNER_RADIUS,
    radiusStep:        X.orbitRadiusStepFor(X.ORBIT_RING_COUNT),
    safetyMargin:      X.ORBIT_SAFETY_MARGIN,
    minGapMultiplier:  gapMult,
    densityByOrbit:    X.ORBIT_DENSITY,
    baseAngVel:        X.ORBIT_ANG_VEL,
    fastRingIndex:     X.ORBIT_FAST_RING - 1,
    fastRingMult:      X.ORBIT_FAST_MULT,
    activeRings,
  };
}
// What an orbit level SHOULD spawn, recomputed from the shipped helpers rather than restated: the
// ramped ring layout plus the level table's own field component.
function expectedSpawn(X, level) {
  const L = withRandom(seededRandom(0xE0E0 + level), () => X.generateOrbitLayout(
    shippedArgs(X, 1280, 720, X.orbitGapMult(level), X.activeRingsFor(level))));
  const fieldCount = X.levelDef(level).fieldCount;
  return { layout: L, ringTotal: L.total, fieldCount, total: L.total + fieldCount };
}
// The four shipped ring radii, in index order — derived, never restated.
function shippedRadii(X) {
  return Array.from({ length: X.ORBIT_RING_COUNT }, (_, i) => X.ORBIT_INNER_RADIUS + i * X.ORBIT_RADIUS_STEP);
}

// ================= (A, part 2) source pins =====================
(function sectionA_pins() {
  const X = build();

  // --- the three constants that moved, and the ones that deliberately did not -----------------------
  eq(X.ORBIT_INNER_RADIUS, 460, "A: ORBIT_INNER_RADIUS is 460 (was 180)");
  eq(X.ORBIT_RADIUS_STEP, 276, "A: ORBIT_RADIUS_STEP is 276 (was 150)");
  eq(JSON.stringify(X.ORBIT_DENSITY), "[0.75,0.45,0.35,0.42]", "A: ORBIT_DENSITY's ring 4 halved to 0.42");
  eq(X.ORBIT_RING_COUNT, 4, "A: ORBIT_RING_COUNT unchanged at 4");
  eq(X.ORBIT_GAP_MULT, 2.5, "A: ORBIT_GAP_MULT unchanged");
  eq(X.ORBIT_GAP_MULT_FLOOR, 1.8, "A: ORBIT_GAP_MULT_FLOOR unchanged");
  eq(X.ORBIT_SAFETY_MARGIN, 8, "A: ORBIT_SAFETY_MARGIN unchanged");
  close(X.ORBIT_ANG_VEL, 6 * Math.PI / 180, "A: ORBIT_ANG_VEL unchanged at 6 deg/s");
  eq(X.ORBIT_FAST_MULT, 3.0, "A: ORBIT_FAST_MULT unchanged");
  eq(X.ORBIT_FAST_RING, 3, "A: ORBIT_FAST_RING unchanged");
  // Both new radii are the design's own derivation, not free numbers (FORK-CS022-A: centre-to-centre).
  eq(X.ORBIT_INNER_RADIUS, 5 * X.DEBRIS_RADII[3] * 2, "A: 460 IS 5 large-satellite diameters");
  eq(X.ORBIT_RADIUS_STEP, 3 * X.DEBRIS_RADII[3] * 2, "A: 276 IS 3 large-satellite diameters");

  // --- the constants-block comments the phase prompt requires rewriting -----------------------------
  const constBlock = scriptSrc.slice(scriptSrc.indexOf("// ---------- CS021 P1: ORBIT LEVELS"),
                                     scriptSrc.indexOf("const ORBIT_SPAWN_TRIES"));
  assert(/1,334/.test(constBlock) && /1,420/.test(constBlock),
    "A: the fitted-radii paragraph names the 1,334 px edge against the 1,420 px budget");
  assert(/WORLD_SIZE_ORBIT/.test(constBlock), "A: ...and says the budget is the ORBIT world's, not the live one");
  assert(/tight -> breather -> widest -> wide/.test(constBlock),
    "A: the density rhythm line reads tight -> breather -> widest -> wide (Correction C7)");
  assert(!/tight -> breather -> wide\/fast -> tightest/.test(constBlock),
    "A: ...and the retired rhythm line is gone");

  // --- ORBIT_RING_COUNT's relocation (FLAG-CS022-e) -------------------------------------------------
  // It had to move INSIDE the level-table block, because levelDef's new orbitRings column reads it and
  // test-cs018-p1.js §B evaluates that block alone in a bare context. Pinned by ORDER, not by line.
  const iLevelBanner = scriptSrc.indexOf("CS018 P1: the LEVEL PROGRESSION TABLE");
  const iRingCount   = scriptSrc.indexOf("const ORBIT_RING_COUNT");
  const iLevelDef    = scriptSrc.indexOf("function levelDef(n) {");
  assert(iLevelBanner > 0 && iRingCount > iLevelBanner && iRingCount < iLevelDef,
    "A: ORBIT_RING_COUNT is declared INSIDE the level-table block, before levelDef (FLAG-CS022-e)");
  eq((codeOnly.match(/const ORBIT_RING_COUNT/g) || []).length, 1, "A: ...and exactly once in the whole build");
  eq((codeOnly.match(/const ORBIT_LEVEL_EVERY/g) || []).length, 1, "A: ORBIT_LEVEL_EVERY still declared exactly once, in the same block");

  // --- generateOrbitLayout's ring filter (spec §4.4) ------------------------------------------------
  const genBody = codeOnly.slice(codeOnly.indexOf("function generateOrbitLayout("));
  const genEnd  = genBody.indexOf("\n}\n");
  const gen = genBody.slice(0, genEnd);
  assert(/activeRings \&\& activeRings\.indexOf\(i\) === -1/.test(gen),
    "A: the filter is `activeRings && activeRings.indexOf(i) === -1` — absent/null means every ring");
  assert(/inactive\.push\(\{ index: i, radius \}\)/.test(gen), "A: an inactive ring is recorded in `inactive`");
  // ORDER IS THE SPEC: the skip lands AFTER radius and BEFORE maxCount.
  const iRadius   = gen.indexOf("const radius        = innerRadius");
  const iSkip     = gen.indexOf("if (activeRings &&");
  const iMaxCount = gen.indexOf("const maxCount      =");
  assert(iRadius >= 0 && iSkip > iRadius && iMaxCount > iSkip,
    "A: the skip lands AFTER `radius` is computed and BEFORE `maxCount` (spec §4.4)");
  // `inactive` is its OWN array, deliberately not folded into `rejected`.
  assert(/const rings = \[\], rejected = \[\], inactive = \[\];/.test(gen),
    "A: `inactive` is a separate array from `rejected` — the two mean different things");
  assert(/rings, rejected, inactive,/.test(gen), "A: ...and both are returned");
  assert(!/rejected\.push\(\{ index: i, radius \}\)/.test(gen),
    "A: the ramp never pushes into `rejected` (which means 'unfair by construction')");

  // --- activeRingsFor (spec §4.4) --------------------------------------------------------------------
  eq((codeOnly.match(/function activeRingsFor\(/g) || []).length, 1, "A: exactly one activeRingsFor definition");
  const arf = codeOnly.slice(codeOnly.indexOf("function activeRingsFor("));
  const arfBody = arf.slice(0, arf.indexOf("\n}\n"));
  assert(/orbitEffectiveCount\(DEBUG\.orbitCount\)/.test(arfBody),
    "A: activeRingsFor counts down from the EFFECTIVE ring count (FLAG-CS022-h — it composes with the knob)");
  assert(/level \/ ORBIT_LEVEL_EVERY/.test(arfBody),
    "A: ...and occurrence is CS021 P2's own derivation — no new clock");
  assert(!/ORBIT_RAMP|CS022_RAMP/.test(codeOnly), "A: no new ramp constant was introduced");

  // --- spawnOrbitWave / nextWave wiring (spec §4.6) --------------------------------------------------
  assert(/function spawnOrbitWave\(speedMul, gapMult, activeRings\)/.test(codeOnly),
    "A: spawnOrbitWave takes activeRings as its THIRD parameter");
  assert(/spawnOrbitWave\(speedMul, orbitEffectiveGapMult\(game\.wave\), activeRingsFor\(game\.wave\)\)/.test(codeOnly),
    "A: nextWave()'s orbit branch resolves the ramp AT THE CALL SITE, like gapMult");
  assert(/spawnFieldSatellites\(levelDef\(game\.wave\)\.fieldCount, speedMul\)/.test(codeOnly),
    "A: ...and then spawns levelDef(game.wave).fieldCount scatter satellites (spec §4.6)");
  assert(/spawnFieldSatellites\(count, speedMul\)/.test(codeOnly),
    "A: the FIELD branch calls the same helper with its own junk count");
  const sfsHits = codeOnly.match(/(function )?spawnFieldSatellites\(/g) || [];
  eq(sfsHits.filter(h => h.startsWith("function")).length, 1, "A: exactly one spawnFieldSatellites definition");
  eq(sfsHits.filter(h => !h.startsWith("function")).length, 2, "A: ...called from exactly TWO sites — both nextWave branches");
  // The generator stays pure and unaware of occurrence — the seam P2 established, widened not breached.
  assert(!/generateOrbitLayout[\s\S]{0,120}activeRingsFor/.test(codeOnly),
    "A: generateOrbitLayout does not call activeRingsFor — the ramp arrives as an argument");
  assert(!/generateOrbitLayout[\s\S]{0,120}orbitGapMult/.test(codeOnly),
    "A: ...and still does not call orbitGapMult either");

  // --- levelDef's two new columns + the ONE recursive call (spec §4.5, FLAG-CS022-e) -----------------
  assert(/orbitRings: archetype === "orbit" \? Math\.min\(n \/ ORBIT_LEVEL_EVERY, ORBIT_RING_COUNT\) : 0,/.test(codeOnly),
    "A: orbitRings derives from the UNCLAMPED n and clamps at ORBIT_RING_COUNT");
  assert(/fieldCount: archetype === "orbit" \? levelDef\(n - 1\)\.junkCount : junkCount,/.test(codeOnly),
    "A: fieldCount is levelDef(n - 1).junkCount on an orbit level, its own junkCount otherwise");
  eq((codeOnly.match(/levelDef\(n - 1\)/g) || []).length, 1, "A: exactly ONE recursive levelDef call in the build");
  // ...and it is inside levelDef's own body, not a lookalike elsewhere.
  {
    const lines = codeOnly.split("\n");
    const dl = lines.findIndex(l => l.startsWith("function levelDef(n) {"));
    const sl = lines.findIndex(l => l.includes("levelDef(n - 1)"));
    let el = -1; for (let i = dl + 1; i < lines.length; i++) if (lines[i] === "}") { el = i; break; }
    assert(dl >= 0 && sl > dl && sl < el, "A: the recursive call sits inside levelDef's own body");
  }

  // --- TRAP 1: GAME_VERSION does not move this phase -------------------------------------------------
  eq(X.GAME_VERSION, "1.0.0.21", "A: TRAP 1 — GAME_VERSION unchanged (P4 owns the bump to 1.0.0.22)");

  // --- TRAP 3: no new debug knob for the ramp; the registry stays at 44 ------------------------------
  eq(X.DEBUG_ENTRIES.length, 44, "A: TRAP 3 — the debug registry is still 44 value entries");
  assert(!X.DEBUG_ENTRIES.some(e => /ramp|activeRing|orbitRings/i.test(e.id)),
    "A: TRAP 3 — no ramp knob was added (the ramp is derived, not dialled)");
  // orbitDensity4's `def` follows the shipped const automatically — the registry convention, verified.
  const d4 = X.DEBUG_ENTRIES.find(e => e.id === "orbitDensity4");
  eq(d4.def, X.ORBIT_DENSITY[3], "A: orbitDensity4's registry default follows ORBIT_DENSITY[3] (0.42) automatically");
  eq(X.DEBUG.orbitDensity4, 0.42, "A: ...and the live DEBUG value is the halved one");
  eq(X.DEBUG.orbitCount, X.ORBIT_RING_COUNT, "A: orbitCount seeds at the shipped ring count, unclamped by the budget");
})();

// ================= (B) spec §8 item 1 — THE §4.7 RAMP TABLE =====================
// Every orbit level 3..63 reproduced by a REAL nextWave() spawn, grouped by orbitRadius. Ring identity
// is asserted by RADIUS, never by array position. Spec §4.7's own published totals for occurrences 1-7
// are pinned as LITERALS here on purpose — that table is the changeset's headline claim, and a wiring
// check alone would happily agree with a wrong-but-self-consistent build.
const WANT_47 = {   // level: [orbit, field, total]
  3:  [22,  5, 27],
  6:  [37,  3, 40],
  9:  [52, 13, 65],
  12: [67,  9, 76],
  15: [70,  5, 75],
  18: [70,  3, 73],
  21: [71, 13, 84],
};
(function sectionB() {
  console.log("(B) spec §8 item 1 — the §4.7 ramp table at EVERY orbit level 3..63, via a real nextWave()");
  const X = build();
  const RAD = shippedRadii(X);
  let orbitLevels = 0, peak = 0, peakLevel = 0;
  const seen = [];
  withRandom(seededRandom(0x4703), () => {
    X.startGame();
    for (let n = 3; n <= 63; n += 3) {
      eq(X.levelDef(n).archetype, "orbit", `B: level ${n} is an orbit level`);
      orbitLevels++;
      const spawned = atWave(X, n);
      const want = expectedSpawn(X, n);

      // Grouped by orbitRadius — the ring identity every orbit test keys off.
      const byRadius = {};
      for (const d of X.game.debris) if (d.orbitCenter) byRadius[d.orbitRadius] = (byRadius[d.orbitRadius] || 0) + 1;
      const liveRadii = Object.keys(byRadius).map(Number).sort((a, b) => a - b);
      const railBorne = liveRadii.reduce((s, r) => s + byRadius[r], 0);
      const scatter   = spawned - railBorne;

      // THE RAMP: how many rings, and WHICH ones — outermost first, never re-spaced.
      const occ = n / X.ORBIT_LEVEL_EVERY;
      const wantRings = Math.max(1, Math.min(occ, X.ORBIT_RING_COUNT));
      eq(liveRadii.length, wantRings, `B: level ${n} (occurrence ${occ}): ${wantRings} ring(s) on the board`);
      const wantRadii = RAD.slice(X.ORBIT_RING_COUNT - wantRings);   // the OUTERMOST `wantRings` of them
      eq(liveRadii.join(","), wantRadii.join(","), `B: level ${n}: the rings present are the outermost ${wantRings}`);
      assert(liveRadii.includes(RAD[X.ORBIT_RING_COUNT - 1]), `B: level ${n}: ring 4 is always present`);
      eq(JSON.stringify(X.activeRingsFor(n).slice().sort((a, b) => a - b)),
         JSON.stringify(wantRadii.map(r => RAD.indexOf(r))),
         `B: level ${n}: activeRingsFor agrees with what actually spawned`);

      // THE TOTALS, both halves, recomputed from the shipped helpers.
      eq(railBorne, want.ringTotal, `B: level ${n}: ring population ${want.ringTotal}`);
      eq(scatter, want.fieldCount, `B: level ${n}: field component ${want.fieldCount}`);
      eq(spawned, want.total, `B: level ${n}: total ${want.total}`);

      // ...and against spec §4.7's published table where it has one.
      if (WANT_47[n]) {
        const [wo, wf, wt] = WANT_47[n];
        eq(railBorne, wo, `B: level ${n}: §4.7 says ${wo} orbit`);
        eq(scatter, wf, `B: level ${n}: §4.7 says ${wf} field`);
        eq(spawned, wt, `B: level ${n}: §4.7 says ${wt} total`);
      }
      if (spawned > peak) { peak = spawned; peakLevel = n; }
      seen.push({ n, orbit: railBorne, field: scatter, total: spawned });
    }
  });
  eq(orbitLevels, 21, "B: 21 orbit levels across 3..63");
  // Spec §4.7's closing claims: from level 24 the orbit half is frozen at 71 and the total breathes with
  // the junk cycle; the peak is 84, at levels 21/30/42/51/63.
  const frozen = seen.filter(s => s.n >= 24);
  assert(frozen.every(s => s.orbit === 71), "B: from level 24 the ring population is frozen at 71");
  eq(JSON.stringify([...new Set(frozen.map(s => s.total))].sort((a, b) => a - b)), "[74,76,80,84]",
    "B: ...and the totals from 24 on breathe 74 / 76 / 80 / 84 with the junk cycle");
  eq(peak, 84, "B: the peak level total is 84 (FORK-CS022-G's halving is what holds it there)");
  eq(JSON.stringify(seen.filter(s => s.total === 84).map(s => s.n)), "[21,30,42,51,63]",
    "B: ...reached at levels 21, 30, 42, 51 and 63");
  eq(peakLevel, 21, "B: the FIRST peak is level 21 — the level the frame-budget gate measures");
  console.log("    " + seen.filter(s => s.n <= 24).map(s => `L${s.n}:${s.orbit}+${s.field}=${s.total}`).join("  "));
})();

// ================= (C) spec §8 item 2 — THE FIELD COMPONENT =====================
(function sectionC() {
  console.log("(C) spec §8 item 2 — the field component: levelDef(n-1).junkCount, on the real spawn ring, no orbit state");
  const X = build();
  let checked = 0;
  withRandom(seededRandom(0xF1E1D), () => {
    X.startGame();
    for (let n = 3; n <= 63; n += 3) {
      atWave(X, n);
      const scatter = X.game.debris.filter(d => !d.orbitCenter);
      // 1. THE COUNT is the PREVIOUS level's junkCount — and that level is always a field level, which
      //    is what makes the column meaningful (spec §1.4).
      eq(X.levelDef(n - 1).archetype, "field", `C: level ${n - 1} is a field level, so its column is a real junk-cycle value`);
      eq(X.levelDef(n).fieldCount, X.levelDef(n - 1).junkCount, `C: level ${n}: fieldCount === levelDef(${n - 1}).junkCount`);
      eq(scatter.length, X.levelDef(n - 1).junkCount, `C: level ${n}: exactly ${X.levelDef(n - 1).junkCount} stateless satellites spawned`);
      // 2. NO ORBIT STATE at all — all four fields absent, not merely falsy.
      assert(scatter.every(d => d.orbitCenter === undefined && d.orbitRadius === undefined &&
                                d.orbitAngle === undefined && d.orbitAngVel === undefined),
        `C: level ${n}: no field-component satellite carries any orbit state`);
      // 3. INSIDE THE REAL SHIP-RELATIVE SPAWN RING, measured with the real wrap-aware dist2.
      for (const d of scatter) {
        const dist = Math.sqrt(X.dist2(d, X.game.ship));
        assert(dist >= X.SPAWN_MIN_DIST - 1e-6 && dist <= X.SPAWN_MAX_DIST + 1e-6,
          `C: level ${n}: field-component satellite at ${dist.toFixed(1)} px is inside [${X.SPAWN_MIN_DIST}, ${X.SPAWN_MAX_DIST}]`);
        checked++;
      }
      // 4. ...and they drift like ordinary debris rather than sitting still.
      assert(scatter.every(d => Math.hypot(d.vx, d.vy) > 0), `C: level ${n}: every field-component satellite has drift velocity`);
      // 5. The level's OWN junkCount is now unread by the spawn (FLAG-CS022-g) — proved by the two
      //    disagreeing at levels where the junk cycle actually differs.
      eq(scatter.length === X.levelDef(n).junkCount, X.levelDef(n).junkCount === X.levelDef(n - 1).junkCount,
        `C: level ${n}: the spawn tracks the PREVIOUS column, not this level's own`);
    }
    // The control that makes point 5 mean something: the two columns really do differ somewhere.
    const differ = [];
    for (let n = 3; n <= 63; n += 3) if (X.levelDef(n).junkCount !== X.levelDef(n).fieldCount) differ.push(n);
    assert(differ.length >= 15, `C: (control) the level's own junkCount differs from its fieldCount at ${differ.length} of the 21 orbit levels`);
  });
  assert(checked >= 100, `C: (control) ${checked} individual field-component satellites were position-checked`);
  // FLAG-CS022-a, recorded rather than asserted-away: there is no debris-vs-debris collision pass in the
  // build, so a field-component satellite MAY spawn overlapping a ring one and that is cosmetic. The
  // spawn deliberately does not rejection-sample against the ring radii; pinned so a future phase that
  // adds avoidance has to come here and say so.
  assert(!/rejection|avoidRing|orbitRadius[\s\S]{0,40}SPAWN_MIN_DIST/.test(codeOnly),
    "C: FLAG-CS022-a — the field spawn does NOT avoid the rings, as specced");
})();

// ================= (D) spec §8 item 3 — THE HALVING, PINNED BOTH WAYS =====================
// Ring 4's count must be EXACTLY half what the retired 0.85 density would have produced, at both ends of
// the occurrence curve. The comparison is COMPUTED against 0.85 through the real generator rather than
// restated as "22 vs 44", so a future density retune fails loudly instead of silently.
(function sectionD() {
  console.log("(D) spec §8 item 3 — ring 4's halving, computed against the RETIRED 0.85 density");
  const X = build();
  const RETIRED_RING4_DENSITY = 0.85;   // CS021's shipped value — a deliberate literal, this is the point
  const R4 = X.ORBIT_RING_COUNT - 1;

  function ring4CountAt(level, density) {
    const dens = X.ORBIT_DENSITY.slice();
    dens[R4] = density;
    const L = withRandom(seededRandom(0xD444 + level), () => X.generateOrbitLayout(
      Object.assign(shippedArgs(X, 1280, 720, X.orbitGapMult(level), X.activeRingsFor(level)),
                    { densityByOrbit: dens })));
    const r = L.rings.find(x => x.index === R4);
    return r ? r.count : 0;
  }

  eq(X.ORBIT_DENSITY[R4], 0.42, "D: the shipped ring-4 density is 0.42");
  assert(X.ORBIT_DENSITY[R4] < RETIRED_RING4_DENSITY, "D: (control) and it really is below the retired 0.85");

  // Level 3 (occurrence 1, gapMult 2.5) and level 24 (the first level at the 1.8 floor).
  // A note on "exact", stated honestly rather than parroting the spec's phrasing. The count is
  // round(1 + density x (maxCount - 1)), so halving the DENSITY halves the (count - 1) term, not count
  // itself, and the final rounding can land half a satellite either side. At occurrence 1 it comes out
  // exactly (22 x 2 === 44); at the 1.8 floor the retired density's own rounding gives 49, whose half is
  // 24.5 and rounds to 25. Both are asserted at the strength that is actually true, and the exact case
  // is asserted exactly so a density retune cannot hide behind the rounding.
  for (const [level, label] of [[3, "occurrence 1"], [24, "the 1.8 floor"]]) {
    const now = ring4CountAt(level, X.ORBIT_DENSITY[R4]);
    const old = ring4CountAt(level, RETIRED_RING4_DENSITY);
    eq(now, Math.round(old / 2), `D: level ${level} (${label}): ring 4 is half its 0.85 count to the rounding (${now} vs ${old})`);
  }
  eq(ring4CountAt(3, X.ORBIT_DENSITY[R4]) * 2, ring4CountAt(3, RETIRED_RING4_DENSITY),
    "D: at occurrence 1 the halving is EXACT — 22 x 2 === 44, no rounding slack at all");
  // The spec's own figures, as a second, independent statement of the same thing.
  eq(ring4CountAt(3, X.ORBIT_DENSITY[R4]), 22, "D: spec's figure — 22 at level 3");
  eq(ring4CountAt(3, RETIRED_RING4_DENSITY), 44, "D: spec's figure — 44 under the retired density");
  eq(ring4CountAt(24, X.ORBIT_DENSITY[R4]), 25, "D: spec's figure — 25 at the floor");
  eq(ring4CountAt(24, RETIRED_RING4_DENSITY), 49, "D: spec's figure — 49 under the retired density");

  // FLAG-CS022-c / Correction C7: the halving reversed ring 4's CHARACTER. It was the tightest ring at
  // 92 px; it is the second-widest now, and ring 1 is the only tight one left.
  const L = withRandom(seededRandom(0xD4FF), () => X.generateOrbitLayout(
    shippedArgs(X, 1280, 720, X.ORBIT_GAP_MULT, null)));
  const gaps = L.rings.map(r => r.actualGapPx);
  close(gaps[R4], 276, "D: ring 4's lane is ~276 px now (it was 92 under the retired density)", 1.0);
  assert(gaps[0] === Math.min(...gaps), "D: ring 1 is the tightest ring (Correction C7)");
  assert(gaps[R4] !== Math.min(...gaps), "D: ...and ring 4 is not, which is what the retired rhythm line claimed");

  // The peak the halving exists to hold down: 84, against the 108 the retired density would have given.
  function peakTotalWith(density) {
    const dens = X.ORBIT_DENSITY.slice(); dens[R4] = density;
    const LL = withRandom(seededRandom(0xD400), () => X.generateOrbitLayout(
      Object.assign(shippedArgs(X, 1280, 720, X.orbitGapMult(21), X.activeRingsFor(21)),
                    { densityByOrbit: dens })));
    return LL.total + X.levelDef(21).fieldCount;
  }
  eq(peakTotalWith(X.ORBIT_DENSITY[R4]), 84, "D: the level-21 peak is 84 with the halved density");
  eq(peakTotalWith(RETIRED_RING4_DENSITY), 108, "D: ...and would have been 108 with the retired one (FORK-CS022-G's whole reason)");
})();

// ================= (E) spec §4.6 — spawnFieldSatellites IS A PURE EXTRACTION =====================
(function sectionE() {
  console.log("(E) spec §4.6 — spawnFieldSatellites is a pure extraction of the pre-P3 field branch");
  // 1. SOURCE PIN against the FIXED pre-P3 commit (never HEAD — the CS017 P6 trap). The old branch's
  //    loop body and the new function's loop body must be textually identical once indentation is
  //    normalised and the loop bound is renamed (`count` -> the parameter `n`).
  let preSrc = null;
  try { preSrc = execSync(`git show ${PRE_P3_REF}:asteroids-deluxe.html`, { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }).toString(); }
  catch (e) { failed++; console.error(`  FAIL: E: could not read ${PRE_P3_REF} — ${e.message}`); }
  if (preSrc) {
    const preScript = preSrc.match(/<script>([\s\S]*?)<\/script>/)[1];
    const norm = s => s.replace(/\s+/g, " ").trim();

    // The pre-P3 loop, sliced out of nextWave()'s else branch.
    const i0 = preScript.indexOf("    for (let i = 0; i < count; i++) {");
    assert(i0 > 0, "E: (setup) found the pre-P3 field-branch loop");
    const oldLoop = preScript.slice(i0, preScript.indexOf("\n    }\n", i0) + "\n    }".length);
    // The new function's body.
    const j0 = scriptSrc.indexOf("function spawnFieldSatellites(n, speedMul) {");
    assert(j0 > 0, "E: (setup) found spawnFieldSatellites");
    const fnSrc = scriptSrc.slice(j0, scriptSrc.indexOf("\n}\n", j0) + 2);   // +2 keeps the closing brace
    const newLoop = fnSrc.slice(fnSrc.indexOf("  for (let i = 0; i < n; i++) {"),
                                fnSrc.lastIndexOf("  }") + "  }".length);
    eq(norm(newLoop), norm(oldLoop.replace("i < count", "i < n")),
      "E: the extracted loop is byte-identical to the pre-P3 branch once indentation and the bound name are normalised");
    // ...and the function is nothing BUT that loop.
    eq(norm(fnSrc), norm("function spawnFieldSatellites(n, speedMul) {\n" + newLoop + "\n}"),
      "E: spawnFieldSatellites contains the loop and nothing else");

    // 2. BEHAVIOUR PIN, which is the stronger half: under one seed, a real FIELD-level nextWave() on the
    //    pre-P3 build and on this one must produce a BYTE-IDENTICAL board. Nothing on a field level's
    //    path changed, so any divergence at all — RNG order included — is a regression.
    const PRE_RETURN = RETURN.filter(s => s !== "activeRingsFor" && s !== "spawnFieldSatellites");
    const PRE = buildFrom(preScript, { returns: PRE_RETURN });
    const NOW = build();
    const snap = X => withRandom(seededRandom(0x5A3E), () => {
      X.startGame();
      const out = [];
      for (const lvl of [2, 4, 5, 7, 8, 10, 11, 13]) {   // every one a FIELD level
        atWave(X, lvl);
        out.push(lvl + ":" + X.game.debris.map(d =>
          `${d.x.toFixed(12)},${d.y.toFixed(12)},${d.vx.toFixed(12)},${d.vy.toFixed(12)},${d.size}`).join("|") +
          "#" + X.game.dock.x.toFixed(12) + "," + X.game.dock.y.toFixed(12));
      }
      return out.join("\n");
    });
    const a = snap(PRE), b = snap(NOW);
    eq(b, a, "E: eight real FIELD-level waves are BYTE-IDENTICAL to the pre-P3 build under the same seed");
    assert(a.length > 500, "E: (control) the snapshot is a substantial string, not an empty comparison");
    // ...and the same comparison at an ORBIT level MUST differ, or the control above proves nothing.
    const orbitSnap = X => withRandom(seededRandom(0x5A3F), () => {
      X.startGame(); atWave(X, 3);
      return X.game.debris.length + "|" + X.game.debris.map(d => d.orbitRadius).join(",");
    });
    assert(orbitSnap(PRE) !== orbitSnap(NOW), "E: (control) an ORBIT level DOES differ from the pre-P3 build — the comparison has teeth");
  }
})();

// ================= (F) spec §8 item 7 — GEOMETRY GUARDS AT THE ORBIT WORLD SIZE =====================
(function sectionF() {
  console.log("(F) spec §8 item 7 — geometry guards at the orbit world size, at EVERY occurrence");
  const X = build();
  // Drive to an orbit level first so the LIVE torus is the one these radii belong in. The counts and
  // gaps below are position-independent, but placeOrbitRing() runs wrapPos() against the live period and
  // a 1288 px ring folded into a 1440-tall world is a confusing thing to be looking at while asserting.
  withRandom(seededRandom(0xF00C), () => { X.startGame(); atWave(X, X.ORBIT_LEVEL_EVERY); });
  eq(X.game.worldSize, X.WORLD_SIZE_ORBIT, "F: (setup) the sweep runs at the orbit world size");
  const shipDiameter = X.SHIP_RADIUS * 2;
  const satR = X.DEBRIS_RADII[3];
  // THE BUDGET IS THE ORBIT WORLD'S, read from the size table — never the live WORLD_H, which is 1440
  // whenever a field level is on screen. This is the distinction CS022 P1's sweep had to introduce.
  const budget = X.worldDims(X.WORLD_SIZE_ORBIT)[1] / 2 - 20;
  eq(budget, 1420, "F: the orbit world's wrap-clean budget is 1420 px");
  const fieldBudget = X.worldDims(X.WORLD_SIZE_FIELD)[1] / 2 - 20;
  eq(fieldBudget, 700, "F: (control) the FIELD world's is 700 px — which this geometry does NOT fit");
  const dock = X.DOCK_RADIUS * X.leverScale(X.LEVER_DOCK_SIZE, 1);
  eq(dock, 88, "F: the dock radius is 88 px at every level (Correction C2)");

  let worstGap = Infinity, worstEdge = 0, occurrences = 0;
  for (let n = 3; n <= 63; n += 3) {
    occurrences++;
    const gapMult = X.orbitGapMult(n);
    const L = withRandom(seededRandom(0xF00D + n), () => X.generateOrbitLayout(
      shippedArgs(X, 2560, 1440, gapMult, X.activeRingsFor(n))));
    for (const r of L.rings) {
      assert(r.actualGapPx >= shipDiameter * gapMult - 1e-9,
        `F: level ${n} ring ${r.index + 1}: arc gap ${r.actualGapPx.toFixed(2)} >= shipDiameter x ${gapMult.toFixed(2)}`);
      assert(r.maxCount >= 1, `F: level ${n} ring ${r.index + 1}: maxCount >= 1`);
      assert(r.count >= 1 && r.count <= r.maxCount,
        `F: level ${n} ring ${r.index + 1}: 1 <= count (${r.count}) <= maxCount (${r.maxCount})`);
      worstGap = Math.min(worstGap, r.actualGapPx);
    }
    // The outermost satellite EDGE clears the budget — the Correction-C3 failure can never regress in.
    assert(L.outerEdge <= budget, `F: level ${n}: outermost satellite edge ${L.outerEdge} <= ${budget}`);
    eq(L.outerEdge, 1334, `F: level ${n}: ...and it is 1334 px at EVERY occurrence (the ramp never re-spaces)`);
    worstEdge = Math.max(worstEdge, L.outerEdge);
    // Ring 1's clearance over the dock, whether or not ring 1 is active at this occurrence.
    assert(X.ORBIT_INNER_RADIUS - satR - dock >= 0,
      `F: level ${n}: ring 1 clears an 88 px dock by ${X.ORBIT_INNER_RADIUS - satR - dock} px`);
    eq(L.rejected.length, 0, `F: level ${n}: no ring was rejected (the maxCount guard never fires)`);
    eq(L.rings.length + L.inactive.length, X.ORBIT_RING_COUNT, `F: level ${n}: active + inactive accounts for every ring`);
    // Every INACTIVE ring still reports the radius it would have had — the spec's reason for skipping
    // after `radius` rather than before it.
    for (const r of L.inactive) eq(r.radius, X.ORBIT_INNER_RADIUS + r.index * X.ORBIT_RADIUS_STEP,
      `F: level ${n}: inactive ring ${r.index + 1} still reports its radius`);
  }
  eq(occurrences, 21, "F: 21 occurrences swept");
  eq(X.ORBIT_INNER_RADIUS - satR - dock, 326, "F: that clearance is 326 px (was 46 at the CS021 geometry)");
  assert(worstEdge > fieldBudget,
    "F: (control) the geometry genuinely does NOT fit the field world — CS022 P1 is load-bearing, not cosmetic");
  console.log(`    tightest lane across all 21 occurrences: ${worstGap.toFixed(2)} px; edge ${worstEdge} px (budget ${budget})`);
})();

// ================= (G) spec §8 item 8 — WRAP CORRECTNESS AT 5120x2880 =====================
(function sectionG() {
  console.log("(G) spec §8 item 8 — wrap correctness at the orbit world size, with a naive control");
  const X = build();
  // Drive to an orbit level FIRST so the LIVE torus really is 5120x2880 — wrapPos reads the live period,
  // and a ring of radius 1288 has no wrap-clean meaning in the 2560x1440 field world.
  withRandom(seededRandom(0x5EA22), () => { X.startGame(); atWave(X, X.ORBIT_LEVEL_EVERY); });
  eq(X.game.worldSize, X.WORLD_SIZE_ORBIT, "G: (setup) the probe runs at the orbit world size");
  const [W, H] = X.worldDims(X.game.worldSize);
  eq(W, 5120, "G: (setup) the live world is 5120 wide");
  eq(H, 2880, "G: (setup) ...and 2880 tall");

  const docks = [
    { x: 5, y: 5 }, { x: W - 5, y: 5 }, { x: 5, y: H - 5 }, { x: W - 5, y: H - 5 },
    { x: 0, y: 0 }, { x: W - 1, y: H / 2 }, { x: W / 2, y: 1 },
  ];
  let samples = 0, naiveWorst = 0, toroidalWorst = 0;
  for (const c of docks) {
    const L = withRandom(seededRandom(0x5EA30 + c.x), () => X.generateOrbitLayout(
      shippedArgs(X, c.x, c.y, X.ORBIT_GAP_MULT, null)));   // all four rings — the widest test
    for (const r of L.rings) {
      for (const s of r.satellites) {
        samples++;
        assert(s.x >= 0 && s.x < W && s.y >= 0 && s.y < H,
          `G: satellite position is inside the world box (${s.x.toFixed(1)}, ${s.y.toFixed(1)})`);
        const toro = Math.sqrt(X.dist2(s, { x: c.x, y: c.y }));
        toroidalWorst = Math.max(toroidalWorst, Math.abs(toro - r.radius));
        close(toro, r.radius, `G: dock at (${c.x},${c.y}) ring ${r.index + 1}: toroidal distance === radius`, 1e-6);
        naiveWorst = Math.max(naiveWorst, Math.abs(Math.hypot(s.x - c.x, s.y - c.y) - r.radius));
      }
    }
  }
  assert(samples > 400, `G: (setup) ${samples} satellites sampled across seven edge/corner docks`);
  assert(toroidalWorst < 1e-6, `G: the wrap-aware measurement is exact (worst error ${toroidalWorst.toExponential(2)} px)`);
  assert(naiveWorst > 1000,
    `G: CONTROL — naive (non-wrap) arithmetic is off by ${naiveWorst.toFixed(0)} px, thousands not units, so the assertion above has teeth`);

  // The same thing end to end, through a REAL nextWave() with the dock forced onto the seam. Both levels
  // are orbit levels, so no resize runs between them and the ship stays exactly where it is put.
  withRandom(seededRandom(0x5EA31), () => {
    X.startGame();
    atWave(X, 3);                              // pays the one field->orbit resize
    X.game.ship.x = 3; X.game.ship.y = H - 4;  // hard against the LIVE seam
    atWave(X, 12);                             // orbit -> orbit: no resize, a FULL-ramp level
  });
  assert(Math.min(X.game.dock.x, W - X.game.dock.x) <= 700 || Math.min(X.game.dock.y, H - X.game.dock.y) <= 700,
    "G: (setup) the real dock landed near a world seam, so its rings straddle it");
  const rail = X.game.debris.filter(d => !!d.orbitCenter);
  eq(rail.length, expectedSpawn(X, 12).ringTotal, "G: (setup) a full-ramp seam-side wave laid its whole ring population");
  const realNaive = rail.reduce((mx, d) =>
    Math.max(mx, Math.abs(Math.hypot(d.x - X.game.dock.x, d.y - X.game.dock.y) - d.orbitRadius)), 0);
  assert(realNaive > 1000, `G: CONTROL — on the REAL seam-side spawn, naive arithmetic is off by ${realNaive.toFixed(0)} px`);
  for (const d of rail) {
    close(Math.sqrt(X.dist2(d, X.game.dock)), d.orbitRadius, "G: real spawn: toroidal distance to the dock === ring radius", 1e-6);
  }
  console.log(`    worst toroidal error ${toroidalWorst.toExponential(2)} px; naive would be off by up to ${naiveWorst.toFixed(0)} px`);
})();

// ================= (H) ⛔ FRAME-BUDGET GATE (spec §8 item 9, FLAG-CS022-f) =====================
//
// GATED ON A DETERMINISTIC COUNTER, NOT ON WALL TIME. Headless Node timing is GC-noisy and machine-
// dependent; the quantity actually at risk is the O(n^2) inner loop of coalesceGarbage(), and its
// iteration count is machine-independent. Wall time is measured and REPORTED alongside, never asserted.
//
// THE CEILING, DERIVED (and derived BEFORE the measurement, so it is a gate rather than a rubber stamp):
//   * CS021 P1 §K measured 1,233 standing canisters at the death-detonation peak on a 40-satellite
//     orbit level, in the 2560x1440 world of the time. That is C(1233,2) ~= 760k pair-checks — the
//     "~760k" figure the phase prompt quotes.
//   * Canister volume scales ~linearly with satellite count (each destroyed satellite sheds a fixed
//     number per tier through the 3-way split cascade). CS022's peak is 84 satellites at level 21,
//     i.e. 84/40 = 2.10x.
//   * CS022 P1 MEASURED that the same level in the 5120x2880 orbit world stands MORE garbage, not less:
//     peak 256 -> 319, i.e. 1.246x, because coalescence's flat-px merge radius merges less over four
//     times the area. Spec §8 item 9 is explicit that the ceiling must be derived against the size-16
//     world rather than extrapolated from CS021's size-4 measurement.
//   * Projection: 1233 x 2.10 x 1.246 ~= 3,226 standing canisters -> C(3226,2) ~= 5.20M pair-checks.
//   * CEILING = 8,000,000, i.e. ~1.54x that projection. The margin covers the pair count's QUADRATIC
//     sensitivity to a canister-count error (a 10% miss is 1.21x on pairs) times a further ~1.25x for
//     the fact that the projection composes two independently-measured scalings. A breach means the
//     real load is materially worse than the arithmetic predicts, which is exactly the condition the
//     gate exists to catch.
//
// A SECOND, TIGHTER CEILING FOR THE REALISTIC PATH, derived the same way and also before measuring.
// The derivation above is about the DEATH-DETONATION peak. Ordinary play's own peak is much lower and
// was measured too: CS022 P1 recorded 319 standing canisters during a LIVE level-3 harvest in the
// size-16 world. Scaled by the same 84/40 = 2.10x satellite ratio that gives ~670 canisters ->
// C(670,2) ~= 224k pair-checks, and 500,000 is ~2.2x that. The progressive full harvest is asserted
// against this one as well, so the realistic path has a gate with actual teeth rather than only the
// worst-case one two orders of magnitude above it.
//
// IF EITHER FAILS: STOP. Per the phase prompt, the density sliders are the first lever and a spatial
// hash for coalescence is a separate changeset — neither is a thing to tune around inside this phase.
const PAIR_CHECK_CEILING = 8000000;
const HARVEST_PAIR_CEILING = 500000;
(function sectionH() {
  console.log("(H) ⛔ FRAME-BUDGET GATE (spec §8 item 9) — deterministic coalesceGarbage pair-check counter");

  // Instrument a COPY of the real source: one counter increment at the top of coalesceGarbage's inner
  // loop, and nothing else. The algorithm under measurement is the shipped one, byte for byte.
  const LOOP = "    for (let j = i + 1; j < gs.length; j++) {\n      const b = gs[j];";
  eq((scriptSrc.match(/for \(let j = i \+ 1; j < gs\.length; j\+\+\) \{/g) || []).length, 1,
    "H: (setup) exactly one coalesceGarbage inner loop to instrument");
  assert(scriptSrc.includes(LOOP), "H: (setup) the inner loop matches the expected text");
  const instrumented = "const __PROBE = { pairs: 0 };\n" +
    scriptSrc.replace(LOOP, LOOP + "\n      __PROBE.pairs++;");
  const X = buildFrom(instrumented, { extra: ["__PROBE"] });
  assert(!!X.__PROBE, "H: (setup) the probe is exported");

  // Prove the counter is LIVE before trusting it. A FRESH burst cannot coalesce — every piece carries a
  // coalesceDelay (3 s at the shipped GARBAGE_COALESCE_DELAY) for which the outer loop skips it, so the
  // control has to run well past that delay before it means anything. Getting this wrong is how a probe
  // reads zero and looks like a pass.
  withRandom(seededRandom(0x9101), () => { X.startGame(); atWave(X, 4); });
  X.game.state = "playing"; X.game.paused = false;
  for (const d of X.game.debris.filter(d => !d.dead).slice(0, 8)) X.destroyDebris(d, true);
  let controlPairs = 0;
  for (let i = 0; i < 300; i++) { X.__PROBE.pairs = 0; X.game.ship.hp = X.SHIP_MAX_HP; X.update(1 / 60); controlPairs = Math.max(controlPairs, X.__PROBE.pairs); }
  assert(controlPairs > 0, `H: (control) the pair counter is live — ${controlPairs} checks in the worst of 300 ordinary frames`);

  // THE MEASUREMENT, at level 21 — the 84-satellite peak. Three probes:
  //   harvest — a steady progressive FULL harvest with the ship kept alive: ordinary play, at CS021
  //             §K's own one-kill-per-6-frames rate, run until the field is clear plus a 2 s tail.
  //   blitz   — every satellite and every split child destroyed within a handful of frames while the
  //             ship stays ALIVE. This is a deliberate over-stress: it is the DEATH-SHOCKWAVE load put
  //             through the LIVE pass, which is exactly what the ceiling's own derivation assumes, and
  //             it is what makes the gate meaningful rather than trivially satisfied.
  //   death   — a real killShip() on a part-harvested board, the CS021 §K worst case, kept for the
  //             entity-count comparison and for the finding printed below.
  // ONE SATELLITE IS DELIBERATELY LEFT ALIVE in the blitz. Wave clear fires on debris.length === 0 after
  // a 2.5 s timer, and the coalesce delay is 3 s — so a fully-cleared board advances the level BEFORE
  // the garbage it produced ever becomes eligible for the pass, and the probe would measure the peak of
  // a different level. Holding one body keeps the measurement on level 21 where it belongs.
  function probe(level, seed, mode) {
    const Y = buildFrom(instrumented, { extra: ["__PROBE"] });
    withRandom(seededRandom(seed), () => { Y.startGame(); atWave(Y, level); });
    Y.game.state = "playing"; Y.game.paused = false;
    const spawned = Y.game.debris.length;
    let frames = 0, sinceKill = 0, tail = 0;
    let worstPairs = 0, worstPairsFrame = 0, worstPairsGarbage = 0;
    let peak = 0, peakDebris = 0, peakGarbage = 0, peakParticles = 0;
    let worstNs = 0n, totalNs = 0n, livePlayFrames = 0;
    const samples = [];
    const MAX_FRAMES = mode === "harvest" ? 9000 : mode === "blitz" ? 600 : 4000;
    withRandom(seededRandom(seed ^ 0xFFFF), () => {
      while (tail < 120 && frames < MAX_FRAMES) {
        if (mode === "death") {
          if (frames === 90) Y.killShip();
          else if (frames < 90) {
            const live = Y.game.debris.filter(d => !d.dead);
            if (++sinceKill >= 6 && live.length) { sinceKill = 0; Y.destroyDebris(live[0], true); }
            Y.game.ship.hp = Y.SHIP_MAX_HP;
          }
        } else {
          // KEEP THE SHIP ALIVE. A parked ship inside a ring level takes ambient contact damage; once it
          // dies, update() drops into updateDeath() and the measurement silently stops being about the
          // live path at all. Topping the hull up outside the timed region is what keeps every frame
          // measured a full update(), collisions and coalescence included.
          Y.game.ship.hp = Y.SHIP_MAX_HP;
          // destroyDebris() does NOT guard on `dead`, so the target must always be a LIVE body — feeding
          // it the same already-dead object repeatedly mints unbounded garbage and children.
          const live = Y.game.debris.filter(d => !d.dead);
          if (mode === "blitz") {
            for (let k = 0; k + 1 < live.length; k++) Y.destroyDebris(live[k], true);   // all but one
          } else if (++sinceKill >= 6 && live.length) {
            sinceKill = 0; Y.destroyDebris(live[0], true);
          }
        }
        if (Y.game.debris.length === 0) tail++;
        Y.__PROBE.pairs = 0;
        const t0 = process.hrtime.bigint();
        Y.update(1 / 60);
        const dtNs = process.hrtime.bigint() - t0;
        const pairs = Y.__PROBE.pairs;
        if (pairs > worstPairs) { worstPairs = pairs; worstPairsFrame = frames; worstPairsGarbage = Y.game.garbage.length; }
        totalNs += dtNs; if (dtNs > worstNs) worstNs = dtNs;
        if (Y.game.state === "playing") livePlayFrames++;
        frames++;
        const ents = Y.game.debris.length + Y.game.hunters.length + Y.game.saucers.length +
                     Y.game.garbage.length + Y.game.particles.length + Y.game.bullets.length +
                     Y.game.powerups.length + Y.game.floaters.length;
        samples.push({ ents, ns: dtNs });
        peak = Math.max(peak, ents);
        peakDebris = Math.max(peakDebris, Y.game.debris.length);
        peakGarbage = Math.max(peakGarbage, Y.game.garbage.length);
        peakParticles = Math.max(peakParticles, Y.game.particles.length);
        if (mode === "death" && Y.game.state === "gameover") break;
      }
    });
    const warm = samples.slice(30);
    const msOf = s => Number(s.ns) / 1e6;
    const pct = (arr, p) => { const v = arr.map(msOf).sort((a, b) => a - b); return v.length ? v[Math.min(v.length - 1, Math.floor(v.length * p))] : 0; };
    return { level, mode, spawned, frames, livePlayFrames, worstPairs, worstPairsFrame, worstPairsGarbage,
             peak, peakDebris, peakGarbage, peakParticles,
             endState: Y.game.state, endWave: Y.game.wave,
             medianMs: pct(warm, 0.5), p95Ms: pct(warm, 0.95), p99Ms: pct(warm, 0.99),
             worstMs: Number(worstNs) / 1e6, meanMs: Number(totalNs / BigInt(frames || 1)) / 1e6 };
  }

  const harvest = probe(21, 0x9021, "harvest");
  const death   = probe(21, 0x9021, "death");
  const blitz   = probe(21, 0x9021, "blitz");

  // Validity: no probe may silently degenerate.
  for (const p of [harvest, blitz, death]) eq(p.spawned, 84, `H: (validity) the ${p.mode} probe started from the 84-satellite peak wave`);
  eq(harvest.endState, "playing", "H: (validity) the harvest probe stayed in the live update path throughout");
  eq(blitz.endState, "playing", "H: (validity) so did the blitz probe");
  eq(harvest.endWave, 21, "H: (validity) the harvest stayed on level 21 — no wave clear mid-measurement");
  eq(blitz.endWave, 21, "H: (validity) ...and so did the blitz");
  assert(harvest.frames > 300, `H: (validity) the harvest ran a real number of frames (${harvest.frames})`);
  assert(harvest.peakDebris > 84, "H: (validity) the harvest really cascaded through the split tiers");
  eq(blitz.livePlayFrames, blitz.frames, "H: (validity) EVERY blitz frame was a live update() — none of it measured the death path");
  assert(blitz.frames >= 550, `H: (validity) the blitz ran past the 3 s coalesce delay (${blitz.frames} frames), so the pass really saw the load`);
  assert(blitz.peakGarbage > harvest.peakGarbage,
    `H: (validity) the blitz really is the heavier standing-garbage load (${blitz.peakGarbage} vs ${harvest.peakGarbage})`);
  eq(death.endState, "gameover", "H: (validity) the death probe really reached gameover");

  // ─────────────────────────────────────────────────────────────────────────────────────────────────
  // THE FINDING THIS PROBE TURNED UP, and it changes how the ceiling should be read. CS021 §K's
  // 1,233-canister figure — the one the ceiling is derived from — is a DEATH-DETONATION peak, and
  // updateDeath() DOES NOT CALL coalesceGarbage AT ALL. That load has therefore never been put through
  // the O(n^2) pass on a single frame in the shipped game, and structurally cannot be:
  //   * updateDeath() has no coalesceGarbage call (source-pinned below);
  //   * killShip() is TERMINAL — F2, no respawn, no lives counter — so the board never returns to the
  //     live update path carrying that garbage;
  //   * the only OTHER mass-destruction event, the Super-Mega-Delivery Hunter sweep, deliberately sets
  //     game.sweepPause, which suspends coalescence for exactly this reason (source-pinned below).
  // So the BLITZ — every satellite and child destroyed at once with the ship still alive — is a load the
  // shipped game cannot produce. It is retained as a REPORTED over-stress and as the counter's own
  // teeth-proof (it demonstrates the instrument can register millions of checks, so a real breach would
  // be caught), and it is deliberately NOT what the gate asserts on. The gate asserts on the two REAL
  // scenarios the phase prompt names: the progressive full harvest and the death detonation.
  // ─────────────────────────────────────────────────────────────────────────────────────────────────
  eq(death.worstPairs, 0, "H: (finding) the DEATH path never runs coalesceGarbage — updateDeath() has no such call");
  {
    const ud = codeOnly.slice(codeOnly.indexOf("function updateDeath(dt) {"));
    const udBody = ud.slice(0, ud.indexOf("\n}\n"));
    assert(!/coalesceGarbage/.test(udBody), "H: (source) updateDeath() contains no coalesceGarbage call");
    assert(/no respawn/.test(scriptSrc.slice(scriptSrc.indexOf("function killShip()"), scriptSrc.indexOf("function killShip()") + 200)),
      "H: (source) killShip() is documented as terminal — no respawn, so the death load never re-enters update()");
    assert(!/\bgame\.lives\b/.test(codeOnly), "H: (source) ...and there is no lives counter anywhere to bring it back");
    assert(/game\.sweepPause = DEBUG\.sweepCoalescePause;/.test(codeOnly),
      "H: (source) the SMD's mass Hunter destruction PAUSES coalescence — the other mass-destruction event is guarded too");
  }
  assert(blitz.worstPairs > 1000000,
    `H: (teeth) the counter can register millions of checks — the blitz drove it to ${blitz.worstPairs.toLocaleString("en-US")}, so a real breach would not go unseen`);

  // ⛔ THE GATED QUANTITY: the two REAL scenarios only.
  const worst = Math.max(harvest.worstPairs, death.worstPairs);
  for (const p of [harvest, death, blitz]) {
    const label = p.mode === "harvest" ? "PROGRESSIVE FULL HARVEST (steady, ship alive) — GATED"
                : p.mode === "death"   ? "DEATH DETONATION at frame 90 (part-harvested, real killShip()) — GATED"
                                       : "BLITZ over-stress (whole ring at once, ship alive) — REPORTED, NOT REACHABLE IN PLAY";
    console.log(`    level ${p.level} ${label}: spawned ${p.spawned}, frames ${p.frames}`);
    console.log(`      PEAK ENTITIES ${p.peak}  (debris ${p.peakDebris} / garbage ${p.peakGarbage} / particles ${p.peakParticles})`);
    console.log(`      update(dt) ms — median ${p.medianMs.toFixed(3)}, p95 ${p.p95Ms.toFixed(3)}, ` +
      `p99 ${p.p99Ms.toFixed(3)}, worst ${p.worstMs.toFixed(3)}, mean ${p.meanMs.toFixed(3)} (GC-inflated)   [REPORTED, never gated]`);
    console.log(`      worst-frame coalesceGarbage pair checks: ${p.worstPairs.toLocaleString("en-US")} ` +
      `(frame ${p.worstPairsFrame}, ${p.worstPairsGarbage} canisters standing)`);
  }
  console.log(`    ⛔ GATE (the two REAL scenarios): worst single frame ${worst.toLocaleString("en-US")} pair checks vs a derived ` +
    `ceiling of ${PAIR_CHECK_CEILING.toLocaleString("en-US")} — ${(100 * worst / PAIR_CHECK_CEILING).toFixed(2)}% of budget.`);
  console.log(`    ⛔ GATE (the realistic path): the harvest's ${harvest.worstPairs.toLocaleString("en-US")} vs the tighter ` +
    `${HARVEST_PAIR_CEILING.toLocaleString("en-US")} live-harvest ceiling — ${(100 * harvest.worstPairs / HARVEST_PAIR_CEILING).toFixed(1)}% of budget.`);
  console.log(`    FINDING: updateDeath() does not coalesce and killShip() is terminal, so the ${death.peakGarbage}-canister death`);
  console.log(`    peak the ceiling was DERIVED from never reaches the O(n^2) pass at all. The blitz above puts that`);
  console.log(`    load through it anyway and hits ${blitz.worstPairs.toLocaleString("en-US")} checks / ${blitz.worstMs.toFixed(0)} ms — which validates the derivation's`);
  console.log(`    order of magnitude (projected ~5.20M) and shows what a spatial hash would be buying, but is NOT a`);
  console.log(`    state the shipped game can enter. Reported for STATUS.md, not gated on.`);
  console.log(`    CAVEAT: update(dt) ONLY. draw() is not in the loop and shadowBlur render cost is the`);
  console.log(`    browser watch item (playtest gate Q7), which no headless probe can answer.`);

  // ⛔ THE GATES THEMSELVES.
  assert(worst <= PAIR_CHECK_CEILING,
    `H: ⛔ GATE — worst single frame of the two REAL scenarios did ${worst.toLocaleString("en-US")} coalesceGarbage ` +
    `pair checks, over the derived ceiling of ${PAIR_CHECK_CEILING.toLocaleString("en-US")}. STOP: retune the density ` +
    `sliders (first lever) or take a spatial hash for coalescence as its own changeset — do NOT tune around this here.`);
  assert(harvest.worstPairs <= HARVEST_PAIR_CEILING,
    `H: ⛔ GATE — the realistic progressive harvest did ${harvest.worstPairs.toLocaleString("en-US")} pair checks in its ` +
    `worst frame, over the ${HARVEST_PAIR_CEILING.toLocaleString("en-US")} live-harvest ceiling. Same instruction: STOP.`);
  // ...and the gated measurement must not be vacuous: the counter has to have seen real work.
  assert(harvest.worstPairs > 10000,
    `H: (control) the harvest's worst frame really did substantial work (${harvest.worstPairs.toLocaleString("en-US")} checks over ` +
    `${harvest.worstPairsGarbage} standing canisters), so the ceiling is measuring something`);
})();

// ================= (I) spec §8 item 10 — FIELD LEVELS UNTOUCHED =====================
(function sectionI() {
  console.log("(I) spec §8 item 10 — all 42 field levels untouched");
  const X = build();
  let fieldLevels = 0;
  withRandom(seededRandom(0xF1E1E), () => {
    X.startGame();
    for (let n = 1; n <= 63; n++) {
      if (X.levelDef(n).archetype !== "field") continue;
      fieldLevels++;
      const spawned = atWave(X, n);
      eq(spawned, X.levelDef(n).junkCount, `I: level ${n}: spawns exactly junkCount (${X.levelDef(n).junkCount})`);
      eq(X.levelDef(n).fieldCount, X.levelDef(n).junkCount, `I: level ${n}: fieldCount === its own junkCount on a field level`);
      eq(X.levelDef(n).orbitRings, 0, `I: level ${n}: orbitRings is 0 on a field level`);
      assert(X.game.debris.every(d => d.orbitCenter === undefined && d.orbitRadius === undefined &&
                                      d.orbitAngle === undefined && d.orbitAngVel === undefined),
        `I: level ${n}: no field-level satellite carries any orbit state`);
      eq(X.game.worldSize, X.WORLD_SIZE_FIELD, `I: level ${n}: runs at the field world size`);
      const [w, h] = X.worldDims(X.game.worldSize);
      assert(w === 2560 && h === 1440, `I: level ${n}: ...which is 2560x1440`);
      eq(X.game.orbitLayout, null, `I: level ${n}: no live orbit layout`);
      for (const d of X.game.debris) {
        const dist = Math.sqrt(X.dist2(d, X.game.ship));
        assert(dist >= X.SPAWN_MIN_DIST - 1e-6 && dist <= X.SPAWN_MAX_DIST + 1e-6,
          `I: level ${n}: satellite at ${dist.toFixed(1)} px is on the ship-relative spawn ring`);
      }
    }
  });
  eq(fieldLevels, 42, "I: 42 field levels across 1..63");
})();

// ================= (J) spec §8 item 11 — DETERMINISM =====================
(function sectionJ() {
  console.log("(J) spec §8 item 11 — the whole ramp sweep is byte-identical under a fixed seed");
  function sweep(seed) {
    const X = build();
    return withRandom(seededRandom(seed), () => {
      X.startGame();
      const out = [];
      for (let n = 3; n <= 63; n += 3) {
        atWave(X, n);
        out.push(n + ":" + X.game.debris.map(d => d.orbitCenter
          ? `R${d.orbitRadius}@${d.orbitAngle.toFixed(9)}/${d.orbitAngVel.toFixed(9)},${d.x.toFixed(9)},${d.y.toFixed(9)}`
          : `F${d.x.toFixed(9)},${d.y.toFixed(9)},${d.vx.toFixed(9)},${d.vy.toFixed(9)}`).join("|"));
      }
      return out.join("\n");
    });
  }
  const a = sweep(0xDE7), b = sweep(0xDE7), c = sweep(0xDE8);
  eq(b, a, "J: the same seed reproduces the whole 3..63 ramp sweep bit for bit");
  assert(a !== c, "J: (control) a different seed produces a different one, so the comparison has teeth");
  assert(a.length > 10000, "J: (control) the sweep snapshot is substantial");
  // activeRingsFor and levelDef are pure with respect to the RNG — the same answers under any seed.
  const X = build();
  const rings1 = withRandom(seededRandom(1), () => Array.from({ length: 21 }, (_, i) => JSON.stringify(X.activeRingsFor((i + 1) * 3))).join(";"));
  const rings2 = withRandom(seededRandom(999), () => Array.from({ length: 21 }, (_, i) => JSON.stringify(X.activeRingsFor((i + 1) * 3))).join(";"));
  eq(rings2, rings1, "J: activeRingsFor is independent of the RNG stream");
})();

// ================= (K) levelDef's two new columns + the ONE recursive call =====================
(function sectionK() {
  console.log("(K) levelDef: orbitRings, fieldCount, and the FLAG-CS022-e recursion");
  const X = build();

  // The field set grew by exactly two.
  const keys = Object.keys(X.levelDef(1));
  eq(keys.length, 16, "K: levelDef returns 16 fields (14 + orbitRings + fieldCount)");
  assert(keys.includes("orbitRings") && keys.includes("fieldCount"), "K: ...and they are the two new ones");

  // orbitRings: the ramp table, from the UNCLAMPED n, held at ORBIT_RING_COUNT.
  for (const [n, want] of [[3, 1], [6, 2], [9, 3], [12, 4], [15, 4], [63, 4], [66, 4],
                           [999999, 4],   // 999999 % 3 === 0 — still an orbit level, still held at 4
                           [1000000, 0],  // 1e6 % 3 === 1 — a field level, 0
                           [1, 0], [2, 0]]) {
    eq(X.levelDef(n).orbitRings, want, `K: levelDef(${n}).orbitRings === ${want}`);
  }
  for (let n = 1; n <= 63; n++) {
    const d = X.levelDef(n);
    if (d.archetype === "field") eq(d.orbitRings, 0, `K: level ${n} is a field level, orbitRings 0`);
    else eq(d.orbitRings, Math.min(n / X.ORBIT_LEVEL_EVERY, X.ORBIT_RING_COUNT), `K: level ${n} orbitRings follows the ramp`);
    // ...and the table column agrees with the live helper at the shipped ring count.
    if (d.archetype === "orbit") eq(d.orbitRings, X.activeRingsFor(n).length,
      `K: level ${n}: the orbitRings COLUMN agrees with activeRingsFor at the shipped orbitCount`);
  }
  // FLAG-CS022-j, worth pinning rather than only noting: the ramp completes at the same level
  // payloadSlots maxes out. Nobody designed that; it falls out, and it should not silently drift.
  const rampDone = [...Array(22).keys()].map(i => i * 3).find(n => n >= 3 && X.levelDef(n).orbitRings === X.ORBIT_RING_COUNT);
  eq(rampDone, 12, "K: the ramp completes at level 12");
  eq(X.levelDef(12).payloadSlots, 24, "K: ...which is exactly where payloadSlots maxes at 24 (FLAG-CS022-j)");
  assert(X.levelDef(11).payloadSlots < 24, "K: (control) level 11 is not yet at the payload ceiling");

  // fieldCount + THE RECURSION: one level deep, terminating, and safe at every extreme.
  for (let n = 1; n <= 200; n++) {
    const d = X.levelDef(n);
    eq(d.fieldCount, d.archetype === "orbit" ? X.levelDef(n - 1).junkCount : d.junkCount,
      `K: levelDef(${n}).fieldCount`);
  }
  eq(X.levelDef(63).fieldCount, 13, "K: level 63's fieldCount is 13");
  for (let n = 64; n <= 200; n++) eq(X.levelDef(n).fieldCount, 13, `K: level ${n}: the L clamp pins fieldCount at 13`);
  for (const n of [0, -3, -1, Infinity, -Infinity, NaN, 1e9]) {
    noThrow(() => X.levelDef(n), `K: levelDef(${n}) terminates — the recursion is at most one deep`);
  }
  eq(X.levelDef(Infinity).archetype, "field", "K: levelDef(Infinity) is a field level (NaN % 3 !== 0), so the recursion is never entered");
  eq(X.levelDef(Infinity).orbitRings, 0, "K: ...and orbitRings is 0 there");
  // Purity survived: repeat calls deep-equal, fresh object each time, no accumulator.
  for (const n of [3, 12, 63, 64]) {
    const a = X.levelDef(n), b = X.levelDef(n);
    assert(a !== b, `K: levelDef(${n}) returns a fresh object`);
    eq(JSON.stringify(a), JSON.stringify(b), `K: levelDef(${n}) twice is identical`);
  }
})();

// ================= (L) AudioSys.ctx null smoke =====================
(function sectionL() {
  console.log("(L) AudioSys.ctx null smoke across a real ramp");
  const X = build({ audio: false });
  eq(X.AudioSys.ctx, null, "L: (setup) AudioSys.ctx really is null");
  noThrow(() => {
    withRandom(seededRandom(0x1EAF), () => {
      X.startGame();
      for (let w = 2; w <= 13; w++) {                 // crosses four occurrences of the ramp
        X.game.debris.length = 0; X.nextWave();
        X.game.state = "playing"; X.game.paused = false;
        for (let i = 0; i < 30; i++) { X.update(1 / 60); X.draw(); }
      }
    });
  }, "L: 12 real level transitions across the ramp update and DRAW with no audio context");
  eq(X.game.wave, 13, "L: ...and reached level 13");
  assert(X.game.debris.every(d => Number.isFinite(d.x) && Number.isFinite(d.y)), "L: every satellite stayed finite");
  // ...and with audio present too.
  const Y = build({ audio: true });
  noThrow(() => {
    withRandom(seededRandom(0x1EB0), () => {
      Y.startGame();
      for (let w = 2; w <= 13; w++) { Y.game.debris.length = 0; Y.nextWave(); for (let i = 0; i < 30; i++) Y.update(1 / 60); }
    });
  }, "L: the same run with an AudioContext present");
})();

// ================= summary =====================
console.log("");
console.log(`test-cs022-p3: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
