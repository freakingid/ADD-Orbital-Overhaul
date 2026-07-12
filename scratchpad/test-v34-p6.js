// Headless test for v3.4 Phase 6 — MusicSys core: lookahead scheduler, menu ducking, title track,
// and the Options "Music Track" row + label-dispatch refactor.
//
//   node scratchpad/test-v34-p6.js
//
// Follows the house rule (CLAUDE.md / GDD 5.4): stub window/document/rAF/navigator + a fake
// localStorage, eval the REAL <script> block, then drive the actual code — no reimplementation.
//
// Unlike test-f8's Proxy ctx (currentTime frozen at 0), this uses a CONCRETE recording ctx so we can
// (a) advance ctx.currentTime to drive the scheduler across a full loop, and (b) inspect gain
// AudioParam calls — specifically that the menu duck moves via linearRampToValueAtTime, not a bare
// .value assignment.

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
function makeGain() { const g = { gain: makeParam(), connect(dest) { return dest; } }; return g; }
function makeOsc() {
  return { type: "sine", frequency: makeParam(), connect(dest) { return dest; },
    start(t) { startedOscs.push(t); }, stop() {} };
}
function makeFilter() { return { type: "lowpass", frequency: makeParam(), Q: makeParam(), connect(dest) { return dest; } }; }
function makeBufferSource() { return { buffer: null, loop: false, playbackRate: makeParam(), connect(dest) { return dest; }, start() {}, stop() {} }; }
function makeCtx() {
  const ctx = { state: "running", currentTime: 0, sampleRate: 44100 };
  ctx.destination = makeGain();
  ctx.createGain = () => makeGain();
  ctx.createOscillator = () => makeOsc();
  ctx.createBiquadFilter = () => makeFilter();
  ctx.createBuffer = (ch, len) => ({ getChannelData() { return new Float32Array(len || 1); } });
  ctx.createBufferSource = () => makeBufferSource();
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
  "startGame", "update", "game", "AudioSys", "MusicSys", "MUSIC_TRACKS", "MUSIC_TRACK_VALUES",
  "menuActive", "openPause", "closePause", "gotoScreen", "menuInput",
  "settings", "saveSettings", "loadSettings", "STORAGE_KEY",
  "MENU_OPTIONS", "VOL_CATS", "bindings", "REBINDABLE",
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub);
const {
  startGame, update, game, AudioSys, MusicSys, MUSIC_TRACKS, MUSIC_TRACK_VALUES,
  menuActive, openPause, closePause, gotoScreen, menuInput,
  settings, saveSettings, loadSettings, STORAGE_KEY,
  MENU_OPTIONS, VOL_CATS, bindings, REBINDABLE,
} = A;

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
function noThrow(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.message); } }

console.log(`(config) options=[${MENU_OPTIONS.join(", ")}]`);
console.log(`(config) musicTracks=[${MUSIC_TRACK_VALUES.join(", ")}]  storageKey=${STORAGE_KEY}`);

// =====================================================================
// A) Every MusicSys entry point is safe with AudioSys.ctx === null (pre-gesture / page load).
// =====================================================================
assert(AudioSys.ctx === null, "A: ctx is null before any gesture");
noThrow(() => MusicSys.setState("title"), "A: setState(title) with ctx null");
noThrow(() => MusicSys.setState("play"),  "A: setState(play) with ctx null");
noThrow(() => MusicSys.setState("off"),   "A: setState(off) with ctx null");
noThrow(() => MusicSys.setDuck(true),     "A: setDuck(true) with ctx null");
noThrow(() => MusicSys.setDuck(false),    "A: setDuck(false) with ctx null");
noThrow(() => MusicSys.setIntensity(0.5), "A: setIntensity with ctx null");
noThrow(() => MusicSys.update(),          "A: update() with ctx null");
noThrow(() => MusicSys.ensureGraph(),     "A: ensureGraph() with ctx null");
assert(MusicSys.duck === null, "A: no duck node built while ctx is null");

// Bring up the audio graph (simulates the first user gesture).
AudioSys.init();
assert(AudioSys.ctx !== null && AudioSys.music !== null, "A: AudioSys graph built by init()");
// Reset MusicSys to a clean baseline (the ctx-null calls above left state mutated harmlessly).
MusicSys.duck = null; MusicSys.trackGain = null; MusicSys.state = "off"; MusicSys.track = null;
MusicSys.step = 0; MusicSys.nextStepTime = 0; MusicSys.ducked = false;

