// Headless test for CS017 Phase 4 — the time-in-level saucer pressure axis (FORK-CS017-B -> (b)
// COMPOSE). The wave-based ramp() value is now the level's OPENING value (t=0); wavePressure() =
// min(1, game.waveTime / DEBUG.saucerPressureSecs) then tightens aim error toward SAUCER_AIM_ERR_CEIL
// and shortens the spawn gap toward each bound's own _CEIL, scaled by DEBUG.saucerAimPressure /
// DEBUG.saucerGapPressure. Both dev-tunable levers live in DEBUG_VARS; setting either to 0 must
// reproduce pre-P4 behaviour at ANY waveTime (the composition property holds at every game.waveTime,
// not just 0, once the scale is zeroed).
//
//   node scratchpad/test-cs017-p4.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL Saucer/update()/nextWave() — never reimplement the formulas.
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) game.waveTime === 0: aim error and BOTH gap bounds are byte-identical to the pre-P4 wave-only
//      formula, at several waves (the composition property — a level opens exactly as it does today).
//  (C) as waveTime grows from 0 toward saucerPressureSecs, aim error tightens (decreases) and both
//      gap bounds shorten (decrease), monotonically.
//  (D) with each pressure scale pushed to its max (1), the value saturates at EXACTLY its _CEIL once
//      waveTime >= saucerPressureSecs, and never overshoots past it for waveTime far beyond that.
//  (E) with saucerAimPressure/saucerGapPressure forced to 0, the pre-P4 formula holds at EVERY
//      waveTime sampled (0, 10, 45, 90, 500) — the knobs genuinely disable the axis.
//  (F) nextWave() resets game.waveTime to 0, which resets the pressure back to the level-opening value.
//  (G) the fired-bullet aim error under nonzero pressure is read off a REAL Saucer shot via the real
//      angleTo (the test-cs012-p1.js idiom), compared against the full P4 formula — never recomputed
//      independently of what actualAimErr() extracts.
//  (H) AudioSys.ctx null smoke across several waves and pressure levels.

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
function noThrow(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.message); } }
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs017p4_extracted.js");
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

const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => new Proxy({}, { get: () => () => {} }) };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
function makeLocalStorage() {
  const store = {};
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
}

const RETURN = [
  "game", "startGame", "nextWave", "update", "Saucer", "angleTo", "ramp", "wavePressure",
  "DEBUG", "DEBUG_VARS", "applyDebug", "AudioSys",
  "SAUCER_AIM_ERR_FLOOR", "SAUCER_AIM_ERR_CEIL", "SAUCER_ACCURACY_RAMP_SCALE",
  "SAUCER_GAP_FLOOR_MIN", "SAUCER_GAP_FLOOR_MAX", "SAUCER_GAP_CEIL_MIN", "SAUCER_GAP_CEIL_MAX",
];

// AudioContext ctor omitted -> AudioSys.ctx stays null (the (H) case).
function buildInstance() {
  const windowStub = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, makeLocalStorage());
}

// Fires one shot from a fresh small Saucer at game.wave/game.waveTime and returns the ACTUAL aim error
// the real Saucer.update() applied, extracted from the fired bullet's angle — the test-cs012-p1.js
// idiom, never a reimplementation of the aim-error formula. Math.random pinned to 1 collapses
// rand(-err, err) to exactly +err.
function actualAimErr(inst, wave, waveTime) {
  const { game, startGame, Saucer, angleTo } = inst;
  startGame();
  game.wave = wave;
  game.waveTime = waveTime;
  game.ship.dead = false;
  const s = new Saucer(true); // small saucer: the only branch that aims
  s.fireTimer = 0; // force an immediate shot on the next update
  game.bullets.length = 0;
  const savedRandom = Math.random;
  Math.random = () => 1; // deterministic: pins rand(-err,err) to exactly +err
  try {
    s.update(1 / 60);
  } finally {
    Math.random = savedRandom;
  }
  assert(game.bullets.length === 1, `actualAimErr(wave=${wave},wt=${waveTime}): exactly one bullet fired`);
  const b = game.bullets[game.bullets.length - 1];
  const firedAngle = Math.atan2(b.vy, b.vx);
  const aimAngle = angleTo(s, game.ship);
  const diff = firedAngle - aimAngle;
  return Math.atan2(Math.sin(diff), Math.cos(diff)); // normalize to (-pi, pi]
}

