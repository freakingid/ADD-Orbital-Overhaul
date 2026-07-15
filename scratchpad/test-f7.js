// Headless test for Phase 7 (F7 Gamepad Input).
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator, eval the REAL <script> block,
// then drive the actual game input code (no reimplementation of the binding logic under test).
//
//   node scratchpad/test-f7.js
//
// Full controller *feel* (deadzone comfort, button mapping) can only be judged with a real
// controller in a browser — that's the top playtest ask. What IS checkable headlessly, and what
// this verifies, is that the data-driven binding table resolves correctly for synthetic states:
//  (A) with no gamepad, input.*() still reflects the keyboard exactly (regression: unchanged path);
//  (B) each default gamepad button resolves to its action (D-Pad rotate/thrust, A fire, RT/RB shield);
//  (C) the left-stick axis + 0.25 deadzone resolves rotate/thrust, and rejects sub-deadzone input;
//  (D) keyboard OR gamepad — either source alone triggers an action, neither leaves it false;
//  (E) only the FIRST connected gamepad is read; additional pads are ignored;
//  (F) edge-triggered menu reads — Start toggles pause once per press (not every held frame),
//      A confirms on title/gameover (startGame), and none of this fires the fire action mid-play;
//  (G) the binding TABLE matches the F7 spec (defaults + fixed flags), so Phase 8 builds on the right data;
//  (H) integration — a gamepad thrust actually drives Ship.update through the unchanged input.thrust().

"use strict";
const fs = require("fs");
const path = require("path");

// ---- Extract the real game script from the single-file build ----
const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ---- Headless environment stubs ----
const noopCtx = new Proxy({}, { get: () => () => {} });          // every 2D ctx method is a no-op
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub };

