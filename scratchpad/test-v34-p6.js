// Headless test for the MusicSys core — lookahead scheduler, menu ducking, title track, the Options
// "Music Track" row + label-dispatch refactor (v3.4 P6), and the intensity-layer machinery (v3.4 P7).
// v3.5: the five shipping tracks (BeaconTitle/Zen/Derelict/Drift/Warehouse) replaced the old
// title/tense/retro/ambient set, ported verbatim from tools/music-lab.html. THE FREEZE: no track
// carries a `tier` field any more, so the v3.4-P7 intensity layering is DORMANT (section I asserts
// this). Sections rewritten for the new track set: E (title loop len), F/O (4-value picker), G/M
// (default "zen"; a removed-track save falls back), H/L (new track names), I (freeze), N (5 tracks),
// P (one-step-gap rule), R (every loop >= 10s). Q's playNote-field wiring stays (the new tracks now
// USE noise/hp/drop/cutoffTo — Q's old "inertness" assertion was dropped).
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
  "MENU_OPTIONS", "SOUND_ROWS", "VOL_CATS", "bindings", "REBINDABLE", "keys",
  "nextWave", "difficultyFactor", "RAMP_WAVES", "updateMusic", "musicStateFor", "MUSIC_LAYER_THRESHOLD",
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
  MENU_OPTIONS, SOUND_ROWS, VOL_CATS, bindings, REBINDABLE, keys,
  nextWave, difficultyFactor, RAMP_WAVES, updateMusic, musicStateFor, MUSIC_LAYER_THRESHOLD,
} = A;

// Fire a real keydown through the actual window listener(s) registered by the script (both the menu
// handler at ~L1075 and the Capture-tools handler at ~L4140 — the latter is inert unless
// game.state==="playing" && !game.paused, so it never interferes with these menu-open tests).
function keydown(key, repeat) {
  const e = { key, repeat: !!repeat, preventDefault() {} };
  (listeners.keydown || []).forEach(f => f(e));
}
function clearKeys() { for (const k of Object.keys(keys)) keys[k] = false; }

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
// Covered the whole loop at least once and wrapped (55 s window > the ~21.8 s title loop).
assert(sched.length >= N, `E: scheduled at least a full loop (${sched.length} >= ${N} steps)`);
const covered = new Set(sched.map(e => e.step));
assert(covered.size === N, `E: every step index in the loop was scheduled (${covered.size}/${N})`);
// The title track is a real loop, not a jingle (>= 10 s; see section R for the all-tracks check).
const loopSec = N * stepDur;
assert(loopSec >= 10 && loopSec <= 90, `E: title loop length ${loopSec}s is a real loop (>= 10s)`);
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
// CS010 P4: the volume sliders + Music Track moved off Options onto the nested "sound" screen.
function openSoundAt(label) {
  game.paused = true; game.menu.screen = "sound";
  game.menu.index = SOUND_ROWS.indexOf(label);
  game.menu.rebinding = null;
}
// Nav rows -> their screens.
openOptionsAt("Sound / Music"); menuInput("confirm"); assert(game.menu.screen === "sound",        "F: Options row 'Sound / Music' -> sound");
openOptionsAt("Controls");     menuInput("confirm"); assert(game.menu.screen === "controls",    "F: Options row 'Controls' -> controls");
openOptionsAt("Achievements"); menuInput("confirm"); assert(game.menu.screen === "achievements", "F: Options row 'Achievements' -> achievements");
openOptionsAt("Difficulty");   menuInput("confirm"); assert(game.menu.screen === "difficulty",   "F: Options row 'Difficulty' -> difficulty");
openOptionsAt("Back");         menuInput("confirm"); assert(game.menu.screen === "root",          "F: Options row 'Back' -> root");

// The three volume sliders still nudge the routed gains (label-dispatched, not index-dispatched).
for (const [label, cat] of [["SFX Volume", "sfx"], ["Music Volume", "music"], ["Master Volume", "master"]]) {
  AudioSys.setVol(cat, 0.5);
  openSoundAt(label); menuInput("right"); assert(AudioSys.vol[cat] > 0.5, `F: '${label}' right raises ${cat}`);
  openSoundAt(label); menuInput("left");  menuInput("left"); assert(AudioSys.vol[cat] < 0.5, `F: '${label}' left lowers ${cat}`);
}

