// Headless test for v3.0 Phase 4 (revised) — pause/menu from ANY state + corrected control scheme.
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator (+ fake localStorage), eval the REAL
// <script> block, then drive the actual input handlers / menu state machine — no reimplementation.
//
//   node scratchpad/test-p4.js
//
// Corrected scheme under test (supersedes the earlier B-1-a mapping):
//  - Controller START = session toggle: title/gameover -> start a game; playing -> open pause;
//    paused -> dismiss & resume.
//  - Keyboard "O" and controller B open the Options/Achievements SYSTEM menu from title/gameover;
//    its root is ["Options","Achievements","Back"]; Back closes the overlay -> underlying screen.
//  - Keyboard ESC: playing -> pause; inside a menu -> back (confirm->back->pause resolution order).
//  - Controller B is context-aware (mirrors ESC): no menu on title/gameover -> open; menu open -> back.
//  - A / Enter still start a game from title/gameover; a single confirm can't both nav a menu AND
//    start a game (FLAG P4-b); menu input never leaks into keys{} or a title start.

"use strict";
const fs = require("fs");
const path = require("path");

// ---- Extract the real game script ----
const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ---- Headless environment stubs (mirrors test-f8) ----
const noopCtx = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub };

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
function keydown(key) { const e = { key, preventDefault() {} }; (listeners.keydown || []).forEach(f => f(e)); }
function keyup(key)   { const e = { key, preventDefault() {} }; (listeners.keyup   || []).forEach(f => f(e)); }

const performanceStub = { now: () => Date.now() };
const rafStub = () => 0;

let fakePads = [];
const navigatorStub = { getGamepads: () => fakePads };

const lsStore = {};
global.localStorage = {
  getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: k => { delete lsStore[k]; }
};

const returnList = [
  "startGame", "update", "game", "keys", "input", "bindings", "GP",
  "pollGamepad", "handleGamepadMenu",
  "openPause", "closePause", "menuInput", "menuActive", "rootItems",
  "MENU_ROOT_PLAY", "MENU_ROOT_SYS", "MENU_OPTIONS", "AudioSys"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub);
const {
  startGame, update, game, keys, input, bindings, GP,
  pollGamepad, handleGamepadMenu,
  openPause, closePause, menuInput, menuActive, rootItems,
  MENU_ROOT_PLAY, MENU_ROOT_SYS, MENU_OPTIONS, AudioSys
} = A;

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const eqArr = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);

// --- Fake-gamepad helpers (as in test-f7/f8) ---
function makePad(press = [], axes = [0, 0, 0, 0]) {
  const buttons = [];
  for (let i = 0; i < 17; i++) buttons.push({ pressed: press.includes(i), value: press.includes(i) ? 1 : 0 });
  return { connected: true, buttons, axes };
}
function setPad(pad) { fakePads = pad === null ? [] : [pad]; pollGamepad(); }
function noPad() { fakePads = []; pollGamepad(); }
function clearKeys() { for (const k of Object.keys(keys)) keys[k] = false; }
// Press a button as a clean rising edge, then run the menu/system dispatcher once.
function padPress(...btns) { setPad(makePad([])); setPad(makePad(btns)); handleGamepadMenu(); }

AudioSys.init();

// =====================================================================
// (A) Corrected bindings: ESC is the pause key ("p" retired); ESC also backs; B/Start unchanged
// =====================================================================
console.log("(A) corrected binding table");
assert(bindings.pause.keys.includes("escape"), "A: pause key is ESC");
assert(!bindings.pause.keys.includes("p"), "A: 'p' is retired from pause (FLAG P4-a default)");
assert(bindings.back.keys.includes("escape"), "A: back key is ESC (shared -> in-menu ESC resolves to back)");
assert(bindings.pause.buttons.includes(GP.START), "A: pad pause/Start unchanged");
assert(bindings.back.buttons.includes(GP.B), "A: pad back/B unchanged");
assert(bindings.confirm.buttons.includes(GP.A) && bindings.confirm.keys.includes("enter"), "A: confirm = A / Enter");

