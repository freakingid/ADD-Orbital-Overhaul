// Headless test for Phase 8 (F8 Pause Modal, Options Menu & Control Rebinding).
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator (+ a fake localStorage), eval the REAL
// <script> block, then drive the actual menu/audio/rebind code — no reimplementation under test.
//
//   node scratchpad/test-f8.js
//
// What can only be judged in a real browser (the playtest asks): whether menu navigation FEELS
// natural on keyboard and gamepad, and whether a rebound control takes effect immediately in play.
// What IS checkable headlessly, and what this verifies:
//  (A) the menu state machine: playing -> pause -> root -> options -> controls, and back out;
//  (B) volume sliders change AudioSys.vol AND the routed gain nodes, clamped to [0,1];
//  (C) live rebinding: capturing a key/button rewrites the binding and takes effect via input.*();
//  (D) input SEPARATION: a menu keypress (and a rebind capture) never leaks into keys{}/ship control,
//      and gameplay is frozen while paused;
//  (E) Return to Defaults restores the rebindable table to the shipped snapshot exactly;
//  (F) gamepad menu navigation (edge-detected D-Pad) + pad rebind capture;
//  (G) localStorage persistence round-trips (serialize -> mutate -> load -> restored).

"use strict";
const fs = require("fs");
const path = require("path");

// ---- Extract the real game script ----
const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ---- Headless environment stubs ----
const noopCtx = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub };

// No-op AudioContext that survives init() building the master/sfx/music gain graph. Every unknown
// access returns a chainable node; gain.value is a writable plain field so setVol() is observable.
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

// window with LISTENER CAPTURE so the test can dispatch synthetic key events into the REAL handlers.
const listeners = {};
const windowStub = {
  addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
  innerWidth: 1280, innerHeight: 720,
  AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext
};
function keydown(key) { const e = { key, preventDefault() {} }; (listeners.keydown || []).forEach(f => f(e)); }
function keyup(key)   { const e = { key, preventDefault() {} }; (listeners.keyup   || []).forEach(f => f(e)); }

const performanceStub = { now: () => Date.now() };
const rafStub = () => 0;

let fakePads = [];
const navigatorStub = { getGamepads: () => fakePads };

// Fake in-memory localStorage on the global — the code references a bare `localStorage`, guarded by
// `typeof`. This lets us round-trip the persistence logic headlessly (the REAL browser localStorage
// still needs verifying outside the artifact sandbox — noted in STATUS.md).
const lsStore = {};
global.localStorage = {
  getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: k => { delete lsStore[k]; }
};

const returnList = [
  "startGame", "update", "game", "keys", "input", "bindings", "GP", "GP_DEADZONE",
  "pollGamepad", "handleGamepadMenu",
  "openPause", "closePause", "menuInput", "menuActive",
  "returnToDefaults", "saveSettings", "loadSettings",
  "DEFAULT_BINDINGS", "REBINDABLE", "MENU_OPTIONS", "SOUND_ROWS", "VOL_CATS", "AudioSys"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub);
const {
  startGame, update, game, keys, input, bindings, GP, GP_DEADZONE,
  pollGamepad, handleGamepadMenu,
  openPause, closePause, menuInput, menuActive,
  returnToDefaults, saveSettings, loadSettings,
  DEFAULT_BINDINGS, REBINDABLE, MENU_OPTIONS, SOUND_ROWS, VOL_CATS, AudioSys
} = A;

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const eqArr = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
const eqAxis = (a, b) => (a === null && b === null) || (a && b && a.index === b.index && a.dir === b.dir);

// --- Fake-gamepad helpers (as in test-f7) ---
function makePad(press = [], axes = [0, 0, 0, 0]) {
  const buttons = [];
  for (let i = 0; i < 17; i++) buttons.push({ pressed: press.includes(i), value: press.includes(i) ? 1 : 0 });
  return { connected: true, buttons, axes };
}
function setPad(pad) { fakePads = pad === null ? [] : [pad]; pollGamepad(); }
function noPad() { fakePads = []; pollGamepad(); }
function clearKeys() { for (const k of Object.keys(keys)) keys[k] = false; }

startGame();
game.state = "playing"; game.paused = false;
AudioSys.init(); // build the master/sfx/music gain graph so setVol() is observable
console.log(`(config) rebindable=[${REBINDABLE.join(",")}]  options=[${MENU_OPTIONS.join(",")}]  volCats=[${VOL_CATS.join(",")}]`);