// (f) Music Track row cycles through all FOUR values and wraps, both directions (calm -> hot).
settings.musicTrack = "zen";
openSoundAt("Music Track");
menuInput("right"); assert(settings.musicTrack === "derelict",  "F: Music Track right: zen -> derelict");
menuInput("right"); assert(settings.musicTrack === "drift",     "F: Music Track right: derelict -> drift");
menuInput("right"); assert(settings.musicTrack === "warehouse", "F: Music Track right: drift -> warehouse");
menuInput("right"); assert(settings.musicTrack === "zen",       "F: Music Track right wraps: warehouse -> zen");
menuInput("left");  assert(settings.musicTrack === "warehouse", "F: Music Track left wraps: zen -> warehouse");
menuInput("left");  assert(settings.musicTrack === "drift",     "F: Music Track left: warehouse -> drift");
// It never lands on a value outside the known set.
const seen = new Set();
for (let i = 0; i < 16; i++) { openSoundAt("Music Track"); menuInput("right"); seen.add(settings.musicTrack); }
assert([...seen].every(v => MUSIC_TRACK_VALUES.includes(v)) && seen.size === 4, "F: Music Track only ever cycles the 4 known values");
// Sound screen's own Back row returns to Options, cursor on "Sound / Music".
openSoundAt("Back"); menuInput("confirm");
assert(game.menu.screen === "options" && MENU_OPTIONS[game.menu.index] === "Sound / Music", "F: Sound 'Back' -> Options, cursor on Sound/Music");

// =====================================================================
// G) Persistence — afd_settings_v1 round-trips EVERY pre-existing field + the new musicTrack.
// =====================================================================
AudioSys.vol.master = 0.3; AudioSys.vol.sfx = 0.7; AudioSys.vol.music = 0.4;
settings.shotPowerupMode = "shots"; settings.magnetMode = "pieces"; settings.musicTrack = "warehouse";
bindings.fire.keys = ["z"]; // a pre-existing rebind field
saveSettings();
assert("afd_settings_v1" in lsStore, "G: saved under the FROZEN key afd_settings_v1");
assert(STORAGE_KEY === "afd_settings_v1", "G: STORAGE_KEY constant is afd_settings_v1");
const stored = JSON.parse(lsStore["afd_settings_v1"]);
assert(stored.musicTrack === "warehouse", "G: musicTrack serialized");
assert(stored.shotPowerupMode === "shots" && stored.magnetMode === "pieces", "G: v3.0 P5 fields serialized (regression)");

// Corrupt in-memory, then load: every field must come back.
AudioSys.vol.master = 1; AudioSys.vol.sfx = 1; AudioSys.vol.music = 1;
settings.shotPowerupMode = "time"; settings.magnetMode = "time"; settings.musicTrack = "zen";
bindings.fire.keys = ["x"];
loadSettings();
assert(near(AudioSys.vol.master, 0.3) && near(AudioSys.vol.sfx, 0.7) && near(AudioSys.vol.music, 0.4), "G: volumes round-trip");
assert(settings.shotPowerupMode === "shots" && settings.magnetMode === "pieces", "G: difficulty modes round-trip (regression)");
assert(settings.musicTrack === "warehouse", "G: musicTrack round-trips");
assert(bindings.fire.keys[0] === "z", "G: rebindings round-trip (regression)");

// A corrupt/unknown musicTrack falls back to the default without throwing (additive-load pattern).
lsStore["afd_settings_v1"] = JSON.stringify({ ...stored, musicTrack: "bogus-track" });
settings.musicTrack = "zen"; // simulate the shipped default already in place
noThrow(() => loadSettings(), "G: loadSettings tolerates a corrupt musicTrack");
assert(settings.musicTrack === "zen", "G: corrupt musicTrack ignored -> keeps the default");
// A missing musicTrack key (older save) is likewise tolerated.
const noTrack = { ...stored }; delete noTrack.musicTrack;
lsStore["afd_settings_v1"] = JSON.stringify(noTrack);
settings.musicTrack = "zen";
noThrow(() => loadSettings(), "G: loadSettings tolerates a missing musicTrack (older save)");
assert(settings.musicTrack === "zen", "G: missing musicTrack -> keeps the default");

