// Headless test originally written for CS017 Phase 1 — the difficulty cycle clock (state only, inert at
// the time): nextWave() derived game.cycle/game.cycleWave from the untouched game.wave as a sawtooth,
// update() ticked game.waveTime, and cycleValue(base, cycle) applied a per-cycle spiral.
//
// **REPOINTED BY CS018 P4 — the cycle clock is RETIRED, and this file now proves that.** FORK-CS018-A
// replaced it with the levelDef() level table as the game's ONE difficulty clock, so CYCLE_LENGTH,
// CYCLE_GAIN, cycleValue(), game.cycle and game.cycleWave no longer exist. Four sections were asserting
// the mechanism rather than the intent, and each has been turned into its mirror image at the same
// strength rather than deleted:
//   (B) was "nextWave() derives the sawtooth"          -> the clock is GONE and game.wave alone drives levelDef.
//   (C) was "both game literals declare all 3 fields"  -> only waveTime survives; the other two are absent.
//   (E) was "cycleValue() spot values"                 -> cycleValue/CYCLE_LENGTH/CYCLE_GAIN are undefined.
//   (F) was "which levers read which clock"            -> junk reads levelDef; Hunter speed/turn are FROZEN.
// (D) waveTime and (G) the headless smoke are P1's own contract, still true, and unchanged.
// (F) had already been repointed once, by CS017 P3, from P1's original "nothing reads the cycle clock."
//
//   node scratchpad/test-cs017-p1.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL nextWave()/startGame()/update()/DebrisSatellite/HunterSatellite —
// never reimplement game logic. Byte-identity comparisons use the REAL ramp()/levelDef()/junkSpeedMul()
// helpers, not re-derived arithmetic.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs017p1_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try {
    execSync(`node --check "${tmp}"`, { stdio: "pipe" });
    passed++;
  } catch (e) {
    failed++;
    console.error("  FAIL: node --check: " + e.stderr.toString());
  } finally {
    fs.unlinkSync(tmp);
  }
})();

function makeCtx(canvasStub) {
  return new Proxy({}, {
    get(t, prop) {
      if (prop === "measureText") return () => ({ width: 0 });
      if (prop === "canvas") return canvasStub;
      if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => ({ addColorStop: () => {} });
      return () => {};
    },
    set() { return true; }
  });
}

const RETURN = [
  "startGame", "update", "nextWave", "game", "settings",
  "DebrisSatellite", "HunterSatellite", "Saucer",
  "ramp", "difficultyFactor", "leverScale",
  "levelDef", "junkSpeedMul", "DEBRIS_SPEEDS",              // CS018 P4 (sections B, F)
  "DEBUG",                                                  // CS018 P6 (section F: tiered saucer gap)
  "SAUCER_GAP_FLOOR_MIN", "SAUCER_GAP_CEIL_MIN", "SAUCER_GAP_FLOOR_MAX", "SAUCER_GAP_CEIL_MAX",
  "HUNTER_SPEED_CEIL", "HUNTER_TURN_CEIL", "HUNTER_FLOOR_FRAC",
  "MusicSys", "AudioSys",
  // CS021 P2 REPOINT (sections B, F): the orbit archetype's total is occurrence-scaled now, not the
  // fixed 40 P1 shipped — orbitTotalAt() below recomputes it from these.
  "generateOrbitLayout", "orbitGapMult", "activeRingsFor", "SHIP_RADIUS", "DEBRIS_RADII",
  "ORBIT_RING_COUNT", "ORBIT_INNER_RADIUS", "ORBIT_RADIUS_STEP", "ORBIT_SAFETY_MARGIN",
  "ORBIT_DENSITY", "ORBIT_ANG_VEL", "ORBIT_FAST_RING", "ORBIT_FAST_MULT",
  // A scope probe, so section (E) can ask "does this identifier exist at all?" without the factory's
  // own return statement throwing a ReferenceError on a retired symbol. Direct eval keeps the script
  // block's lexical scope, so this sees exactly what the game's own code would see.
  'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }'
];

