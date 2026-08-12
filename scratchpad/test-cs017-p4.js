// Headless test originally written for CS017 Phase 4 — the time-in-level saucer pressure axis
// (FORK-CS017-B -> (b) COMPOSE): wavePressure() = min(1, game.waveTime / DEBUG.saucerPressureSecs) tightened
// the spawn-gap and aim-error levers on top of their wave-based opening values.
//
// **REPOINTED BY CS018 P6 THEN P7 — THE WHOLE AXIS IS GONE.** P6 retired the GAP half (the spawn gap moved
// onto the UFO MOVEMENT appearance-frequency TIER + jitteredInterval() and stopped reading game.waveTime).
// P7 retired what was left: the AIM half moved onto the UFO WEAPONS accuracy TIER + ufoAccuracyRad(), and
// wavePressure() itself — along with DEBUG.saucerAimPressure, DEBUG.saucerPressureSecs and the whole
// "SAUCER PRESSURE" DEBUG_VARS header — is deleted outright (not merely retired-in-place; the phase prompt
// asked for the function to be removed once both consumers were gone). Rather than delete this file's
// coverage a second time, every section is now the mirror image of what it used to assert, at the same
// strength and against the same real code:
//   (sanity) was "the two surviving pressure knobs exist with these values, saucerGapPressure is gone"
//       -> ALL THREE pressure knobs and their header are gone; wavePressure is not even a live identifier.
//   (B) was "at waveTime=0, aim error is byte-identical to the pre-P4 wave-only formula" (+ a P6 gap CONTROL)
//       -> aim error is now waveTime-INVARIANT at every level sampled — the CONTROL that used to cover only
//          the gap now covers both levers, because neither reads game.waveTime any more.
//   (C) was "aim error tightens monotonically as waveTime grows; the gap CONTROL does not move at all"
//       -> NEITHER lever moves at all as waveTime grows from 0 to 1e7 — mirror image, both levers now.
//   (D)/(E) were "saucerAimPressure forced to 1 saturates aim error at CEIL" / "forced to 0 reproduces the
//       pre-P4 formula" — the knob that made those true doesn't exist. Replaced by ONE new section proving
//       where the axis actually lives now: aim error steps with LEVEL at the TIER_STEPS.ufoAccuracy
//       breakpoints (1/13/34), matching the UFO WEAPONS tier, not any time-in-level clock.
//   (F) was "nextWave() resets waveTime, which resets the pressure to the level-opening value"
//       -> nextWave() still resets waveTime (unrelated regression, unchanged code) but resetting it no
//          longer moves the aim error at all, since the error doesn't read waveTime any more.
//   (G) was "the real fired-bullet aim error under nonzero pressure matches the full P4 formula"
//       -> the real fired-bullet aim error matches the tier-derived ufoAccuracyRad() formula instead,
//          extracted from an actual shot exactly as before, never recomputed independently.
// (A) syntax and (H) the headless smoke are unchanged claims, run against the current code.
//
//   node scratchpad/test-cs017-p4.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL Saucer/update()/nextWave() — never reimplement the formulas.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "orbital-overhaul.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
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
  // CS024 P4: levelDef dropped — the level table and all 21 tier knobs are deleted (spec §1.6).
  "game", "startGame", "nextWave", "update", "Saucer", "angleTo", "ufoAccuracyRad",
  "ufoAccuracyRad", "DEBUG", "DEBUG_VARS", "applyDebug", "AudioSys", "leverState",
  'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }',
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

// Forces the real saucer-spawn branch in update() to fire once and returns the sampled saucerTimer via a
// deterministic pass (Math.random pinned to randomVal) — never a reimplementation of the spawn-gap formula.
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

// ================= (sanity) the whole pressure axis — knobs, header, and the function itself — is gone ====
(function sectionSanity() {
  console.log("(sanity) DEBUG_VARS: all three pressure knobs + their header are gone; wavePressure is not a live identifier (CS018 P7)");
  const inst = buildInstance();
  const { DEBUG_VARS, DEBUG, probe } = inst;
  for (const id of ["saucerGapPressure", "saucerPressureSecs", "saucerAimPressure"]) {
    assert(!DEBUG_VARS.some(v => v.id === id), `sanity: DEBUG_VARS has no ${id} entry`);
    assert(!(id in DEBUG), `sanity: DEBUG.${id} does not exist`);
  }
  assert(!DEBUG_VARS.some(v => v.header === "SAUCER PRESSURE"), "sanity: the SAUCER PRESSURE header is gone");
  assert(probe("typeof wavePressure") === "undefined", "sanity: wavePressure is not defined anywhere in scope");
})();