// A robust no-op AudioContext. Unlike the other tests, F7's handleGamepadMenu attempts AudioSys.init()
// (the best-effort audio unlock on a controller Start/A press), which sets AudioSys.ctx to a real
// object — so it can no longer rely on ctx===null to early-return. This Proxy makes every AudioSys
// method safe after init: unknown property access returns a chainable no-op node.
function makeAudioNode() {
  return new Proxy({
    gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    Q: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    threshold: { value: 0, setValueAtTime() {} }, ratio: { value: 1, setValueAtTime() {} },
    attack: { value: 0, setValueAtTime() {} }, release: { value: 0, setValueAtTime() {} },
    type: "sine", buffer: null, loop: false, curve: null, playbackRate: { value: 1 },
    connect() { return makeAudioNode(); }, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
function FakeAudioContext() {
  return new Proxy({
    state: "running", currentTime: 0, sampleRate: 44100, destination: makeAudioNode(),
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; }
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}

const windowStub = {
  addEventListener: () => {},
  innerWidth: 1280, innerHeight: 720,
  AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext
};
const performanceStub = { now: () => Date.now() };
const rafStub = () => 0;               // never actually runs the game loop

// The gamepad list the code polls. Mutable from the test: set `fakePads`, call pollGamepad(),
// then read input.*(). navigatorStub.getGamepads closes over this variable.
let fakePads = [];
const navigatorStub = { getGamepads: () => fakePads };

const returnList = [
  "startGame", "update", "game", "keys",
  "input", "bindings", "gamepad", "GP", "GP_DEADZONE",
  "pollGamepad", "handleGamepadMenu", "gpPressed", "gpActive", "kbActive", "actionHeld"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub);
const {
  startGame, update, game, keys,
  input, bindings, gamepad, GP, GP_DEADZONE,
  pollGamepad, handleGamepadMenu, gpPressed, gpActive, kbActive, actionHeld
} = A;

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error("  FAIL: " + msg); }
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// --- Fake-gamepad helpers ---
// A Standard-Gamepad-shaped object: 17 buttons ({pressed,value}), 4 axes. `press` = button indices
// held; `axes` overrides axis values.
function makePad(press = [], axes = [0, 0, 0, 0]) {
  const buttons = [];
  for (let i = 0; i < 17; i++) buttons.push({ pressed: press.includes(i), value: press.includes(i) ? 1 : 0 });
  return { connected: true, buttons, axes };
}
// Install a single pad (or a raw pads array) and refresh the code's snapshot.
function setPad(pad) { fakePads = pad === null ? [] : [pad]; pollGamepad(); }
function setPads(arr) { fakePads = arr; pollGamepad(); }
function noPad() { fakePads = []; pollGamepad(); }
function clearKeys() { for (const k of Object.keys(keys)) keys[k] = false; }

startGame();
game.state = "playing"; game.paused = false;
console.log(`(config) deadzone=${GP_DEADZONE}  fire->A(${GP.A})  shield->RT(${GP.RT})/RB(${GP.RB})  thrust->DPAD_UP(${GP.DPAD_UP})/LY`);

// =====================================================================
// (A) No gamepad -> keyboard path is exactly as before F7
// =====================================================================
console.log("(A) no gamepad: input.*() mirrors the keyboard");
noPad(); clearKeys();
assert(gamepad.connected === false, "A: no pad connected");
assert(!input.left() && !input.right() && !input.thrust() && !input.fire() && !input.shield(), "A: nothing pressed -> all false");
keys["arrowleft"] = true; assert(input.left(), "A: ArrowLeft -> left");
clearKeys(); keys["a"] = true; assert(input.left(), "A: 'a' -> left");
clearKeys(); keys["d"] = true; assert(input.right(), "A: 'd' -> right");
clearKeys(); keys["arrowup"] = true; assert(input.thrust(), "A: ArrowUp -> thrust");
clearKeys(); keys["w"] = true; assert(input.thrust(), "A: 'w' -> thrust");
clearKeys(); keys[" "] = true; assert(input.fire(), "A: Space -> fire");
clearKeys(); keys["shift"] = true; assert(input.shield(), "A: Shift -> shield");
clearKeys();

// Regression: predicates work even if pollGamepad was NEVER called (initial gamepad state) —
// this is the state the OTHER headless tests (f2..f6) run in, so they must stay green.
gamepad.connected = false; gamepad.buttons = []; gamepad.axes = []; gamepad.prevButtons = [];
keys["w"] = true; assert(input.thrust(), "A: thrust works with a never-polled gamepad (f2..f6 regression path)");
clearKeys();

// =====================================================================
// (B) Default gamepad BUTTON bindings resolve to the right actions
// =====================================================================
console.log("(B) gamepad buttons: D-Pad rotate/thrust, A fire, RT/RB shield");
clearKeys();
setPad(makePad([GP.DPAD_LEFT]));
assert(input.left() && !input.right() && !input.thrust() && !input.fire(), "B: D-Pad Left -> left only");
setPad(makePad([GP.DPAD_RIGHT]));
assert(input.right() && !input.left(), "B: D-Pad Right -> right");
setPad(makePad([GP.DPAD_UP]));
assert(input.thrust() && !input.left() && !input.right(), "B: D-Pad Up -> thrust");
setPad(makePad([GP.A]));
assert(input.fire() && !input.shield(), "B: A button -> fire");
setPad(makePad([GP.RT]));
assert(input.shield(), "B: Right Trigger -> shield (gap-fill)");
setPad(makePad([GP.RB]));
assert(input.shield(), "B: Right Bumper -> shield (gap-fill, alt)");
setPad(makePad([GP.B]));   // B is 'back' (menu) — must NOT be any gameplay action
assert(!input.fire() && !input.shield() && !input.left() && !input.right() && !input.thrust(), "B: B button is not a gameplay action");
noPad();

// =====================================================================
// (C) Left-stick AXIS + 0.25 deadzone
// =====================================================================
console.log("(C) left-stick axis with the 0.25 deadzone");
setPad(makePad([], [-0.5, 0, 0, 0]));  assert(input.left() && !input.right(), "C: LX -0.5 -> left");
setPad(makePad([], [ 0.5, 0, 0, 0]));  assert(input.right() && !input.left(), "C: LX +0.5 -> right");
setPad(makePad([], [ 0, -0.5, 0, 0])); assert(input.thrust(), "C: LY -0.5 -> thrust");
setPad(makePad([], [ 0,  0.5, 0, 0])); assert(!input.thrust(), "C: LY +0.5 (stick down) -> not thrust");
setPad(makePad([], [-0.20, 0, 0, 0])); assert(!input.left(), "C: LX -0.20 (inside deadzone) -> no left");
setPad(makePad([], [-0.25, 0, 0, 0])); assert(!input.left(), "C: LX -0.25 (exactly deadzone) -> no left (strict >)");
setPad(makePad([], [-0.26, 0, 0, 0])); assert(input.left(), "C: LX -0.26 (just past deadzone) -> left");
noPad();

// =====================================================================
// (D) Keyboard OR gamepad — either alone triggers, both idle -> false
// =====================================================================
console.log("(D) keyboard OR gamepad combine per action");
clearKeys(); setPad(makePad([]));                 // pad connected, nothing pressed
assert(!input.left(), "D: pad connected, no keys, no buttons -> left false");
keys["a"] = true; assert(input.left(), "D: keyboard 'a' still works while a pad is connected");
clearKeys(); setPad(makePad([GP.DPAD_LEFT])); assert(input.left(), "D: gamepad-only left with no keys held");
clearKeys(); noPad();

// =====================================================================
// (E) Only the first connected gamepad is used
// =====================================================================
console.log("(E) first connected gamepad only; others ignored");
setPads([makePad([GP.DPAD_LEFT]), makePad([GP.DPAD_RIGHT])]);
assert(input.left() && !input.right(), "E: pad[0] left wins; pad[1] right ignored");
setPads([null, makePad([GP.DPAD_RIGHT])]);   // empty slot 0, real pad at 1 -> first *connected* is pad[1]
assert(input.right(), "E: null slot skipped; first non-null pad is used");
noPad();

// =====================================================================
// (F) Edge-triggered menu/system reads (Start pause, A confirm)
// =====================================================================
console.log("(F) menu edges: Start toggles pause once/press; A confirms on title/gameover");
clearKeys();
// gpPressed fires only on the rising edge.
setPad(makePad([]));                 // baseline: nothing held
setPad(makePad([GP.START]));         // Start goes down this frame
assert(gpPressed(bindings.pause), "F: gpPressed(pause) true on the frame Start is first pressed");
setPad(makePad([GP.START]));         // Start still held
assert(!gpPressed(bindings.pause), "F: gpPressed(pause) false while Start stays held (no repeat)");

// Full pause-toggle behavior through handleGamepadMenu, in the 'playing' state.
game.state = "playing"; game.paused = false;
setPad(makePad([]));                 // release
setPad(makePad([GP.START])); handleGamepadMenu();
assert(game.paused === true, "F: Start press pauses (playing -> paused)");
setPad(makePad([GP.START])); handleGamepadMenu();
assert(game.paused === true, "F: holding Start does NOT re-toggle (still paused)");
setPad(makePad([])); handleGamepadMenu();
setPad(makePad([GP.START])); handleGamepadMenu();
assert(game.paused === false, "F: a second distinct Start press unpauses");
setPad(makePad([]));

// A = confirm starts the game from gameover (and title), mirroring Enter.
game.state = "gameover";
setPad(makePad([]));                  // baseline
setPad(makePad([GP.A])); handleGamepadMenu();
assert(game.state === "playing", "F: A on gameover -> startGame (state now playing)");
game.state = "title";
setPad(makePad([]));
setPad(makePad([GP.A])); handleGamepadMenu();
assert(game.state === "playing", "F: A on title -> startGame");

// During play, the A-button menu-confirm must NOT re-trigger startGame (A means fire here); Start
// mid-play only pauses. Confirm that a held A while playing doesn't reset the game.
game.state = "playing"; game.paused = false; const scoreBefore = game.score = 4321;
setPad(makePad([GP.A])); handleGamepadMenu();
assert(game.state === "playing" && game.score === scoreBefore, "F: A during play doesn't confirm/restart (it's fire)");
setPad(makePad([])); noPad();

// =====================================================================
// (G) The binding TABLE matches the F7 spec (Phase 8 builds against this data)
// =====================================================================
console.log("(G) binding-table data matches the F7 defaults + fixed flags");
assert(bindings.fire.buttons.includes(GP.A), "G: fire -> A");
assert(bindings.shield.buttons.includes(GP.RT) && bindings.shield.buttons.includes(GP.RB), "G: shield -> RT and RB (gap-fill)");
assert(bindings.thrust.buttons.includes(GP.DPAD_UP) && bindings.thrust.axis.index === GP.AXIS_LY && bindings.thrust.axis.dir < 0, "G: thrust -> D-Pad Up + LY negative");
assert(bindings.left.buttons.includes(GP.DPAD_LEFT) && bindings.left.axis.index === GP.AXIS_LX && bindings.left.axis.dir < 0, "G: left -> D-Pad Left + LX negative");
assert(bindings.right.buttons.includes(GP.DPAD_RIGHT) && bindings.right.axis.dir > 0, "G: right -> D-Pad Right + LX positive");
assert(bindings.pause.buttons.includes(GP.START), "G: pause -> Start");
assert(bindings.back.buttons.includes(GP.B), "G: back -> B");
assert(bindings.confirm.buttons.includes(GP.A), "G: confirm -> A");
// gameplay actions are rebindable; menu/system actions are fixed
assert(["left", "right", "thrust", "fire", "shield"].every(a => bindings[a].fixed === false), "G: gameplay actions are rebindable (fixed:false)");
assert(["confirm", "back", "pause"].every(a => bindings[a].fixed === true), "G: menu/system actions are fixed (fixed:true)");
// keyboard defaults preserved
assert(bindings.left.keys.includes("arrowleft") && bindings.left.keys.includes("a"), "G: left keyboard keys unchanged");
// v3.0 P4 (FLAG P4-a): "p" retired; ESC is the pause key (shared with back so ESC-in-menu = back).
assert(bindings.pause.keys.includes("escape") && !bindings.pause.keys.includes("p"), "G: pause keyboard key is ESC ('p' retired)");

// =====================================================================
// (H) Integration: a gamepad thrust drives the REAL Ship.update via input.thrust()
// =====================================================================
console.log("(H) gamepad thrust reaches Ship.update through the unchanged input layer");
game.state = "playing"; game.paused = false;
game.debris.length = 0; game.hunters.length = 0; game.saucers.length = 0; game.bullets.length = 0;
game.chain.length = 0; game.garbage.length = 0; game.powerups.length = 0;
Object.assign(game.ship, { x: game.camera.x, y: game.camera.y, vx: 0, vy: 0, angle: 0, dead: false, invuln: 0 });
clearKeys();
setPad(makePad([GP.DPAD_UP]));    // hold thrust on the pad
assert(input.thrust() === true, "H: input.thrust() true from the gamepad");
for (let i = 0; i < 8; i++) { update(1 / 60); }
const speed = Math.hypot(game.ship.vx, game.ship.vy);
assert(speed > 0, `H: ship accelerated under gamepad thrust (|v|=${speed.toFixed(1)} px/s)`);
assert(game.ship.vx > 0, "H: thrust pushed the ship along +x (angle 0), so the input actually flowed through");
noPad(); clearKeys();

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
