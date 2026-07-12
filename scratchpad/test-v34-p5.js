// Headless test for v3.4 Phase 5 — the low-health warning (looping siren + red directional pointer).
// Follows GDD 5.4 rule 7: stub window/document/rAF (+ fake localStorage), eval the REAL <script>
// block, then drive the ACTUAL update()/damageShip()/killShip()/quitToTitle()/openPause()/draw()
// — no reimplementation of the logic under test.
//
//   node scratchpad/test-v34-p5.js
//
// Checks:
//  (A) constants: LOW_HP_THRESHOLD === 100; COLOR.lowhp is a hex distinct from COLOR.hp,
//      COLOR.clumpHot, and the low-HP bar fill "#ff7060".
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

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ---- Headless environment stubs (mirrors test-p4 / test-p5 / test-f8) ----
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
  "POWERUP_HEALTH_AMOUNT", "SHIP_MAX_HP", "DMG_SMALL"
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
  POWERUP_HEALTH_AMOUNT, SHIP_MAX_HP, DMG_SMALL
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
assert(COLOR.lowhp.toLowerCase() !== COLOR.clumpHot.toLowerCase(), "A: COLOR.lowhp distinct from COLOR.clumpHot");
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
    if (entry[0] === "save") cur = { translate: null, rotate: null, colors: [] };
    else if (entry[0] === "translate" && cur) cur.translate = [entry[1], entry[2]];
    else if (entry[0] === "rotate" && cur) cur.rotate = entry[1];
    else if (entry[0] === "strokeStyle" && cur) cur.colors.push(entry[1]);
    else if (entry[0] === "restore" && cur) { results.push(cur); cur = null; }
  }
  return results.filter(r => r.colors.includes(COLOR.lowhp));
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
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