// ================= (B) both levers are now waveTime-INVARIANT =====================
(function sectionB() {
  console.log("(B) aim error AND spawn gap are both waveTime-invariant now — neither lever reads game.waveTime any more");
  const inst = buildInstance();
  for (const wave of [1, 5, 9, 17, 25]) {
    const errAt0 = actualAimErr(inst, wave, 0);
    const errAt90 = actualAimErr(inst, wave, 90);
    assert(near(errAt0, errAt90, 1e-9),
      `B: wave ${wave} aim error at waveTime=0 (${errAt0}) === at waveTime=90 (${errAt90}) — no longer time-driven`);

    const gapAt0Min = actualGap(inst, wave, 0, 0), gapAt0Max = actualGap(inst, wave, 0, 1);
    const gapAt90Min = actualGap(inst, wave, 90, 0), gapAt90Max = actualGap(inst, wave, 90, 1);
    assert(near(gapAt0Min, gapAt90Min, 1e-9), `B: wave ${wave} gapMin at waveTime=0 === at waveTime=90 (CS018 P6, regression control)`);
    assert(near(gapAt0Max, gapAt90Max, 1e-9), `B: wave ${wave} gapMax at waveTime=0 === at waveTime=90 (CS018 P6, regression control)`);
  }
})();

// ================= (C) neither lever moves even at an extreme waveTime =====================
(function sectionC() {
  console.log("(C) neither aim error nor the spawn gap moves at all as waveTime grows toward extremes");
  const inst = buildInstance();
  const waveTimes = [0, 15, 30, 45, 60, 75, 90, 120, 150, 1e7];
  for (const wave of [1, 15]) {
    const errs = waveTimes.map(wt => actualAimErr(inst, wave, wt));
    for (let i = 1; i < errs.length; i++) {
      assert(near(errs[i], errs[0], 1e-9),
        `C: wave ${wave} aim error at wt=${waveTimes[i]} (${errs[i]}) === at wt=0 (${errs[0]}) — waveTime-independent`);
    }
    const gapMins = waveTimes.map(wt => actualGap(inst, wave, wt, 0));
    for (let i = 1; i < gapMins.length; i++) {
      assert(near(gapMins[i], gapMins[0], 1e-9),
        `C: wave ${wave} gapMin at wt=${waveTimes[i]} (${gapMins[i]}) === at wt=0 (${gapMins[0]}) — waveTime-independent (CS018 P6)`);
    }
  }
})();

// ================= (D) aim error follows the ONE live helper, at every level ============================
// REPOINTED BY CS024 P4, THEN AGAIN BY CS024 P5. This section's subject is CS017 P4's retired time-in-level
// pressure axis, and its job is to prove aim error does NOT track waveTime — that half is unchanged below.
// P4 additionally froze the level axis itself (the tiers and their nine knobs were deleted, spec §1.6, and
// nothing wave-driven fed the quantity for that one phase, so it read flat everywhere). P5 wires the
// ufoAccuracySmall LEVER at the point of use (spec §2.4/§4.6): aim error is "exactly what ufoAccuracyRad()
// says, at every level, with a nonzero waveTime" (unchanged — still checked off a REAL fired bullet), but
// ufoAccuracyRad() itself now genuinely varies by level (leverState(w).ufoAccuracySmall, INVERTED, floor
// 30deg -> ceil 8deg), so the former "FLAT across every probed level" claim inverts to "tracks the lever,
// level by level" instead. The mirror-image control that a nonzero waveTime changes nothing is untouched
// below in (E)/(F).
(function sectionD() {
  console.log("(D) aim error is exactly ufoAccuracyRad() at every level, with waveTime deliberately nonzero");
  const inst = buildInstance();
  const { DEBUG, ufoAccuracyRad, leverState, game } = inst;
  // The nine UFO WEAPONS tier knobs are gone; nothing here can be reading one by accident.
  for (const id of ["ufoAccuracyLow", "ufoAccuracyNormal", "ufoAccuracyHigh"])
    assert(!(id in DEBUG), `D: DEBUG.${id} is gone with the 21 tier knobs (CS024 P4)`);
  const levels = [1, 12, 13, 33, 34, 63];
  const errs = [];
  for (const level of levels) {
    game.wave = level;
    const expectedRad = ufoAccuracyRad();
    const actualErr = actualAimErr(inst, level, 999); // waveTime is irrelevant — a nonzero value proves it
    assert(near(actualErr, expectedRad, 1e-6),
      `D: level ${level} real fired aim error (${actualErr}) === ufoAccuracyRad() (${expectedRad})`);
    errs.push(actualErr);
  }
  // REPOINTED BY CS024 P5: no longer FROZEN — err now tracks leverState(level).ufoAccuracySmall exactly,
  // level by level, off the SAME real fired-bullet reading captured above.
  for (let i = 0; i < levels.length; i++) {
    const expected = leverState(levels[i]).ufoAccuracySmall * Math.PI / 180;
    assert(near(errs[i], expected, 1e-6),
      `D: level ${levels[i]} err (${errs[i]}) === leverState(${levels[i]}).ufoAccuracySmall in radians (${expected})`);
  }
  // And it genuinely moves across the sweep — level 1 sits at the lever's floor (30deg), level 63 is well
  // past the lever's 4-step span and sits at (or past) its ceiling (8deg); the two must differ.
  assert(errs[levels.length - 1] < errs[0] - 1e-9,
    `D: level ${levels[levels.length - 1]} err (${errs[levels.length - 1]}) < level 1 err (${errs[0]}) — the lever genuinely moved (TRAP 2: P5 wires the lever)`);
})();

