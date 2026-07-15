// Headless test for CS010 P7 — the sixth track (a celebration cue for the High Scores screen) and
// the two routing fixes that let it play:
//   (a) musicStateFor() is now MENU-AWARE: it returns "highscore" iff (game.paused &&
//       game.menu.screen === "highscores"), and is BYTE-IDENTICAL to the pre-P7 mapping for every
//       other combination — that regression is the point of this file.
//   (b) menu ducking EXEMPTS the High Scores screen: setDuck is engaged on every OTHER menu screen
//       but NOT on "highscores" (the track has its own full level and nothing beneath it).
// Plus the standing track guarantees from test-v34-p6 re-checked for `highscore`: it's registered in
// MUSIC_TRACKS but NOT in MUSIC_TRACK_VALUES (contextual, like `title`), its loop is >= 10s, it has
// no >1-step silence gap (checked circularly), it carries no `tier` field, and its worst-case
// per-scheduled-step node creation is bounded (re-measured here).
//
//   node scratchpad/test-cs010-p7.js
//
// Same house-rule harness as test-v34-p6: stub window/document/rAF/navigator + a fake localStorage,
// eval the REAL <script> block, then drive the actual code — no reimplementation.

"use strict";
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "asteroids-deluxe.html"), "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ---- Recording Web Audio stubs (concrete, mutable currentTime) ----
function makeParam() {
  const rec = { linearRamps: [], expRamps: [], setValues: [], cancels: [], bareSets: [] };
  const p = {
    _v: 1, rec,
    linearRampToValueAtTime(v, t) { rec.linearRamps.push({ v, t }); this._v = v; },
    exponentialRampToValueAtTime(v, t) { rec.expRamps.push({ v, t }); this._v = v; },
    setValueAtTime(v, t) { rec.setValues.push({ v, t }); this._v = v; },
    setTargetAtTime(v) { this._v = v; },
    cancelScheduledValues(t) { rec.cancels.push(t); },
  };
  Object.defineProperty(p, "value", { get() { return this._v; }, set(v) { this._v = v; rec.bareSets.push(v); } });
  return p;
}
const startedOscs = [];
function makeGain() { const g = { gain: makeParam(), connect(dest) { return dest; }, disconnect() {} }; return g; }
function makeOsc() {
  return { type: "sine", frequency: makeParam(), connect(dest) { return dest; },
    start(t) { startedOscs.push(t); }, stop() {}, setPeriodicWave() {}, onended: null };
}
function makeFilter() { return { type: "lowpass", frequency: makeParam(), Q: makeParam(), connect(dest) { return dest; } }; }
function makeBufferSource() { return { buffer: null, loop: false, playbackRate: makeParam(), connect(dest) { return dest; }, start() {}, stop() {}, onended: null }; }
// CS011 P4: VoiceSys.ensure()/_schedule() now run on every startGame() (sayLevel(1)), so this ctx
// needs the radio-chain + formant-synth node types too, not just Gain/Osc/Filter/BufferSource.
function makeShaper() { return { curve: null, connect(dest) { return dest; } }; }
function makeCompressor() {
  return { threshold: makeParam(), ratio: makeParam(), attack: makeParam(), release: makeParam(),
    connect(dest) { return dest; } };
}
function makeCtx() {
  const ctx = { state: "running", currentTime: 0, sampleRate: 44100 };
  ctx.destination = makeGain();
  ctx.createGain = () => makeGain();
  ctx.createOscillator = () => makeOsc();
  ctx.createBiquadFilter = () => makeFilter();
  ctx.createBuffer = (ch, len) => ({ getChannelData() { return new Float32Array(len || 1); } });
  ctx.createBufferSource = () => makeBufferSource();
  ctx.createWaveShaper = () => makeShaper();
  ctx.createDynamicsCompressor = () => makeCompressor();
  ctx.createPeriodicWave = () => ({});
  ctx.resume = () => {};
  return ctx;
}
function FakeAudioContext() { return makeCtx(); }

const listeners = {};
const noopCtx = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub };
const windowStub = {
  addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
  innerWidth: 1280, innerHeight: 720,
  AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext,
};
const performanceStub = { now: () => 0 };
const rafStub = () => 0;
const navigatorStub = { getGamepads: () => [] };

const lsStore = {};
global.localStorage = {
  getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: k => { delete lsStore[k]; },
};