// =====================================================================
// (A) State machine: playing -> pause -> root -> options -> controls -> back out
// =====================================================================
console.log("(A) menu state machine transitions");
assert(!menuActive(), "A: not in a menu while playing");
openPause();
assert(game.paused === true && game.menu.screen === "root" && game.menu.index === 0, "A: pause opens root");
menuInput("down"); assert(game.menu.index === 1, "A: down -> Options row");
menuInput("confirm"); assert(game.menu.screen === "options", "A: confirm Options -> options screen");
game.menu.index = MENU_OPTIONS.indexOf("Controls"); menuInput("confirm"); assert(game.menu.screen === "controls", "A: confirm Controls -> controls screen");
menuInput("back"); assert(game.menu.screen === "options", "A: back -> options");
menuInput("back"); assert(game.menu.screen === "root", "A: back -> root");
menuInput("back"); assert(game.paused === false && game.menu.screen === null, "A: back from root resumes the game");

// =====================================================================
// (B) Volume sliders drive AudioSys.vol AND the gain nodes, clamped [0,1]
// =====================================================================
console.log("(B) volume sliders + gain-node routing + clamping");
// CS010 P4: the sliders moved off Options onto a nested "Sound / Music" screen (SOUND_ROWS).
openPause(); menuInput("down"); menuInput("confirm"); // -> options
// CS014 P3 inserted "How to Play" ahead of "Sound / Music" (no longer row 0) — select by label.
game.menu.index = MENU_OPTIONS.indexOf("Sound / Music");
assert(game.menu.screen === "options" && MENU_OPTIONS[game.menu.index] === "Sound / Music", "B: on Sound/Music row");
menuInput("confirm"); // -> sound, index 0 = SFX
assert(game.menu.screen === "sound" && game.menu.index === 0 && SOUND_ROWS[0] === "SFX Volume", "B: on SFX slider");
const sfxBefore = AudioSys.vol.sfx;
menuInput("left");
assert(near(AudioSys.vol.sfx, sfxBefore - 0.1), "B: left lowers SFX by one step");
assert(near(AudioSys.sfx.gain.value, AudioSys.vol.sfx), "B: SFX gain NODE tracks the value (routing works)");
for (let i = 0; i < 20; i++) menuInput("left");
assert(near(AudioSys.vol.sfx, 0), "B: SFX clamps at 0 (no negative volume)");
game.menu.index = SOUND_ROWS.indexOf("Master Volume");
for (let i = 0; i < 20; i++) menuInput("right");
assert(near(AudioSys.vol.master, 1), "B: Master clamps at 1 (unity, no gain > 1)");
assert(near(AudioSys.master.gain.value, 1), "B: Master gain NODE tracks the value");
menuInput("left");
assert(near(AudioSys.vol.master, 0.9) && near(AudioSys.master.gain.value, 0.9), "B: Master left -> 0.9 on value + node");
menuInput("back"); // Sound/Music -> Options, cursor on "Sound / Music"
assert(game.menu.screen === "options", "B: back from Sound/Music -> Options");
// (game.paused stays true here — section C below sets game.menu.screen directly, same as before CS010 P4)
// restore volumes to full so later assertions start clean
AudioSys.setVol("sfx", 1); AudioSys.setVol("master", 1); AudioSys.setVol("music", 1);

// =====================================================================
// (C) Live rebinding via the REAL keydown path + input.*() reflects it immediately
// =====================================================================
console.log("(C) live keyboard rebind takes effect + no leak into gameplay keys");
// go to controls, first action ("left"), keyboard column
game.menu.screen = "controls"; game.menu.row = 0; game.menu.col = 0; game.menu.rebinding = null;
menuInput("confirm");
assert(game.menu.rebinding && game.menu.rebinding.action === REBINDABLE[0] && game.menu.rebinding.device === "key",
  "C: confirm on a keyboard cell arms key-capture");
clearKeys();
keydown("j"); // the captured key
assert(eqArr(bindings[REBINDABLE[0]].keys, ["j"]), "C: captured key replaces the keyboard binding");
assert(game.menu.rebinding === null, "C: capture clears after one key");
assert(!keys["j"], "C: the captured key was NOT written into keys{} (no gameplay leak)");
// live effect: 'j' now drives that action; the old default key no longer does
const act0 = REBINDABLE[0]; // "left"
clearKeys(); keys["j"] = true;   assert(input[act0](), "C: rebound key 'j' now triggers " + act0 + "() live");
clearKeys(); keys["arrowleft"] = true; assert(!input[act0](), "C: old default ArrowLeft no longer triggers " + act0);
clearKeys();