function build() {
  const canvasStub = { width: 1280, height: 720, style: {} };
  canvasStub.getContext = () => makeCtx(canvasStub);
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const listeners = {};
  const windowStub = {
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    innerWidth: 1280, innerHeight: 720,
    AudioContext: undefined, webkitAudioContext: undefined
  };
  const performanceStub = { now: () => 100000 };
  const rafStub = () => 0;
  const navigatorStub = { getGamepads: () => [] };
  const lsStore = {};
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, localStorageStub);
}

// CS021 P2 REPOINT helper (sections B, F): P1 shipped ONE gap multiplier for every occurrence, so a real
// orbit wave always spawned exactly 40 satellites; P2 makes it occurrence-scaled (orbitGapMult), so the
// total now climbs to 45 by the floor. Recompute the expectation from the SAME generator + multiplier
// nextWave() is wired to, rather than restating a level-40 literal that is only true at occurrence 1.
// Consumes its own rand() draws (placeOrbitRing's startAngle) but never reads them back, so it does not
// disturb any Math.random() sequencing the surrounding assertions depend on.
// EXTENDED BY CS022 P3 — the third rewrite of this helper, and the reason it is a helper at all: it
// recomputes what an orbit level's nextWave() ACTUALLY SPAWNS from the same generator, ramp and level
// table the shipped code is wired to, so a geometry or schedule move fails as a wiring mismatch rather
// than as a stale literal. Two parts are new this changeset:
//   * THE RING RAMP (FORK-CS022-E) — activeRingsFor(level) selects rings outermost-first, so occurrence 1
//     lays only ring 4 and all four are present from occurrence 4 (level 12) onward;
//   * THE FIELD COMPONENT (FORK-CS022-F) — levelDef(level).fieldCount ordinary scatter satellites ON TOP
//     of the rings, which is exactly what retires CS021's "junkCount is not consumed on an orbit level"
//     rule (spec Correction C6) and is why this returns a SUM rather than layout.total.
function orbitTotalAt(A, level) {
  const ringTotal = A.generateOrbitLayout({
    satelliteDiameter: A.DEBRIS_RADII[3] * 2,
    shipDiameter:      A.SHIP_RADIUS * 2,
    centerX: 0, centerY: 0,
    orbitCount:        A.ORBIT_RING_COUNT,
    innerRadius:       A.ORBIT_INNER_RADIUS,
    radiusStep:        A.ORBIT_RADIUS_STEP,
    safetyMargin:      A.ORBIT_SAFETY_MARGIN,
    minGapMultiplier:  A.orbitGapMult(level),
    densityByOrbit:    A.ORBIT_DENSITY,
    baseAngVel:        A.ORBIT_ANG_VEL,
    fastRingIndex:     A.ORBIT_FAST_RING - 1,
    fastRingMult:      A.ORBIT_FAST_MULT,
    activeRings:       A.activeRingsFor(level),   // CS022 P3: the ramp, read from the shipped helper
  }).total;
  return ringTotal + A.levelDef(level).fieldCount; // CS022 P3: rings PLUS the field component
}