const returnList = [
  "startGame", "game", "AudioSys", "MusicSys", "MUSIC_TRACKS", "MUSIC_TRACK_VALUES",
  "menuActive", "updateMusic", "musicStateFor", "settings",
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub);
const {
  startGame, game, AudioSys, MusicSys, MUSIC_TRACKS, MUSIC_TRACK_VALUES,
  menuActive, updateMusic, musicStateFor, settings,
} = A;

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// The pre-P7 mapping, reproduced here as the oracle for the "unchanged for every other combination"
// regression. game.paused===false OR the open screen isn't "highscores" -> this must hold verbatim.
function preP7(s) { return s === "playing" ? settings.musicTrack : s === "title" ? "title" : "off"; }

// =====================================================================
// A) musicStateFor() is menu-aware: "highscore" IFF (game.paused && game.menu.screen==="highscores").
//    Exhaustive over the state strings the flow actually visits x paused x a spread of menu screens.
// =====================================================================
settings.musicTrack = "warehouse"; // a concrete gameplay selection so the "playing" branch is observable
const STATES = ["title", "playing", "gameover", "dying"];
const SCREENS = [null, "root", "options", "sound", "difficulty", "controls", "achievements", "highscores"];
for (const st of STATES) {
  for (const paused of [false, true]) {
    for (const scr of SCREENS) {
      game.state = st; game.paused = paused; game.menu.screen = scr;
      const got = musicStateFor(st);
      const wantHigh = paused && scr === "highscores";
      if (wantHigh) {
        assert(got === "highscore",
          `A: highscore IFF (paused && screen==highscores) — state=${st} scr=${scr} -> ${got}`);
      } else {
        // THE REGRESSION: every other combination is byte-identical to the pre-P7 mapping.
        assert(got === preP7(st),
          `A: unchanged for state=${st} paused=${paused} scr=${scr} — want ${preP7(st)} got ${got}`);
      }
    }
  }
}
// Spelled out for the four states named in the phase prompt, both with and without the highscores menu.
for (const st of STATES) {
  game.paused = true; game.menu.screen = "highscores"; game.state = st;
  assert(musicStateFor(st) === "highscore", `A: state=${st} on highscores menu -> highscore`);
  game.paused = false; game.menu.screen = null;
  assert(musicStateFor(st) === preP7(st), `A: state=${st} with no menu -> pre-P7 (${preP7(st)})`);
}
// A paused NON-highscores screen must NOT trigger the cue (it's the screen, not merely paused).
game.state = "playing"; game.paused = true; game.menu.screen = "options";
assert(musicStateFor("playing") === "warehouse", "A: paused on Options still routes the gameplay track, not highscore");

// =====================================================================
// B) Duck exemption: bring up the audio graph, then drive the REAL updateMusic() on each menu screen
//    and observe the duck node. Every menu screen ducks to 0.5 EXCEPT "highscores", which stays at 1.0.
// =====================================================================
AudioSys.init();
assert(AudioSys.ctx !== null, "B: audio graph built");
startGame();                 // state "playing", not paused
AudioSys.ctx.currentTime = 100;

function duckTargetAfterUpdate(screen) {
  // Arrive from a known un-ducked baseline so the ramp we observe is THIS screen's decision.
  game.state = "playing"; game.paused = true; game.menu.screen = screen;
  MusicSys.ducked = false;                       // reset the idempotency latch
  AudioSys.ctx.currentTime += 0.2;
  MusicSys.duck && (MusicSys.duck.gain.rec.linearRamps.length = 0);
  updateMusic();
  return MusicSys.ducked; // true iff setDuck(true) was requested this frame
}
const menuScreens = ["root", "options", "sound", "difficulty", "controls", "achievements"];
for (const scr of menuScreens) {
  assert(duckTargetAfterUpdate(scr) === true, `B: "${scr}" screen ducks (setDuck engaged)`);
  assert(MusicSys.duck.gain.rec.linearRamps.some(r => near(r.v, 0.5)), `B: "${scr}" ramps the bus toward 0.5`);
}
// The exemption: High Scores does NOT duck.
assert(duckTargetAfterUpdate("highscores") === false, "B: highscores screen is EXEMPT — setDuck NOT engaged");
assert(!MusicSys.duck.gain.rec.linearRamps.some(r => near(r.v, 0.5)), "B: highscores never ramps the bus to 0.5");
// And normal play (no menu) is likewise un-ducked.
game.state = "playing"; game.paused = false; game.menu.screen = null;
MusicSys.ducked = true; MusicSys.duck.gain.rec.linearRamps.length = 0;
updateMusic();
assert(MusicSys.ducked === false, "B: normal play is not ducked");