// (e) THE PERSISTENCE CONSEQUENCE: a save written by an OLD build holding musicTrack:"retro" (a track
// that no longer exists) loads cleanly on a FRESH instance and falls back to the new default "zen".
// afd_settings_v1 stays frozen — no key rename, no crash. Exercised through a real construction so
// the startup loadSettings() (which only accepts a value in MUSIC_TRACK_VALUES) runs against it.
for (const removed of ["retro", "tense", "ambient"]) {
  const store = { "afd_settings_v1": JSON.stringify({ shotPowerupMode: "shots", magnetMode: "pieces", musicTrack: removed }) };
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const savedLS = global.localStorage; global.localStorage = ls;
  let freshA;
  noThrow(() => { freshA = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub); },
    `G(e): a save holding removed track "${removed}" loads without throwing`);
  global.localStorage = savedLS;
  assert(freshA.settings.musicTrack === "zen", `G(e): removed track "${removed}" falls back to the default "zen"`);
  // The rest of the (still-valid) save is honored — proving it was a track-value rejection, not a whole-save reject.
  assert(freshA.settings.shotPowerupMode === "shots" && freshA.settings.magnetMode === "pieces",
    `G(e): the still-valid fields of the "${removed}" save loaded normally`);
}

// =====================================================================
// H) v3.4 P7 — all three gameplay tracks load, start, stop, and crossfade without throwing.
// =====================================================================
MusicSys.setState("off"); AudioSys.ctx.currentTime = 200;
for (const name of MUSIC_TRACK_VALUES) {
  noThrow(() => MusicSys.setState(name), `H: setState(${name}) does not throw`);
  assert(MusicSys.state === name, `H: state is ${name}`);
  assert(MusicSys.track === MUSIC_TRACKS[name], `H: ${name} track is the ${name} table`);
  assert(MusicSys.trackGain !== null, `H: ${name} track has a live trackGain`);
  assert(Array.isArray(MusicSys.layerGates) && MusicSys.layerGates.length === MUSIC_TRACKS[name].layers.length,
    `H: ${name} built one layerGate per layer`);
  AudioSys.ctx.currentTime += 1;
  const prevGain = MusicSys.trackGain;
  noThrow(() => MusicSys.setState("off"), `H: setState(off) from ${name} does not throw`);
  assert(prevGain.gain.rec.linearRamps.some(r => near(r.v, 0.0001)), `H: ${name} faded out on stop`);
  assert(MusicSys.trackGain === null, `H: off leaves no live trackGain after ${name}`);
  AudioSys.ctx.currentTime += 1;
}
// Crossfade directly between two gameplay tracks (no "off" in between).
MusicSys.setState("zen");
const zenGain = MusicSys.trackGain;
AudioSys.ctx.currentTime += 1;
noThrow(() => MusicSys.setState("derelict"), "H: zen -> derelict crossfade does not throw");
assert(MusicSys.state === "derelict", "H: state moved to derelict");
assert(zenGain.gain.rec.linearRamps.some(r => near(r.v, 0.0001)), "H: old (zen) track faded on crossfade");
assert(MusicSys.trackGain !== zenGain, "H: derelict has its own new trackGain");

// =====================================================================
// I) THE FREEZE (v3.5, requirement (c)): no track carries a `tier` field, so every gate is built at
//    (layer.tier || 1) === 1 (always on) and setIntensity() skips every tier-1 gate — it walks the
//    list and does nothing. The v3.4-P7 difficulty-gated intensity layering is DORMANT with no code
//    change. Assert that dormancy directly: all layers audible at every intensity, no gate ever ramps.
// =====================================================================
function audibleCount() { return MusicSys.layerGates.filter(lg => lg.node.gain.value > 0).length; }
// (c) NO layer in ANY track carries a tier field.
for (const name of Object.keys(MUSIC_TRACKS)) {
  const track = MUSIC_TRACKS[name];
  if (!track) continue; // "off" is null
  for (const layer of track.layers)
    assert(!("tier" in layer), `I(c): ${name}/${layer.name} carries NO tier field (the freeze)`);
}
MusicSys.setState("off"); AudioSys.ctx.currentTime += 1;
MusicSys.setIntensity(0);           // reset BEFORE the track loads
MusicSys.setState("drift");
assert(MusicSys.layerGates.every(lg => lg.tier === 1), "I: every built gate is tier 1 (layer.tier || 1)");
const allOn = MusicSys.layerGates.length;
assert(audibleCount() === allOn, `I: at f=0 every layer is already audible (${allOn}) — foundation-only tracks`);
// Sweep intensity across every old threshold and back down. Audible count never changes, and because
// setIntensity `continue`s past every tier-1 gate, NO gate is ever ramped.
for (const lg of MusicSys.layerGates) lg.node.gain.rec.linearRamps.length = 0;
for (const f of [0, 0.25, 0.5, 0.8, 1, 0.3, 0]) {
  AudioSys.ctx.currentTime += 0.5;
  MusicSys.setIntensity(f);
  assert(audibleCount() === allOn, `I: f=${f} still leaves all ${allOn} layers audible (intensity layering dormant)`);
}
assert(MusicSys.layerGates.every(lg => lg.node.gain.rec.linearRamps.length === 0),
  "I: setIntensity ramped NO gate across a full 0->1->0 sweep — the machinery walks and does nothing (freeze)");

