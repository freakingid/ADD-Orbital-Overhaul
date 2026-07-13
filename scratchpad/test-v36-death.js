// Headless test for v3.6 Phase 5 — the "dying" death spectacle.
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator (+ fake localStorage), eval the REAL
// <script> block, then drive the ACTUAL killShip()/update()/draw()/keydown handlers — no
// reimplementation of the logic under test.
//
//   node scratchpad/test-v36-death.js
//
// Checks:
//  (A) killShip() enters "dying" (NOT "gameover"), arms deathT/shake, and still fires
//      gameEnded + Achievements.evaluate + Achievements.save exactly ONCE, at killShip — not later.
//  (B) the field genuinely keeps MOVING during "dying" (a debris object's position changes across
//      frames — the exact thing that froze before), and update() does NOT re-evaluate achievements
//      during the death.
//  (C) score does NOT change during the death, and NO achievement counter moves — even though nearby
//      bodies really do detonate (the awardScore=false path, plus the destroyHunter gating fix).
//  (D) after DEATH_DURATION of real frames the state is exactly "gameover" (one transition), and
//      achievements were NOT evaluated again at the transition.
//  (E) a confirm (Enter) keypress during "dying" does NOT start a new game (spectacle unskippable).
//  (F) draw() is crash-free at several points through the death window (flash frame, mid, near end).
//  (G) FLAG-I: Capture's P (screenshot) is honoured during "dying"; O (slow-mo) is not; and P is
//      inert once the state is "gameover".

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ---- Headless environment stubs (mirrors test-p5 / test-p4) ----
const noopCtx = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };

function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
    Q: { value: 0 }, type: "sine", buffer: null, loop: false, playbackRate: { value: 1 },
    connect() { return makeAudioNode(); }
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
function FakeAudioContext() {
  return new Proxy({
    state: "running", currentTime: 0, sampleRate: 44100, destination: makeAudioNode(),
    createGain() { return makeAudioNode(); },
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; }
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}

const listeners = {};
const windowStub = {
  addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
  innerWidth: 1280, innerHeight: 720,
  AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext
};
const performanceStub = { now: () => Date.now() };
const rafStub = () => 0;
const navigatorStub = { getGamepads: () => [] };

const lsStore = {};
global.localStorage = {
  getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: k => { delete lsStore[k]; }
};

const returnList = [
  "startGame", "update", "draw", "game", "keys", "killShip",
  "DEATH_DURATION", "DEATH_SHAKE_INIT", "Achievements", "AudioSys",
  "DebrisSatellite", "HunterSatellite", "Capture", "bindings"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, global.localStorage);
const {
  startGame, update, draw, game, keys, killShip,
  DEATH_DURATION, DEATH_SHAKE_INIT, Achievements, AudioSys,
  DebrisSatellite, HunterSatellite, Capture, bindings
} = A;

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }

AudioSys.init();
const DT = 1 / 60;

// Fire the REAL keydown listener(s) with a synthetic event.
function keydown(key, repeat = false) {
  const e = { key, repeat, preventDefault() {} };
  for (const fn of (listeners["keydown"] || [])) fn(e);
}
// Run one death frame through the REAL update() (state must be "dying").
function stepDeath() { update(DT); }

// ================= (A) killShip enters "dying" and flushes achievements ONCE, at killShip =========
(function sectionA() {
  startGame();
  // Give the run some score + a couple of stats so we can prove they don't move later.
  game.score = 4200;

  // Spy Achievements.evaluate / save (method calls on the returned object — killShip looks them up on
  // the same object, so the spies are seen).
  let evalCount = 0, saveCount = 0;
  const origEval = Achievements.evaluate, origSave = Achievements.save;
  Achievements.evaluate = function (...a) { evalCount++; return origEval.apply(this, a); };
  Achievements.save     = function (...a) { saveCount++; return origSave.apply(this, a); };

  assert(game.state === "playing", "A: pre-kill state is playing");
  assert(game.stats.gameEnded === false, "A: gameEnded starts false");

  killShip();

  assert(game.state === "dying", "A: killShip enters 'dying', not 'gameover'");
  assert(game.state !== "gameover", "A: killShip did NOT go straight to 'gameover'");
  assert(Math.abs(game.deathT - DEATH_DURATION) < 1e-9, "A: deathT armed to DEATH_DURATION");
  assert(game.shake === DEATH_SHAKE_INIT, "A: shake armed to DEATH_SHAKE_INIT");
  assert(game.ship.dead === true, "A: ship marked dead");
  assert(game.stats.gameEnded === true, "A: gameEnded flagged at killShip");
  assert(evalCount === 1, "A: Achievements.evaluate fired exactly once at killShip");
  assert(saveCount === 1, "A: Achievements.save fired exactly once at killShip");

  // A second killShip() is a guarded no-op (ship already dead) — must not double-fire achievements.
  killShip();
  assert(evalCount === 1, "A: re-killShip does not re-evaluate (guarded on ship.dead)");
  assert(saveCount === 1, "A: re-killShip does not re-save");

  // Now run the WHOLE death window; evaluate/save must NOT fire again during "dying" or at the handoff.
  const frames = Math.ceil(DEATH_DURATION / DT) + 4;
  for (let i = 0; i < frames; i++) stepDeath();
  assert(evalCount === 1, "A: no re-evaluate during the death or at the 'dying'->'gameover' handoff");
  assert(saveCount === 1, "A: no re-save during the death or at the handoff");

  Achievements.evaluate = origEval; Achievements.save = origSave; // restore
})();