// =====================================================================
// (B) Controller START is a session toggle across states
// =====================================================================
console.log("(B) controller Start: start / pause / resume by state");
game.state = "title"; game.paused = false; noPad();
padPress(GP.START);
assert(game.state === "playing" && !game.paused, "B: Start on title -> START A GAME");
padPress(GP.START);
assert(game.state === "playing" && game.paused && game.menu.screen === "root", "B: Start while playing -> OPEN PAUSE (root)");
assert(eqArr(rootItems(), MENU_ROOT_PLAY), "B: paused-from-play root = [Continue,Options,Quit]");
padPress(GP.START);
assert(game.state === "playing" && !game.paused, "B: Start while paused -> DISMISS & RESUME");
noPad();

// =====================================================================
// (C) Keyboard "O" opens the SYSTEM menu from title/gameover; Back returns to the underlying screen
// =====================================================================
console.log("(C) keyboard O opens the system menu; Back returns");
game.state = "title"; game.paused = false; game.menu.screen = null; clearKeys();
keydown("o");
assert(game.paused && game.menu.screen === "root", "C: O on title -> system menu open");
assert(eqArr(rootItems(), MENU_ROOT_SYS), "C: system root = [Options,Achievements,High Scores,Back] (v3.6 P6)");
assert(game.state === "title", "C: opening the system menu did NOT also start a game");
// navigate to "Back" and confirm -> close overlay, back to title. v3.6 P6 added a "High Scores" row
// to MENU_ROOT_SYS ahead of "Back" — look it up by label (this file's own convention elsewhere, e.g.
// section D below) instead of a stale hardcoded index.
game.menu.index = rootItems().indexOf("Back");
menuInput("confirm");
assert(!game.paused && game.menu.screen === null && game.state === "title", "C: Back closes overlay -> underlying title");

// gameover behaves the same
game.state = "gameover"; game.paused = false; game.menu.screen = null; clearKeys();
keydown("o");
assert(game.paused && eqArr(rootItems(), MENU_ROOT_SYS), "C: O on gameover -> system menu");
game.menu.index = rootItems().indexOf("Back"); menuInput("confirm");
assert(!game.paused && game.state === "gameover", "C: Back -> underlying gameover");

// =====================================================================
// (D) Controller B opens the system menu (title/gameover); B backs out when a menu is open
// =====================================================================
console.log("(D) controller B: open on title/gameover, back when a menu is open");
game.state = "title"; game.paused = false; game.menu.screen = null; noPad();
padPress(GP.B);
assert(game.paused && game.menu.screen === "root" && eqArr(rootItems(), MENU_ROOT_SYS), "D: B on title -> system menu");
// B again -> back (root back closes)
padPress(GP.B);
assert(!game.paused && game.state === "title", "D: B while menu open -> back/close");
// Reach Achievements directly from the system root, then B backs to root (cursor on Achievements)
game.state = "gameover"; game.paused = false; game.menu.screen = null; noPad();
padPress(GP.B);
game.menu.index = rootItems().indexOf("Achievements"); menuInput("confirm");
assert(game.menu.screen === "achievements", "D: system root -> Achievements");
menuInput("back");
assert(game.menu.screen === "root" && rootItems()[game.menu.index] === "Achievements",
  "D: back from Achievements -> system root, cursor on Achievements (achReturn=root)");
closePause();

// =====================================================================
// (E) Keyboard ESC: pauses OUTSIDE a menu (playing), backs INSIDE a menu
// =====================================================================
console.log("(E) ESC pauses outside, backs inside");
startGame(); game.paused = false; clearKeys(); // fresh playing game
keydown("escape");
assert(game.paused && game.menu.screen === "root", "E: ESC while playing -> PAUSE");
// dive: Options -> ESC backs to root -> ESC backs out (resumes)
menuInput("down"); // Continue -> Options in play root
assert(rootItems()[game.menu.index] === "Options", "E: cursor on Options");
menuInput("confirm");
assert(game.menu.screen === "options", "E: into Options");
keydown("escape");
assert(game.menu.screen === "root", "E: ESC inside a menu -> BACK (options -> root)");
keydown("escape");
assert(!game.paused && game.menu.screen === null, "E: ESC at root -> back out / resume");
// ESC on the title with no menu does nothing (pause is gated on 'playing')
game.state = "title"; game.paused = false; game.menu.screen = null; clearKeys();
keydown("escape");
assert(!game.paused && game.state === "title", "E: ESC on title with no menu is inert (O/B are the openers)");

