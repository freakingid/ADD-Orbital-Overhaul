// Headless test for CS021 Phase 1 — THE ORBIT-LEVEL ARCHETYPE.
//
//   node scratchpad/test-cs021-p1.js
//
// WHAT LANDED (PLANNED-FEATURES-CS021 §1/§4, forks A/B/C1/C2/D/E). Every ORBIT_LEVEL_EVERY-th level
// (3, 6, 9 … 63 — 21 of the 63) replaces nextWave()'s scatter with four concentric rings of size-3
// DebrisSatellites ORBITING THE DOCK. It is a spawn ARRANGEMENT plus a motion MODE, not a wall: the
// satellites are ordinary debris, so a lane can be shot open and the whole arrangement erodes into a
// normal field as it is harvested. Five moving parts:
//
//   1. generateOrbitLayout() — the per-ring arithmetic, inlined as a plain function (Correction C1: no
//      ES module, ever) with the fitted radii of §1.2 rather than the handoff's size-derived ones
//      (Correction C3: those put ring 5 at a 2,576 px radius in a 2560x1440 torus).
//   2. levelDef(n).archetype — the schedule, a pure function of game.wave, THE one difficulty clock.
//   3. nextWave()'s branch — "field" is the shipped loop, byte-untouched; "orbit" calls the generator
//      centred on the dock and does NOT consume junkCount.
//   4. DebrisSatellite's optional orbit state — angle integrated, position DERIVED, wrap-aware. With the
//      state absent the drift path is byte-for-byte what it always was.
//   5. destroyDebris()'s tangent handoff — children inherit the parent's instantaneous orbital tangent
//      and NO orbit state (FORK-CS021-C2 -> (i)).
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL startGame/update(1/60)/nextWave/destroyDebris path. Nothing under
// test is reimplemented — every number below comes out of the shipped source.
//
// Sections:
//  (A) node --check + source pins, incl. TRAP 1 (GAME_VERSION untouched) and TRAP 3 (DEBUG_VARS still 34)
//  (B) THE §1.2 GEOMETRY TABLE, pinned exactly: counts, maxCounts, arc gaps, total, outer edge, clearance
//  (C) THE FAIRNESS SWEEP — spec §8 items 1-4, at EVERY orbit level 3..63
//  (D) FIELD LEVELS ARE UNTOUCHED — spec §8 item 5
//  (E) THE MOTION MODE — real update(1/60) frames: angle advance, derived position, rail authority,
//      independent sprite spin, and the drift path proven byte-identical when the state is absent
//  (F) THE SPLIT — the tangent handoff, speed AND perpendicularity, and no orbit state on a child
//  (G) THE maxCount GUARD — a deliberately tiny ring is REJECTED, never placed with a negative gap
//  (H) WRAP CORRECTNESS — spec §8 item 8, with a naive-arithmetic control that must fail
//  (I) SPAWN SAFETY (FORK-CS021-A -> (c)) — the reroll clears the ship, and the bound really terminates
//  (J) DETERMINISM — spec §8 item 6: the same seed reproduces the same wave, bit for bit
//  (K) FRAME-BUDGET PROBE (spec §8 item 7, FLAG-CS021-h) — REPORTED, NOT GATED
//  (L) AudioSys.ctx null smoke across a full orbit level

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
function noThrow(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.stack); } }

