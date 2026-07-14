// Headless test for v3.4 Phase 5 — the low-health warning (looping siren + red directional pointer).
// Extended in v3.5 P3 (sections H-K) — the siren voice rebuilt into a pulsed, HP-scaled alarm.
// Follows GDD 5.4 rule 7: stub window/document/rAF (+ fake localStorage), eval the REAL <script>
// block, then drive the ACTUAL update()/damageShip()/killShip()/quitToTitle()/openPause()/draw()
// — no reimplementation of the logic under test.
//
//   node scratchpad/test-v34-p5.js
//
// Checks:
//  (A) constants: LOW_HP_THRESHOLD === 100; COLOR.lowhp is a hex distinct from COLOR.hp and the
//      low-HP bar fill "#ff7060" (v3.6 P1a: COLOR.clumpHot deleted, dropped from this check).
//  (B) the low-health STATE engages at exactly LOW_HP_THRESHOLD (threshold: yes; threshold+1: no).
//  (C) AudioSys.lowhp edge detection: fires (true) exactly once on the rising edge across several
//      frames (not every frame), fires (false) exactly once on the falling edge (a Health pickup
//      lifting HP back above threshold via the real applyPowerup).
//  (D) teardown: AudioSys.lowhp(false) fires on killShip(), on quitToTitle(), and on openPause(),
//      each while the siren is live — THE POINT OF THIS FILE.
//  (E) pointer angle: a health powerup at a known bearing — the chevron's translate/rotate matches
//      angleTo(ship, powerup), including across a world-wrap seam (where naive subtraction would be
//      ~180 degrees wrong).
//  (F) nearest-selection: two health powerups on the field — the pointer targets the nearer one by
//      wrap-aware dist2.
//  (G) draw() is crash-free in the low-health state with zero/one health powerup, and with the dock
//      chevron also showing.
//  (H) [v3.5 P3] the rebuilt voice builds its pulse LFO + harmonic partner without throwing on
//      lowhp(true), and lowhp(false) nulls every stored handle (this.lowhpOsc/this.lowhpGain/this.lowhpT).
//  (I) [v3.5 P3] lowhpSet: urgency at hp = LOW_HP_THRESHOLD is ~0 and at hp = 1 is ~1; pulse rate
//      and gain are monotonically non-decreasing as hp falls; params move via linearRampToValueAtTime
//      (never a bare .value set); safe no-op when the voice isn't live and when ctx is null.
//  (J) [v3.5 P3] a real 120-frame update() run at fixed low HP does not rebuild the voice (spies
//      ctx.createOscillator) — the per-frame lowhpSet call is idempotent on the node graph.
//  (K) [v3.5 P3] the four (D) teardown assertions above still pass unchanged against the rebuilt
//      voice — the load-bearing regression guard against a leaked droning oscillator.

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ---- Headless environment stubs ----
// A CONCRETE recording Web Audio stub (mirrors test-v34-p6's — needed here, unlike the old Proxy
// stub, to inspect gain/frequency AudioParam automation calls: v3.5 P3's lowhpSet must move params
// via linearRampToValueAtTime, never a bare .value set, and section J spies createOscillator to
// prove the rebuilt voice's per-frame lowhpSet call never rebuilds the node graph).
let oscCreateCount = 0;
function makeParam() {
  const rec = { linearRamps: [], setValues: [], cancels: [], bareSets: [] };
  const p = {
    _v: 1, rec,
    linearRampToValueAtTime(v, t) { rec.linearRamps.push({ v, t }); this._v = v; },
    exponentialRampToValueAtTime(v, t) { this._v = v; },
    setTargetAtTime(v) { this._v = v; },
    setValueAtTime(v, t) { rec.setValues.push({ v, t }); this._v = v; },
    cancelScheduledValues(t) { rec.cancels.push(t); },
  };
  Object.defineProperty(p, "value", { get() { return this._v; }, set(v) { this._v = v; rec.bareSets.push(v); } });
  return p;
}
function makeGain() { return { gain: makeParam(), connect(dest) { return dest; } }; }
function makeOsc() {
  oscCreateCount++;
  // CS010 P9: setPeriodicWave + onended added — the VoiceSys glottal source sets both.
  return { type: "sine", frequency: makeParam(), onended: null, connect(dest) { return dest; }, start() {}, stop() {}, setPeriodicWave() {}, disconnect() {} };
}
function makeFilter() { return { type: "lowpass", frequency: makeParam(), Q: makeParam(), connect(dest) { return dest; }, disconnect() {} }; }
function makeBufferSource() { return { buffer: null, loop: false, playbackRate: makeParam(), connect(dest) { return dest; }, start() {}, stop() {}, disconnect() {} }; }
function FakeAudioContext() {
  const ctx = { state: "running", currentTime: 0, sampleRate: 44100 };
  ctx.destination = makeGain();
  ctx.createGain = () => makeGain();
  ctx.createOscillator = () => makeOsc();
  ctx.createBiquadFilter = () => makeFilter();
  ctx.createBuffer = (ch, len) => ({ getChannelData() { return new Float32Array(len || 1); } });
  ctx.createBufferSource = () => makeBufferSource();
  // CS010 P9: the VoiceSys radio chain adds these node factories to the audio graph.
  ctx.createWaveShaper = () => ({ curve: null, connect(dest) { return dest; }, disconnect() {} });
  ctx.createDynamicsCompressor = () => ({ threshold: makeParam(), ratio: makeParam(), attack: makeParam(), release: makeParam(), connect(dest) { return dest; }, disconnect() {} });
  ctx.createPeriodicWave = () => ({});
  ctx.resume = () => {};
  return ctx;
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

// A recording 2D context: no-ops everything, but logs translate/rotate/save/restore calls and
// strokeStyle assignments in order, so drawPoly's (x, y, angle, color) calls can be recovered.
function makeRecordingCtx() {
  const log = [];
  const target = {};
  const recordedMethods = ["translate", "rotate", "save", "restore", "beginPath", "moveTo", "lineTo", "closePath", "stroke"];
  return new Proxy(target, {
    get(t, p) {
      if (p === "log") return log;
      if (recordedMethods.includes(p)) return (...args) => log.push([p, ...args]);
      if (p in t) return t[p];
      return (...args) => {};
    },
    set(t, p, v) {
      t[p] = v;
      if (p === "strokeStyle") log.push(["strokeStyle", v]);
      return true;
    }
  });
}
let recCtx = makeRecordingCtx();
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => recCtx };
const documentStub = { getElementById: () => canvasStub };

