// Headless test for CS012 Phase 1 — SAUCER_ACCURACY_RAMP_SCALE, the small-saucer aim-error knob
// (PLANNED-FEATURES-CS012.md FORK-CS012-A -> (a)). Only the wave ARGUMENT passed to the existing
// `ramp(SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL, wave)` call changed, to a scaled wave
// `1 + (game.wave - 1) * SAUCER_ACCURACY_RAMP_SCALE` — pinning the wave-1 floor exactly while making
// the small-saucer's aim sharpen more slowly than the global difficulty ramp.
//
//   node scratchpad/test-cs012-p1.js
//
// Standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL <script>
// block, and drive the ACTUAL Saucer.update() fire logic (never reimplement the aim-error formula).
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) Wave-1 identity: the ACTUAL fired-bullet aim error at game.wave = 1 equals the real `ramp`
//      function's pre-edit call shape (`ramp(FLOOR, CEIL, 1)`) byte-for-byte, since the scaled wave
//      collapses to exactly 1 there.
//  (C) Tighter-later: at wave 9 and wave 17, the ACTUAL scaled-wave err is LOOSER (larger) than the
//      old unscaled `ramp(FLOOR, CEIL, wave)` value at that same wave, and err is monotonically
//      non-increasing as wave climbs across a wider sample (1,5,9,13,17,25,50).
//  (D) Bounds: err never drops below SAUCER_AIM_ERR_CEIL nor rises above SAUCER_AIM_ERR_FLOOR, across
//      the same wave sample.
//  (E) AudioSys.ctx null: startGame()/update(1/60) must not crash.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const extractScript = html => {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Could not find <script> block");
  return m[1];
};
const currentSrc = extractScript(fs.readFileSync(htmlPath, "utf8"));

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function noThrow(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.message); } }

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs012p1_extracted.js");
  fs.writeFileSync(tmp, currentSrc);
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
  "game", "startGame", "update", "Saucer", "angleTo", "ramp",
  "SAUCER_AIM_ERR_FLOOR", "SAUCER_AIM_ERR_CEIL", "SAUCER_ACCURACY_RAMP_SCALE",
];

// AudioContext ctor omitted -> AudioSys.ctx stays null (the (E) case); Saucer/aim logic never
// touches audio, so no Web Audio mock is needed for this phase's test.
function buildInstance() {
  const windowStub = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    currentSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, makeLocalStorage());
}

// Fires one shot from a fresh small Saucer at the given game.wave and returns the ACTUAL aim error
// the real Saucer.update() applied, extracted from the fired bullet's angle — never a reimplementation
// of the formula under test. With Math.random forced to exactly 1, `rand(-err, err)` (= -err + 1*(2*err))
// collapses to exactly +err, so err = fired-angle - angleTo(saucer, ship), normalized to (-pi, pi].
function actualAimErr(inst, wave) {
  const { game, startGame, Saucer, angleTo } = inst;
  startGame();
  game.wave = wave;
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
  assert(game.bullets.length === 1, `actualAimErr(wave=${wave}): exactly one bullet fired`);
  const b = game.bullets[game.bullets.length - 1];
  const firedAngle = Math.atan2(b.vy, b.vx);
  const aimAngle = angleTo(s, game.ship);
  const diff = firedAngle - aimAngle;
  return Math.atan2(Math.sin(diff), Math.cos(diff)); // normalize to (-pi, pi]
}

// ================= (B) wave-1 identity =====================
(function () {
  console.log("(B) wave-1 identity: scaled wave collapses to exactly 1");
  const inst = buildInstance();
  const { ramp, SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL, SAUCER_ACCURACY_RAMP_SCALE } = inst;
  assert(SAUCER_ACCURACY_RAMP_SCALE < 1, "B: SAUCER_ACCURACY_RAMP_SCALE is < 1 (sharpens slower)");
  const scaledWave1 = 1 + (1 - 1) * SAUCER_ACCURACY_RAMP_SCALE;
  assert(scaledWave1 === 1, "B: scaled wave at game.wave=1 is exactly 1");
  const expected = ramp(SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL, 1);
  const actual = actualAimErr(inst, 1);
  assert(Math.abs(actual - expected) < 1e-9,
    `B: wave-1 actual err (${actual}) === pre-edit ramp(FLOOR,CEIL,1) (${expected})`);
})();

// ================= (C) tighter-later + monotonic =====================
(function () {
  console.log("(C) mid/late waves: new err looser than old unscaled err; monotonic tightening");
  const inst = buildInstance();
  const { ramp, SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL } = inst;
  for (const wave of [9, 17]) {
    const oldErr = ramp(SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL, wave);
    const newErr = actualAimErr(inst, wave);
    assert(newErr > oldErr,
      `C: wave ${wave} new err (${newErr}) looser (larger) than old unscaled err (${oldErr})`);
  }
  const waves = [1, 5, 9, 13, 17, 25, 50];
  const errs = waves.map(w => actualAimErr(inst, w));
  for (let i = 1; i < errs.length; i++) {
    assert(errs[i] <= errs[i - 1] + 1e-9,
      `C: err at wave ${waves[i]} (${errs[i]}) <= err at wave ${waves[i - 1]} (${errs[i - 1]}) (tightens or holds)`);
  }
})();

// ================= (D) bounds =====================
(function () {
  console.log("(D) bounds: SAUCER_AIM_ERR_CEIL <= err <= SAUCER_AIM_ERR_FLOOR");
  const inst = buildInstance();
  const { SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL } = inst;
  for (const wave of [1, 2, 5, 9, 13, 17, 25, 50, 200]) {
    const err = actualAimErr(inst, wave);
    assert(err <= SAUCER_AIM_ERR_FLOOR + 1e-9, `D: wave ${wave} err (${err}) <= FLOOR (${SAUCER_AIM_ERR_FLOOR})`);
    assert(err >= SAUCER_AIM_ERR_CEIL - 1e-9, `D: wave ${wave} err (${err}) >= CEIL (${SAUCER_AIM_ERR_CEIL})`);
  }
})();

// ================= (E) ctx null: no crash =====================
(function () {
  console.log("(E) AudioSys.ctx null: startGame()/update(1/60) don't crash");
  const inst = buildInstance();
  noThrow(() => inst.startGame(), "E: startGame() with ctx null");
  noThrow(() => inst.update(1 / 60), "E: update(1/60) with ctx null");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