// =====================================================================
// J) setIntensity is called from the REAL nextWave() and NOT from the per-frame update path.
// =====================================================================
startGame(); // resets game.wave to 1 via its own nextWave() call
let intensityCalls = 0;
const rawSetIntensity = MusicSys.setIntensity.bind(MusicSys);
MusicSys.setIntensity = function (f) { intensityCalls++; return rawSetIntensity(f); };
intensityCalls = 0; // startGame()'s own nextWave() already ran; count only what follows
for (let i = 0; i < 120; i++) update(1 / 60); // 2s of frames at a fixed wave, no wave clear
assert(intensityCalls === 0, `J: setIntensity called ${intensityCalls} times over 120 frames at a fixed wave (want 0)`);
nextWave();
assert(intensityCalls === 1, `J: nextWave() calls setIntensity exactly once (got ${intensityCalls})`);
MusicSys.setIntensity = rawSetIntensity;

// =====================================================================
// K) Tempo/key are IDENTICAL across intensity — scheduleStep never consults intensity; gating is a
//    downstream gain gate only. Capture the exact (layer, freq) note sequence over one full loop at
//    f=0 and again at f=1 for every gameplay track and diff them.
// =====================================================================
function captureNoteSequence(trackName, intensity) {
  MusicSys.setState("off"); AudioSys.ctx.currentTime += 1;
  MusicSys.setIntensity(intensity);
  MusicSys.setState(trackName);
  const track = MUSIC_TRACKS[trackName];
  const notes = [];
  const rawPlayNote = MusicSys.playNote.bind(MusicSys);
  MusicSys.playNote = function (layer, cell, t, i) { notes.push(layer.name + ":" + cell.f.toFixed(4)); return rawPlayNote(layer, cell, t, i); };
  const start = AudioSys.ctx.currentTime, dt = 1 / 60, loopLen = track.steps * track.stepDur;
  for (let t = start; t < start + loopLen + 1; t += dt) { AudioSys.ctx.currentTime = t; MusicSys.update(); }
  MusicSys.playNote = rawPlayNote;
  return notes;
}
for (const name of MUSIC_TRACK_VALUES) {
  const lowF = captureNoteSequence(name, 0);
  const highF = captureNoteSequence(name, 1);
  assert(lowF.length > 0, `K: ${name} produced note events at f=0`);
  assert(JSON.stringify(lowF) === JSON.stringify(highF),
    `K: ${name} note sequence (pitch+layer, every step) is byte-identical at f=0 vs f=1 — the loop thickens, it does not swap`);
}

// =====================================================================
// L) Switching tracks via settings.musicTrack crossfades (through updateMusic/musicStateFor) and
//    leaves exactly one track live.
// =====================================================================
assert(musicStateFor("title") === "title", "L: musicStateFor(title) -> title");
assert(musicStateFor("gameover") === "off", "L: musicStateFor(gameover) -> off");
settings.musicTrack = "drift";
assert(musicStateFor("playing") === "drift", "L: musicStateFor(playing) routes through settings.musicTrack");

MusicSys.setState("off"); AudioSys.ctx.currentTime += 1;
game.state = "playing"; game.paused = false;
settings.musicTrack = "drift";
updateMusic();
assert(MusicSys.state === "drift", "L: updateMusic() drives setState via the selected track");
const liveBefore = MusicSys.trackGain;
AudioSys.ctx.currentTime += 1;
settings.musicTrack = "warehouse"; // simulate an Options pause-menu change mid-game
updateMusic();
assert(MusicSys.state === "warehouse", "L: switching settings.musicTrack crossfades to the new track");
assert(MusicSys.trackGain !== null && MusicSys.trackGain !== liveBefore, "L: exactly one (new) track is live");
assert(liveBefore.gain.rec.linearRamps.some(r => near(r.v, 0.0001)), "L: the old track faded out, not hard-cut");