// =====================================================================
// B) Ducking: setDuck rides duck.gain via a linearRamp, toward 0.5 on, 1.0 off — never a bare set.
// =====================================================================
AudioSys.ctx.currentTime = 10;
MusicSys.setDuck(true);
assert(MusicSys.duck !== null, "B: duck node created on first setDuck after init");
let dr = MusicSys.duck.gain.rec;
assert(dr.linearRamps.length >= 1, "B: setDuck(true) issued a linearRampToValueAtTime");
assert(dr.linearRamps.some(r => near(r.v, 0.5)), "B: duck ramps toward 0.5 when on");
assert(!dr.bareSets.includes(0.5), "B: 0.5 is reached by RAMP, not a bare .value = assignment");
const rampsAfterOn = dr.linearRamps.length;

// Idempotent: a second setDuck(true) must NOT issue another ramp (called every frame in the loop).
MusicSys.setDuck(true);
assert(dr.linearRamps.length === rampsAfterOn, "B: repeated setDuck(true) is idempotent (no new ramp)");

// Clear the rec so we observe ONLY the un-duck movement (the node's resting value was legitimately
// bare-set to 1.0 at construction; the assertion is that the MOVE back to 1.0 is a ramp).
dr.linearRamps.length = 0; dr.bareSets.length = 0;
AudioSys.ctx.currentTime = 11;
MusicSys.setDuck(false);
assert(dr.linearRamps.some(r => near(r.v, 1.0)), "B: setDuck(false) ramps back toward 1.0");
assert(!dr.bareSets.includes(1.0), "B: un-duck to 1.0 is reached by RAMP, not a bare .value = assignment");

// =====================================================================
// C) menuActive() drives the duck: EVERY pause-menu screen ducks (all live under game.paused).
// =====================================================================
startGame(); // state "playing"
assert(menuActive() === false, "C: not ducked during normal play");
const screens = ["root", "options", "difficulty", "controls", "achievements"];
openPause(); // -> screen "root", paused true
for (const s of screens) {
  if (s !== "root") gotoScreen(s);
  // Reset the duck latch so each screen's duck is independently observable.
  MusicSys.ducked = false; MusicSys.duck.gain.rec.linearRamps.length = 0;
  AudioSys.ctx.currentTime += 0.1;
  assert(menuActive() === true, `C: menuActive() true on "${s}" screen`);
  MusicSys.setDuck(menuActive());
  assert(MusicSys.duck.gain.rec.linearRamps.some(r => near(r.v, 0.5)), `C: "${s}" screen ducks to 0.5`);
}
closePause();
MusicSys.ducked = true; MusicSys.duck.gain.rec.linearRamps.length = 0; // simulate arriving from a ducked (menu-open) state
MusicSys.setDuck(menuActive());
assert(menuActive() === false, "C: closePause() clears menuActive()");
assert(MusicSys.duck.gain.rec.linearRamps.some(r => near(r.v, 1.0)), "C: closing the menu un-ducks to 1.0");

// =====================================================================
// D) setState transitions: state/track update, and the previous track is stopped (faded to ~0).
// =====================================================================
MusicSys.trackGain = null; MusicSys.state = "off"; MusicSys.track = null; MusicSys.step = 0;
AudioSys.ctx.currentTime = 20;
MusicSys.setState("title");
assert(MusicSys.state === "title", "D: setState(title) sets state");
assert(MusicSys.track === MUSIC_TRACKS.title, "D: title track is the title table");
assert(MusicSys.trackGain !== null, "D: title track has a live trackGain");
const titleGain = MusicSys.trackGain;
assert(titleGain.gain.rec.linearRamps.some(r => near(r.v, 1)), "D: new track fades IN via ramp to 1");

AudioSys.ctx.currentTime = 25;
noThrow(() => MusicSys.setState("play"), "D: setState(play) does not throw");
assert(MusicSys.state === "play", "D: state is play");
assert(MusicSys.track === null, "D: play is a SILENT STUB this phase (null track)");
assert(titleGain.gain.rec.linearRamps.some(r => near(r.v, 0.0001)), "D: previous (title) track was stopped — faded to ~0");
assert(MusicSys.trackGain === null, "D: silent state leaves no live trackGain");

AudioSys.ctx.currentTime = 30;
noThrow(() => MusicSys.setState("off"), "D: setState(off) does not throw");
assert(MusicSys.state === "off" && MusicSys.track === null, "D: off is silence");