// =====================================================================
// (D) Separation: menu keys navigate (never move the ship); play is frozen while paused
// =====================================================================
console.log("(D) menu input vs gameplay input separation");
game.menu.screen = "root"; game.menu.index = 0; game.menu.rebinding = null; game.paused = true;
clearKeys();
keydown("arrowdown");
assert(game.menu.index === 1, "D: ArrowDown navigates the menu while paused");
assert(!keys["arrowdown"], "D: ArrowDown was NOT recorded into keys{} while a menu is open");
// frozen gameplay: even a genuinely-held gameplay key can't rotate the ship while paused
clearKeys(); keys["arrowleft"] = true; keys["j"] = true; // j is now 'left' too
const angBefore = game.ship.angle;
update(1 / 60);
assert(game.ship.angle === angBefore, "D: update() is frozen while paused — ship does not rotate");
clearKeys();
// contrast: unpaused, the same key drives the ship through the normal path
closePause();
keydown("arrowleft");
assert(keys["arrowleft"] === true, "D: while playing, ArrowLeft IS recorded into keys{}");
keyup("arrowleft"); assert(!keys["arrowleft"], "D: keyup clears it");
clearKeys();

// =====================================================================
// (E) Return to Defaults restores the rebindable table exactly
// =====================================================================
console.log("(E) Return to Defaults restores the shipped snapshot");
// mutate two bindings away from defaults (keyboard + gamepad)
bindings[REBINDABLE[0]].keys = ["j"];
bindings.thrust.buttons = [GP.Y]; bindings.thrust.axis = null;
assert(!eqArr(bindings[REBINDABLE[0]].keys, DEFAULT_BINDINGS[REBINDABLE[0]].keys), "E: (precondition) left keys differ from default");
returnToDefaults();
let allReset = true;
for (const n of REBINDABLE) {
  const b = bindings[n], d = DEFAULT_BINDINGS[n];
  if (!eqArr(b.keys, d.keys) || !eqArr(b.buttons, d.buttons) || !eqAxis(b.axis, d.axis)) allReset = false;
}
assert(allReset, "E: every rebindable action matches DEFAULT_BINDINGS after Return to Defaults");
assert(eqArr(bindings.thrust.buttons, [GP.DPAD_UP]) && eqAxis(bindings.thrust.axis, { index: GP.AXIS_LY, dir: -1 }),
  "E: thrust gamepad button + analog axis both restored");

// =====================================================================
// (F) Gamepad menu navigation (edge-detected) + pad rebind capture
// =====================================================================
console.log("(F) gamepad menu nav + pad rebind capture");
setPad(makePad([]));      // baseline pad connected
openPause();              // primes the nav latch off the current (idle) pad state
assert(game.menu.screen === "root" && game.menu.index === 0, "F: openPause -> root");
setPad(makePad([GP.DPAD_DOWN])); handleGamepadMenu();
assert(game.menu.index === 1, "F: D-Pad Down moves the cursor once");
setPad(makePad([GP.DPAD_DOWN])); handleGamepadMenu();
assert(game.menu.index === 1, "F: holding D-Pad Down does NOT repeat (edge-detected)");
setPad(makePad([])); handleGamepadMenu();               // release
setPad(makePad([GP.A])); handleGamepadMenu();            // A = confirm -> Options
assert(game.menu.screen === "options", "F: A confirms into Options");
// pad rebind: arm capture for thrust's gamepad cell, then press a button
game.menu.screen = "controls"; game.menu.row = 2; game.menu.col = 1; game.menu.rebinding = null; // row 2 = thrust
menuInput("confirm");
assert(game.menu.rebinding && game.menu.rebinding.device === "pad", "F: confirm on a gamepad cell arms pad-capture");
setPad(makePad([]));  handleGamepadMenu();               // baseline so the next press is an edge
setPad(makePad([GP.Y])); handleGamepadMenu();            // Y button captured
assert(eqArr(bindings.thrust.buttons, [GP.Y]), "F: captured pad button replaces the gamepad binding");
assert(bindings.thrust.axis === null, "F: pad rebind drops the analog axis (shown binding matches reality)");
assert(game.menu.rebinding === null, "F: pad capture clears after one button");
returnToDefaults();       // put thrust back for cleanliness
noPad(); closePause();

// =====================================================================
// (G) localStorage persistence round-trips
// =====================================================================
console.log("(G) settings persist + reload via localStorage");
AudioSys.setVol("sfx", 0.4);
bindings.fire.keys = ["k"];
saveSettings();
// now corrupt the live state and reload — it should come back to the saved values
AudioSys.vol.sfx = 1; bindings.fire.keys = ["x"];
loadSettings();
assert(near(AudioSys.vol.sfx, 0.4), "G: saved SFX volume reloaded");
assert(eqArr(bindings.fire.keys, ["k"]), "G: saved custom fire binding reloaded");
// a raw JSON payload really was written
const raw = global.localStorage.getItem("afd_settings_v1");
assert(raw && JSON.parse(raw).vol && JSON.parse(raw).bindings, "G: a structured settings blob is in storage");
// clean the store + restore defaults so nothing bleeds into other runs
global.localStorage.removeItem("afd_settings_v1");
returnToDefaults(); AudioSys.setVol("sfx", 1);

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
