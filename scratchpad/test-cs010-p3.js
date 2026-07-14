// Headless test for CS010 Phase 3 — the low-health corner glow, the lowhpPulseRate() shared rate
// helper, the game.lowHpPhase pulse accumulator, and the relief-exhale flash.
//
//   node scratchpad/test-cs010-p3.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL functions (update/drawHUD/startGame/killShip/openPause/…) —
// never reimplement game logic. Sections:
//  (A) node --check on the extracted <script>.
//  (B) lowhpPulseRate(): (0) === MIN, (1) === MAX, and it is exactly what the phase accumulator uses.
//  (C) game.lowHpPhase: advances monotonically (mod TAU, by the expected 2π·rate·dt) while engaged;
//      is 0 after startGame(); resets to 0 on the falling-edge disengage.
//  (D) drawHUD() renders WITHOUT THROWING when AudioSys.ctx is null (the whole point of the game-side
//      phase — audio may be unavailable), with the glow engaged and disengaged, and NEVER leaks
//      globalAlpha (== 1 after it returns).
//  (E) relief flash: healing back above the threshold arms it EXACTLY ONCE and it decays to 0 over
//      LOWHP_RELIEF_FLASH; DYING below the threshold arms it ZERO times (killShip drive + the explicit
//      guard); pausing below the threshold and resuming arms it ZERO times; startGame() zeroes it.

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

// ---- canvas ctx stub. Unlike the P1/P2 no-op Proxy, this one (1) returns a real gradient object from
// createRadialGradient (so drawHUD's glow can call .addColorStop) and (2) TRACKS globalAlpha through a
// set trap so we can assert it's restored to 1. Everything else no-ops. ----
function makeDrawCtx() {
  const store = { globalAlpha: 1 };
  const gradient = { addColorStop() {} };
  return new Proxy(store, {
    get(t, p) {
      if (p === "createRadialGradient" || p === "createLinearGradient") return () => gradient;
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}
const drawCtx = makeDrawCtx();
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => drawCtx };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };

// AudioContext stub is available on window, but nothing in this test calls AudioSys.init(), so
// AudioSys.ctx stays null — exactly the "audio unavailable" state the glow must render through.
function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} },
    Q: { value: 0 }, type: "sine", buffer: null, loop: false, playbackRate: { value: 1 },
    connect() { return makeAudioNode(); }, start() {}, stop() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
function FakeAudioContext() {
  return new Proxy({
    state: "running", currentTime: 0, sampleRate: 44100, destination: makeAudioNode(),
    createGain() { return makeAudioNode(); },
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; }
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}

const RETURN = ["lowhpPulseRate", "game", "startGame", "update", "drawHUD", "openPause", "closePause",
  "killShip", "AudioSys", "LOWHP_PULSE_RATE_MIN", "LOWHP_PULSE_RATE_MAX", "LOWHP_RELIEF_FLASH",
  "LOW_HP_THRESHOLD", "SHIP_MAX_HP", "TAU"];

function buildInstance(lsStore) {
  lsStore = lsStore || {};
  const listeners = {};
  const windowStub = {
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    innerWidth: 1280, innerHeight: 720, AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext
  };
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    currentSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, localStorageStub);
}

// Put the instance in a controlled live-play state at a chosen HP, with no hazards to perturb HP.
function prepPlaying(inst, hp) {
  inst.startGame();
  inst.game.state = "playing"; inst.game.paused = false;
  for (const arr of ["debris", "hunters", "saucers", "garbage", "bullets", "powerups", "floaters"]) {
    if (inst.game[arr]) inst.game[arr].length = 0;
  }
  Object.assign(inst.game.ship, { dead: false, x: inst.game.ship.x, y: inst.game.ship.y, vx: 0, vy: 0 });
  inst.game.ship.hp = hp;
}

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(require("os").tmpdir(), "cs010-p3-extracted.js");
  fs.writeFileSync(tmp, currentSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: syntax: " + e.stderr.toString()); }
})();

// ================= (B) lowhpPulseRate() shared helper =====================
(function () {
  console.log("(B) lowhpPulseRate() endpoints + it is the accumulator's rate");
  const A = buildInstance();
  assert(A.lowhpPulseRate(0) === A.LOWHP_PULSE_RATE_MIN, `lowhpPulseRate(0) === MIN (${A.LOWHP_PULSE_RATE_MIN}); got ${A.lowhpPulseRate(0)}`);
  assert(A.lowhpPulseRate(1) === A.LOWHP_PULSE_RATE_MAX, `lowhpPulseRate(1) === MAX (${A.LOWHP_PULSE_RATE_MAX}); got ${A.lowhpPulseRate(1)}`);
  // monotone increasing across the range (a sanity check on the interpolation direction)
  assert(A.lowhpPulseRate(0.25) < A.lowhpPulseRate(0.75), "lowhpPulseRate rises with t");
})();