// ================= (B) the cycle clock is RETIRED; game.wave alone drives the level table ==============
// REPOINTED BY CS018 P4 (was: "nextWave() derives cycle/cycleWave as a CYCLE_LENGTH=9 sawtooth"). The
// mirror image of the original claim, at the same strength: across the same 28 levels, game.wave is still
// the untouched absolute counter, the two derived fields no longer exist on `game` at all, and the level's
// junk count now comes from levelDef(game.wave) — one clock, not two.
(function sectionB() {
  console.log("(B) the cycle clock is retired: no game.cycle/game.cycleWave, and game.wave alone feeds levelDef()");
  const A = build();
  const g = A.game;
  A.startGame(); // wave 1

  for (let w = 1; w <= 28; w++) {
    if (w > 1) { g.debris = []; A.nextWave(); }
    assert(g.wave === w, `B: game.wave is the untouched absolute counter (expected ${w}, got ${g.wave})`);
    assert(!("cycle" in g), `B: level ${w}: game.cycle does not exist (the sawtooth is gone)`);
    assert(!("cycleWave" in g), `B: level ${w}: game.cycleWave does not exist (the sawtooth is gone)`);
    // The ONE clock, proven by its effect. REPOINTED BY CS021 P1: levelDef(game.wave) now also decides
    // the level's ARCHETYPE, and that is still ONE clock — game.wave — not two. A field level's spawned
    // junk count is still levelDef(game.wave).junkCount; an orbit level's population comes from its
    // geometry instead, so the effect measured here is the archetype the same single clock produced.
    const arch = A.levelDef(g.wave).archetype;
    if (arch === "orbit") {
      const wantTotal = orbitTotalAt(A, w);   // CS021 P2: occurrence-scaled, no longer always 40
      assert(g.debris.length === wantTotal,
        `B: level ${w}: ORBIT archetype spawned the ${wantTotal}-satellite layout (got ${g.debris.length})`);
    } else {
      assert(g.debris.length === A.levelDef(g.wave).junkCount,
        `B: level ${w}: spawned junk ${g.debris.length} === levelDef(${w}).junkCount ${A.levelDef(w).junkCount}`);
    }
    assert(arch === (w % 3 === 0 ? "orbit" : "field"),
      `B: level ${w}: the archetype is a pure function of the ONE clock (got ${arch})`);
  }
  // CONTROL: the level table is genuinely not a 9-long sawtooth — level 1 and level 10 (same cycleWave
  // under the retired CYCLE_LENGTH 9) do not have to agree, and in fact do not on the shipped table.
  assert(A.levelDef(1).junkCount !== A.levelDef(10).junkCount,
    "B: control — levels 1 and 10 differ, so nothing is still reading a 9-long cycle position");
})();