// Same-state setState is a no-op (no redundant crossfade).
AudioSys.ctx.currentTime = 31;
MusicSys.setState("title");
const g2 = MusicSys.trackGain;
MusicSys.setState("title");
assert(MusicSys.trackGain === g2, "D: setState() to the current state is a no-op (no new trackGain)");

// The title screen after a game (ctx already exists) starts the title track cleanly.
MusicSys.setState("off");
AudioSys.ctx.currentTime = 40;
game.state = "title";
noThrow(() => { MusicSys.setState("off"); MusicSys.setState("title"); }, "D: title track (re)starts after a game with ctx live");
assert(MusicSys.state === "title" && MusicSys.trackGain !== null, "D: title track live on return to title");

// =====================================================================
// E) The lookahead scheduler: drive N frames against a controlled currentTime. Each step is
//    scheduled exactly once, in order, with no gaps, and never into the past.
// =====================================================================
// Fresh title track from t=100.
MusicSys.setState("off");
AudioSys.ctx.currentTime = 100;
MusicSys.setState("title");
const track = MUSIC_TRACKS.title;
const N = track.steps, stepDur = track.stepDur;

// Wrap scheduleStep to record (step, tStep, nowAtCall) — still calls through to the real scheduler.
const rawScheduleStep = MusicSys.scheduleStep.bind(MusicSys);
const sched = [];
MusicSys.scheduleStep = function (step, tStep) {
  sched.push({ step, tStep, now: AudioSys.ctx.currentTime });
  return rawScheduleStep(step, tStep);
};

// Simulate ~55 s of frames at 60 fps (dt smaller than MUSIC_LOOKAHEAD, so scheduling stays ahead).
const dt = 1 / 60;
for (let t = 100; t < 155; t += dt) {
  AudioSys.ctx.currentTime = t;
  MusicSys.update();
}
MusicSys.scheduleStep = rawScheduleStep; // restore

assert(sched.length > 0, "E: scheduler scheduled some steps");
// Never into the past: every scheduled step time is >= the clock at the moment it was scheduled.
assert(sched.every(e => e.tStep >= e.now - 1e-9), "E: no step scheduled into the past");
// Contiguous, exactly-once: consecutive scheduled steps advance by exactly 1 (mod N) — no gaps, no dupes.
let contiguous = true;
for (let i = 1; i < sched.length; i++) {
  if ((sched[i].step - sched[i - 1].step + N) % N !== 1) { contiguous = false; break; }
}
assert(contiguous, "E: steps scheduled contiguously (no gaps, no double-scheduling)");
// Monotonic non-decreasing start times.
let monotonic = true;
for (let i = 1; i < sched.length; i++) if (sched[i].tStep < sched[i - 1].tStep - 1e-9) { monotonic = false; break; }
assert(monotonic, "E: scheduled start times are monotonic");
// Covered the whole loop at least once and wrapped (55 s > 48 s loop).
assert(sched.length >= N, `E: scheduled at least a full loop (${sched.length} >= ${N} steps)`);
const covered = new Set(sched.map(e => e.step));
assert(covered.size === N, `E: every step index in the loop was scheduled (${covered.size}/${N})`);
// The title track really is long/patient (45-90 s) and has real note content.
const loopSec = N * stepDur;
assert(loopSec >= 45 && loopSec <= 90, `E: title loop length ${loopSec}s is in the 45-90s target`);
let noteCells = 0;
for (const layer of track.layers) for (const c of layer.steps) if (c) noteCells++;
assert(noteCells > 0 && track.layers.length >= 2, "E: title track is a multi-layer table with real notes");
// The scheduler actually produced oscillator voices (real audio, not just bookkeeping).
assert(startedOscs.length > 0, "E: scheduled notes started real oscillator voices");

// =====================================================================
// F) Options menu — label-dispatch refactor: every existing row still reaches its screen, the
//    sliders still nudge, and the new Music Track row cycles + persists.
// =====================================================================
function openOptionsAt(label) {
  game.paused = true; game.menu.screen = "options";
  game.menu.index = MENU_OPTIONS.indexOf(label);
  game.menu.rebinding = null;
}
// Nav rows -> their screens.
openOptionsAt("Controls");     menuInput("confirm"); assert(game.menu.screen === "controls",    "F: Options row 'Controls' -> controls");
openOptionsAt("Achievements"); menuInput("confirm"); assert(game.menu.screen === "achievements", "F: Options row 'Achievements' -> achievements");
openOptionsAt("Difficulty");   menuInput("confirm"); assert(game.menu.screen === "difficulty",   "F: Options row 'Difficulty' -> difficulty");
openOptionsAt("Back");         menuInput("confirm"); assert(game.menu.screen === "root",          "F: Options row 'Back' -> root");