// ================= (C) game.lowHpPhase accumulator =====================
(function () {
  console.log("(C) game.lowHpPhase: 0 after startGame, advances monotonically (mod TAU) while engaged, resets on disengage");
  const A = buildInstance();
  A.startGame();
  assert(A.game.lowHpPhase === 0, `startGame() zeroes lowHpPhase; got ${A.game.lowHpPhase}`);

  // Engage at a FIXED hp so t is known and the per-frame increment is deterministic. Hold hp each frame
  // (hazards cleared, so nothing else moves it) and confirm each step is exactly 2π·rate·dt, mod TAU.
  const dt = 1 / 60, hp = 50, TAU = A.TAU;
  const t = 1 - hp / A.LOW_HP_THRESHOLD;
  const expectedStep = TAU * A.lowhpPulseRate(t) * dt;
  prepPlaying(A, hp);
  let prev = A.game.lowHpPhase, monotone = true, stepsOK = true, inRange = true;
  for (let fr = 0; fr < 200; fr++) {
    A.game.ship.hp = hp;                 // hold hp fixed → known t every frame
    for (const arr of ["debris", "hunters", "saucers", "garbage", "powerups"]) if (A.game[arr]) A.game[arr].length = 0;
    A.update(dt);
    const cur = A.game.lowHpPhase;
    const step = (cur - prev + TAU) % TAU;      // forward advance regardless of wrap
    if (step <= 0) monotone = false;
    if (!near(step, expectedStep, 1e-6)) stepsOK = false;
    if (cur < 0 || cur >= TAU) inRange = false;
    prev = cur;
  }
  assert(A.game.lowHpSiren === true, "siren engaged while below threshold");
  assert(monotone, "lowHpPhase advances forward every frame (mod TAU) while engaged");
  assert(stepsOK, `each advance equals 2π·lowhpPulseRate(t)·dt (${expectedStep.toFixed(6)} rad/frame)`);
  assert(inRange, "lowHpPhase stays bounded in [0, TAU) (accumulator is mod TAU)");
  assert(A.game.lowHpPhase !== 0, "lowHpPhase is nonzero while engaged (it actually accumulated)");

  // Disengage (heal above threshold) → phase resets to 0.
  A.game.ship.hp = A.SHIP_MAX_HP;
  A.update(dt);
  assert(A.game.lowHpSiren === false, "siren disengaged after healing above threshold");
  assert(A.game.lowHpPhase === 0, `lowHpPhase resets to 0 on the falling-edge disengage; got ${A.game.lowHpPhase}`);
})();

// ================= (D) drawHUD() with AudioSys.ctx null + no globalAlpha leak =====================
(function () {
  console.log("(D) drawHUD() renders with AudioSys.ctx null (glow on/off) and never leaks globalAlpha");
  const A = buildInstance();
  assert(A.AudioSys.ctx == null, "AudioSys.ctx is null in the headless harness (no user gesture) — the glow must render anyway");
  prepPlaying(A, 40);

  // Glow ENGAGED: siren on, low hp, a nonzero phase → the four-corner radial-gradient fill path runs.
  A.game.lowHpSiren = true; A.game.lowHpPhase = 1.0;
  let threw = null;
  try { A.drawHUD(); } catch (e) { threw = e.message; }
  assert(threw === null, `drawHUD() does not throw with the glow engaged and ctx null (${threw})`);
  assert(drawCtx.globalAlpha === 1, `globalAlpha restored to 1 after drawHUD() (glow engaged); got ${drawCtx.globalAlpha}`);

  // With a relief flash in flight too (geometry pop on the hull ring) — still no throw, still no leak.
  A.game.hpReliefFlash = A.LOWHP_RELIEF_FLASH; A.game.ship.hp = 200; // hpCrit false → relief geometry path
  threw = null;
  try { A.drawHUD(); } catch (e) { threw = e.message; }
  assert(threw === null, `drawHUD() does not throw with a relief flash in flight (${threw})`);
  assert(drawCtx.globalAlpha === 1, `globalAlpha restored to 1 after drawHUD() (relief flash); got ${drawCtx.globalAlpha}`);

  // Glow DISENGAGED: siren off → the glow block is skipped; drawHUD still clean.
  A.game.lowHpSiren = false; A.game.hpReliefFlash = 0; A.game.ship.hp = A.SHIP_MAX_HP;
  threw = null;
  try { A.drawHUD(); } catch (e) { threw = e.message; }
  assert(threw === null, `drawHUD() does not throw with the glow disengaged (${threw})`);
  assert(drawCtx.globalAlpha === 1, `globalAlpha restored to 1 after drawHUD() (glow off); got ${drawCtx.globalAlpha}`);
})();