// ================= (B) the field keeps moving during "dying" =======================================
(function sectionB() {
  startGame();
  // Clean field; a single tracked debris placed FAR from the ship so the shockwave can't reach it in
  // the few frames we observe (it must survive long enough to be seen moving).
  game.debris.length = 0; game.hunters.length = 0; game.saucers.length = 0;
  game.garbage.length = 0; game.bullets.length = 0; game.particles.length = 0;
  game.ship.x = 1280; game.ship.y = 720;
  const far = new DebrisSatellite(1280 + 1150, 720, 2, 1);
  far.vx = 40; far.vy = -25; // guarantee motion
  game.debris.push(far);

  killShip();
  assert(game.state === "dying", "B: in 'dying' after killShip");
  const x0 = far.x, y0 = far.y;
  for (let i = 0; i < 6; i++) stepDeath(); // 6 frames = 0.1s; ring reaches only ~70px, far body safe
  assert(!far.dead, "B: the far tracked debris has NOT been detonated yet (still on the field)");
  assert(far.x !== x0 || far.y !== y0, "B: the field KEEPS MOVING during 'dying' (debris pos changed)");
})();

// ================= (C) no score, no achievement counters move during the death =====================
(function sectionC() {
  startGame();
  game.score = 9000;
  game.debris.length = 0; game.hunters.length = 0; game.saucers.length = 0;
  game.garbage.length = 0; game.bullets.length = 0; game.particles.length = 0;
  game.ship.x = 1280; game.ship.y = 720;

  // A large debris AND a large Hunter right on top of the ship: the shockwave reaches them almost
  // immediately, so they (and their split children) really detonate during the window.
  const dbg = new DebrisSatellite(1300, 720, 3, 1);
  game.debris.push(dbg);
  const hnt = HunterSatellite.spawnCore();
  hnt.x = 1260; hnt.y = 720; hnt.vx = 0; hnt.vy = 0;
  game.hunters.push(hnt);

  killShip();
  const score0 = game.score;
  const snap = {
    debrisKills: game.stats.debrisKills,
    hunterLineageKills: game.stats.hunterLineageKills,
    largeHunterKills: game.stats.largeHunterKills,
    hunterKills: Achievements.lifetime.hunterKills,
    bestDebrisGame: Achievements.lifetime.bestDebrisGame,
    delivered: Achievements.lifetime.delivered
  };
  const particles0 = game.particles.length;
  let peakParticles = particles0; // particles have a finite life + get filtered, so track the PEAK

  const frames = Math.ceil(DEATH_DURATION / DT) + 4;
  for (let i = 0; i < frames; i++) { stepDeath(); peakParticles = Math.max(peakParticles, game.particles.length); }

  assert(game.state === "gameover", "C: reached 'gameover' after the window");
  assert(dbg.dead === true, "C: the nearby large debris really detonated (dead)");
  assert(hnt.dead === true, "C: the nearby large Hunter really detonated (dead)");
  assert(peakParticles > particles0, "C: detonations produced explosion particles (spectacle real)");
  assert(game.score === score0, "C: score did NOT change during the death");
  assert(game.stats.debrisKills === snap.debrisKills, "C: debrisKills unchanged");
  assert(game.stats.hunterLineageKills === snap.hunterLineageKills, "C: hunterLineageKills unchanged");
  assert(game.stats.largeHunterKills === snap.largeHunterKills, "C: largeHunterKills unchanged");
  assert(Achievements.lifetime.hunterKills === snap.hunterKills, "C: lifetime hunterKills unchanged (destroyHunter gating fix)");
  assert(Achievements.lifetime.bestDebrisGame === snap.bestDebrisGame, "C: lifetime bestDebrisGame unchanged");
  assert(Achievements.lifetime.delivered === snap.delivered, "C: lifetime delivered unchanged");
})();