// Forces the real saucer-spawn branch in update() to fire once and returns { gapMin, gapMax } via two
// separate deterministic passes (Math.random pinned to 0 collapses rand(gapMin,gapMax) to gapMin; 1
// collapses it to gapMax) — never a reimplementation of the ramp()+pressure composition.
function actualGap(inst, wave, waveTime, randomVal) {
  const { game, startGame, update } = inst;
  startGame();
  game.wave = wave;
  game.waveTime = waveTime;
  game.saucers = [];
  game.saucerTimer = -1; // force the spawn branch on the next update
  const savedRandom = Math.random;
  Math.random = () => randomVal;
  try {
    update(0); // dt=0: isolates the spawn-timer branch, no other accumulator advances
  } finally {
    Math.random = savedRandom;
  }
  assert(game.saucers.length === 1, `actualGap(wave=${wave},wt=${waveTime},r=${randomVal}): exactly one saucer spawned`);
  return game.saucerTimer;
}

// Pre-P4 formulas (the level's opening value, unchanged since CS012 P1 / the original F10 build).
function preP4Err(inst, wave) {
  const { ramp, SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL, SAUCER_ACCURACY_RAMP_SCALE } = inst;
  return ramp(SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL, 1 + (wave - 1) * SAUCER_ACCURACY_RAMP_SCALE);
}
function preP4GapMin(inst, wave) {
  const { ramp, SAUCER_GAP_FLOOR_MIN, SAUCER_GAP_CEIL_MIN } = inst;
  return ramp(SAUCER_GAP_FLOOR_MIN, SAUCER_GAP_CEIL_MIN, wave);
}
function preP4GapMax(inst, wave) {
  const { ramp, SAUCER_GAP_FLOOR_MAX, SAUCER_GAP_CEIL_MAX } = inst;
  return ramp(SAUCER_GAP_FLOOR_MAX, SAUCER_GAP_CEIL_MAX, wave);
}

// ================= sanity: the three new DEBUG_VARS entries =====================
(function sectionSanity() {
  console.log("(sanity) DEBUG_VARS registry: three new entries, correct shape and defaults");
  const inst = buildInstance();
  const { DEBUG_VARS, DEBUG } = inst;
  const byId = id => DEBUG_VARS.find(v => v.id === id);
  const secs = byId("saucerPressureSecs");
  assert(!!secs, "sanity: saucerPressureSecs entry exists");
  assert(secs.def === 90 && secs.min === 10 && secs.max === 300 && secs.step === 5,
    "sanity: saucerPressureSecs def/min/max/step match the spec");
  const aimP = byId("saucerAimPressure");
  assert(!!aimP && aimP.def === 0.5 && aimP.min === 0 && aimP.max === 1 && aimP.step === 0.05,
    "sanity: saucerAimPressure def/min/max/step match the spec");
  const gapP = byId("saucerGapPressure");
  assert(!!gapP && gapP.def === 0.5 && gapP.min === 0 && gapP.max === 1 && gapP.step === 0.05,
    "sanity: saucerGapPressure def/min/max/step match the spec");
  assert(DEBUG.saucerPressureSecs === 90 && DEBUG.saucerAimPressure === 0.5 && DEBUG.saucerGapPressure === 0.5,
    "sanity: DEBUG seeds from the registry defaults on load");
})();

// ================= (B) waveTime === 0: byte-identical to the pre-P4 formula =====================
(function sectionB() {
  console.log("(B) game.waveTime === 0: aim error + both gap bounds are byte-identical to the pre-P4 formula");
  const inst = buildInstance();
  for (const wave of [1, 5, 9, 17, 25]) {
    const expectedErr = preP4Err(inst, wave);
    const actualErr = actualAimErr(inst, wave, 0);
    assert(near(actualErr, expectedErr, 1e-9),
      `B: wave ${wave} waveTime=0 aim error ${actualErr} === pre-P4 ${expectedErr}`);

    const expectedGapMin = preP4GapMin(inst, wave);
    const actualGapMin = actualGap(inst, wave, 0, 0);
    assert(near(actualGapMin, expectedGapMin, 1e-9),
      `B: wave ${wave} waveTime=0 gapMin ${actualGapMin} === pre-P4 ${expectedGapMin}`);

    const expectedGapMax = preP4GapMax(inst, wave);
    const actualGapMax = actualGap(inst, wave, 0, 1);
    assert(near(actualGapMax, expectedGapMax, 1e-9),
      `B: wave ${wave} waveTime=0 gapMax ${actualGapMax} === pre-P4 ${expectedGapMax}`);
  }
})();