// ================= (E) relief flash arming/decay/guards =====================
(function () {
  console.log("(E) relief flash: arm-once + decay; dying arms 0; pause+resume arms 0; startGame zeroes");
  const dt = 1 / 60;

  // --- heal above threshold arms EXACTLY ONCE, then decays to 0 over LOWHP_RELIEF_FLASH ---
  const A = buildInstance();
  prepPlaying(A, 50);
  A.update(dt);                                  // engage siren
  assert(A.game.lowHpSiren === true && A.game.hpReliefFlash === 0, "engaged low-health, no relief flash yet");
  A.game.ship.hp = A.SHIP_MAX_HP;                 // heal above threshold → falling edge
  A.update(dt);
  assert(near(A.game.hpReliefFlash, A.LOWHP_RELIEF_FLASH), `relief flash armed to LOWHP_RELIEF_FLASH on heal; got ${A.game.hpReliefFlash}`);
  // A second full-hp frame must NOT re-arm (siren latch is already down) — it decays instead.
  A.game.ship.hp = A.SHIP_MAX_HP;
  A.update(dt);
  assert(A.game.hpReliefFlash < A.LOWHP_RELIEF_FLASH, "relief flash is not re-armed on the next frame (armed exactly once) — it decays");
  // Run out the clock; it reaches exactly 0 and stays there.
  const framesToDecay = Math.ceil(A.LOWHP_RELIEF_FLASH / dt) + 2;
  for (let i = 0; i < framesToDecay; i++) { A.game.ship.hp = A.SHIP_MAX_HP; A.update(dt); }
  assert(A.game.hpReliefFlash === 0, `relief flash decays to exactly 0 over ~${A.LOWHP_RELIEF_FLASH}s; got ${A.game.hpReliefFlash}`);

  // --- DYING while below the threshold arms it ZERO times (drive killShip) ---
  const B = buildInstance();
  prepPlaying(B, 50);
  B.update(dt);                                  // engaged, hpReliefFlash still 0
  B.killShip();                                  // death teardown zeroes the latch + the flash
  assert(B.game.hpReliefFlash === 0, `killShip() does not arm/leave a relief flash (dying is not relief); got ${B.game.hpReliefFlash}`);
  B.update(dt);                                  // now in "dying" — updateDeath early-returns; must not arm it
  assert(B.game.hpReliefFlash === 0, "a post-death update() (dying state) still leaves the relief flash at 0");

  // --- the explicit guard itself: reach the falling-edge branch with a DEAD ship and a live latch ---
  // (this is the branch that would fire the cheerful pop at the moment of death without `!ship.dead`).
  const C = buildInstance();
  prepPlaying(C, 50);
  C.game.ship.dead = true;                       // lowHp := (hp<=thr && !dead) = false → falling edge
  C.game.lowHpSiren = true;                      // latch still up (the hypothetical the guard defends)
  C.update(dt);
  assert(C.game.lowHpSiren === false, "falling-edge branch ran (latch cleared) with a dead ship");
  assert(C.game.hpReliefFlash === 0, "the `!ship.dead` guard blocks the relief flash when the ship is dead");

  // --- pausing below the threshold and resuming arms it ZERO times ---
  const D = buildInstance();
  prepPlaying(D, 50);
  D.update(dt);                                  // engaged
  D.openPause();                                 // tears the siren latch down directly + zeroes the flash
  assert(D.game.lowHpSiren === false && D.game.hpReliefFlash === 0, "openPause clears siren latch and any relief flash");
  D.update(dt);                                  // paused → update() early-returns
  D.closePause();
  D.game.ship.hp = 50;                           // still below threshold on resume
  D.update(dt);                                  // RISING edge (re-engage) — NOT the falling edge
  assert(D.game.lowHpSiren === true, "resuming below threshold re-engages the siren (rising edge)");
  assert(D.game.hpReliefFlash === 0, "pause→resume below the threshold never arms the relief flash");

  // --- startGame() zeroes it ---
  const E = buildInstance();
  E.game.hpReliefFlash = 0.3; E.game.lowHpPhase = 2.0;
  E.startGame();
  assert(E.game.hpReliefFlash === 0, "startGame() zeroes hpReliefFlash");
  assert(E.game.lowHpPhase === 0, "startGame() zeroes lowHpPhase");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