// =====================================================================
// M) The default gameplay track is "zen" (v3.5) on a completely fresh settings load (no saved data).
// =====================================================================
{
  const freshStore = {};
  const freshLS = {
    getItem: k => (k in freshStore ? freshStore[k] : null),
    setItem: (k, v) => { freshStore[k] = String(v); },
    removeItem: k => { delete freshStore[k]; },
  };
  const savedLS = global.localStorage;
  global.localStorage = freshLS;
  const freshA = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub);
  global.localStorage = savedLS;
  assert(freshA.settings.musicTrack === "zen", "M: a fresh game instance with no saved settings defaults musicTrack to zen");
}

// =====================================================================
// N) (d) Worst-case node creation for a single scheduled step, across ALL FIVE tracks (title + the
//    four gameplay tracks), is bounded. Every layer is always scheduled (gating is a downstream gain
//    gate, and it's frozen anyway), so this is the true worst case regardless of intensity. Measured
//    worst case across the five tracks: 13 (zen step 0: bass+padLo+padMid+kick = 3+4+4+2 nodes).
// =====================================================================
const NODE_BOUND = 16; // "a handful" — measured worst case is 13; see reported figures below
let overallMax = 0;
for (const name of ["title", ...MUSIC_TRACK_VALUES]) {
  MusicSys.setState("off"); AudioSys.ctx.currentTime += 1;
  MusicSys.setIntensity(1);
  MusicSys.setState(name);
  const track = MUSIC_TRACKS[name];
  const ctx = AudioSys.ctx;
  const rawGain = ctx.createGain, rawOsc = ctx.createOscillator, rawFilter = ctx.createBiquadFilter;
  let trackMax = 0;
  for (let step = 0; step < track.steps; step++) {
    let count = 0;
    ctx.createGain = () => { count++; return rawGain(); };
    ctx.createOscillator = () => { count++; return rawOsc(); };
    ctx.createBiquadFilter = () => { count++; return rawFilter(); };
    MusicSys.scheduleStep(step, ctx.currentTime);
    trackMax = Math.max(trackMax, count);
  }
  ctx.createGain = rawGain; ctx.createOscillator = rawOsc; ctx.createBiquadFilter = rawFilter;
  console.log(`(perf) ${name}: worst-case nodes created for a single scheduled step at max intensity = ${trackMax}`);
  overallMax = Math.max(overallMax, trackMax);
  assert(trackMax <= NODE_BOUND, `N: ${name} worst-case per-step node creation (${trackMax}) is bounded (<= ${NODE_BOUND})`);
}
console.log(`(perf) overall worst-case per-frame node creation at max intensity = ${overallMax}`);

// =====================================================================
// O) v3.5 P1 — keyboard menu repeat guard: a browser auto-repeat keydown (e.repeat === true) while a
//    menu is open must NOT drive menuInput; a genuine (non-repeat) keydown still must. Driven through
//    the REAL window "keydown" listener(s), not by calling handleMenuKey/menuInput directly.
// =====================================================================
game.paused = true; game.menu.screen = "sound"; game.menu.index = SOUND_ROWS.indexOf("Music Track");
game.menu.rebinding = null;
settings.musicTrack = "zen";
keydown("d", true);  // repeat
assert(settings.musicTrack === "zen", "O: a REPEAT keydown on Music Track does not change settings.musicTrack");
keydown("d", false); // genuine press
assert(settings.musicTrack === "derelict", "O: a non-repeat keydown on Music Track advances it exactly once");

// A volume slider row: repeat does not move AudioSys.vol; a non-repeat press does.
game.menu.index = SOUND_ROWS.indexOf("SFX Volume");
AudioSys.setVol("sfx", 0.5);
keydown("d", true);
assert(near(AudioSys.vol.sfx, 0.5), "O: a REPEAT keydown on a volume slider does not move AudioSys.vol");
keydown("d", false);
assert(near(AudioSys.vol.sfx, 0.6), "O: a non-repeat keydown on a volume slider moves it exactly one step");

// A Difficulty toggle row: same shape, on the "difficulty" screen.
game.menu.screen = "difficulty"; game.menu.index = 0; // "shot" row
settings.shotPowerupMode = "time";
keydown("d", true);
assert(settings.shotPowerupMode === "time", "O: a REPEAT keydown on a Difficulty toggle does not flip it");
keydown("d", false);
assert(settings.shotPowerupMode === "shots", "O: a non-repeat keydown on a Difficulty toggle flips it exactly once");