// ================= (C) monotonic tightening/shortening as waveTime grows =====================
(function sectionC() {
  console.log("(C) as waveTime grows, aim error tightens and both gap bounds shorten, monotonically");
  const inst = buildInstance();
  const waveTimes = [0, 15, 30, 45, 60, 75, 90, 120, 150];
  for (const wave of [1, 15]) {
    const errs = waveTimes.map(wt => actualAimErr(inst, wave, wt));
    for (let i = 1; i < errs.length; i++) {
      assert(errs[i] <= errs[i - 1] + 1e-9,
        `C: wave ${wave} aim error at wt=${waveTimes[i]} (${errs[i].toFixed(5)}) <= at wt=${waveTimes[i - 1]} (${errs[i - 1].toFixed(5)})`);
    }
    assert(errs[errs.length - 1] < errs[0] - 1e-6, `C: wave ${wave} aim error strictly tightened somewhere across the sample`);

    const gapMins = waveTimes.map(wt => actualGap(inst, wave, wt, 0));
    const gapMaxs = waveTimes.map(wt => actualGap(inst, wave, wt, 1));
    for (let i = 1; i < gapMins.length; i++) {
      assert(gapMins[i] <= gapMins[i - 1] + 1e-9,
        `C: wave ${wave} gapMin at wt=${waveTimes[i]} (${gapMins[i].toFixed(5)}) <= at wt=${waveTimes[i - 1]} (${gapMins[i - 1].toFixed(5)})`);
      assert(gapMaxs[i] <= gapMaxs[i - 1] + 1e-9,
        `C: wave ${wave} gapMax at wt=${waveTimes[i]} (${gapMaxs[i].toFixed(5)}) <= at wt=${waveTimes[i - 1]} (${gapMaxs[i - 1].toFixed(5)})`);
    }
    assert(gapMins[gapMins.length - 1] < gapMins[0] - 1e-6, `C: wave ${wave} gapMin strictly shortened somewhere across the sample`);
    assert(gapMaxs[gapMaxs.length - 1] < gapMaxs[0] - 1e-6, `C: wave ${wave} gapMax strictly shortened somewhere across the sample`);
  }
})();

// ================= (D) saturation at max pressure scale: exactly _CEIL, never overshoots =====================
(function sectionD() {
  console.log("(D) with pressure scale forced to 1, saturates at EXACTLY the _CEIL once waveTime >= saucerPressureSecs");
  const inst = buildInstance();
  const { applyDebug, SAUCER_AIM_ERR_CEIL, SAUCER_GAP_CEIL_MIN, SAUCER_GAP_CEIL_MAX } = inst;
  applyDebug("saucerAimPressure", 1);
  applyDebug("saucerGapPressure", 1);
  for (const wave of [1, 9, 25]) {
    for (const wt of [90, 91, 150, 1000, 50000]) {
      const err = actualAimErr(inst, wave, wt);
      assert(near(err, SAUCER_AIM_ERR_CEIL, 1e-6),
        `D: wave ${wave} wt=${wt} aim error (${err}) === SAUCER_AIM_ERR_CEIL (${SAUCER_AIM_ERR_CEIL}) at max pressure scale`);
      const gapMin = actualGap(inst, wave, wt, 0);
      assert(near(gapMin, SAUCER_GAP_CEIL_MIN, 1e-6),
        `D: wave ${wave} wt=${wt} gapMin (${gapMin}) === SAUCER_GAP_CEIL_MIN (${SAUCER_GAP_CEIL_MIN}) at max pressure scale`);
      const gapMax = actualGap(inst, wave, wt, 1);
      assert(near(gapMax, SAUCER_GAP_CEIL_MAX, 1e-6),
        `D: wave ${wave} wt=${wt} gapMax (${gapMax}) === SAUCER_GAP_CEIL_MAX (${SAUCER_GAP_CEIL_MAX}) at max pressure scale`);
    }
  }
  // Never overshoots past _CEIL even at the default (0.5) scale across a huge waveTime.
  applyDebug("saucerAimPressure", 0.5);
  applyDebug("saucerGapPressure", 0.5);
  for (const wave of [1, 25]) {
    const err = actualAimErr(inst, wave, 1e7);
    assert(err >= SAUCER_AIM_ERR_CEIL - 1e-6, `D: wave ${wave} default-scale aim error (${err}) never overshoots past CEIL (${SAUCER_AIM_ERR_CEIL})`);
    const gapMin = actualGap(inst, wave, 1e7, 0);
    assert(gapMin >= SAUCER_GAP_CEIL_MIN - 1e-6, `D: wave ${wave} default-scale gapMin (${gapMin}) never overshoots past CEIL (${SAUCER_GAP_CEIL_MIN})`);
    const gapMax = actualGap(inst, wave, 1e7, 1);
    assert(gapMax >= SAUCER_GAP_CEIL_MAX - 1e-6, `D: wave ${wave} default-scale gapMax (${gapMax}) never overshoots past CEIL (${SAUCER_GAP_CEIL_MAX})`);
  }
})();

