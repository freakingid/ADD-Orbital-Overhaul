// Headless test for v3.4 Phase 6 — MusicSys core: lookahead scheduler, menu ducking, title track,
// and the Options "Music Track" row + label-dispatch refactor.
// Extended in v3.4 P7 (sections H-N) — the three gameplay tracks + difficulty-gated intensity layers.
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
  "MENU_OPTIONS", "VOL_CATS", "bindings", "REBINDABLE", "keys",
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
  MENU_OPTIONS, VOL_CATS, bindings, REBINDABLE, keys,
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
MusicSys.setState("tense");
const tenseGain = MusicSys.trackGain;
AudioSys.ctx.currentTime += 1;
noThrow(() => MusicSys.setState("retro"), "H: tense -> retro crossfade does not throw");
assert(MusicSys.state === "retro", "H: state moved to retro");
assert(tenseGain.gain.rec.linearRamps.some(r => near(r.v, 0.0001)), "H: old (tense) track faded on crossfade");
assert(MusicSys.trackGain !== tenseGain, "H: retro has its own new trackGain");

// =====================================================================
// I) Layer gating: at f = 0.0 / 0.25 / 0.5 / 0.8, exactly 1 / 2 / 3 / 4 layers are audible (gain > 0).
//    Boundary crossings move via linearRampToValueAtTime — a ramp, never a jump.
// =====================================================================
function audibleCount() { return MusicSys.layerGates.filter(lg => lg.node.gain.value > 0).length; }
MusicSys.setState("off"); AudioSys.ctx.currentTime += 1;
MusicSys.setIntensity(0);           // reset BEFORE the track loads, so it builds at f=0
MusicSys.setState("retro");
assert(audibleCount() === 1, `I: f=0 -> exactly 1 layer audible (got ${audibleCount()})`);

const points = [[0.25, 2], [0.5, 3], [0.8, 4]];
for (const [f, expect] of points) {
  for (const lg of MusicSys.layerGates) lg.node.gain.rec.linearRamps.length = 0; // isolate this transition
  AudioSys.ctx.currentTime += 1;
  MusicSys.setIntensity(f);
  assert(audibleCount() === expect, `I: f=${f} -> exactly ${expect} layers audible (got ${audibleCount()})`);
  const anyRamped = MusicSys.layerGates.some(lg => lg.node.gain.rec.linearRamps.length > 0);
  assert(anyRamped, `I: f=${f} crossing moved at least one gate via a RAMP`);
  // Tier 1 (foundation) is bare-set once at track construction and never revisited by setIntensity —
  // that's correct (it's always on), so only tiers 2-4 are checked for "moved by ramp, not a jump."
  const anyBareJump = MusicSys.layerGates.some(lg =>
    lg.tier > 1 && lg.node.gain.rec.bareSets.includes(1) && lg.node.gain.rec.linearRamps.length === 0);
  assert(!anyBareJump, `I: f=${f} — no gated (tier 2-4) layer flipped via a bare .value jump`);
}
// Dropping back down ramps layers back off too (not just up).
for (const lg of MusicSys.layerGates) lg.node.gain.rec.linearRamps.length = 0;
AudioSys.ctx.currentTime += 1;
MusicSys.setIntensity(0);
assert(audibleCount() === 1, "I: dropping f back to 0 mutes back down to 1 audible layer");
assert(MusicSys.layerGates.some(lg => lg.node.gain.rec.linearRamps.some(r => near(r.v, 0))),
  "I: the drop back down is also a ramp");

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
settings.musicTrack = "tense";
assert(musicStateFor("playing") === "tense", "L: musicStateFor(playing) routes through settings.musicTrack");

MusicSys.setState("off"); AudioSys.ctx.currentTime += 1;
game.state = "playing"; game.paused = false;
settings.musicTrack = "tense";
updateMusic();
assert(MusicSys.state === "tense", "L: updateMusic() drives setState via the selected track");
const liveBefore = MusicSys.trackGain;
AudioSys.ctx.currentTime += 1;
settings.musicTrack = "ambient"; // simulate an Options pause-menu change mid-game
updateMusic();
assert(MusicSys.state === "ambient", "L: switching settings.musicTrack crossfades to the new track");
assert(MusicSys.trackGain !== null && MusicSys.trackGain !== liveBefore, "L: exactly one (new) track is live");
assert(liveBefore.gain.rec.linearRamps.some(r => near(r.v, 0.0001)), "L: the old track faded out, not hard-cut");