// The guard must not leak into normal (non-menu) play: a repeat keydown there still records into
// keys{}, same as any other keydown — gameplay legitimately wants held-key behavior.
game.paused = false; game.menu.screen = null; game.state = "playing";
clearKeys();
keydown("arrowleft", true); // repeat, but NOT in a menu
assert(keys["arrowleft"] === true, "O: a repeat keydown during normal play still records into keys{} (guard did not leak into gameplay)");

// =====================================================================
// P) (b) No track has a gap longer than ONE step where nothing across ANY layer is sounding. A single
//    one-step rest (e.g. a 16th rest inside Warehouse's groove) is music, not a hole — so the rule is
//    "max ONE consecutive silent step," NOT "no gap at all." The old ambient bug was multi-second
//    holes. Coverage is checked circularly (the loop repeats, so a run may span the seam). A note at
//    step s with duration d (in steps) is counted as sounding across steps s .. s+d-1 (mod STEPS).
// =====================================================================
for (const name of Object.keys(MUSIC_TRACKS)) {
  const track = MUSIC_TRACKS[name];
  if (!track) continue; // "off" is null
  const N = track.steps;
  const sounding = new Array(N).fill(false);
  for (const layer of track.layers) {
    for (let s = 0; s < N; s++) {
      const cell = layer.steps[s];
      if (!cell) continue;
      const dur = Math.max(1, Math.round(cell.dur));
      for (let k = 0; k < dur; k++) sounding[(s + k) % N] = true;
    }
  }
  // Longest run of consecutive silent steps, scanned over 2N so a seam-spanning run is caught whole.
  let worst = 0, run = 0;
  for (let i = 0; i < N * 2; i++) { if (!sounding[i % N]) { run++; if (run > worst) worst = run; } else run = 0; }
  worst = Math.min(worst, N); // a hypothetically all-silent track caps at N (never happens here)
  console.log(`(gap) ${name}: longest silent run = ${worst} step(s) over ${N} steps`);
  assert(worst <= 1, `P(b): ${name} has no gap longer than one step where nothing sounds (worst run = ${worst})`);
}

// =====================================================================
// R) (a) Every track's loop is at least 10 s long — a real loop, never a jingle.
// =====================================================================
for (const name of Object.keys(MUSIC_TRACKS)) {
  const track = MUSIC_TRACKS[name];
  if (!track) continue; // "off" is null
  const sec = track.steps * track.stepDur;
  console.log(`(loop) ${name}: ${sec.toFixed(2)}s (${track.steps} steps @ ${track.stepDur}s)`);
  assert(sec >= 10, `R(a): ${name} loop is >= 10s (${sec.toFixed(2)}s)`);
}

// =====================================================================
// Q) playNote() optional layer fields (noise/hp/drop/dropTime/q/cutoffTo/cutoffTime), whose wiring
//    landed in v3.5 P1 (BLOCK A). The v3.5 tracks now genuinely USE these (zen/warehouse noise+hp,
//    kick drop, every filtered pad cutoffTo/q), so the old "no shipped layer sets these" inertness
//    assertion is gone. (a) confirms each real track schedules a deterministic, non-empty note stream;
//    (b)-(d) drive synthetic layers directly through the real MusicSys.playNote to prove each field's
//    wiring in isolation.
// =====================================================================

