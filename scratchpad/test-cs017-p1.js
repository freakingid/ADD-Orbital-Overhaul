// Headless test for CS017 Phase 1 — the difficulty cycle clock (state only, inert this phase).
// nextWave() now derives game.cycle/game.cycleWave from the untouched game.wave (a sawtooth: cycle =
// floor((wave-1)/CYCLE_LENGTH), cycleWave = ((wave-1) % CYCLE_LENGTH) + 1); update()'s playing body ticks
// game.waveTime += dt, frozen while paused/at the title; cycleValue(base, cycle) is a spiral-scaling
// helper nothing called at the time. Sections (B)-(E)/(G) are P1's own contract and are unchanged.
//
// SECTION (F) WAS REPOINTED BY CS017 P3. P1's inertness was a property of P1 only: P3 deliberately wired
// the four SAWTOOTH levers (debris count, debris speed at both sites, Hunter speed, Hunter turn rate) to
// cycleWave/cycleValue, so the old "these must still read the absolute game.wave" sweep is now asserting
// the opposite of the shipped design. Rather than delete the coverage, (F) now proves the OTHER half of
// the same claim, at the same strength and against the same real helpers: the sawtooth levers read the
// cycle clock EXACTLY as P3 specified, and the FROZEN levers (the saucer group) still do not. The full
// sawtooth/reset/spiral behaviour is owned by scratchpad/test-cs017-p3.js.
//
//   node scratchpad/test-cs017-p1.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL nextWave()/startGame()/update()/DebrisSatellite/HunterSatellite —
// never reimplement game logic. Byte-identity comparisons use the REAL ramp()/leverScale() helpers, not
// re-derived arithmetic.

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
  "cycleValue", "CYCLE_LENGTH", "CYCLE_GAIN",
  "DebrisSatellite", "HunterSatellite", "Saucer",
  "ramp", "difficultyFactor", "leverScale",
  "DEBRIS_COUNT_MAX", "DEBRIS_COUNT_HARD_MAX", "DEBRIS_SPEED_PER_WAVE", // CS017 P3 (section F)
  "SAUCER_GAP_FLOOR_MIN", "SAUCER_GAP_CEIL_MIN", "SAUCER_GAP_FLOOR_MAX", "SAUCER_GAP_CEIL_MAX",
  "HUNTER_SPEED_CEIL", "HUNTER_TURN_CEIL", "HUNTER_FLOOR_FRAC",
  "MusicSys", "AudioSys"
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

// ================= (B) the sawtooth: cycle/cycleWave for waves 1..28 ====================
(function sectionB() {
  console.log("(B) nextWave() derives cycle/cycleWave as a CYCLE_LENGTH=9 sawtooth over the untouched game.wave");
  const A = build();
  const g = A.game;
  assert(A.CYCLE_LENGTH === 9, "B: sanity — CYCLE_LENGTH === 9");
  A.startGame(); // wave 1

  const expected = {}; // wave -> [cycle, cycleWave]
  for (let w = 1; w <= 28; w++) {
    expected[w] = [Math.floor((w - 1) / 9), ((w - 1) % 9) + 1];
  }
  // named spot checks from the prompt
  assert(expected[9][0] === 0 && expected[9][1] === 9, "B: sanity — wave 9 -> cycle 0 / cw 9");
  assert(expected[10][0] === 1 && expected[10][1] === 1, "B: sanity — wave 10 -> cycle 1 / cw 1");
  assert(expected[19][0] === 2 && expected[19][1] === 1, "B: sanity — wave 19 -> cycle 2 / cw 1");

  for (let w = 1; w <= 28; w++) {
    if (w > 1) A.nextWave();
    assert(g.wave === w, `B: game.wave is the untouched absolute counter (expected ${w}, got ${g.wave})`);
    const [ec, ecw] = expected[w];
    assert(g.cycle === ec, `B: wave ${w}: game.cycle expected ${ec}, got ${g.cycle}`);
    assert(g.cycleWave === ecw, `B: wave ${w}: game.cycleWave expected ${ecw}, got ${g.cycleWave}`);
  }
})();