// =====================================================================
// M) The default gameplay track is "retro" on a completely fresh settings load (no saved data).
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
  assert(freshA.settings.musicTrack === "retro", "M: a fresh game instance with no saved settings defaults musicTrack to retro");
}

// =====================================================================
// N) Node-creation count per frame (per scheduled step) at max intensity is bounded. All layers are
//    always scheduled regardless of gating (only the downstream gain gate is intensity-dependent), so
//    max intensity and f=0 create the same node count — this measures the worst case across a full
//    loop of each gameplay track.
// =====================================================================
const NODE_BOUND = 16; // "a handful" (FLAG-9c) — see reported figures below
let overallMax = 0;
for (const name of MUSIC_TRACK_VALUES) {
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
game.paused = true; game.menu.screen = "options"; game.menu.index = MENU_OPTIONS.indexOf("Music Track");
game.menu.rebinding = null;
settings.musicTrack = "tense";
keydown("d", true);  // repeat
assert(settings.musicTrack === "tense", "O: a REPEAT keydown on Music Track does not change settings.musicTrack");
keydown("d", false); // genuine press
assert(settings.musicTrack === "retro", "O: a non-repeat keydown on Music Track advances it exactly once");

// A volume slider row: repeat does not move AudioSys.vol; a non-repeat press does.
game.menu.index = MENU_OPTIONS.indexOf("SFX Volume");
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
// P) v3.5 P1 — Ambient's tier-1 (foundation) layer is audibly present, not a near-silent single blip.
//    Regression guard against the original bug: 1 note per 8s loop while tiers 2-4 are gated off below
//    wave 3, so a wave-1 player selecting Ambient heard what sounded like "the music stopped."
// =====================================================================
function tier1NoteCount(trackName) {
  const track = MUSIC_TRACKS[trackName];
  let n = 0;
  for (const layer of track.layers) {
    if ((layer.tier || 1) !== 1) continue;
    for (const c of layer.steps) if (c) n++;
  }
  return n;
}
// Notes-per-second-of-loop-time, so tracks with very different tempos/loop lengths are compared fairly.
function tier1Density(trackName) {
  const track = MUSIC_TRACKS[trackName];
  return tier1NoteCount(trackName) / (track.steps * track.stepDur);
}
const ambNotes = tier1NoteCount("ambient"), ambDensity = tier1Density("ambient");
const tenseDensity = tier1Density("tense"), retroDensity = tier1Density("retro");
console.log(`(density) tier-1-only notes/sec: ambient=${ambDensity.toFixed(3)} tense=${tenseDensity.toFixed(3)} retro=${retroDensity.toFixed(3)} (ambient raw count/loop=${ambNotes})`);
// Regression guard, not a precise target: ambient's tempo is deliberately ~4-8x slower than its
// siblings (8s loop @ stepDur 0.5 vs. tense's 4s @ 0.125 / retro's 3.2s @ 0.1), so a much lower
// notes/sec density is expected and correct — the bug was near-ZERO presence, not "slower." Bound
// chosen generously loose (>= 1/25th of the faster tracks) so it only fires if ambient regresses
// back toward "effectively nothing," while still requiring a real minimum note count.
assert(ambNotes >= 4, `P: ambient tier-1 has a real minimum note count over one loop (${ambNotes} >= 4)`);
assert(ambDensity >= tenseDensity / 25, `P: ambient tier-1 density (${ambDensity.toFixed(3)}/s) is within a sane factor of tense's (${tenseDensity.toFixed(3)}/s)`);
assert(ambDensity >= retroDensity / 25, `P: ambient tier-1 density (${ambDensity.toFixed(3)}/s) is within a sane factor of retro's (${retroDensity.toFixed(3)}/s)`);

// Ambient's tier-1 notes must be spread across the loop, not clustered in a single cell (the original
// bug: exactly one note, i.e. one occupied step, for the whole loop).
{
  const track = MUSIC_TRACKS.ambient;
  const bassLayer = track.layers.find(l => (l.tier || 1) === 1);
  const occupiedSteps = bassLayer.steps.reduce((n, c, i) => c ? n.concat(i) : n, []);
  assert(occupiedSteps.length >= 2, `P: ambient tier-1 occupies more than one step in the loop (steps: ${occupiedSteps.join(",")})`);
  const spread = Math.max(...occupiedSteps) - Math.min(...occupiedSteps);
  assert(spread >= track.steps * 0.5, `P: ambient tier-1 notes are spread across at least half the loop, not clustered (spread=${spread}/${track.steps})`);
}

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