// (a) For each shipping track, the scheduled note stream (step, layer, freq, dur, gain) is
//     deterministic (identical across two captures) and non-empty.
function captureFullStream(trackName) {
  MusicSys.setState("off"); AudioSys.ctx.currentTime += 1;
  MusicSys.setIntensity(1); // max intensity so every layer is gated audible -> every note is scheduled
  MusicSys.setState(trackName);
  const track = MUSIC_TRACKS[trackName];
  const notes = [];
  const rawPlayNote = MusicSys.playNote.bind(MusicSys);
  MusicSys.playNote = function (layer, cell, t, i) {
    notes.push([this.step, i, cell.f.toFixed(4), cell.dur, cell.g == null ? 1 : cell.g]);
    return rawPlayNote(layer, cell, t, i);
  };
  const start = AudioSys.ctx.currentTime, dt = 1 / 60, loopLen = track.steps * track.stepDur;
  for (let t = start; t < start + loopLen + 1; t += dt) { AudioSys.ctx.currentTime = t; MusicSys.update(); }
  MusicSys.playNote = rawPlayNote;
  return notes;
}
for (const name of ["title", ...MUSIC_TRACK_VALUES]) {
  const before = JSON.stringify(captureFullStream(name));
  const after = JSON.stringify(captureFullStream(name));
  assert(before === after, `Q(a): ${name} note stream is stable/deterministic across two captures`);
  assert(before.length > 2, `Q(a): ${name} produced a non-empty note stream`);
}
// The v3.5 tracks DO exercise playNote's optional branches — confirm at least one shipped layer sets
// each of noise / hp / drop / cutoffTo across the real track data (the inverse of the old inertness
// check: these branches are now reachable from real game data, and (b)-(d) below verify their wiring).
{
  const allLayers = ["title", ...MUSIC_TRACK_VALUES].flatMap(n => MUSIC_TRACKS[n].layers);
  assert(allLayers.some(l => l.noise), "Q(a): some shipped layer uses noise:true (zen shaker / warehouse hat)");
  assert(allLayers.some(l => l.hp != null), "Q(a): some shipped layer sets hp (highpass on the noise voices)");
  assert(allLayers.some(l => l.drop != null), "Q(a): some shipped layer sets drop (the kick punch)");
  assert(allLayers.some(l => l.cutoffTo != null), "Q(a): some shipped layer sets cutoffTo (filter-envelope pads/stabs)");
}

// Harness to drive MusicSys.playNote() directly against a synthetic one-layer track, bypassing the
// scheduler entirely (isolates the field under test from any real track data).
function playSyntheticNote(layer, cell) {
  MusicSys.setState("off"); AudioSys.ctx.currentTime += 1;
  const synthTrack = { stepDur: 0.5, steps: 1, layers: [Object.assign({ name: "synth", type: "sine", gain: 1 }, layer)] };
  MusicSys.track = synthTrack;
  MusicSys.layerGates = [{ node: makeGain(), tier: 1, target: 1 }];
  const ctx = AudioSys.ctx;
  const counts = { gain: 0, osc: 0, filter: 0, bufferSource: 0 };
  const rawGain = ctx.createGain, rawOsc = ctx.createOscillator, rawFilter = ctx.createBiquadFilter, rawBS = ctx.createBufferSource;
  ctx.createGain = () => { counts.gain++; return rawGain(); };
  ctx.createOscillator = () => { counts.osc++; return rawOsc(); };
  ctx.createBiquadFilter = () => { counts.filter++; return rawFilter(); };
  ctx.createBufferSource = () => { counts.bufferSource++; return rawBS(); };
  MusicSys.playNote(synthTrack.layers[0], cell, ctx.currentTime, 0);
  ctx.createGain = rawGain; ctx.createOscillator = rawOsc; ctx.createBiquadFilter = rawFilter; ctx.createBufferSource = rawBS;
  return counts;
}

// (b) noise:true creates a buffer source and no oscillator.
{
  MusicSys.noiseBuf = null; // force ensureNoiseBuf() to (re)build, proving the lazy-cache path works
  const counts = playSyntheticNote({ noise: true }, { f: 440, dur: 1, g: 1 });
  assert(counts.bufferSource === 1, `Q(b): noise:true creates exactly one buffer source (got ${counts.bufferSource})`);
  assert(counts.osc === 0, `Q(b): noise:true creates no oscillator (got ${counts.osc})`);
  assert(MusicSys.noiseBuf !== null, "Q(b): the noise buffer was lazily built and cached on MusicSys");
  const cachedBuf = MusicSys.noiseBuf;
  playSyntheticNote({ noise: true }, { f: 440, dur: 1, g: 1 });
  assert(MusicSys.noiseBuf === cachedBuf, "Q(b): a second noise note reuses the cached buffer, not a fresh one");
}
// A non-noise layer is unaffected: still one oscillator, no buffer source.
{
  const counts = playSyntheticNote({}, { f: 440, dur: 1, g: 1 });
  assert(counts.osc === 1 && counts.bufferSource === 0, "Q(b): a plain layer (no noise) still creates one oscillator and no buffer source");
}