// ================= (E) pressure scale === 0 reproduces pre-P4 behaviour at ALL waveTime =====================
(function sectionE() {
  console.log("(E) with saucerAimPressure/saucerGapPressure forced to 0, the pre-P4 formula holds at EVERY waveTime");
  const inst = buildInstance();
  const { applyDebug } = inst;
  applyDebug("saucerAimPressure", 0);
  applyDebug("saucerGapPressure", 0);
  for (const wave of [1, 9, 25]) {
    for (const wt of [0, 10, 45, 90, 500]) {
      const expectedErr = preP4Err(inst, wave);
      const actualErr = actualAimErr(inst, wave, wt);
      assert(near(actualErr, expectedErr, 1e-9),
        `E: wave ${wave} wt=${wt} aim error (${actualErr}) === pre-P4 (${expectedErr}) with the knob at 0`);

      const expectedGapMin = preP4GapMin(inst, wave);
      const actualGapMin = actualGap(inst, wave, wt, 0);
      assert(near(actualGapMin, expectedGapMin, 1e-9),
        `E: wave ${wave} wt=${wt} gapMin (${actualGapMin}) === pre-P4 (${expectedGapMin}) with the knob at 0`);

      const expectedGapMax = preP4GapMax(inst, wave);
      const actualGapMax = actualGap(inst, wave, wt, 1);
      assert(near(actualGapMax, expectedGapMax, 1e-9),
        `E: wave ${wave} wt=${wt} gapMax (${actualGapMax}) === pre-P4 (${expectedGapMax}) with the knob at 0`);
    }
  }
})();

// ================= (F) nextWave() resets the pressure by resetting waveTime =====================
(function sectionF() {
  console.log("(F) nextWave() resets game.waveTime to 0, reverting the pressure to the level-opening value");
  const inst = buildInstance();
  const { game, startGame, nextWave, update } = inst;
  startGame();
  const openingErr = actualAimErr(inst, game.wave, 0);

  // Drive waveTime up under the real update() loop (playing, unpaused).
  game.state = "playing"; game.paused = false;
  for (let i = 0; i < 600; i++) update(1 / 10); // 60s of accumulated waveTime
  assert(game.waveTime > 50, `F: sanity — game.waveTime accumulated under update() (got ${game.waveTime})`);
  const pressuredErr = actualAimErr(inst, game.wave, game.waveTime);
  assert(pressuredErr < openingErr - 1e-6, "F: sanity — pressure actually tightened the aim error before the reset");

  nextWave();
  assert(game.waveTime === 0, `F: nextWave() resets game.waveTime to 0 (got ${game.waveTime})`);
  const resetErr = actualAimErr(inst, game.wave, game.waveTime);
  const expectedOpeningErr = preP4Err(inst, game.wave);
  assert(near(resetErr, expectedOpeningErr, 1e-9),
    `F: immediately after nextWave(), aim error (${resetErr}) === the new level's opening value (${expectedOpeningErr})`);
})();

// ================= (G) real fired-bullet aim error under nonzero pressure, via the real angleTo =====
(function sectionG() {
  console.log("(G) real fired-bullet aim error under nonzero pressure matches the full P4 formula, extracted (not recomputed)");
  const inst = buildInstance();
  const { ramp, SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL, SAUCER_ACCURACY_RAMP_SCALE, DEBUG } = inst;
  const wave = 10, waveTime = 45;
  const fired = actualAimErr(inst, wave, waveTime); // the REAL Saucer.update() shot, via angleTo
  const base = ramp(SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL, 1 + (wave - 1) * SAUCER_ACCURACY_RAMP_SCALE);
  const pressure = Math.min(1, waveTime / DEBUG.saucerPressureSecs);
  const expected = base + (SAUCER_AIM_ERR_CEIL - base) * pressure * DEBUG.saucerAimPressure;
  assert(near(fired, expected, 1e-6),
    `G: real fired-bullet aim error (${fired}) === full P4 formula (${expected}) at wave ${wave}, waveTime ${waveTime}`);
  assert(fired < base - 1e-6, "G: the nonzero-pressure fired error is tighter than the level's opening (t=0) value");
})();

// ================= (H) AudioSys.ctx null: no crash across waves + pressure levels =====================
(function sectionH() {
  console.log("(H) AudioSys.ctx null: startGame()/update()/nextWave() across waves and pressure levels don't crash");
  const inst = buildInstance();
  const { AudioSys, startGame, update, nextWave, game, applyDebug } = inst;
  assert(AudioSys.ctx === null, "H: sanity — no AudioContext stub means AudioSys.ctx is null");
  applyDebug("saucerAimPressure", 1);
  applyDebug("saucerGapPressure", 1);
  let threw = null;
  try {
    startGame();
    game.state = "playing"; game.paused = false;
    for (let w = 0; w < 10; w++) {
      for (let i = 0; i < 120; i++) update(1 / 60); // 2 minutes/wave -> well past saucerPressureSecs
      nextWave();
    }
  } catch (e) { threw = e; }
  assert(!threw, "H: startGame()/update()/nextWave() ran headless across 10 waves at max pressure without throwing" + (threw ? ": " + threw : ""));
})();

console.log(`\ntest-cs017-p4: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