// =====================================================================
// (F) A / Enter still start a game from title/gameover
// =====================================================================
console.log("(F) A / Enter still start a game");
game.state = "title"; game.paused = false; game.menu.screen = null; clearKeys();
keydown("enter");
assert(game.state === "playing", "F: Enter on title -> start a game");
game.state = "gameover"; game.paused = false; noPad();
padPress(GP.A);
assert(game.state === "playing", "F: A on gameover -> start a game");
noPad();

// =====================================================================
// (G) FLAG P4-b: a single confirm can't both open/navigate the menu AND start a game
// =====================================================================
console.log("(G) confirm can't both navigate a menu and start a game (P4-b)");
// Keyboard: system menu open on title; Enter navigates the menu, never restarts.
game.state = "title"; game.paused = false; game.menu.screen = null; clearKeys();
keydown("o");                                  // open system menu
const savedScreen = game.menu.screen;
keydown("enter");                              // confirm INSIDE the menu
assert(game.state === "title" && game.paused, "G: Enter inside the system menu does NOT start a game");
assert(game.menu.screen !== null, "G: Enter routed to menu nav (still in a menu screen)");
closePause();
// Gamepad single-frame race: B (open) + A (confirm) pressed the same frame -> B wins, no start.
game.state = "title"; game.paused = false; game.menu.screen = null; noPad();
setPad(makePad([])); setPad(makePad([GP.B, GP.A])); handleGamepadMenu();
assert(game.paused && game.state === "title", "G: same-frame B+A -> menu opens, game does NOT start (else-if guard)");
closePause(); noPad();
// Gamepad: while the system menu is open, A confirms in-menu, never starts a game.
game.state = "title"; game.paused = false; game.menu.screen = null; noPad();
padPress(GP.B);                                // open
padPress(GP.A);                                // confirm inside
assert(game.state === "title" && game.paused, "G: A while system menu open confirms in-menu, no start");
closePause(); noPad();

// =====================================================================
// (H) No leak: menu input never reaches keys{} nor triggers a title start; ship stays frozen
// =====================================================================
console.log("(H) no menu-input leak into keys{} / gameplay / a title start");
game.state = "title"; game.paused = false; game.menu.screen = null; clearKeys();
keydown("o");                                  // system menu open
keydown("arrowdown");                           // nav
assert(!keys["arrowdown"], "H: menu nav key NOT written to keys{}");
keydown("arrowleft"); keydown("w");
assert(!keys["arrowleft"] && !keys["w"], "H: no gameplay keys recorded while a menu is open");
assert(game.state === "title", "H: no menu keypress started a game");
closePause();
// While paused mid-game, a held gameplay key can't move the ship (update() frozen).
startGame(); openPause(); clearKeys();
keys["arrowleft"] = true;
const angBefore = game.ship.angle;
update(1 / 60);
assert(game.ship.angle === angBefore, "H: update() frozen while paused -> ship does not rotate");
closePause(); clearKeys();

// =====================================================================
// (I) Achievements reachable via BOTH paths, each backing to the right parent
// =====================================================================
console.log("(I) Achievements back-target resolves by entry path");
// play path: pause -> Options -> Achievements -> back -> Options
startGame(); openPause();
game.menu.index = rootItems().indexOf("Options"); menuInput("confirm"); // -> options
game.menu.index = MENU_OPTIONS.indexOf("Achievements"); menuInput("confirm"); // -> achievements (from options)
assert(game.menu.screen === "achievements" && game.menu.achReturn === "options", "I: play path sets achReturn=options");
menuInput("back");
assert(game.menu.screen === "options", "I: back from Achievements -> Options (play path)");
closePause();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