// ================= (C) the game literals: waveTime survives, cycle/cycleWave are gone — SOURCE ==========
// REPOINTED BY CS018 P4 (was: "both literals declare all three fields"). The standing repo rule is that a
// game.* field must be declared in BOTH the `const game = {...}` literal and startGame()'s reset, or it
// reads undefined for a whole run. The retirement has to be symmetric for the same reason.
(function sectionC() {
  console.log("(C) source inspection: only waveTime remains in the game{} literal and startGame()'s reset");

  const literalMatch = scriptSrc.match(/const game = \{[\s\S]*?\n\};/);
  assert(!!literalMatch, "C: located the `const game = {...}` literal in source");
  const literalSrc = literalMatch ? literalMatch[0] : "";
  assert(!/^\s*cycle:\s*0/m.test(literalSrc), "C: game literal no longer declares cycle: 0");
  assert(!/^\s*cycleWave:\s*1/m.test(literalSrc), "C: game literal no longer declares cycleWave: 1");
  assert(/waveTime:\s*0/.test(literalSrc), "C: game literal still declares waveTime: 0");

  const startGameMatch = scriptSrc.match(/function startGame\(\) \{[\s\S]*?\nfunction nextWave/);
  assert(!!startGameMatch, "C: located startGame()'s body in source");
  const startGameSrc = startGameMatch ? startGameMatch[0] : "";
  assert(!/game\.cycle\s*=/.test(startGameSrc), "C: startGame() no longer resets game.cycle");
  assert(!/game\.cycleWave\s*=/.test(startGameSrc), "C: startGame() no longer resets game.cycleWave");
  assert(/game\.waveTime\s*=\s*0/.test(startGameSrc), "C: startGame() still resets game.waveTime = 0");

  // And nowhere in live (non-comment) code either — the retirement ledger's "removed outright" claim.
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  for (const id of ["game.cycle", "game.cycleWave"]) {
    const hits = codeOnly.filter(l => l.includes(id));
    assert(hits.length === 0, `C: zero live references to ${id} (found: ${JSON.stringify(hits)})`);
  }
})();

// ================= (D) waveTime: accumulates while playing, zeroed by nextWave(), frozen paused/title ===
(function sectionD() {
  console.log("(D) game.waveTime accumulates under update() while playing, resets on nextWave(), freezes paused/title");
  const A = build();
  const g = A.game;
  A.startGame();
  assert(g.waveTime === 0, "D: waveTime starts at 0 on a fresh run");

  for (let i = 0; i < 30; i++) A.update(1 / 60);
  const afterPlaying = g.waveTime;
  assert(afterPlaying > 0.49 && afterPlaying < 0.51, `D: waveTime accumulated ~0.5s over 30 frames at 1/60 (got ${afterPlaying})`);

  // Frozen while paused.
  g.paused = true;
  for (let i = 0; i < 30; i++) A.update(1 / 60);
  assert(g.waveTime === afterPlaying, `D: waveTime does NOT advance while paused (expected ${afterPlaying}, got ${g.waveTime})`);
  g.paused = false;

  // Frozen at the title.
  g.state = "title";
  for (let i = 0; i < 30; i++) A.update(1 / 60);
  assert(g.waveTime === afterPlaying, `D: waveTime does NOT advance at the title (expected ${afterPlaying}, got ${g.waveTime})`);
  g.state = "playing";

  // Resumes accumulating once playing again.
  for (let i = 0; i < 30; i++) A.update(1 / 60);
  assert(g.waveTime > afterPlaying, "D: waveTime resumes accumulating once back to playing/unpaused");

  // nextWave() zeroes it.
  A.nextWave();
  assert(g.waveTime === 0, "D: nextWave() resets game.waveTime to 0");
})();

// ================= (E) cycleValue / CYCLE_LENGTH / CYCLE_GAIN are GONE ====================
// REPOINTED BY CS018 P4 (was: "cycleValue(base, cycle) === base * (1 + cycle * CYCLE_GAIN)"). Removed
// outright per the retirement ledger (PLANNED-FEATURES-CS018 §7), so the assertion is existential: the
// identifiers do not resolve in the script block's own scope, and the source carries no definition. The
// probe's own positive control keeps this from passing vacuously (a broken probe would fail it).
(function sectionE() {
  console.log("(E) cycleValue / CYCLE_LENGTH / CYCLE_GAIN no longer exist");
  const A = build();
  assert(A.probe("RAMP_WAVES") === 8, "E: (meta) the scope probe genuinely resolves a live constant");
  for (const id of ["cycleValue", "CYCLE_LENGTH", "CYCLE_GAIN"]) {
    assert(A.probe(id) === "__ReferenceError__", `E: ${id} is undefined in the script block's scope`);
  }
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  for (const id of ["cycleValue", "CYCLE_LENGTH", "CYCLE_GAIN"]) {
    const hits = codeOnly.filter(l => l.includes(id));
    assert(hits.length === 0, `E: zero live source references to ${id} (found: ${JSON.stringify(hits)})`);
  }
  // FLAG-l: the one piece of the old machinery that was RETAINED, and why — the music-intensity curve.
  assert(typeof A.difficultyFactor === "function" && typeof A.ramp === "function",
    "E: difficultyFactor()/ramp() are retained (FLAG-l: the music-intensity curve)");
  assert(Math.abs(A.difficultyFactor(1)) < 1e-12, "E: difficultyFactor(1) is still 0");
})();

// ================= (F) lever wiring after the retirement: table-driven, frozen, and still-on-ramp ======
// REPOINTED BY CS018 P4. This section has now been repointed twice — P1 asserted "nothing reads the cycle
// clock", P3 asserted "the sawtooth levers read it", and P4 asserts the third and final arrangement:
//   - junk count and speed read levelDef()/junkSpeedMul() (P3);
//   - Hunter speed and turn rate are FROZEN CONSTANTS, level-independent (P4, FLAG-a);
//   - the saucer spawn gap still ramps on the absolute game.wave (P6 moves it onto tiers, not this phase).
// Each claim carries its mirror-image control so no direction can pass vacuously, and every expectation is
// built from the REAL levelDef/junkSpeedMul/ramp helpers, never re-derived arithmetic.
(function sectionF() {
  console.log("(F) lever wiring: junk on levelDef, Hunter speed/turn FROZEN, saucer gap now tiered (CS018 P6)");
  const A = build();
  const g = A.game;
  A.startGame();

  const frozenSpeeds = [], frozenTurns = [];
  for (let w = 1; w <= 12; w++) {
    // nextWave() only ever fires once the field is clear (game.debris.length === 0 gate, elsewhere in
    // update()) — nextWave() itself does not clear the array, so the test must simulate that precondition.
    if (w > 1) { g.debris = []; A.nextWave(); }
    assert(g.wave === w, `F: sanity — game.wave === ${w}`);

    // --- TABLE-DRIVEN: junk count + speedMul, exactly as nextWave() spawned them (CS018 P3) ---
    // REPOINTED BY CS021 P1. The count/speed claim is about the FIELD archetype's drift spawn and is
    // unchanged there. An ORBIT level's satellites are on a rail: their vx/vy is the instantaneous
    // orbital tangent (angVel × radius), which has nothing to do with DEBRIS_SPEEDS × junkSpeedMul, so
    // the tier envelope is a category error for them. They get their own assertion instead of a skip.
    //
    // REPOINTED BY CS022 P3 (spec §1.4, FORK-CS022-F): an orbit level now spawns BOTH populations —
    // ramped rings plus levelDef(n-1).junkCount ordinary scatter satellites — so "which speed rule
    // applies" is a PER-ENTITY question keyed on orbit state, not a per-LEVEL one. Dispatching on the
    // level, as this branch used to, fed the field component's undefined orbitAngVel into the rail rule
    // and produced NaN. Each population is now checked by ITS OWN rule, and the field component on an
    // orbit level is checked by exactly the same tier envelope a field level's scatter is.
    const expectedSpeedMul = A.junkSpeedMul();
    const tierEnvelope = (d, label) => {
      const sp = Math.hypot(d.vx, d.vy);
      const lo = A.DEBRIS_SPEEDS[3] * expectedSpeedMul * 0.7 * 0.999;
      const hi = A.DEBRIS_SPEEDS[3] * expectedSpeedMul * 1.3 * 1.001;
      assert(sp >= lo && sp <= hi,
        `F: level ${w}: ${label} speed ${sp.toFixed(2)} outside the tier envelope [${lo.toFixed(2)}, ${hi.toFixed(2)}]`);
    };
    if (A.levelDef(w).archetype === "orbit") {
      const wantTotal = orbitTotalAt(A, w);   // CS022 P3: rings (ramped) + the field component
      assert(g.debris.length === wantTotal, `F: level ${w}: ORBIT level spawned the ${wantTotal}-satellite layout (got ${g.debris.length})`);
      let railBorne = 0, scatter = 0;
      for (const d of g.debris) {
        if (d.orbitCenter) {
          railBorne++;
          const sp = Math.hypot(d.vx, d.vy);
          const want = Math.abs(d.orbitAngVel * d.orbitRadius);
          assert(Math.abs(sp - want) < 1e-9,
            `F: level ${w}: orbiting satellite speed ${sp.toFixed(3)} === angVel × radius ${want.toFixed(3)}`);
        } else {
          scatter++;
          tierEnvelope(d, "orbit-level FIELD COMPONENT junk");
        }
      }
      assert(scatter === A.levelDef(w).fieldCount,
        `F: level ${w}: the field component is exactly levelDef(${w}).fieldCount (${A.levelDef(w).fieldCount}, got ${scatter})`);
      assert(railBorne === wantTotal - scatter,
        `F: level ${w}: ...and the remaining ${railBorne} satellites are all rail-borne`);
    } else {
      const expectedCount = A.levelDef(w).junkCount;
      assert(g.debris.length === expectedCount,
        `F: level ${w}: junk count expected ${expectedCount}, got ${g.debris.length}`);
      // Every piece's speed magnitude was DEBRIS_SPEEDS[3] * speedMul * rand(0.7,1.3); check the piece speed
      // falls inside the rand(0.7,1.3) envelope of the tier-derived multiplier.
      for (const d of g.debris) {
        const sp = Math.hypot(d.vx, d.vy);
        const lo = A.DEBRIS_SPEEDS[3] * expectedSpeedMul * 0.7 * 0.999;
        const hi = A.DEBRIS_SPEEDS[3] * expectedSpeedMul * 1.3 * 1.001;
        assert(sp >= lo && sp <= hi,
          `F: level ${w}: junk speed ${sp.toFixed(2)} outside the tier envelope [${lo.toFixed(2)}, ${hi.toFixed(2)}]`);
      }
    }

    // --- FROZEN: Hunter speed/turn — no clock at all (CS018 P4, FLAG-a) ---
    for (const size of [3, 2, 1]) {
      const h = new A.HunterSatellite(0, 0, size);
      const expSpeed = A.HUNTER_SPEED_CEIL[size] * A.HUNTER_FLOOR_FRAC;
      const expTurn  = A.HUNTER_TURN_CEIL[size]  * A.HUNTER_FLOOR_FRAC;
      assert(Math.abs(h.speed - expSpeed) < 1e-9,
        `F: level ${w} size ${size}: frozen speed expected ${expSpeed}, got ${h.speed}`);
      assert(Math.abs(h.turnRate - expTurn) < 1e-9,
        `F: level ${w} size ${size}: frozen turnRate expected ${expTurn}, got ${h.turnRate}`);
      if (size === 3) { frozenSpeeds.push(h.speed); frozenTurns.push(h.turnRate); }
      // CONTROL: the old ramp is provably GONE — past level 1 the frozen value must NOT equal what
      // ramp(floor, ceil, wave) would have produced (they coincide only at wave 1, where the factor is 0).
      if (w > 1 && A.HUNTER_SPEED_CEIL[size] !== 0) {
        const rampedSpeed = A.ramp(expSpeed, A.HUNTER_SPEED_CEIL[size], w);
        assert(Math.abs(h.speed - rampedSpeed) > 1e-9,
          `F: level ${w} size ${size}: frozen speed must differ from the retired ramp() value ${rampedSpeed.toFixed(3)}`);
      }
    }

    // --- REPOINTED BY CS018 P6 (mirror-image of the old claim): saucer gap moved OFF ramp()/game.wave
    // onto the UFO MOVEMENT appearance-frequency TIER + jitteredInterval(). Forces the spawn timer to
    // expire, with Math.random() pinned so jitteredInterval's rand(lo,hi) collapses to lo (the tier
    // centre's lower jitter bound) — also pins the smallChance roll false, same as before.
    g.saucers = [];
    g.saucerTimer = -1;
    const savedRandom = Math.random;
    Math.random = () => 0; // rand(a,b) = a + 0*(b-a) = a -> pins to the jitter lower bound
    try {
      A.update(0); // dt=0: no other accumulator advances, isolates the spawn-timer branch
    } finally {
      Math.random = savedRandom;
    }
    assert(g.saucers.length === 1, `F: level ${w}: forcing the spawn timer produced exactly one saucer`);
    const tier = A.levelDef(g.wave).ufoAppearFreq;
    const center = tier === "low" ? A.DEBUG.ufoAppearFreqLow : tier === "high" ? A.DEBUG.ufoAppearFreqHigh : A.DEBUG.ufoAppearFreqNormal;
    const expGapLo = center * (1 - A.DEBUG.freqJitter / 100);
    assert(Math.abs(g.saucerTimer - expGapLo) < 1e-9,
      `F: level ${w}: saucer gap (Math.random pinned to 0) expected the tier's jitter lower bound=${expGapLo}, got ${g.saucerTimer}`);
  }

  // The frozen claim, stated globally: every large Hunter sampled across levels 1..12 got the SAME value.
  assert(new Set(frozenSpeeds).size === 1,
    `F: large-Hunter speed is identical at every level (got ${JSON.stringify([...new Set(frozenSpeeds)])})`);
  assert(new Set(frozenTurns).size === 1,
    `F: large-Hunter turn rate is identical at every level (got ${JSON.stringify([...new Set(frozenTurns)])})`);
})();

// ================= (G) AudioSys.ctx null -> startGame()/update() no-crash smoke ======================
(function sectionG() {
  console.log("(G) AudioSys.ctx null: startGame()/update(1/60) x multi-wave no-crash smoke");
  const A = build();
  assert(A.AudioSys.ctx === null, "G: sanity — no AudioContext stub means AudioSys.ctx is null");
  let threw = null;
  try {
    A.startGame();
    for (let w = 0; w < 15; w++) {
      for (let i = 0; i < 60; i++) A.update(1 / 60);
      A.nextWave();
    }
  } catch (e) { threw = e; }
  assert(!threw, "G: startGame()/nextWave()/update() ran headless across 15 waves without throwing" + (threw ? ": " + threw : ""));
})();

console.log(`\ntest-cs017-p1: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