// ================= (A, part 1) syntax =====================
(function sectionA_syntax() {
  console.log("(A) node --check + source pins");
  const tmp = path.join(repoRoot, "scratchpad", "_cs021p1_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
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
  "game", "startGame", "update", "draw", "nextWave", "destroyDebris",
  "DebrisSatellite", "Dock", "levelDef", "junkSpeedMul", "leverScale",
  // CS021 P1's own surface
  "generateOrbitLayout", "placeOrbitRing", "spawnSafeOrbitLayout", "spawnOrbitWave",
  "nearestOrbitDist", "orbitTangent", "orbitSyncVelocity",
  "ORBIT_LEVEL_EVERY", "ORBIT_INNER_RADIUS", "ORBIT_RADIUS_STEP", "ORBIT_RING_COUNT",
  "ORBIT_DENSITY", "ORBIT_GAP_MULT", "ORBIT_SAFETY_MARGIN", "ORBIT_ANG_VEL",
  "ORBIT_FAST_MULT", "ORBIT_FAST_RING", "ORBIT_SPAWN_TRIES",
  // CS021 P2 REPOINT (section D): orbitGapMult is the occurrence-scaled multiplier that supersedes the
  // fixed ORBIT_GAP_MULT past occurrence 1 — needed to recompute D's expected total per level.
  "orbitGapMult",
  // shared world/entity constants the assertions derive from (never a restated literal)
  "DEBRIS_RADII", "DEBRIS_SPEEDS", "SHIP_RADIUS", "SHIP_MAX_HP", "DOCK_RADIUS", "LEVER_DOCK_SIZE",
  "WORLD_W", "WORLD_H", "TAU", "dist2", "wrapPos", "rand",
  "AudioSys", "GAME_VERSION", "DEBUG", "DEBUG_VARS", "DEBUG_ENTRIES",
];

function build({ audio = true, store = {} } = {}) {
  const c = makeCtxStub();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? FakeAudioContext : undefined,
    webkitAudioContext: audio ? FakeAudioContext : undefined
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

// A deterministic LCG — every section that drives a real spawn runs inside one, so this file's
// assertions are reproducible run to run (spec §8 item 6, FLAG-CS021-f: the SHIPPED game keeps rand()).
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function withRandom(gen, fn) {
  const saved = Math.random;
  Math.random = gen;
  try { return fn(); } finally { Math.random = saved; }
}
function withPinned(v, fn) { return withRandom(() => v, fn); }

// Drive the game to absolute level `w` through the REAL nextWave(), clearing the field first so the
// post-call array length is that level's ACTUAL spawn count (nextWave layers onto whatever is there).
function atWave(X, w) {
  X.game.wave = w - 1;
  X.game.debris.length = 0;
  X.nextWave();
  return X.game.debris.length;
}
// The shipped generator arguments, exactly as spawnOrbitWave() assembles them. Centre/ship are the
// caller's so a section can place them wherever it needs.
function shippedArgs(X, centerX, centerY) {
  return {
    satelliteDiameter: X.DEBRIS_RADII[3] * 2,
    shipDiameter:      X.SHIP_RADIUS * 2,
    centerX, centerY,
    orbitCount:        X.ORBIT_RING_COUNT,
    innerRadius:       X.ORBIT_INNER_RADIUS,
    radiusStep:        X.ORBIT_RADIUS_STEP,
    safetyMargin:      X.ORBIT_SAFETY_MARGIN,
    minGapMultiplier:  X.ORBIT_GAP_MULT,
    densityByOrbit:    X.ORBIT_DENSITY,
    baseAngVel:        X.ORBIT_ANG_VEL,
    fastRingIndex:     X.ORBIT_FAST_RING - 1,
    fastRingMult:      X.ORBIT_FAST_MULT,
  };
}

// ================= (A, part 2) source pins =====================
(function sectionA_pins() {
  const X = build();
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");

  // TRAP 1 — this phase does NOT bump the version. CS021 P5 owns that; when it lands it repoints this
  // assertion to its mirror image (assert GAME_VERSION !== "1.0.0.20"), the standing treatment.
  eq(X.GAME_VERSION, "1.0.0.20", "A: TRAP 1 — GAME_VERSION is untouched by P1 (P5 bumps it to 1.0.0.21)");
  // TRAP 3 — REPOINTED BY CS021 P3: the ORBIT section (10 knobs) has now landed, taking DEBUG_VARS from
  // P1's own 34 value entries to 44. What P1 is answerable for — that ITS OWN diff added none — is now
  // the positive claim that the ORBIT knobs present are exactly P3's ten, not something P1 slipped in.
  const valueEntries = X.DEBUG_VARS.filter(v => !v.header);
  const orbitEntries = valueEntries.filter(v => /^orbit/i.test(v.id));
  eq(valueEntries.length, 44, "A: TRAP 3 — DEBUG_VARS has 44 value entries (P1's 34 + CS021 P3's 10-entry ORBIT section)");
  eq(orbitEntries.length, 10, "A: REPOINTED BY CS021 P3 — exactly the ten ORBIT knobs exist (P1 itself still added none)");

  // Correction C1: the generator is a plain inlined function, not a module export.
  eq((scriptSrc.match(/function generateOrbitLayout\(/g) || []).length, 1, "A: exactly one generateOrbitLayout definition");
  assert(!/\bexport\b/.test(codeOnly), "A: C1 — the script block contains no `export` (no ES module, ever)");
  assert(!/\bimport\s/.test(codeOnly) && !/\brequire\(/.test(codeOnly), "A: C1 — and no import/require either");

  // Requirement 3 of the handoff, kept: satelliteDiameter is read at the CALL SITE from DEBRIS_RADII,
  // never hoisted into a second satellite-size constant.
  assert(/satelliteDiameter:\s*DEBRIS_RADII\[3\] \* 2/.test(codeOnly),
    "A: satelliteDiameter is read as DEBRIS_RADII[3] * 2 at the call site");
  assert(!/const\s+ORBIT_SAT(ELLITE)?_(DIAM|RADIUS|SIZE)/.test(codeOnly),
    "A: no new satellite-size constant was introduced (Corrections §2)");

  // The house helpers are used, not hand-rolled arithmetic (the single most common bug source here).
  assert(/function placeOrbitRing[\s\S]{0,600}wrapPos\(/.test(codeOnly), "A: placeOrbitRing emits positions through wrapPos()");
  assert(/function nearestOrbitDist[\s\S]{0,300}dist2\(/.test(codeOnly), "A: nearestOrbitDist measures with the wrap-aware dist2()");
  assert(/function spawnSafeOrbitLayout[\s\S]{0,900}dist2\(ship, centre\)/.test(codeOnly),
    "A: the spawn-safety band test measures the ship-to-centre distance with dist2()");
  assert(/startAngle[\s\S]{0,80}rand\(0, angleStep\)|rand\(0, angleStep\)/.test(codeOnly),
    "A: startAngle uses the house rand() helper, not a raw Math.random()");

  // The field spawn loop is untouched: still the ship-relative ring, still exactly two byte-identical
  // junkSpeedMul() derivation sites (nextWave + destroyDebris) — no third one was added for the orbit
  // branch, which reuses nextWave's own local.
  assert(/rand\(SPAWN_MIN_DIST, SPAWN_MAX_DIST\)/.test(codeOnly), "A: the field spawn still uses the ship-relative [SPAWN_MIN_DIST, SPAWN_MAX_DIST] ring");
  eq(scriptSrc.split("\n").map(l => l.trim()).filter(l => l === "const speedMul = junkSpeedMul();").length, 2,
    "A: still exactly TWO byte-identical `const speedMul = junkSpeedMul();` sites");

  // The archetype is derived from the ONE clock and from nothing else.
  assert(/archetype: n % ORBIT_LEVEL_EVERY === 0 \? "orbit" : "field"/.test(codeOnly),
    "A: levelDef derives archetype from n alone — one clock, no cycle state");
  eq((codeOnly.match(/archetype === "orbit"/g) || []).length, 1, "A: exactly one consumer of the archetype in the spawn path");

  // The bounded loop cannot become unbounded by a later edit without failing here.
  assert(/ring\.spawnSafetyTries < ORBIT_SPAWN_TRIES/.test(codeOnly), "A: the reroll loop is bounded by ORBIT_SPAWN_TRIES");
})();

// ================= (B) THE §1.2 GEOMETRY TABLE =====================
// Pinned exactly, against a layout produced by the REAL generator with the REAL shipped constants. The
// spec's own table is the expectation; a retune of any ORBIT_* constant must move this section too.
// `gap` is the spec table's PUBLISHED figure, to its stated 1-decimal precision; the exact arithmetic
// (circumference/count − satelliteDiameter) is asserted separately at full double precision, so a drift
// fails against both the document and the formula.
const WANT_RINGS = [
  // radius, maxCount, density, count, actualGapPx (arc, as published in §1.2)
  { radius: 180, maxCount: 7,  density: 0.75, count: 6,  gap: 96.5 },
  { radius: 330, maxCount: 13, density: 0.45, count: 6,  gap: 253.6 },
  { radius: 480, maxCount: 19, density: 0.35, count: 7,  gap: 338.8 },
  { radius: 630, maxCount: 25, density: 0.85, count: 21, gap: 96.5 },
];
(function sectionB() {
  console.log("(B) the §1.2 geometry table, pinned exactly");
  const X = build();
  const L = withRandom(seededRandom(0xB0B0), () => X.generateOrbitLayout(shippedArgs(X, 1280, 720)));

  // The inputs, so a constant drifting away from the spec fails HERE rather than three sections later.
  eq(X.ORBIT_INNER_RADIUS, 180, "B: innerRadius 180");
  eq(X.ORBIT_RADIUS_STEP, 150, "B: radiusStep 150");
  eq(X.ORBIT_RING_COUNT, 4, "B: 4 rings (FORK-CS021-B)");
  eq(X.ORBIT_GAP_MULT, 2.5, "B: gap multiplier 2.5 (P1 ships it fixed; P2 makes it occurrence-scaled)");
  eq(X.ORBIT_SAFETY_MARGIN, 8, "B: safety margin 8");
  eq(JSON.stringify(X.ORBIT_DENSITY), "[0.75,0.45,0.35,0.85]", "B: the density curve is the shipped [0.75, 0.45, 0.35, 0.85]");
  eq(X.DEBRIS_RADII[3] * 2, 92, "B: size-3 satellite diameter is 92 px (DEBRIS_RADII[3] * 2)");
  eq(X.SHIP_RADIUS * 2, 26, "B: ship diameter is 26 px (SHIP_RADIUS * 2)");

  // minRequiredGap: the multiplicative half wins at every shipped value (65 > 26 + 8 = 34).
  eq(L.minRequiredGap, 65, "B: minRequiredGap = max(26 + 8, 26 x 2.5) = 65");
  eq(L.spacePerSatellite, 157, "B: spacePerSatellite = 92 + 65 = 157");

  eq(L.rings.length, 4, "B: four rings were placed");
  eq(L.rejected.length, 0, "B: no ring was rejected at the shipped geometry (the §1.1 guard never fires)");
  L.rings.forEach((r, i) => {
    const w = WANT_RINGS[i];
    eq(r.index, i, `B: ring ${i + 1} index`);
    eq(r.radius, w.radius, `B: ring ${i + 1} radius`);
    close(r.circumference, X.TAU * w.radius, `B: ring ${i + 1} circumference = 2π x radius`);
    eq(r.maxCount, w.maxCount, `B: ring ${i + 1} maxCount`);
    eq(r.density, w.density, `B: ring ${i + 1} density`);
    eq(r.count, w.count, `B: ring ${i + 1} COUNT`);
    close(r.actualGapPx, w.gap, `B: ring ${i + 1} actualGapPx matches §1.2's published figure`, 0.05);
    close(r.actualGapPx, X.TAU * w.radius / w.count - X.DEBRIS_RADII[3] * 2,
      `B: ring ${i + 1} actualGapPx === circumference/count − satelliteDiameter, exactly`, 1e-9);
    eq(r.satellites.length, w.count, `B: ring ${i + 1} placed exactly its count`);
    // Every satellite is on the ring, at an exact multiple of angleStep from startAngle.
    close(r.angleStep, X.TAU / w.count, `B: ring ${i + 1} angleStep = TAU / count`);
    r.satellites.forEach((s, k) => close(s.angle, r.startAngle + k * r.angleStep, `B: ring ${i + 1} satellite ${k} angle`));
  });
  eq(L.total, 40, "B: 40 size-3 satellites in total at first occurrence (FORK-CS021-D — the bonanza is deliberate)");
  eq(L.outerEdge, 676, "B: outermost satellite EDGE is 630 + 46 = 676 px");

  // The fast ring, and only the fast ring.
  L.rings.forEach((r, i) => {
    const wantVel = X.ORBIT_ANG_VEL * (i === X.ORBIT_FAST_RING - 1 ? X.ORBIT_FAST_MULT : 1);
    close(r.angVel, wantVel, `B: ring ${i + 1} angVel`);
  });
  eq(X.ORBIT_FAST_RING, 3, "B: ring 3 — the deliberately sparse one — is the fast ring");
  assert(L.rings[2].angVel > L.rings[0].angVel, "B: the fast ring really is markedly faster than the rest");
  close(L.rings[2].angVel / L.rings[0].angVel, X.ORBIT_FAST_MULT, "B: and by exactly ORBIT_FAST_MULT");
  // Ring 3 is the SPARSEST by arc gap, which is the rhythm the curve exists to produce.
  assert(L.rings[2].actualGapPx === Math.max(...L.rings.map(r => r.actualGapPx)),
    "B: ring 3 has the widest lanes of the four — sparse in space, tight in time");

  // §1.2's stated clearances.
  const satR = X.DEBRIS_RADII[3];
  const wave1Dock = X.DOCK_RADIUS * X.leverScale(X.LEVER_DOCK_SIZE, 1);
  eq(wave1Dock, 88, "B: a wave-1 dock's radius is 88 px (DOCK_RADIUS 44 x the 2x size lever)");
  eq(X.ORBIT_INNER_RADIUS - satR - wave1Dock, 46, "B: inner-ring clearance over a wave-1 dock is 46 px");
  console.log("    " + L.rings.map(r => `R${r.index + 1} r=${r.radius} n=${r.count}/${r.maxCount} gap=${r.actualGapPx.toFixed(1)}px v=${(r.angVel * 180 / Math.PI).toFixed(1)}deg/s`).join("  "));
})();

// ================= (C) THE FAIRNESS SWEEP — spec §8 items 1-4 =====================
(function sectionC() {
  console.log("(C) fairness sweep: spec §8 items 1-4 at EVERY orbit level 3..63");
  const X = build();
  const shipDiameter = X.SHIP_RADIUS * 2;
  const satR = X.DEBRIS_RADII[3];
  const budget = X.WORLD_H / 2 - 20;                                  // the wrap-clean radius budget
  const wave1Dock = X.DOCK_RADIUS * X.leverScale(X.LEVER_DOCK_SIZE, 1);
  let orbitLevels = 0, worstGap = Infinity, worstEdge = 0;
  for (let n = 1; n <= 63; n++) {
    if (X.levelDef(n).archetype !== "orbit") continue;
    orbitLevels++;
    // P1 ships ONE gap multiplier for every occurrence; P2 is what makes it scale. Asserting that here
    // means P2's own sweep has a red control to move away from.
    const gapMult = X.ORBIT_GAP_MULT;
    const L = withRandom(seededRandom(0xC0DE + n), () => X.generateOrbitLayout(shippedArgs(X, 1280, 720)));
    for (const r of L.rings) {
      // item 1 — the fairness floor
      assert(r.actualGapPx >= shipDiameter * gapMult - 1e-9,
        `C: level ${n} ring ${r.index + 1}: arc gap ${r.actualGapPx.toFixed(2)} >= shipDiameter x ${gapMult} (${shipDiameter * gapMult})`);
      // item 2 — the count is inside its own bound, and the §1.1 guard never fired
      assert(r.maxCount >= 1, `C: level ${n} ring ${r.index + 1}: maxCount >= 1`);
      assert(r.count >= 1 && r.count <= r.maxCount,
        `C: level ${n} ring ${r.index + 1}: 1 <= count (${r.count}) <= maxCount (${r.maxCount})`);
      worstGap = Math.min(worstGap, r.actualGapPx);
    }
    // item 3 — the Correction-C3 failure can never regress in
    assert(L.outerEdge <= budget, `C: level ${n}: outermost satellite edge ${L.outerEdge} <= ${budget}`);
    worstEdge = Math.max(worstEdge, L.outerEdge);
    // item 4 — the inner ring clears a wave-1 dock
    assert(X.ORBIT_INNER_RADIUS - satR >= wave1Dock,
      `C: level ${n}: innerRadius - satRadius (${X.ORBIT_INNER_RADIUS - satR}) >= wave-1 dock radius (${wave1Dock})`);
    eq(L.rejected.length, 0, `C: level ${n}: no ring was rejected`);
    eq(L.total, 40, `C: level ${n}: 40 satellites (P1 is pre-scaling — every occurrence is identical)`);
  }
  eq(orbitLevels, 21, "C: 21 orbit levels across 1..63 (FORK-CS021-E — every 3rd)");
  console.log(`    tightest lane across all 21 occurrences: ${worstGap.toFixed(2)} px (floor ${shipDiameter * X.ORBIT_GAP_MULT}); widest edge ${worstEdge} px (budget ${budget})`);
})();

// CS021 P2 REPOINT helper (section D): P1 shipped ONE gap multiplier for every occurrence, so a real
// orbit wave always spawned exactly 40 satellites; P2 makes it occurrence-scaled (orbitGapMult), climbing
// the total to 45 by the floor (occurrence 8 / level 24). Recompute the expectation from the SAME
// generator + multiplier nextWave() is wired to, rather than restating a level-40 literal that was only
// ever true at occurrence 1. Total does not depend on startAngle/centre, so any fixed seed/centre works.
function expectedOrbitTotal(X, level) {
  const L = withRandom(seededRandom(0xE0E0 + level), () =>
    X.generateOrbitLayout({ ...shippedArgs(X, 1280, 720), minGapMultiplier: X.orbitGapMult(level) }));
  return L.total;
}

// ================= (D) FIELD LEVELS ARE UNTOUCHED — spec §8 item 5 =====================
(function sectionD() {
  console.log("(D) field levels: spawn path behaviourally identical");
  const X = build();
  withRandom(seededRandom(0xF1E1D), () => {
    X.startGame();
    let fieldLevels = 0, orbitLevels = 0;
    for (let n = 1; n <= 63; n++) {
      const spawned = atWave(X, n);
      const def = X.levelDef(n);
      if (def.archetype === "field") {
        fieldLevels++;
        eq(spawned, def.junkCount, `D: level ${n}: satellite count === junkCount (${def.junkCount})`);
        assert(X.game.debris.every(d => d.orbitCenter === undefined && d.orbitRadius === undefined &&
                                        d.orbitAngle === undefined && d.orbitAngVel === undefined),
          `D: level ${n}: NO field-level satellite carries any orbit state`);
        // and every one is still on the ship-relative spawn ring, drifting
        assert(X.game.debris.every(d => Math.hypot(d.vx, d.vy) > 0), `D: level ${n}: every field satellite has drift velocity`);
      } else {
        orbitLevels++;
        // CS021 P2 REPOINT: was `eq(spawned, 40, ...)` — the total is occurrence-scaled now (spec §5),
        // so only occurrence 1 (level 3) still spawns exactly 40; deeper occurrences climb toward 45.
        const wantTotal = expectedOrbitTotal(X, n);
        eq(spawned, wantTotal, `D: level ${n}: orbit level spawned ${wantTotal}, not junkCount ${def.junkCount}`);
        assert(spawned !== def.junkCount, `D: level ${n}: junkCount was NOT consumed`);
      }
    }
    eq(fieldLevels, 42, "D: 42 field levels");
    eq(orbitLevels, 21, "D: 21 orbit levels");
  });

  // levelDef is unchanged in every other column: the whole table, compared field by field against the
  // values CS018 P1 pinned, with `archetype` the only addition.
  const KEYS = ["level", "phase", "rel", "archetype", "junkCount", "payloadSlots", "maxLargeHunters",
                "junkSpeed", "ufoAppearFreq", "ufoFlightSpeed", "ufoDirChangeFreq", "ufoFireFreq",
                "ufoAccuracy", "ufoShotSpeed"];
  eq(Object.keys(X.levelDef(1)).length, 14, "D: levelDef returns 14 fields (13 + archetype)");
  assert(Object.keys(X.levelDef(1)).every(k => KEYS.includes(k)), "D: and no unexpected field appeared");
  const WANT_JUNK_1_21 = [3, 5, 9, 13, 3, 5, 9, 13, 3, 5, 9, 13, 3, 5, 9, 13, 3, 5, 9, 13, 13];
  const WANT_PAY_1_13  = [8, 8, 8, 8, 10, 12, 14, 16, 18, 20, 22, 24, 24];
  const WANT_CAP_1_21  = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 5, 5, 5, 5, 7];
  for (let n = 1; n <= 21; n++) {
    eq(X.levelDef(n).junkCount, WANT_JUNK_1_21[n - 1], `D: levelDef(${n}).junkCount column untouched`);
    eq(X.levelDef(n).maxLargeHunters, WANT_CAP_1_21[n - 1], `D: levelDef(${n}).maxLargeHunters column untouched`);
  }
  for (let n = 1; n <= 13; n++) eq(X.levelDef(n).payloadSlots, WANT_PAY_1_13[n - 1], `D: levelDef(${n}).payloadSlots column untouched`);
  eq(X.levelDef(1).junkSpeed, "low", "D: tier columns untouched (level 1 junkSpeed)");
  eq(X.levelDef(63).ufoShotSpeed, "high", "D: tier columns untouched (level 63 ufoShotSpeed)");

  // The schedule itself, including past the endgame plateau — the one field that reads the UNCLAMPED n.
  eq(X.ORBIT_LEVEL_EVERY, 3, "D: the schedule constant is 3 (FORK-CS021-E)");
  for (const n of [3, 6, 9, 60, 63, 66, 99, 2001]) eq(X.levelDef(n).archetype, "orbit", `D: level ${n} is an orbit level`);
  for (const n of [1, 2, 4, 5, 61, 62, 64, 65]) eq(X.levelDef(n).archetype, "field", `D: level ${n} is a field level`);
  eq(X.levelDef(Infinity).archetype, "field", "D: levelDef(Infinity) resolves without throwing");
})();

// ================= (E) THE MOTION MODE =====================
(function sectionE() {
  console.log("(E) orbit motion mode through REAL update(1/60) frames");
  const X = build();
  withRandom(seededRandom(0x0B17), () => { X.startGame(); atWave(X, 3); });
  X.game.state = "playing"; X.game.paused = false;
  eq(X.game.debris.length, 40, "E: (setup) a real level-3 wave has 40 satellites");

  const sample = X.game.debris[0];
  const centre = sample.orbitCenter;
  assert(!!centre, "E: an orbit-level satellite carries orbitCenter");
  eq(centre.x, X.game.dock.x, "E: the rings are centred on the DOCK's x");
  eq(centre.y, X.game.dock.y, "E: the rings are centred on the DOCK's y");
  assert(X.game.debris.every(d => d.orbitCenter === centre),
    "E: every satellite shares ONE captured centre object (captured at generation, never re-read)");

  // Angle advance and derived position, over 60 real frames.
  const before = X.game.debris.map(d => ({ a: d.orbitAngle, spin: d.angle, r: d.orbitRadius, w: d.orbitAngVel }));
  const FRAMES = 60, DT = 1 / 60;
  for (let i = 0; i < FRAMES; i++) X.update(DT);
  X.game.debris.forEach((d, i) => {
    if (i >= before.length) return;
    const b = before[i];
    if (d.orbitCenter === undefined) return;   // a satellite destroyed and replaced by children
    close(d.orbitAngle, b.a + b.w * DT * FRAMES, `E: satellite ${i}: orbitAngle advanced by angVel x elapsed`, 1e-9);
    // position DERIVED from the angle, wrap-aware
    const want = X.wrapPos({ x: centre.x + Math.cos(d.orbitAngle) * d.orbitRadius,
                             y: centre.y + Math.sin(d.orbitAngle) * d.orbitRadius });
    close(d.x, want.x, `E: satellite ${i}: x is derived from the rail`, 1e-9);
    close(d.y, want.y, `E: satellite ${i}: y is derived from the rail`, 1e-9);
    close(Math.sqrt(X.dist2(d, centre)), d.orbitRadius, `E: satellite ${i}: still exactly on its ring (wrap-aware)`, 1e-6);
    // vx/vy is the instantaneous tangent, so everything that only READS a velocity sees the truth
    close(Math.hypot(d.vx, d.vy), Math.abs(d.orbitAngVel * d.orbitRadius), `E: satellite ${i}: |v| = angVel x radius`, 1e-9);
    // sprite spin is independent of the orbit and still advancing on its own rate
    close(d.angle, b.spin + d.spin * DT * FRAMES, `E: satellite ${i}: sprite spin advanced independently`, 1e-9);
  });

  // THE RAIL IS AUTHORITATIVE. Any shove applied to an orbiting body is overwritten on the next frame —
  // worth pinning because it is an emergent consequence of the motion mode, not an accident. NOTE FOR
  // READERS OF THE HISTORY: this used to say "what shieldDeflect does". CS021 P1b is exactly that
  // consequence being dealt with — the shield no longer tries to push a rail-borne satellite at all, it
  // bounces the SHIP instead (see test-cs021-p1b.js). The property asserted here is unchanged and is
  // what P1b's fix rests on.
  const d0 = X.game.debris.find(d => !!d.orbitCenter);
  d0.x += 500; d0.y -= 500; d0.vx = 9999; d0.vy = -9999;
  X.update(DT);
  close(Math.sqrt(X.dist2(d0, centre)), d0.orbitRadius, "E: a shoved orbiting satellite is back on its rail the next frame", 1e-6);
  close(Math.hypot(d0.vx, d0.vy), Math.abs(d0.orbitAngVel * d0.orbitRadius), "E: and its velocity is re-derived, not the shoved one", 1e-9);

  // THE DRIFT PATH IS BYTE-UNTOUCHED WHEN THE STATE IS ABSENT: a hand-built satellite integrates exactly
  // x += vx*dt, y += vy*dt, with nothing else changed.
  const plain = new X.DebrisSatellite(600, 400, 3, 1);
  eq(plain.orbitCenter, undefined, "E: a plain DebrisSatellite has no orbit state");
  const px = plain.x, py = plain.y, pvx = plain.vx, pvy = plain.vy, pa = plain.angle, pspin = plain.spin;
  plain.update(DT);
  close(plain.x, px + pvx * DT, "E: drift path — x += vx * dt, unchanged", 1e-12);
  close(plain.y, py + pvy * DT, "E: drift path — y += vy * dt, unchanged", 1e-12);
  close(plain.vx, pvx, "E: drift path — vx is not touched", 1e-12);
  close(plain.vy, pvy, "E: drift path — vy is not touched", 1e-12);
  close(plain.angle, pa + pspin * DT, "E: drift path — sprite spin, unchanged", 1e-12);

  // The fast ring really moves faster on the field, not just in the layout object.
  const byRadius = {};
  for (const d of X.game.debris) if (d.orbitCenter) byRadius[d.orbitRadius] = Math.abs(d.orbitAngVel);
  assert(byRadius[480] > byRadius[180] && byRadius[480] > byRadius[330] && byRadius[480] > byRadius[630],
    "E: the ring-3 satellites on the field carry the fast angular velocity");
})();

// ================= (F) THE SPLIT — the tangent handoff =====================
(function sectionF() {
  console.log("(F) the split: children inherit the orbital tangent and NO orbit state");
  const X = build();
  withRandom(seededRandom(0x5717), () => { X.startGame(); atWave(X, 3); });
  X.game.state = "playing"; X.game.paused = false;

  // Take one satellite from each ring so both angular velocities are covered.
  const perRing = {};
  for (const d of X.game.debris) if (d.orbitCenter && !perRing[d.orbitRadius]) perRing[d.orbitRadius] = d;
  const radii = Object.keys(perRing).map(Number).sort((a, b) => a - b);
  eq(radii.length, 4, "F: (setup) one parent sampled from each of the four rings");

  for (const r of radii) {
    const parent = perRing[r];
    const centre = parent.orbitCenter;
    const wantSpeed = Math.abs(parent.orbitAngVel * parent.orbitRadius);
    // The tangent helper, checked against the parent's own live state before the split consumes it.
    const t = X.orbitTangent(parent);
    close(Math.hypot(t[0], t[1]), wantSpeed, `F: ring r=${r}: orbitTangent |v| = angVel x radius`, 1e-9);
    // Perpendicular to the CENTRE RAY: the dot product of the tangent with the outward radial unit
    // vector is zero. The ray is measured wrap-aware via the parent's own angle, which is what the
    // position was derived from.
    const rayX = Math.cos(parent.orbitAngle), rayY = Math.sin(parent.orbitAngle);
    close(t[0] * rayX + t[1] * rayY, 0, `F: ring r=${r}: the tangent is perpendicular to the centre ray`, 1e-9);

    const before = X.game.debris.length;
    withPinned(0.5, () => X.destroyDebris(parent, false));
    eq(X.game.debris.length, before + 3, `F: ring r=${r}: the real split appended exactly 3 children`);
    const kids = X.game.debris.slice(-3);
    for (const k of kids) {
      eq(k.size, parent.size - 1, `F: ring r=${r}: child is one tier down`);
      close(Math.hypot(k.vx, k.vy), wantSpeed, `F: ring r=${r}: child speed === orbitAngVel x orbitRadius`, 1e-9);
      close(k.vx * rayX + k.vy * rayY, 0, `F: ring r=${r}: child velocity is perpendicular to the centre ray`, 1e-9);
      eq(k.orbitCenter, undefined, `F: ring r=${r}: child carries NO orbitCenter`);
      eq(k.orbitRadius, undefined, `F: ring r=${r}: child carries NO orbitRadius`);
      eq(k.orbitAngle, undefined, `F: ring r=${r}: child carries NO orbitAngle`);
      eq(k.orbitAngVel, undefined, `F: ring r=${r}: child carries NO orbitAngVel`);
      // and it really is off the rail: one frame of drift moves it off the parent's ring
      const d0 = Math.abs(Math.sqrt(X.dist2(k, centre)) - r);
      k.update(1 / 60);
      const d1 = Math.abs(Math.sqrt(X.dist2(k, centre)) - r);
      assert(d1 > d0 || wantSpeed === 0, `F: ring r=${r}: the child drifts OFF the ring instead of following it`);
    }
  }

  // A FIELD-level parent is unaffected: no tangent, children keep their own junkSpeedMul-derived drift.
  withRandom(seededRandom(0x5718), () => { atWave(X, 4); });
  eq(X.levelDef(4).archetype, "field", "F: (control) level 4 is a field level");
  const fieldParent = X.game.debris[0];
  eq(X.orbitTangent(fieldParent), null, "F: orbitTangent(field satellite) is null — the handoff is inert off the rail");
  const beforeF = X.game.debris.length;
  withPinned(0.5, () => X.destroyDebris(fieldParent, false));
  const fieldKids = X.game.debris.slice(-3);
  eq(X.game.debris.length, beforeF + 3, "F: the field split still appends exactly 3 children");
  for (const k of fieldKids) {
    const sp = Math.hypot(k.vx, k.vy);
    const mul = X.junkSpeedMul();
    assert(sp >= X.DEBRIS_SPEEDS[2] * mul * 0.7 - 1e-6 && sp <= X.DEBRIS_SPEEDS[2] * mul * 1.3 + 1e-6,
      `F: a field-level child still gets its junkSpeedMul()-derived drift (${sp.toFixed(2)})`);
  }
})();

// ================= (G) THE maxCount GUARD =====================
(function sectionG() {
  console.log("(G) the maxCount >= 1 guard: a tiny ring is REJECTED, never placed with a negative gap");
  const X = build();
  // A ring so small that spacePerSatellite (157 px at shipped values) does not fit around it even once.
  // circumference = 2π x 20 = 125.7 < 157, so maxCount floors to 0 and the ring is unfair by construction.
  const tiny = withRandom(seededRandom(1), () => X.generateOrbitLayout(Object.assign(shippedArgs(X, 1280, 720), {
    orbitCount: 3, innerRadius: 20, radiusStep: 1,
  })));
  eq(tiny.rings.length, 0, "G: all three sub-minimum rings were rejected, none placed");
  eq(tiny.rejected.length, 3, "G: and all three were RECORDED as rejected rather than silently dropped");
  for (const r of tiny.rejected) {
    assert(r.maxCount < 1, `G: rejected ring ${r.index + 1} really had maxCount < 1 (${r.maxCount})`);
    assert(r.circumference < tiny.spacePerSatellite, `G: rejected ring ${r.index + 1}: circumference < spacePerSatellite`);
  }
  eq(tiny.total, 0, "G: the layout's total is 0 — nothing was placed with a negative gap");
  eq(tiny.outerEdge, 0, "G: and there is no outer edge to report");

  // The boundary: the smallest radius at which one satellite DOES fit, placed with a non-negative gap.
  // circumference = spacePerSatellite exactly at r = 157 / TAU ≈ 24.987.
  const justFits = Math.ceil(tiny.spacePerSatellite / X.TAU * 1e6) / 1e6;
  const edge = withRandom(seededRandom(2), () => X.generateOrbitLayout(Object.assign(shippedArgs(X, 1280, 720), {
    orbitCount: 1, innerRadius: justFits, radiusStep: 0,
  })));
  eq(edge.rings.length, 1, "G: at the boundary radius exactly one ring IS placed");
  eq(edge.rings[0].maxCount, 1, "G: with maxCount exactly 1");
  eq(edge.rings[0].count, 1, "G: and count clamped to 1");
  assert(edge.rings[0].actualGapPx >= 0, `G: its gap is NON-NEGATIVE (${edge.rings[0].actualGapPx})`);

  // A mixed layout: only the unfair rings drop out, the fair ones are placed normally.
  const mixed = withRandom(seededRandom(3), () => X.generateOrbitLayout(Object.assign(shippedArgs(X, 1280, 720), {
    orbitCount: 4, innerRadius: 10, radiusStep: 200,
  })));
  eq(mixed.rejected.length, 1, "G: in a mixed layout only the sub-minimum ring is rejected");
  eq(mixed.rejected[0].index, 0, "G: and it is the one that was too small");
  eq(mixed.rings.length, 3, "G: the three fair rings are placed as normal");
  for (const r of mixed.rings) assert(r.actualGapPx >= 0, `G: mixed ring ${r.index + 1} has a non-negative gap`);
})();

// ================= (H) WRAP CORRECTNESS — spec §8 item 8 =====================
(function sectionH() {
  console.log("(H) wrap correctness: a dock near a world edge still lays exact rings");
  const X = build();
  const corners = [
    { x: 5, y: 5 }, { x: X.WORLD_W - 5, y: 5 }, { x: 5, y: X.WORLD_H - 5 },
    { x: X.WORLD_W - 5, y: X.WORLD_H - 5 }, { x: 0, y: 0 }, { x: X.WORLD_W - 1, y: X.WORLD_H / 2 },
  ];
  let naiveWorst = 0, toroidalWorst = 0, samples = 0;
  for (const c of corners) {
    const L = withRandom(seededRandom(0x5EA13 + c.x), () => X.generateOrbitLayout(shippedArgs(X, c.x, c.y)));
    for (const r of L.rings) {
      for (const s of r.satellites) {
        samples++;
        // Every emitted position is folded into [0, WORLD) by wrapPos.
        assert(s.x >= 0 && s.x < X.WORLD_W && s.y >= 0 && s.y < X.WORLD_H,
          `H: satellite position is inside the world box (${s.x.toFixed(1)}, ${s.y.toFixed(1)})`);
        // TOROIDAL distance to the centre is exactly the ring radius.
        const toro = Math.sqrt(X.dist2(s, { x: c.x, y: c.y }));
        toroidalWorst = Math.max(toroidalWorst, Math.abs(toro - r.radius));
        close(toro, r.radius, `H: dock at (${c.x},${c.y}) ring ${r.index + 1}: toroidal distance === radius`, 1e-6);
        // NAIVE arithmetic is the control: it must be badly wrong for at least some of these, so the
        // assertion above is genuinely testing the wrap-aware path and not passing by luck.
        naiveWorst = Math.max(naiveWorst, Math.abs(Math.hypot(s.x - c.x, s.y - c.y) - r.radius));
      }
    }
  }
  assert(samples === 6 * 40, `H: (setup) 240 satellites sampled across six edge/corner docks (got ${samples})`);
  assert(naiveWorst > 100, `H: CONTROL — naive (non-wrap) arithmetic is off by ${naiveWorst.toFixed(1)} px on these layouts, so it would FAIL the assertion above`);
  assert(toroidalWorst < 1e-6, `H: the wrap-aware measurement is exact (worst error ${toroidalWorst.toExponential(2)} px)`);

  // The same thing end to end, through the REAL nextWave() with the dock forced onto the seam.
  withRandom(seededRandom(0x5EA14), () => {
    X.startGame();
    X.game.ship.x = 2; X.game.ship.y = X.WORLD_H - 3;
    atWave(X, 3);
  });
  eq(X.game.debris.length, 40, "H: a real seam-side orbit wave still spawns 40");
  for (const d of X.game.debris) {
    close(Math.sqrt(X.dist2(d, X.game.dock)), d.orbitRadius, "H: real spawn: toroidal distance to the dock === ring radius", 1e-6);
  }
  console.log(`    worst toroidal error ${toroidalWorst.toExponential(2)} px; naive arithmetic would be off by up to ${naiveWorst.toFixed(1)} px`);
})();

// ================= (I) SPAWN SAFETY (FORK-CS021-A -> (c)) =====================
(function sectionI() {
  console.log("(I) spawn safety: the reroll clears the ship, and the bound really terminates");
  const X = build();
  const CX = 1280, CY = 720;

  // 1. THE SHIP SEEDED EXACTLY ON A RING BAND. Every ring radius, many angles: the layout that comes
  //    back must clear the ship by at least minRequiredGap on EVERY ring, and the ring the ship is on
  //    must have been recognised as in-band.
  let maxTries = 0, banded = 0, rerolled = 0, trials = 0;
  const gen = seededRandom(0x5AFE);
  for (const ringIdx of [0, 1, 2, 3]) {
    const radius = X.ORBIT_INNER_RADIUS + ringIdx * X.ORBIT_RADIUS_STEP;
    for (let t = 0; t < 40; t++) {
      trials++;
      const th = (t / 40) * X.TAU;
      const ship = X.wrapPos({ x: CX + Math.cos(th) * radius, y: CY + Math.sin(th) * radius });
      const L = withRandom(gen, () => X.spawnSafeOrbitLayout(X.generateOrbitLayout(shippedArgs(X, CX, CY)), ship));
      const onRing = L.rings[ringIdx];
      assert(onRing.spawnSafetyBand === true,
        `I: ring ${ringIdx + 1}: a ship exactly on the radius is recognised as IN BAND`);
      if (onRing.spawnSafetyTries > 0) rerolled++;
      maxTries = Math.max(maxTries, ...L.rings.map(r => r.spawnSafetyTries));
      for (const r of L.rings) {
        if (r.spawnSafetyBand) banded++;
        assert(r.spawnSafetyCleared === true,
          `I: ring ${r.index + 1}: cleared (tries ${r.spawnSafetyTries}) with the ship on ring ${ringIdx + 1}`);
        assert(X.nearestOrbitDist(r, ship) >= L.minRequiredGap - 1e-9,
          `I: ring ${r.index + 1}: nearest satellite is >= minRequiredGap (${L.minRequiredGap}) from the ship`);
      }
    }
  }
  assert(rerolled > 0, `I: (control) the reroll actually fired — ${rerolled} of ${trials} on-ring trials needed one`);
  assert(banded > 0, "I: (control) rings were genuinely classified as in-band");
  assert(maxTries < X.ORBIT_SPAWN_TRIES, `I: no trial came near the bound (worst ${maxTries} of ${X.ORBIT_SPAWN_TRIES})`);
  console.log(`    on-ring trials: ${trials}, reroll fired on ${rerolled}, worst attempt count ${maxTries}/${X.ORBIT_SPAWN_TRIES}`);

  // 2. A REROLL MOVES START ANGLES ONLY. Counts, radii, densities, velocities and gaps are identical
  //    before and after — the property CS021 P3's reroll keybind will lean on.
  const shipOnRing = X.wrapPos({ x: CX + X.ORBIT_INNER_RADIUS, y: CY });
  const L2 = withRandom(seededRandom(0x5AFF), () => X.generateOrbitLayout(shippedArgs(X, CX, CY)));
  const snap = L2.rings.map(r => ({ radius: r.radius, count: r.count, maxCount: r.maxCount, density: r.density,
                                    angVel: r.angVel, gap: r.actualGapPx, angleStep: r.angleStep, start: r.startAngle }));
  withRandom(seededRandom(0x5B00), () => X.spawnSafeOrbitLayout(L2, shipOnRing));
  L2.rings.forEach((r, i) => {
    eq(r.radius, snap[i].radius, `I: reroll left ring ${i + 1} radius alone`);
    eq(r.count, snap[i].count, `I: reroll left ring ${i + 1} count alone`);
    eq(r.maxCount, snap[i].maxCount, `I: reroll left ring ${i + 1} maxCount alone`);
    eq(r.density, snap[i].density, `I: reroll left ring ${i + 1} density alone`);
    eq(r.angVel, snap[i].angVel, `I: reroll left ring ${i + 1} angVel alone`);
    eq(r.actualGapPx, snap[i].gap, `I: reroll left ring ${i + 1} gap alone`);
    eq(r.angleStep, snap[i].angleStep, `I: reroll left ring ${i + 1} angleStep alone`);
    eq(r.satellites.length, snap[i].count, `I: reroll left ring ${i + 1} satellite count alone`);
  });
  assert(L2.rings.some(r => r.startAngle !== snap[r.index].start), "I: (control) at least one startAngle DID move");

  // 3. THE BOUND TERMINATES. minRequiredGap is forced to something no rotation can satisfy, so every
  //    ring is permanently in-band and the loop MUST exhaust rather than hang. Also proves the
  //    "log and accept the last roll" path: the warning fires, and the layout still comes back usable.
  const L3 = withRandom(seededRandom(0x5B01), () => X.generateOrbitLayout(shippedArgs(X, CX, CY)));
  L3.minRequiredGap = 1e6;                     // unsatisfiable by construction
  const savedWarn = console.warn;
  let warnings = 0;
  console.warn = () => { warnings++; };
  let returned = null;
  const t0 = Date.now();
  try { returned = withRandom(seededRandom(0x5B02), () => X.spawnSafeOrbitLayout(L3, { x: CX, y: CY })); }
  finally { console.warn = savedWarn; }
  const elapsed = Date.now() - t0;
  assert(returned === L3, "I: an unsatisfiable layout still RETURNS — the loop is bounded, never infinite");
  assert(elapsed < 2000, `I: and it returns promptly (${elapsed} ms)`);
  for (const r of L3.rings) {
    eq(r.spawnSafetyTries, X.ORBIT_SPAWN_TRIES, `I: ring ${r.index + 1} exhausted exactly ORBIT_SPAWN_TRIES attempts`);
    eq(r.spawnSafetyCleared, false, `I: ring ${r.index + 1} reports that it did NOT clear`);
    eq(r.satellites.length, r.count, `I: ring ${r.index + 1} still has a full, usable set of satellites (the last roll)`);
  }
  eq(warnings, L3.rings.length, "I: one warning logged per exhausted ring — logged and accepted, not thrown");

  // 4. THE WHOLE INVARIANT, END TO END, through the REAL nextWave(): across many wave starts at random
  //    ship positions, no satellite is ever laid down within minRequiredGap of the ship.
  const gap = X.SHIP_RADIUS * 2 * X.ORBIT_GAP_MULT;
  let waves = 0, worst = Infinity;
  withRandom(seededRandom(0x5B03), () => {
    X.startGame();
    for (let i = 0; i < 120; i++) {
      X.game.ship.x = Math.random() * X.WORLD_W;
      X.game.ship.y = Math.random() * X.WORLD_H;
      atWave(X, 3);
      waves++;
      for (const d of X.game.debris) worst = Math.min(worst, Math.sqrt(X.dist2(d, X.game.ship)));
    }
  });
  eq(waves, 120, "I: (setup) 120 real orbit wave starts driven");
  assert(worst >= gap - 1e-9,
    `I: across 120 real orbit wave starts the closest satellite to the ship was ${worst.toFixed(2)} px, never under minRequiredGap (${gap})`);
  console.log(`    120 real wave starts: closest satellite-to-ship distance ${worst.toFixed(2)} px (floor ${gap})`);
})();

// ================= (J) DETERMINISM — spec §8 item 6 =====================
(function sectionJ() {
  console.log("(J) determinism: the same seed reproduces the same wave, bit for bit");
  function snapshot(seed) {
    const X = build();
    return withRandom(seededRandom(seed), () => {
      X.startGame();
      atWave(X, 3);
      return X.game.debris.map(d =>
        `${d.x.toFixed(9)},${d.y.toFixed(9)},${d.orbitRadius},${d.orbitAngle.toFixed(9)},${d.orbitAngVel.toFixed(9)}`
      ).join("|") + "#" + X.game.dock.x.toFixed(9) + "," + X.game.dock.y.toFixed(9);
    });
  }
  const a = snapshot(0xDE7);
  const b = snapshot(0xDE7);
  const c = snapshot(0xDE8);
  eq(a, b, "J: the same seed produces a bit-identical orbit wave");
  assert(a !== c, "J: (control) a different seed produces a different one, so the comparison has teeth");
  // The generator's own output is deterministic under a pinned rand as well.
  const X = build();
  const g1 = withPinned(0.25, () => X.generateOrbitLayout(shippedArgs(X, 900, 500)));
  const g2 = withPinned(0.25, () => X.generateOrbitLayout(shippedArgs(X, 900, 500)));
  eq(JSON.stringify(g1), JSON.stringify(g2), "J: generateOrbitLayout is deterministic under a pinned rand()");
})();

// ================= (K) FRAME-BUDGET PROBE — REPORTED, NOT GATED =====================
// Spec §8 item 7 / FLAG-CS021-h. FORK-CS021-D accepts 40 size-3 satellites against a normal-level max of
// 13, and a full harvest of those cascades into up to ~80 size-2, ~160 size-1 and a large garbage burst
// per tier, plus coalescence. That load has never been run before, so it is MEASURED here rather than
// assumed — and deliberately not gated on a magic threshold: the numbers are what CS021 P5's retune
// argues from. Only the shape of the run is asserted (that it really happened); the costs are printed.
(function sectionK() {
  console.log("(K) frame-budget probe (FLAG-CS021-h) — REPORTED, not gated");
  function probe(level, seed, keepAlive = true) {
    const X = build();
    withRandom(seededRandom(seed), () => { X.startGame(); atWave(X, level); });
    X.game.state = "playing"; X.game.paused = false;
    const spawned = X.game.debris.length;
    let peak = 0, frames = 0, killEvery = 6, sinceKill = 0, totalNs = 0n, worstNs = 0n;
    let peakDebris = 0, peakGarbage = 0, peakParticles = 0;
    const samples = [];   // {ents, garbage, ns} per frame, for the percentile figures below
    withRandom(seededRandom(seed ^ 0xFFFF), () => {
      // Harvest at a steady rate until the field is clear, then run a 2 s tail (under the 2.5 s
      // wave-clear timer, so the measurement stays inside ONE level).
      let tail = 0;
      while (tail < 120 && frames < 4000) {
        if (X.game.debris.length === 0) tail++;
        else if (++sinceKill >= killEvery) { sinceKill = 0; X.destroyDebris(X.game.debris[0], true); }
        // KEEP THE SHIP ALIVE. A parked ship inside a 40-satellite ring level takes contact damage and
        // dies within seconds; once it does, update() drops into updateDeath() and then early-returns at
        // "gameover", and the probe silently measures nothing. Topping the hull up outside the timed
        // region keeps the FULL update path (collisions included) running for every frame measured.
        if (keepAlive) X.game.ship.hp = X.SHIP_MAX_HP;
        const t0 = process.hrtime.bigint();
        X.update(1 / 60);
        const dtNs = process.hrtime.bigint() - t0;
        totalNs += dtNs; if (dtNs > worstNs) worstNs = dtNs;
        frames++;
        const ents = X.game.debris.length + X.game.hunters.length + X.game.saucers.length +
                     X.game.garbage.length + X.game.particles.length + X.game.bullets.length +
                     X.game.powerups.length + X.game.floaters.length;
        samples.push({ ents, garbage: X.game.garbage.length, ns: dtNs });
        peak = Math.max(peak, ents);
        peakDebris = Math.max(peakDebris, X.game.debris.length);
        peakGarbage = Math.max(peakGarbage, X.game.garbage.length);
        peakParticles = Math.max(peakParticles, X.game.particles.length);
      }
    });
    // Timing in a headless Node process is dominated by GC pauses on the tail, so the summary is
    // ROBUST statistics (median / p95 / p99 / worst) plus a LOAD CURVE: the median frame cost binned by
    // simultaneous entity count. The load curve is the number that actually answers FLAG-CS021-h — "does
    // per-frame cost scale with what an orbit level produces" — where a bare mean just measures the GC.
    const warm = samples.slice(60);                          // discard JIT warm-up
    const msOf = s => Number(s.ns) / 1e6;
    const pct = (arr, p) => { const v = arr.map(msOf).sort((a, b) => a - b); return v.length ? v[Math.min(v.length - 1, Math.floor(v.length * p))] : 0; };
    const BINS = [0, 100, 250, 500, 1000, 2000, Infinity];
    const curve = [];
    for (let i = 0; i + 1 < BINS.length; i++) {
      const inBin = warm.filter(s => s.ents >= BINS[i] && s.ents < BINS[i + 1]);
      if (inBin.length) curve.push({ lo: BINS[i], hi: BINS[i + 1], n: inBin.length, medianMs: pct(inBin, 0.5) });
    }
    return { level, spawned, frames, peak, peakDebris, peakGarbage, peakParticles, curve,
             endState: X.game.state, endWave: X.game.wave,
             meanMs: Number(totalNs / BigInt(frames)) / 1e6,
             medianMs: pct(warm, 0.5), p95Ms: pct(warm, 0.95), p99Ms: pct(warm, 0.99),
             worstMs: Number(worstNs) / 1e6 };
  }
  const orbit = probe(3, 0x9001);    // level 3 — the first orbit occurrence
  const field = probe(4, 0x9001);    // level 4 — the densest field level in the cycle (junkCount 13)
  // The genuine worst case, and it is reachable in play: the ship dying on a part-harvested orbit level
  // sends updateDeath()'s expanding shockwave through every remaining satellite at once, detonating the
  // whole arrangement in a few frames rather than over a minute of harvesting.
  const death = probe(3, 0x9001, false);

  // Only the shape is asserted, so the probe can never silently become vacuous.
  eq(orbit.spawned, 40, "K: (validity) the orbit probe really started from a 40-satellite wave");
  eq(field.spawned, 13, "K: (validity) the field control really started from a 13-satellite wave");
  assert(orbit.frames > 60 && field.frames > 60, "K: (validity) both probes ran a real number of frames");
  assert(orbit.peak > field.peak, "K: (validity) the orbit level really is the heavier load");
  // Without these two the probe can silently degenerate: a dead ship sends update() into updateDeath()
  // and then into an early return, and a wave clear would put a whole different level under measurement.
  eq(orbit.endState, "playing", "K: (validity) the orbit probe stayed in the live update path throughout");
  eq(field.endState, "playing", "K: (validity) the field probe stayed in the live update path throughout");
  eq(orbit.endWave, 3, "K: (validity) the orbit probe stayed on level 3 — no wave clear mid-measurement");
  eq(field.endWave, 4, "K: (validity) the field probe stayed on level 4");

  for (const p of [orbit, field]) {
    console.log(`    level ${p.level} (${p.level % 3 === 0 ? "ORBIT" : "field"}): spawned ${p.spawned}, frames ${p.frames}`);
    console.log(`      PEAK ENTITIES ${p.peak}  (debris ${p.peakDebris} / garbage ${p.peakGarbage} / particles ${p.peakParticles})`);
    console.log(`      update(dt) ms — median ${p.medianMs.toFixed(3)}, p95 ${p.p95Ms.toFixed(3)}, ` +
      `p99 ${p.p99Ms.toFixed(3)}, worst ${p.worstMs.toFixed(3)}, mean ${p.meanMs.toFixed(3)} (GC-inflated)`);
    console.log(`      load curve (median ms by simultaneous entities): ` +
      p.curve.map(c => `${c.lo}-${c.hi === Infinity ? "max" : c.hi}: ${c.medianMs.toFixed(3)} (n=${c.n})`).join("  "));
  }
  console.log(`    ratio orbit:field — peak entities ${(orbit.peak / field.peak).toFixed(2)}x, ` +
    `median frame cost ${(orbit.medianMs / field.medianMs).toFixed(2)}x, ` +
    `worst frame ${(orbit.worstMs / field.worstMs).toFixed(2)}x   [REPORTED, not gated — see STATUS.md]`);
  assert(death.peak > orbit.peak, "K: (validity) the death-shockwave variant really is the heavier peak");
  console.log(`    WORST CASE — level 3 orbit, ship allowed to die (death shockwave detonates the ring at once):`);
  console.log(`      PEAK ENTITIES ${death.peak}  (debris ${death.peakDebris} / garbage ${death.peakGarbage} / particles ${death.peakParticles}), ` +
    `median ${death.medianMs.toFixed(3)} ms, p99 ${death.p99Ms.toFixed(3)} ms, worst ${death.worstMs.toFixed(3)} ms ` +
    `(most of that run is updateDeath()/gameover, which is a much cheaper path than update())`);
  console.log(`    CAVEAT: this measures update(dt) ONLY. draw() is not in the loop, and the known browser`);
  console.log(`    watch item is shadowBlur render cost, which scales with the same entity counts.`);
})();

// ================= (L) AudioSys.ctx null smoke =====================
(function sectionL() {
  console.log("(L) AudioSys.ctx null smoke across a full orbit level");
  const X = build({ audio: false });
  eq(X.AudioSys.ctx, null, "L: (setup) AudioSys.ctx really is null");
  noThrow(() => {
    withRandom(seededRandom(0x1EAF), () => {
      X.startGame();
      atWave(X, 3);
      X.game.state = "playing"; X.game.paused = false;
      for (let i = 0; i < 240; i++) {
        if (i % 8 === 0 && X.game.debris.length) X.destroyDebris(X.game.debris[0], true);
        X.update(1 / 60);
        X.draw();
      }
    });
  }, "L: a real orbit level updates and DRAWS 240 frames with no audio context");
  assert(X.game.debris.every(d => Number.isFinite(d.x) && Number.isFinite(d.y) &&
                                  Number.isFinite(d.vx) && Number.isFinite(d.vy)),
    "L: every surviving satellite's position and velocity stayed finite");
  // And a couple of levels past it, so wave-clear -> nextWave -> the next archetype is exercised too.
  noThrow(() => {
    withRandom(seededRandom(0x1EB0), () => { for (let w = 4; w <= 7; w++) { atWave(X, w); for (let i = 0; i < 30; i++) X.update(1 / 60); } });
  }, "L: levels 4..7 (field, field, ORBIT, field) run clean back to back");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