// The three volume sliders still nudge the routed gains (label-dispatched, not index-dispatched).
for (const [label, cat] of [["SFX Volume", "sfx"], ["Music Volume", "music"], ["Master Volume", "master"]]) {
  AudioSys.setVol(cat, 0.5);
  openOptionsAt(label); menuInput("right"); assert(AudioSys.vol[cat] > 0.5, `F: '${label}' right raises ${cat}`);
  openOptionsAt(label); menuInput("left");  menuInput("left"); assert(AudioSys.vol[cat] < 0.5, `F: '${label}' left lowers ${cat}`);
}

// Music Track row cycles through all three values and wraps, both directions.
settings.musicTrack = "tense";
openOptionsAt("Music Track");
menuInput("right"); assert(settings.musicTrack === "retro",   "F: Music Track right: tense -> retro");
menuInput("right"); assert(settings.musicTrack === "ambient", "F: Music Track right: retro -> ambient");
menuInput("right"); assert(settings.musicTrack === "tense",   "F: Music Track right wraps: ambient -> tense");
menuInput("left");  assert(settings.musicTrack === "ambient", "F: Music Track left wraps: tense -> ambient");
// It never lands on a value outside the known set.
const seen = new Set();
for (let i = 0; i < 12; i++) { openOptionsAt("Music Track"); menuInput("right"); seen.add(settings.musicTrack); }
assert([...seen].every(v => MUSIC_TRACK_VALUES.includes(v)) && seen.size === 3, "F: Music Track only ever cycles known values");

// =====================================================================
// G) Persistence — afd_settings_v1 round-trips EVERY pre-existing field + the new musicTrack.
// =====================================================================
AudioSys.vol.master = 0.3; AudioSys.vol.sfx = 0.7; AudioSys.vol.music = 0.4;
settings.shotPowerupMode = "shots"; settings.magnetMode = "pieces"; settings.musicTrack = "ambient";
bindings.fire.keys = ["z"]; // a pre-existing rebind field
saveSettings();
assert("afd_settings_v1" in lsStore, "G: saved under the FROZEN key afd_settings_v1");
assert(STORAGE_KEY === "afd_settings_v1", "G: STORAGE_KEY constant is afd_settings_v1");
const stored = JSON.parse(lsStore["afd_settings_v1"]);
assert(stored.musicTrack === "ambient", "G: musicTrack serialized");
assert(stored.shotPowerupMode === "shots" && stored.magnetMode === "pieces", "G: v3.0 P5 fields serialized (regression)");

// Corrupt in-memory, then load: every field must come back.
AudioSys.vol.master = 1; AudioSys.vol.sfx = 1; AudioSys.vol.music = 1;
settings.shotPowerupMode = "time"; settings.magnetMode = "time"; settings.musicTrack = "tense";
bindings.fire.keys = ["x"];
loadSettings();
assert(near(AudioSys.vol.master, 0.3) && near(AudioSys.vol.sfx, 0.7) && near(AudioSys.vol.music, 0.4), "G: volumes round-trip");
assert(settings.shotPowerupMode === "shots" && settings.magnetMode === "pieces", "G: difficulty modes round-trip (regression)");
assert(settings.musicTrack === "ambient", "G: musicTrack round-trips");
assert(bindings.fire.keys[0] === "z", "G: rebindings round-trip (regression)");

// A corrupt/unknown musicTrack falls back to the default without throwing (additive-load pattern).
lsStore["afd_settings_v1"] = JSON.stringify({ ...stored, musicTrack: "bogus-track" });
settings.musicTrack = "retro"; // simulate the shipped default already in place
noThrow(() => loadSettings(), "G: loadSettings tolerates a corrupt musicTrack");
assert(settings.musicTrack === "retro", "G: corrupt musicTrack ignored -> keeps the default");
// A missing musicTrack key (older save) is likewise tolerated.
const noTrack = { ...stored }; delete noTrack.musicTrack;
lsStore["afd_settings_v1"] = JSON.stringify(noTrack);
settings.musicTrack = "retro";
noThrow(() => loadSettings(), "G: loadSettings tolerates a missing musicTrack (older save)");
assert(settings.musicTrack === "retro", "G: missing musicTrack -> keeps the default");

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