// ================= (F) nextWave() still resets waveTime, but it no longer affects the aim error =====
(function sectionF() {
  console.log("(F) nextWave() resets game.waveTime to 0 (unchanged regression); aim error is unaffected either way");
  const inst = buildInstance();
  const { game, startGame, nextWave, update } = inst;
  startGame();
  const openingErr = actualAimErr(inst, game.wave, 0);

  // Drive waveTime up under the real update() loop (playing, unpaused).
  game.state = "playing"; game.paused = false;
  for (let i = 0; i < 600; i++) update(1 / 10); // 60s of accumulated waveTime
  assert(game.waveTime > 50, `F: sanity — game.waveTime accumulated under update() (got ${game.waveTime})`);
  const midRunErr = actualAimErr(inst, game.wave, game.waveTime);
  assert(near(midRunErr, openingErr, 1e-9), "F: aim error mid-run (large waveTime) === the level-opening value — unaffected by accumulation");

  nextWave();
  assert(game.waveTime === 0, `F: nextWave() still resets game.waveTime to 0 (got ${game.waveTime})`);
  const resetErr = actualAimErr(inst, game.wave, game.waveTime);
  const expectedErr = actualAimErr(inst, game.wave, 12345); // same level, an arbitrary nonzero waveTime
  assert(near(resetErr, expectedErr, 1e-9), "F: post-reset aim error === the same level's error at any other waveTime — the reset itself no longer matters to this lever");
})();

// ================= (G) real fired-bullet aim error matches the tier-derived formula, extracted not recomputed ===
(function sectionG() {
  console.log("(G) real fired-bullet aim error matches ufoAccuracyRad() exactly, extracted from an actual shot");
  const inst = buildInstance();
  const { ufoAccuracyRad, game } = inst;
  for (const wave of [1, 13, 34, 50]) {
    const fired = actualAimErr(inst, wave, 45); // the REAL Saucer.update() shot, via angleTo
    game.wave = wave; // ufoAccuracyRad() reads game.wave directly
    const expected = ufoAccuracyRad();
    assert(near(fired, expected, 1e-6),
      `G: wave ${wave} real fired-bullet aim error (${fired}) === ufoAccuracyRad() (${expected})`);
  }
})();

// ================= (H) AudioSys.ctx null: no crash across waves =====================
(function sectionH() {
  console.log("(H) AudioSys.ctx null: startGame()/update()/nextWave() across many waves don't crash");
  const inst = buildInstance();
  const { AudioSys, startGame, update, nextWave, game } = inst;
  assert(AudioSys.ctx === null, "H: sanity — no AudioContext stub means AudioSys.ctx is null");
  let threw = null;
  try {
    startGame();
    game.state = "playing"; game.paused = false;
    for (let w = 0; w < 10; w++) {
      for (let i = 0; i < 120; i++) update(1 / 60); // 2 minutes/wave
      nextWave();
    }
  } catch (e) { threw = e; }
  assert(!threw, "H: startGame()/update()/nextWave() ran headless across 10 waves without throwing" + (threw ? ": " + threw : ""));
})();

console.log(`\ntest-cs017-p4: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