// (c) a synthetic layer with drop creates exactly one frequency ramp (on the oscillator, an
//     exponentialRampToValueAtTime — the drop-pitch kick punch).
{
  const rawOsc = makeOsc, capturedOscs = [];
  AudioSys.ctx.createOscillator = () => { const o = makeOsc(); capturedOscs.push(o); return o; };
  playSyntheticNote({ drop: 12, dropTime: 0.08 }, { f: 440, dur: 1, g: 1 });
  AudioSys.ctx.createOscillator = () => makeOsc();
  assert(capturedOscs.length === 1, `Q(c): drop layer creates exactly one oscillator (got ${capturedOscs.length})`);
  assert(capturedOscs[0].frequency.rec.expRamps.length === 1,
    `Q(c): drop creates exactly one frequency exponentialRampToValueAtTime (got ${capturedOscs[0].frequency.rec.expRamps.length})`);
  const rampedTo = capturedOscs[0].frequency.rec.expRamps[0].v;
  const expected = 440 * Math.pow(2, -12 / 12);
  assert(near(rampedTo, expected, 1e-3), `Q(c): drop ramps to f*2^(-drop/12) = ${expected.toFixed(3)} (got ${rampedTo.toFixed(3)})`);
}
// A layer with no drop field creates no frequency ramp.
{
  const capturedOscs = [];
  AudioSys.ctx.createOscillator = () => { const o = makeOsc(); capturedOscs.push(o); return o; };
  playSyntheticNote({}, { f: 440, dur: 1, g: 1 });
  AudioSys.ctx.createOscillator = () => makeOsc();
  assert(capturedOscs[0].frequency.rec.expRamps.length === 0, "Q(c): no drop field -> no frequency ramp");
}

// (d) a synthetic layer with cutoffTo creates exactly one filter-frequency ramp, and a layer with
//     only cutoff creates none.
{
  const capturedFilters = [];
  AudioSys.ctx.createBiquadFilter = () => { const f = makeFilter(); capturedFilters.push(f); return f; };
  playSyntheticNote({ cutoff: 800, cutoffTo: 4000, cutoffTime: 0.3 }, { f: 440, dur: 1, g: 1 });
  AudioSys.ctx.createBiquadFilter = () => makeFilter();
  assert(capturedFilters.length === 1, `Q(d): cutoff layer creates exactly one filter (got ${capturedFilters.length})`);
  assert(capturedFilters[0].frequency.rec.expRamps.length === 1,
    `Q(d): cutoffTo creates exactly one filter-frequency ramp (got ${capturedFilters[0].frequency.rec.expRamps.length})`);
  assert(near(capturedFilters[0].frequency.rec.expRamps[0].v, 4000), "Q(d): filter ramps to cutoffTo (4000)");
}
{
  const capturedFilters = [];
  AudioSys.ctx.createBiquadFilter = () => { const f = makeFilter(); capturedFilters.push(f); return f; };
  playSyntheticNote({ cutoff: 800 }, { f: 440, dur: 1, g: 1 });
  AudioSys.ctx.createBiquadFilter = () => makeFilter();
  assert(capturedFilters.length === 1, "Q(d): cutoff-only layer still creates exactly one filter");
  assert(capturedFilters[0].frequency.rec.expRamps.length === 0, "Q(d): cutoff without cutoffTo creates no filter-frequency ramp");
}
// q defaults to the BiquadFilter default (1) when unset, and is applied when set.
{
  const capturedFilters = [];
  AudioSys.ctx.createBiquadFilter = () => { const f = makeFilter(); capturedFilters.push(f); return f; };
  playSyntheticNote({ cutoff: 800 }, { f: 440, dur: 1, g: 1 });
  playSyntheticNote({ cutoff: 800, q: 5 }, { f: 440, dur: 1, g: 1 });
  AudioSys.ctx.createBiquadFilter = () => makeFilter();
  assert(near(capturedFilters[0].Q.value, 1), "Q(d): no q field -> Q defaults to 1 (BiquadFilter default)");
  assert(near(capturedFilters[1].Q.value, 5), "Q(d): q:5 sets Q to 5");
}
// hp adds a second (highpass) filter in front of the lowpass, in signal order osc -> lowpass -> highpass.
{
  const capturedFilters = [];
  AudioSys.ctx.createBiquadFilter = () => { const f = makeFilter(); capturedFilters.push(f); return f; };
  playSyntheticNote({ cutoff: 800, hp: 200 }, { f: 440, dur: 1, g: 1 });
  AudioSys.ctx.createBiquadFilter = () => makeFilter();
  assert(capturedFilters.length === 2, `Q(d): cutoff+hp creates exactly two filters (got ${capturedFilters.length})`);
  const types = capturedFilters.map(f => f.type);
  assert(types.includes("lowpass") && types.includes("highpass"), "Q(d): one lowpass and one highpass filter created");
}

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