// ================= (D) exact-window handoff to "gameover" ==========================================
(function sectionD() {
  startGame();
  game.debris.length = 0; game.hunters.length = 0; game.saucers.length = 0;
  killShip();
  const total = Math.ceil(DEATH_DURATION / DT);   // frames whose dt sums to DEATH_DURATION (150 @ 60fps)
  // Step one frame at a time until the handoff, counting frames. The check is deathT<=0, so accumulated
  // float error can push the flip one frame past `total`; allow that ±1 slack.
  let n = 0;
  while (game.state === "dying" && n < total + 5) { stepDeath(); n++; }
  assert(game.state === "gameover", "D: reaches 'gameover' within a frame of DEATH_DURATION");
  assert(n === total || n === total + 1, "D: transition lands at DEATH_DURATION (±1 frame, float slack): " + n);
  assert(game.deathT === 0, "D: deathT clamped to exactly 0 at the handoff");
  // Further update() calls in "gameover" are the normal early-return (world frozen) — no crash, no flip back.
  const dbgLen = game.debris.length;
  stepDeath(); stepDeath();
  assert(game.state === "gameover", "D: stays 'gameover' (no flip back to 'dying'/'playing')");
  assert(game.debris.length === dbgLen, "D: world is frozen again under 'gameover' (no further sim)");
})();

// ================= (E) confirm during "dying" does NOT restart the game ============================
(function sectionE() {
  startGame();
  game.score = 7777;
  game.wave = 9;
  killShip();
  assert(game.state === "dying", "E: in 'dying' before the confirm press");
  const confirmKey = bindings.confirm.keys[0]; // "enter"
  keydown(confirmKey);
  // startGame() would have flipped state to "playing" and reset score to 0 / wave to 0.
  assert(game.state === "dying", "E: confirm during 'dying' did NOT start a new game (state still 'dying')");
  assert(game.score === 7777, "E: confirm during 'dying' did NOT reset score (startGame not called)");
  assert(game.wave === 9, "E: confirm during 'dying' did NOT reset wave");
  // And it still works at the real "gameover" boundary (regression guard on the audited site).
  const frames = Math.ceil(DEATH_DURATION / DT) + 2;
  for (let i = 0; i < frames; i++) stepDeath();
  assert(game.state === "gameover", "E: reached 'gameover'");
  // v3.6 P6: a qualifying score arms game.entry at the "dying"->"gameover" seam, and confirm there
  // commits initials instead of starting a game (see test-v36-scores.js §F for that behaviour) — an
  // orthogonal, later-phase concern. Clear it here so this P5-only assertion (the confirm binding
  // genuinely still reaches startGame once nothing is intercepting it) stays isolated.
  game.entry = null;
  keydown(confirmKey);
  assert(game.state === "playing", "E: confirm at 'gameover' DOES start a new game (unchanged site)");
})();

// ================= (F) draw() is crash-free through the death window ================================
(function sectionF() {
  startGame();
  // Populate a busy field so the world-render path is genuinely exercised during death.
  game.ship.x = 1280; game.ship.y = 720;
  for (let i = 0; i < 5; i++) game.debris.push(new DebrisSatellite(700 + i * 120, 500 + i * 40, ((i % 3) + 1), 1));
  game.hunters.push(HunterSatellite.spawnCore());
  killShip();
  let ok = true;
  try {
    draw();                       // frame 1: white flash active, tiny ring
    for (let i = 0; i < 30; i++) { stepDeath(); draw(); }  // mid-window: big ring, shake, detonations
    // step to the gameover handoff and draw there too
    const frames = Math.ceil(DEATH_DURATION / DT) + 4;
    for (let i = 0; i < frames; i++) { stepDeath(); }
    draw();                       // "gameover" frame
  } catch (err) { ok = false; console.error("  draw() threw: " + (err && err.stack || err)); }
  assert(ok, "F: draw() is crash-free across the death window and into 'gameover'");
})();

// ================= (G) FLAG-I: P allowed during "dying"; O not; P inert at "gameover" ==============
(function sectionG() {
  startGame();
  killShip();
  assert(game.state === "dying", "G: in 'dying'");
  Capture._shot = false;
  Capture.timeScale = 1;
  keydown("p");
  assert(Capture._shot === true, "G: P (screenshot) IS honoured during 'dying' (FLAG-I)");
  keydown("o");
  assert(Capture.timeScale === 1, "G: O (slow-mo) is NOT honoured during 'dying' (live-play only)");

  // Advance to gameover; P must go inert (canShoot false there).
  const frames = Math.ceil(DEATH_DURATION / DT) + 4;
  for (let i = 0; i < frames; i++) stepDeath();
  assert(game.state === "gameover", "G: reached 'gameover'");
  Capture._shot = false;
  keydown("p");
  assert(Capture._shot === false, "G: P is inert at 'gameover' (Capture live-play/dying only)");
})();

// ---- summary ----
console.log(`\ntest-v36-death: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