// ================= (C) both game literals carry all three fields — SOURCE inspection ====================
(function sectionC() {
  console.log("(C) source inspection: the game{} literal AND startGame()'s reset both declare cycle/cycleWave/waveTime");

  const literalMatch = scriptSrc.match(/const game = \{[\s\S]*?\n\};/);
  assert(!!literalMatch, "C: located the `const game = {...}` literal in source");
  const literalSrc = literalMatch ? literalMatch[0] : "";
  assert(/cycle:\s*0/.test(literalSrc), "C: game literal declares cycle: 0");
  assert(/cycleWave:\s*1/.test(literalSrc), "C: game literal declares cycleWave: 1");
  assert(/waveTime:\s*0/.test(literalSrc), "C: game literal declares waveTime: 0");

  const startGameMatch = scriptSrc.match(/function startGame\(\) \{[\s\S]*?\nfunction nextWave/);
  assert(!!startGameMatch, "C: located startGame()'s body in source");
  const startGameSrc = startGameMatch ? startGameMatch[0] : "";
  assert(/game\.cycle\s*=\s*0/.test(startGameSrc), "C: startGame() resets game.cycle = 0");
  assert(/game\.cycleWave\s*=\s*1/.test(startGameSrc), "C: startGame() resets game.cycleWave = 1");
  assert(/game\.waveTime\s*=\s*0/.test(startGameSrc), "C: startGame() resets game.waveTime = 0");
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

// ================= (E) cycleValue() spot values ====================
(function sectionE() {
  console.log("(E) cycleValue(base, cycle) === base * (1 + cycle * CYCLE_GAIN)");
  const A = build();
  assert(A.CYCLE_GAIN === 0.12, "E: sanity — CYCLE_GAIN === 0.12");
  assert(A.cycleValue(100, 0) === 100, "E: cycleValue(100, 0) === 100 (cycle 0 is a no-op)");
  const c1 = A.cycleValue(100, 1);
  assert(Math.abs(c1 - 112) < 1e-9, `E: cycleValue(100, 1) === 112 (got ${c1})`);
  const c3 = A.cycleValue(10, 3);
  assert(Math.abs(c3 - 13.6) < 1e-9, `E: cycleValue(10, 3) === 13.6 (got ${c3})`);
  assert(A.cycleValue(0, 5) === 0, "E: cycleValue(0, cycle) === 0 for any cycle");
})();

// ================= (F) which levers read the cycle clock, and which still read game.wave ===========
// REPOINTED BY CS017 P3 (was: "nothing reads cycle/cycleWave"). The SAWTOOTH levers must now read the
// cycle clock exactly as P3 specified — debris count/speed via cycleValue(...cycleWave, cycle), Hunter
// speed/turn the same — while the FROZEN saucer group must still sample the absolute game.wave. Both
// halves are checked with the REAL cycleValue()/ramp() helpers and the REAL constants, never re-derived
// arithmetic, and each half carries the mirror-image control (the value must NOT equal what the other
// clock would have produced) so neither direction can pass vacuously.
(function sectionF() {
  console.log("(F) lever wiring: sawtooth levers read cycle/cycleWave, the frozen saucer group still reads game.wave");
  const A = build();
  const g = A.game;
  A.startGame();

  for (let w = 1; w <= 12; w++) {
    // nextWave() only ever fires once the field is clear (game.debris.length === 0 gate, elsewhere in
    // update()) — nextWave() itself does not clear the array, so the test must simulate that precondition.
    if (w > 1) { g.debris = []; A.nextWave(); }
    assert(g.wave === w, `F: sanity — game.wave === ${w}`);

    // --- SAWTOOTH: debris count + speedMul, exactly as nextWave() spawned them ---
    const expectedCount = Math.min(
      Math.round(A.cycleValue(Math.min(3 + g.cycleWave, A.DEBRIS_COUNT_MAX), g.cycle)),
      A.DEBRIS_COUNT_HARD_MAX);
    assert(g.debris.length === expectedCount,
      `F: wave ${w}: debris count expected ${expectedCount}, got ${g.debris.length} (cycleWave=${g.cycleWave}, cycle=${g.cycle})`);
    const expectedSpeedMul = A.cycleValue(1 + (g.cycleWave - 1) * A.DEBRIS_SPEED_PER_WAVE, g.cycle);
    // Every debris piece's speed magnitude was DEBRIS_SPEEDS[3] * speedMul * rand(0.7,1.3); check the
    // piece speed falls in the rand(0.7,1.3) envelope of the cycleWave-based expected multiplier.
    for (const d of g.debris) {
      const sp = Math.hypot(d.vx, d.vy);
      const lo = 70 * expectedSpeedMul * 0.7 * 0.999, hi = 70 * expectedSpeedMul * 1.3 * 1.001;
      assert(sp >= lo && sp <= hi,
        `F: wave ${w}: debris speed ${sp.toFixed(2)} outside the cycleWave-based envelope [${lo.toFixed(2)}, ${hi.toFixed(2)}]`);
    }

    // --- SAWTOOTH: Hunter speed/turn, sampled fresh at spawn from the cycle clock ---
    const h = new A.HunterSatellite(0, 0, 3);
    const expSpeed = A.cycleValue(A.ramp(A.HUNTER_SPEED_CEIL[3] * A.HUNTER_FLOOR_FRAC, A.HUNTER_SPEED_CEIL[3], g.cycleWave), g.cycle);
    const expTurn  = A.cycleValue(A.ramp(A.HUNTER_TURN_CEIL[3]  * A.HUNTER_FLOOR_FRAC, A.HUNTER_TURN_CEIL[3],  g.cycleWave), g.cycle);
    assert(Math.abs(h.speed - expSpeed) < 1e-9, `F: wave ${w}: Hunter speed expected ${expSpeed}, got ${h.speed}`);
    assert(Math.abs(h.turnRate - expTurn) < 1e-9, `F: wave ${w}: Hunter turnRate expected ${expTurn}, got ${h.turnRate}`);
    // CONTROL (mirror image of the pre-P3 one): where wave !== cycleWave the sample must NOT equal what
    // the old absolute-wave formula produced, proving the repoint is real and not a coincidence.
    if (g.wave !== g.cycleWave) {
      const preP3Speed = A.ramp(A.HUNTER_SPEED_CEIL[3] * A.HUNTER_FLOOR_FRAC, A.HUNTER_SPEED_CEIL[3], g.wave);
      assert(Math.abs(h.speed - preP3Speed) > 1e-9,
        `F: wave ${w}: Hunter speed must differ from the pre-P3 absolute-wave value (the sawtooth is provably wired)`);
      const preP3Mul = 1 + (g.wave - 1) * A.DEBRIS_SPEED_PER_WAVE;
      assert(Math.abs(expectedSpeedMul - preP3Mul) > 1e-9,
        `F: wave ${w}: debris speedMul must differ from the pre-P3 absolute-wave value`);
    }

    // --- FROZEN: saucer gap. Forces the spawn timer to expire, with Math.random() pinned so
    // rand(gapMin,gapMax) collapses to gapMin. Must still read the ABSOLUTE game.wave (CS017 P3 §5).
    g.saucers = [];
    g.saucerTimer = -1;
    const savedRandom = Math.random;
    Math.random = () => 0; // rand(a,b) = a + 0*(b-a) = a -> pins to gapMin; also pins smallChance roll false
    try {
      A.update(0); // dt=0: no other accumulator advances, isolates the spawn-timer branch
    } finally {
      Math.random = savedRandom;
    }
    assert(g.saucers.length === 1, `F: wave ${w}: forcing the spawn timer produced exactly one saucer`);
    const expGapMin = A.ramp(A.SAUCER_GAP_FLOOR_MIN, A.SAUCER_GAP_CEIL_MIN, g.wave);
    assert(Math.abs(g.saucerTimer - expGapMin) < 1e-9,
      `F: wave ${w}: saucer gap (Math.random pinned to 0) expected gapMin=${expGapMin}, got ${g.saucerTimer}`);
    // CONTROL: where wave !== cycleWave the frozen lever must NOT have picked up the cycle clock.
    if (g.wave !== g.cycleWave) {
      const sawtoothGap = A.cycleValue(A.ramp(A.SAUCER_GAP_FLOOR_MIN, A.SAUCER_GAP_CEIL_MIN, g.cycleWave), g.cycle);
      assert(Math.abs(g.saucerTimer - sawtoothGap) > 1e-9,
        `F: wave ${w}: the saucer gap is FROZEN — it must not equal the cycleWave/spiral value (${sawtoothGap})`);
    }
  }
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