// =====================================================================
// C) updateMusic() actually SWITCHES to the highscore track on the High Scores screen, and back off it.
// =====================================================================
MusicSys.setState("off"); AudioSys.ctx.currentTime += 1;
game.state = "gameover"; game.paused = true; game.menu.screen = "highscores";
updateMusic();
assert(MusicSys.state === "highscore", "C: opening High Scores crossfades to the highscore track");
assert(MusicSys.track === MUSIC_TRACKS.highscore, "C: the live track IS the highscore table");
const hsGain = MusicSys.trackGain;
AudioSys.ctx.currentTime += 1;
game.menu.screen = "root"; // navigate away (still paused, e.g. back to the Options tree)
updateMusic();
assert(MusicSys.state === "off", "C: leaving High Scores (to a gameover-context menu) returns to silence");
assert(hsGain.gain.rec.linearRamps.some(r => near(r.v, 0.0001)), "C: the highscore track faded out, not hard-cut");

// =====================================================================
// D) Registry: highscore is in MUSIC_TRACKS but NOT in MUSIC_TRACK_VALUES (it's contextual, like title).
// =====================================================================
assert(MUSIC_TRACKS.highscore != null, "D: highscore is registered in MUSIC_TRACKS");
assert(!MUSIC_TRACK_VALUES.includes("highscore"), "D: highscore is NOT a gameplay-picker value");
assert(MUSIC_TRACK_VALUES.length === 4 && !MUSIC_TRACK_VALUES.includes("title"),
  "D: the picker is still exactly the four gameplay tracks (title/highscore both excluded)");

// =====================================================================
// E) Standing track guarantees, re-checked for `highscore`.
// =====================================================================
const hs = MUSIC_TRACKS.highscore;
// (freeze) no tier field.
for (const layer of hs.layers) assert(!("tier" in layer), `E: highscore/${layer.name} carries no tier field (freeze)`);
// (loop) >= 10s.
const sec = hs.steps * hs.stepDur;
console.log(`(loop) highscore: ${sec.toFixed(2)}s (${hs.steps} steps @ ${hs.stepDur}s)`);
assert(sec >= 10, `E: highscore loop is >= 10s (${sec.toFixed(2)}s)`);
// (gap) no silent run longer than one step, checked circularly (a note at s with dur d sounds s..s+d-1).
{
  const N = hs.steps, sounding = new Array(N).fill(false);
  for (const layer of hs.layers) for (let s = 0; s < N; s++) {
    const cell = layer.steps[s]; if (!cell) continue;
    const dur = Math.max(1, Math.round(cell.dur));
    for (let k = 0; k < dur; k++) sounding[(s + k) % N] = true;
  }
  let worst = 0, run = 0;
  for (let i = 0; i < N * 2; i++) { if (!sounding[i % N]) { run++; if (run > worst) worst = run; } else run = 0; }
  worst = Math.min(worst, N);
  console.log(`(gap) highscore: longest silent run = ${worst} step(s) over ${N} steps`);
  assert(worst <= 1, `E: highscore has no gap longer than one step (worst run = ${worst})`);
}
// (nodes) re-measure worst-case per-scheduled-step node creation. Bound is 16 ("a handful").
{
  MusicSys.setState("off"); AudioSys.ctx.currentTime += 1;
  MusicSys.setState("highscore");
  const ctx = AudioSys.ctx;
  const rawGain = ctx.createGain, rawOsc = ctx.createOscillator, rawFilter = ctx.createBiquadFilter, rawBS = ctx.createBufferSource;
  let trackMax = 0, worstStep = -1;
  for (let step = 0; step < hs.steps; step++) {
    let count = 0;
    ctx.createGain = () => { count++; return rawGain(); };
    ctx.createOscillator = () => { count++; return rawOsc(); };
    ctx.createBiquadFilter = () => { count++; return rawFilter(); };
    ctx.createBufferSource = () => { count++; return rawBS(); };
    MusicSys.scheduleStep(step, ctx.currentTime);
    if (count > trackMax) { trackMax = count; worstStep = step; }
  }
  ctx.createGain = rawGain; ctx.createOscillator = rawOsc; ctx.createBiquadFilter = rawFilter; ctx.createBufferSource = rawBS;
  console.log(`(perf) highscore: worst-case nodes for a single scheduled step = ${trackMax} (at step ${worstStep})`);
  assert(trackMax <= 16, `E: highscore worst-case per-step node creation (${trackMax}) is bounded (<= 16)`);
}
// (audio) the track actually produces oscillator voices when scheduled across a loop.
{
  const before = startedOscs.length;
  MusicSys.setState("off"); AudioSys.ctx.currentTime += 1;
  MusicSys.setState("highscore");
  const start = AudioSys.ctx.currentTime, dt = 1 / 60, loopLen = hs.steps * hs.stepDur;
  for (let t = start; t < start + loopLen + 1; t += dt) { AudioSys.ctx.currentTime = t; MusicSys.update(); }
  assert(startedOscs.length > before, "E: highscore scheduled real oscillator voices across a loop");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