const returnList = [
  "startGame", "update", "draw", "game", "keys",
  "damageShip", "killShip", "quitToTitle", "openPause", "closePause",
  "applyPowerup", "AudioSys", "Powerup",
  "angleTo", "dist2", "shortDelta", "wrapPos",
  "LOW_HP_THRESHOLD", "COLOR", "VIEW_W", "VIEW_H", "WORLD_W", "WORLD_H",
  "POWERUP_HEALTH_AMOUNT", "SHIP_MAX_HP", "DMG_SMALL",
  "LOWHP_PULSE_RATE_MIN", "LOWHP_PULSE_RATE_MAX", "LOWHP_GAIN_MIN", "LOWHP_GAIN_MAX",
  "LOWHP_HARMONIC_GAIN_FRAC", "LOWHP_PARAM_RAMP"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, global.localStorage);
const {
  startGame, update, draw, game, keys,
  damageShip, killShip, quitToTitle, openPause, closePause,
  applyPowerup, AudioSys, Powerup,
  angleTo, dist2, shortDelta, wrapPos,
  LOW_HP_THRESHOLD, COLOR, VIEW_W, VIEW_H, WORLD_W, WORLD_H,
  POWERUP_HEALTH_AMOUNT, SHIP_MAX_HP, DMG_SMALL,
  LOWHP_PULSE_RATE_MIN, LOWHP_PULSE_RATE_MAX, LOWHP_GAIN_MIN, LOWHP_GAIN_MAX,
  LOWHP_HARMONIC_GAIN_FRAC, LOWHP_PARAM_RAMP
} = A;

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }

AudioSys.init();
const DT = 1 / 60;

// Spy on AudioSys.lowhp — records every call's argument, then forwards to the real implementation
// so the persistent-voice bookkeeping (this.lowhpOsc) still behaves normally.
const realLowhp = AudioSys.lowhp.bind(AudioSys);
let lowhpCalls = [];
AudioSys.lowhp = (on) => { lowhpCalls.push(on); realLowhp(on); };

function isolate() {
  game.debris.length = 0; game.hunters.length = 0; game.saucers.length = 0;
  game.powerups.length = 0; game.garbage.length = 0; game.bullets.length = 0;
  game.ship.x = 1800; game.ship.y = 1000; game.ship.vx = 0; game.ship.vy = 0;
  game.ship.invuln = 0; game.ship.cooldown = 0;
}

// =====================================================================
console.log("(A) constants");
assert(LOW_HP_THRESHOLD === 100, `A: LOW_HP_THRESHOLD === 100 (got ${LOW_HP_THRESHOLD})`);
assert(typeof COLOR.lowhp === "string" && /^#[0-9a-f]{6}$/i.test(COLOR.lowhp), "A: COLOR.lowhp is a hex color");
assert(COLOR.lowhp.toLowerCase() !== COLOR.hp.toLowerCase(), "A: COLOR.lowhp distinct from COLOR.hp");
assert(COLOR.lowhp.toLowerCase() !== "#ff7060", "A: COLOR.lowhp distinct from the low-HP bar fill (#ff7060)");

// =====================================================================
console.log("(B) low-health state engages at exactly LOW_HP_THRESHOLD");
startGame(); isolate();
game.ship.hp = LOW_HP_THRESHOLD + 1;
lowhpCalls = [];
update(DT);
assert(!lowhpCalls.includes(true), "B: at threshold+1, siren does NOT engage");
game.ship.hp = LOW_HP_THRESHOLD;
lowhpCalls = [];
update(DT);
assert(lowhpCalls.length === 1 && lowhpCalls[0] === true, "B: at exactly threshold, siren engages");

// =====================================================================
console.log("(C) AudioSys.lowhp edge detection: fires once on rising edge, once on falling edge");
startGame(); isolate();
game.ship.hp = SHIP_MAX_HP;
lowhpCalls = [];
update(DT); update(DT); update(DT);
assert(lowhpCalls.length === 0, "C: no siren calls while HP is healthy across several frames");
game.ship.hp = LOW_HP_THRESHOLD; // rising edge
lowhpCalls = [];
update(DT);
assert(lowhpCalls.length === 1 && lowhpCalls[0] === true, "C: siren engages exactly once on the rising edge");
lowhpCalls = [];
for (let i = 0; i < 10; i++) update(DT); // HP stays low; no further popups/hazards move it
assert(lowhpCalls.length === 0, `C: siren does NOT re-fire every frame while state is unchanged (got ${lowhpCalls.length} calls)`);
// falling edge via a REAL Health pickup lifting HP back above threshold
assert(LOW_HP_THRESHOLD + POWERUP_HEALTH_AMOUNT > LOW_HP_THRESHOLD, "sanity: a Health pickup clears the threshold");
lowhpCalls = [];
applyPowerup("health");
assert(game.ship.hp === LOW_HP_THRESHOLD + POWERUP_HEALTH_AMOUNT, "C: applyPowerup(health) actually raised HP");
update(DT);
assert(lowhpCalls.length === 1 && lowhpCalls[0] === false, "C: siren disengages exactly once on the falling edge (Health pickup)");
lowhpCalls = [];
for (let i = 0; i < 10; i++) update(DT);
assert(lowhpCalls.length === 0, "C: no further calls once healthy and steady");

// =====================================================================
console.log("(D) teardown: killShip / quitToTitle / openPause all silence a live siren");
startGame(); isolate();
game.ship.hp = LOW_HP_THRESHOLD;
update(DT); // engage the siren
assert(game.lowHpSiren === true, "D: precondition — siren latch is live before killShip");
lowhpCalls = [];
killShip();
assert(lowhpCalls.length === 1 && lowhpCalls[0] === false, "D: killShip() calls AudioSys.lowhp(false)");
assert(game.lowHpSiren === false, "D: killShip() clears the latch");

startGame(); isolate();
game.ship.hp = LOW_HP_THRESHOLD;
update(DT);
assert(game.lowHpSiren === true, "D: precondition — siren latch is live before quitToTitle");
lowhpCalls = [];
quitToTitle();
assert(lowhpCalls.length === 1 && lowhpCalls[0] === false, "D: quitToTitle() calls AudioSys.lowhp(false)");
assert(game.lowHpSiren === false, "D: quitToTitle() clears the latch");

startGame(); isolate();
game.ship.hp = LOW_HP_THRESHOLD;
update(DT);
assert(game.lowHpSiren === true, "D: precondition — siren latch is live before openPause");
lowhpCalls = [];
openPause();
assert(lowhpCalls.length === 1 && lowhpCalls[0] === false, "D: openPause() calls AudioSys.lowhp(false)");
assert(game.lowHpSiren === false, "D: openPause() clears the latch");
closePause();

// =====================================================================
console.log("(E) pointer angle matches angleTo(ship, powerup), including across a world-wrap seam");
function findLowhpChevron() {
  // The chevron is drawn via drawPoly, which does: save() -> translate(x,y) -> rotate(a) ->
  // beginPath -> moveTo/lineTo x3 -> closePath -> [glowStroke: strokeStyle=color, stroke()] -> restore().
  // Scan the recorded log for a translate/rotate pair whose segment (up to the next save/restore)
  // sets strokeStyle to COLOR.lowhp.
  const log = recCtx.log;
  let cur = null, results = [];
  for (const entry of log) {
    if (entry[0] === "save") cur = { translate: null, rotate: null, colors: [], lineTos: 0 };
    else if (entry[0] === "translate" && cur) cur.translate = [entry[1], entry[2]];
    else if (entry[0] === "rotate" && cur) cur.rotate = entry[1];
    else if (entry[0] === "lineTo" && cur) cur.lineTos++;
    else if (entry[0] === "strokeStyle" && cur) cur.colors.push(entry[1]);
    else if (entry[0] === "restore" && cur) { results.push(cur); cur = null; }
  }
  // The chevron is a 3-vertex triangle (moveTo + 2 lineTo). Filter on vertex count as well as color
  // so the CS009 P2 HULL-ring ship glyph — a 4-vertex poly (3 lineTo) that also strokes COLOR.lowhp
  // when the hull is critical — is not mistaken for a second chevron.
  return results.filter(r => r.colors.includes(COLOR.lowhp) && r.lineTos === 2);
}

startGame(); isolate();
game.state = "playing"; game.paused = false;
game.ship.hp = LOW_HP_THRESHOLD;
game.ship.x = 1000; game.ship.y = 1000;
const hp1 = new Powerup(1200, 1100, "health");
game.powerups = [hp1];
recCtx.log.length = 0;
draw();
let hits = findLowhpChevron();
assert(hits.length === 1, `E: exactly one low-hp chevron drawn (got ${hits.length})`);
let expectedAngle = angleTo(game.ship, hp1);
assert(Math.abs(hits[0].rotate - expectedAngle) < 1e-9, `E: chevron angle matches angleTo(ship, powerup) (got ${hits[0].rotate}, expected ${expectedAngle})`);
const [cx, cy] = hits[0].translate;
assert(Math.abs(cx - (VIEW_W / 2 + Math.cos(expectedAngle) * 58)) < 1e-6 &&
       Math.abs(cy - (VIEW_H / 2 + Math.sin(expectedAngle) * 58)) < 1e-6,
  "E: chevron orbits at radius 58 around screen center");

// Across a world-wrap seam: ship near the world edge, powerup just past the wrap boundary — the
// short way around is the opposite direction from the naive (unwrapped) angle.
startGame(); isolate();
game.state = "playing"; game.paused = false;
game.ship.hp = LOW_HP_THRESHOLD;
game.ship.x = 5; game.ship.y = 700;
const hp2 = new Powerup(WORLD_W - 5, 700, "health"); // 10px away the wrap-aware way, ~WORLD_W-10 the naive way
game.powerups = [hp2];
recCtx.log.length = 0;
draw();
hits = findLowhpChevron();
assert(hits.length === 1, `E(wrap): exactly one low-hp chevron drawn (got ${hits.length})`);
const wrapExpected = angleTo(game.ship, hp2);
const naiveAngle = Math.atan2(hp2.y - game.ship.y, hp2.x - game.ship.x);
assert(Math.abs(wrapExpected - naiveAngle) > Math.PI / 2, "E(wrap): sanity — wrap-aware angle really does differ sharply from the naive one");
assert(Math.abs(hits[0].rotate - wrapExpected) < 1e-9, `E(wrap): chevron uses the wrap-aware angle, not the naive one (got ${hits[0].rotate}, expected ${wrapExpected})`);

// =====================================================================
console.log("(F) nearest-selection: with two health powerups, the pointer targets the nearer one");
startGame(); isolate();
game.state = "playing"; game.paused = false;
game.ship.hp = LOW_HP_THRESHOLD;
game.ship.x = 1000; game.ship.y = 1000;
const near = new Powerup(1050, 1000, "health");  // close
const far = new Powerup(1000, 1400, "health");   // far
game.powerups = [far, near]; // deliberately out of distance order
recCtx.log.length = 0;
draw();
hits = findLowhpChevron();
assert(hits.length === 1, `F: exactly one low-hp chevron drawn with two powerups on field (got ${hits.length})`);
const nearAngle = angleTo(game.ship, near);
const farAngle = angleTo(game.ship, far);
assert(Math.abs(hits[0].rotate - nearAngle) < 1e-9 && Math.abs(hits[0].rotate - farAngle) > 1e-6,
  "F: chevron targets the nearer powerup, by wrap-aware dist2");

// =====================================================================
console.log("(G) draw() is crash-free: zero / one health powerup, with the dock chevron also showing");
startGame(); isolate();
game.state = "playing"; game.paused = false;
game.ship.hp = LOW_HP_THRESHOLD;
game.powerups = [];
recCtx.log.length = 0;
draw();
assert(findLowhpChevron().length === 0, "G: hidden (no chevron drawn) when no health powerup exists on the field");

game.powerups = [new Powerup(game.ship.x + 100, game.ship.y, "health")];
game.chain = [{ x: game.ship.x, y: game.ship.y, px: game.ship.x, py: game.ship.y, spin: 0, spinRate: 0, mass: 1 }];
game.dock = { x: game.ship.x + 300, y: game.ship.y + 300, radius: 60 };
recCtx.log.length = 0;
draw();
assert(findLowhpChevron().length === 1, "G: chevron drawn (one health powerup) alongside the dock chevron, no throw");

// =====================================================================
console.log("(H) [v3.5 P3] the rebuilt voice builds pulse LFO + harmonic partner, tears down fully");
AudioSys.lowhp(false); // clean slate — any prior section may have left the voice live
assert(AudioSys.lowhpOsc === null, "H: precondition — voice not live before this section");
AudioSys.lowhp(true);
assert(AudioSys.lowhpOsc && AudioSys.lowhpOsc.root && AudioSys.lowhpOsc.harm && AudioSys.lowhpOsc.lfo,
  "H: lowhp(true) builds root + harmonic + lfo oscillators without throwing");
assert(AudioSys.lowhpGain && AudioSys.lowhpGain.rootLevel && AudioSys.lowhpGain.harmLevel &&
  AudioSys.lowhpGain.pulseGain && AudioSys.lowhpGain.lfoGain,
  "H: lowhp(true) builds root/harmonic level gains + the pulse gain + its LFO depth gain");
assert(AudioSys.lowhpOsc.harm.frequency.value > AudioSys.lowhpOsc.root.frequency.value,
  "H: the harmonic partner sits above the root (a fifth/octave, not unison)");
AudioSys.lowhp(false);
assert(AudioSys.lowhpOsc === null && AudioSys.lowhpGain === null && AudioSys.lowhpT === null,
  "H: lowhp(false) nulls every stored handle (lowhpOsc/lowhpGain/lowhpT)");

// =====================================================================
console.log("(I) [v3.5 P3] lowhpSet: HP-scaled urgency, monotonic, ramped (never a bare set), safe no-op");
// safe no-op: ctx null
const realCtx = AudioSys.ctx;
AudioSys.ctx = null;
let threw = false;
try { AudioSys.lowhpSet(0.5); } catch (e) { threw = true; }
assert(!threw, "I: lowhpSet is a safe no-op when ctx is null");
AudioSys.ctx = realCtx;
// safe no-op: voice not live
AudioSys.lowhp(false);
threw = false;
try { AudioSys.lowhpSet(0.5); } catch (e) { threw = true; }
assert(!threw, "I: lowhpSet is a safe no-op when the voice is not live");
assert(AudioSys.lowhpOsc === null, "I: lowhpSet does not build a voice as a side effect");

// urgency at hp=LOW_HP_THRESHOLD is ~0, at hp=1 is ~1 — driven through the REAL update() edge-detect
// site, not a direct lowhpSet(t) call, so this exercises the actual t = 1 - hp/LOW_HP_THRESHOLD formula.
startGame(); isolate();
game.ship.hp = LOW_HP_THRESHOLD;
update(DT);
assert(Math.abs(AudioSys.lowhpT - 0) < 1e-9, `I: urgency at hp=LOW_HP_THRESHOLD is ~0 (got ${AudioSys.lowhpT})`);
game.ship.hp = 1;
update(DT);
assert(AudioSys.lowhpT > 0.98, `I: urgency at hp=1 is ~1 (got ${AudioSys.lowhpT})`);

// monotonic non-decreasing pulse rate + gain as hp falls, moved via linearRampToValueAtTime, never
// a bare per-frame .value set (checked against the ramp record accumulated AFTER construction, since
// the initial build legitimately bare-sets starting levels once — same idiom as the P7 tier-1 gate).
AudioSys.lowhp(false); AudioSys.lowhp(true);
const lfoFreqParam = AudioSys.lowhpOsc.lfo.frequency;
const rootGainParam = AudioSys.lowhpGain.rootLevel.gain;
const harmGainParam = AudioSys.lowhpGain.harmLevel.gain;
const bareBaseline = { lfo: lfoFreqParam.rec.bareSets.length, root: rootGainParam.rec.bareSets.length, harm: harmGainParam.rec.bareSets.length };
let lastRate = -1, lastGain = -1;
for (const t of [0, 0.25, 0.5, 0.75, 1]) {
  AudioSys.lowhpSet(t);
  const rate = LOWHP_PULSE_RATE_MIN + (LOWHP_PULSE_RATE_MAX - LOWHP_PULSE_RATE_MIN) * t;
  const gain = LOWHP_GAIN_MIN + (LOWHP_GAIN_MAX - LOWHP_GAIN_MIN) * t;
  assert(rate >= lastRate, `I: pulse rate non-decreasing at t=${t}`);
  assert(gain >= lastGain, `I: gain non-decreasing at t=${t}`);
  lastRate = rate; lastGain = gain;
  const lastRamp = lfoFreqParam.rec.linearRamps[lfoFreqParam.rec.linearRamps.length - 1];
  assert(lastRamp && Math.abs(lastRamp.v - rate) < 1e-9, `I: lfo.frequency ramps to the expected rate at t=${t}`);
  const lastRootRamp = rootGainParam.rec.linearRamps[rootGainParam.rec.linearRamps.length - 1];
  assert(lastRootRamp && Math.abs(lastRootRamp.v - gain) < 1e-9, `I: rootLevel.gain ramps to the expected gain at t=${t}`);
  const lastHarmRamp = harmGainParam.rec.linearRamps[harmGainParam.rec.linearRamps.length - 1];
  assert(lastHarmRamp && Math.abs(lastHarmRamp.v - gain * LOWHP_HARMONIC_GAIN_FRAC) < 1e-9, `I: harmLevel.gain ramps to gain*LOWHP_HARMONIC_GAIN_FRAC at t=${t}`);
}
assert(lfoFreqParam.rec.bareSets.length === bareBaseline.lfo && rootGainParam.rec.bareSets.length === bareBaseline.root &&
  harmGainParam.rec.bareSets.length === bareBaseline.harm,
  "I: no bare .value set was added by any lowhpSet call — every move was a linearRampToValueAtTime");
// idempotent on t: repeating the same t schedules no new ramp
const ramps1 = lfoFreqParam.rec.linearRamps.length;
AudioSys.lowhpSet(1);
assert(lfoFreqParam.rec.linearRamps.length === ramps1, "I: lowhpSet is idempotent — repeating the same t schedules no new ramp");

// =====================================================================
console.log("(J) [v3.5 P3] a fixed-HP 120-frame update() run does not rebuild the voice");
// Identity check, not a global oscillator-count spy: other subsystems (the heartbeat, wave-clear
// re-spawn, a saucer timer) legitimately create their OWN oscillators during a real update() run,
// which would make a global creation counter flaky/contaminated. Snapshotting the siren's own node
// references and asserting they're the SAME objects 120 frames later is a direct, uncontaminated
// proof that the per-frame lowhpSet(t) call never tears down and rebuilds the voice.
AudioSys.lowhp(false);
startGame(); isolate();
game.ship.hp = LOW_HP_THRESHOLD - 10; // engage the siren this frame
update(DT);
assert(game.lowHpSiren === true, "J: precondition — siren engaged");
const before = { root: AudioSys.lowhpOsc.root, harm: AudioSys.lowhpOsc.harm, lfo: AudioSys.lowhpOsc.lfo,
  rootLevel: AudioSys.lowhpGain.rootLevel, harmLevel: AudioSys.lowhpGain.harmLevel, pulseGain: AudioSys.lowhpGain.pulseGain };
for (let i = 0; i < 120; i++) { game.ship.hp = LOW_HP_THRESHOLD - 10; update(DT); } // HP pinned — steady low-health state
assert(game.lowHpSiren === true, "J: siren still engaged after 120 steady frames");
assert(AudioSys.lowhpOsc.root === before.root && AudioSys.lowhpOsc.harm === before.harm && AudioSys.lowhpOsc.lfo === before.lfo,
  "J: the same oscillator objects persist across 120 frames — no rebuild");
assert(AudioSys.lowhpGain.rootLevel === before.rootLevel && AudioSys.lowhpGain.harmLevel === before.harmLevel && AudioSys.lowhpGain.pulseGain === before.pulseGain,
  "J: the same gain node objects persist across 120 frames — no rebuild");
AudioSys.lowhp(false); game.lowHpSiren = false;

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
