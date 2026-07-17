// Headless test for CS010 Phase 4 — menu restructure: the "Sound / Music" sub-dialog (§9), High
// Scores nested under Options (§8b, FORK-4), and the final MENU_OPTIONS order (§10a).
//
//   node scratchpad/test-cs010-p4.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL functions (menuInput/openPause/closePause/rootItems/…) — never
// reimplement menu logic. This is a RELOCATION, not a redesign, so the risk is entirely index
// fragility (FLAG-8b) — every navigation assertion below checks the LANDING LABEL, not a raw index,
// so the test survives the next reorder. Sections:
//  (A) node --check on the extracted <script>.
//  (B) config: MENU_ROOT_PLAY/MENU_OPTIONS/SOUND_ROWS shapes; "High Scores" is IN MENU_OPTIONS; no
//      gotoScreen("options", <numeric literal>) call survives in source. (CS012 P4: MENU_ROOT_SYS retired.)
//  (C) title -> Options (opened directly) -> Sound/Music -> Back.
//  (D) Options -> High Scores -> Back, from BOTH the title/gameover entry (O opens Options directly)
//      AND the pause-menu entry (the whole point of §8b — a single Options nesting reaches both contexts).
//  (E) Options -> Controls -> Back, and P2's Ship Rotation row on Controls still works (not clobbered).
//  (F) Options -> Achievements -> Back — single parent (Options), from BOTH title and pause (CS012 P4: achReturn retired).
//  (G) Options -> Difficulty -> Back.
//  (H) Sound/Music screen: the three volume sliders + Music Track cycler still work, label-dispatched,
//      persisted via saveSettings(); Back returns to Options.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const extractScript = html => {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Could not find <script> block");
  return m[1];
};
const currentSrc = extractScript(fs.readFileSync(htmlPath, "utf8"));

const noopCtx = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };

function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} },
    Q: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} },
    threshold: { value: 0, setValueAtTime() {} }, ratio: { value: 1, setValueAtTime() {} },
    attack: { value: 0, setValueAtTime() {} }, release: { value: 0, setValueAtTime() {} },
    type: "sine", buffer: null, loop: false, curve: null, playbackRate: { value: 1 },
    connect() { return makeAudioNode(); }, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
function FakeAudioContext() {
  return new Proxy({
    state: "running", currentTime: 0, sampleRate: 44100, destination: makeAudioNode(),
    createGain() { return makeAudioNode(); },
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; }
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}

const RETURN = [
  "startGame", "game", "menuInput", "openPause", "closePause", "rootItems", "gotoScreen",
  "MENU_ROOT_PLAY", "MENU_OPTIONS", "SOUND_ROWS", "VOL_CATS", "VOL_LABELS",
  "REBINDABLE", "AudioSys", "settings", "MUSIC_TRACK_VALUES"
];

function buildInstance(lsStore) {
  lsStore = lsStore || {};
  const listeners = {};
  const windowStub = {
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    innerWidth: 1280, innerHeight: 720, AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext
  };
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    currentSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, localStorageStub);
}

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(require("os").tmpdir(), "cs010-p4-extracted.js");
  fs.writeFileSync(tmp, currentSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: syntax: " + e.stderr.toString()); }
})();

// ================= (B) config shapes + no surviving hardcoded indices =====================
(function () {
  console.log("(B) MENU_ROOT_PLAY / MENU_OPTIONS / SOUND_ROWS shapes; no hardcoded gotoScreen index");
  const A = buildInstance();
  // CS012 P4 (FORK-CS012-C → a): the system-menu root (MENU_ROOT_SYS) is retired — Options is the sole
  // hub, opened directly from title/gameover. MENU_ROOT_PLAY (Continue/Options/Quit) is the only root.
  assert(JSON.stringify(A.MENU_ROOT_PLAY) === JSON.stringify(["Continue", "Options", "Quit"]),
    `B: MENU_ROOT_PLAY === [Continue, Options, Quit]; got ${JSON.stringify(A.MENU_ROOT_PLAY)}`);
  assert(!/const\s+MENU_ROOT_SYS/.test(currentSrc), "B: MENU_ROOT_SYS is no longer declared (only referenced in a retire-note comment)");
  // CS014 P3 added "How to Play" (first row) + "Replay Hints" (immediately before Back) — deliberate
  // snapshot update, not a weakened assertion; see IMPLEMENTATION-PHASES-CS014.md P3.
  const expectedOptions = ["How to Play", "Sound / Music", "Controls", "Achievements", "High Scores", "Difficulty", "Replay Hints", "Back"];
  assert(JSON.stringify(A.MENU_OPTIONS) === JSON.stringify(expectedOptions),
    `B: MENU_OPTIONS === ${JSON.stringify(expectedOptions)} (§10a, CS014 P3 update); got ${JSON.stringify(A.MENU_OPTIONS)}`);
  // CS010 P9 added the "Voice Volume" slider row (SOUND_ROWS/VOL_LABELS/VOL_CATS grew together);
  // CS011 P3 added "Voice" (style picker) + "Captions" (toggle), both value-column rows outside
  // VOL_LABELS/VOL_CATS (those two arrays stay slider-only).
  const expectedSound = ["SFX Volume", "Music Volume", "Master Volume", "Voice Volume", "Voice", "Captions", "Music Track", "Back"];
  assert(JSON.stringify(A.SOUND_ROWS) === JSON.stringify(expectedSound),
    `B: SOUND_ROWS === ${JSON.stringify(expectedSound)}; got ${JSON.stringify(A.SOUND_ROWS)}`);
  assert(JSON.stringify(A.VOL_LABELS) === JSON.stringify(["SFX Volume", "Music Volume", "Master Volume", "Voice Volume"]),
    "B: VOL_LABELS grew with Voice Volume, still paired with VOL_CATS");
  assert(JSON.stringify(A.VOL_CATS) === JSON.stringify(["sfx", "music", "master", "voice"]), "B: VOL_CATS grew with voice");

  // FLAG-8b: no gotoScreen("options", <numeric literal>) call anywhere in the live source — every
  // call site must resolve the index via MENU_OPTIONS.indexOf(...) instead.
  const hardcoded = currentSrc.match(/gotoScreen\(\s*"options"\s*,\s*-?\d+\s*\)/g);
  assert(!hardcoded, `B: no hardcoded gotoScreen("options", N) survives in source; found: ${JSON.stringify(hardcoded)}`);
  // Also: no gotoScreen call anywhere passes a bare negative-literal index (the -1/indexOf(-1) trap).
  const negativeLiteral = currentSrc.match(/gotoScreen\([^)]*,\s*-\d+\s*\)/g);
  assert(!negativeLiteral, `B: no gotoScreen(...) call passes a negative literal index; found: ${JSON.stringify(negativeLiteral)}`);
})();

// ================= (C) title -> Options (direct) -> Sound/Music -> Back =====================
(function () {
  console.log("(C) title -> Options (direct) -> Sound/Music -> Back");
  const A = buildInstance();
  A.startGame(); A.game.state = "title"; A.game.paused = false;
  A.openPause();
  assert(A.game.menu.screen === "options", "C: O from title opens Options directly (no intermediate root)");
  A.game.menu.index = A.MENU_OPTIONS.indexOf("Sound / Music");
  A.menuInput("confirm");
  assert(A.game.menu.screen === "sound" && A.SOUND_ROWS[A.game.menu.index] === "SFX Volume",
    "C: Options -> Sound/Music, cursor on first row");
  A.menuInput("back");
  assert(A.game.menu.screen === "options" && A.MENU_OPTIONS[A.game.menu.index] === "Sound / Music",
    "C: Sound/Music back -> Options, cursor on Sound / Music");
  A.closePause();
})();

// ================= (D) Options -> High Scores -> Back, both entry paths =====================
(function () {
  console.log("(D) Options -> High Scores -> Back (title/gameover path AND pause-menu path)");
  const A = buildInstance();

  // Title/gameover path: O opens Options directly -> High Scores.
  A.startGame(); A.game.state = "title"; A.game.paused = false;
  A.openPause();
  assert(A.game.menu.screen === "options", "D: title path: O opens Options directly");
  A.game.menu.index = A.MENU_OPTIONS.indexOf("High Scores"); A.menuInput("confirm");
  assert(A.game.menu.screen === "highscores", "D: title path: Options -> High Scores opens the screen");
  A.menuInput("back");
  assert(A.game.menu.screen === "options" && A.MENU_OPTIONS[A.game.menu.index] === "High Scores",
    "D: title path: back -> Options, cursor on High Scores");
  A.closePause();

  // Pause-menu path (mid-game): Continue/Options/Quit root -> Options -> High Scores. This reachability
  // is the entire point of §8b — the root-only entry never allowed this.
  A.startGame(); A.openPause();
  assert(A.rootItems().includes("Options") && !A.rootItems().includes("High Scores"),
    "D: pause-menu root has Options, no direct High Scores row");
  A.game.menu.index = A.rootItems().indexOf("Options"); A.menuInput("confirm");
  A.game.menu.index = A.MENU_OPTIONS.indexOf("High Scores"); A.menuInput("confirm");
  assert(A.game.menu.screen === "highscores", "D: pause-menu path: Options -> High Scores opens the screen");
  A.menuInput("back");
  assert(A.game.menu.screen === "options" && A.MENU_OPTIONS[A.game.menu.index] === "High Scores",
    "D: pause-menu path: back -> Options, cursor on High Scores");
  A.closePause();
})();

// ================= (E) Options -> Controls -> Back; P2's rotation row survives =====================
(function () {
  console.log("(E) Options -> Controls -> Back; Ship Rotation row (P2) not clobbered");
  const A = buildInstance();
  A.startGame(); A.openPause();
  A.game.menu.index = A.rootItems().indexOf("Options"); A.menuInput("confirm");
  A.game.menu.index = A.MENU_OPTIONS.indexOf("Controls"); A.menuInput("confirm");
  assert(A.game.menu.screen === "controls", "E: Options -> Controls");
  const turnRow = A.REBINDABLE.length; // menuControls derives this the same way
  A.game.menu.row = turnRow;
  const before = A.settings.shipTurnScale;
  A.menuInput("right");
  assert(A.settings.shipTurnScale > before, "E: Ship Rotation row still adjustable on Controls (P2 row intact)");
  const backRow = A.REBINDABLE.length + 2;
  A.game.menu.row = backRow;
  A.menuInput("confirm");
  assert(A.game.menu.screen === "options" && A.MENU_OPTIONS[A.game.menu.index] === "Controls",
    "E: Controls back -> Options, cursor on Controls");
  A.closePause();
})();

// ================= (F) Options -> Achievements -> Back, single parent (CS012 P4) =====================
(function () {
  console.log("(F) Options -> Achievements -> Back, reached via Options from BOTH title and pause");
  const A = buildInstance();

  // Title/gameover context: O opens Options directly -> Achievements -> Back -> Options.
  A.startGame(); A.game.state = "title"; A.game.paused = false;
  A.openPause();
  assert(A.game.menu.screen === "options", "F: title path: O opens Options directly");
  A.game.menu.index = A.MENU_OPTIONS.indexOf("Achievements"); A.menuInput("confirm");
  assert(A.game.menu.screen === "achievements", "F: title path: Options -> Achievements");
  A.menuInput("back");
  assert(A.game.menu.screen === "options" && A.MENU_OPTIONS[A.game.menu.index] === "Achievements",
    "F: title path: back from Achievements -> Options, cursor on Achievements");
  A.closePause();

  // Pause context (mid-game): root -> Options -> Achievements -> Back -> Options.
  A.startGame(); A.openPause();
  A.game.menu.index = A.rootItems().indexOf("Options"); A.menuInput("confirm");
  A.game.menu.index = A.MENU_OPTIONS.indexOf("Achievements"); A.menuInput("confirm");
  assert(A.game.menu.screen === "achievements", "F: pause path: Options -> Achievements");
  A.menuInput("back");
  assert(A.game.menu.screen === "options" && A.MENU_OPTIONS[A.game.menu.index] === "Achievements",
    "F: pause path: back from Achievements -> Options, cursor on Achievements");
  A.closePause();
})();

// ================= (G) Options -> Difficulty -> Back =====================
(function () {
  console.log("(G) Options -> Difficulty -> Back");
  const A = buildInstance();
  A.startGame(); A.openPause();
  A.game.menu.index = A.rootItems().indexOf("Options"); A.menuInput("confirm");
  A.game.menu.index = A.MENU_OPTIONS.indexOf("Difficulty"); A.menuInput("confirm");
  assert(A.game.menu.screen === "difficulty", "G: Options -> Difficulty");
  A.menuInput("back");
  assert(A.game.menu.screen === "options" && A.MENU_OPTIONS[A.game.menu.index] === "Difficulty",
    "G: Difficulty back -> Options, cursor on Difficulty");
  A.closePause();
})();

// ================= (H) Sound/Music screen: sliders + track cycler + persistence =====================
(function () {
  console.log("(H) Sound/Music sliders + Music Track cycler work, label-dispatched, persisted");
  const lsStore = {};
  const A = buildInstance(lsStore);
  A.AudioSys.init();
  A.startGame(); A.openPause();
  A.game.menu.screen = "sound";

  for (const [label, cat] of [["SFX Volume", "sfx"], ["Music Volume", "music"], ["Master Volume", "master"]]) {
    A.AudioSys.setVol(cat, 0.5);
    A.game.menu.index = A.SOUND_ROWS.indexOf(label);
    A.menuInput("right");
    assert(near(A.AudioSys.vol[cat], 0.6), `H: '${label}' right raises ${cat} by VOL_STEP`);
  }

  A.settings.musicTrack = "zen";
  A.game.menu.index = A.SOUND_ROWS.indexOf("Music Track");
  A.menuInput("right");
  assert(A.settings.musicTrack === "derelict", "H: Music Track right cycles zen -> derelict");

  // Persistence still round-trips through afd_settings_v1 (unchanged by the relocation).
  const raw = JSON.parse(lsStore["afd_settings_v1"]);
  assert(near(raw.vol.sfx, 0.6) && raw.musicTrack === "derelict", "H: Sound/Music values persist into afd_settings_v1");

  A.game.menu.index = A.SOUND_ROWS.indexOf("Back");
  A.menuInput("confirm");
  assert(A.game.menu.screen === "options" && A.MENU_OPTIONS[A.game.menu.index] === "Sound / Music",
    "H: Sound/Music Back -> Options, cursor on Sound / Music");
  A.closePause();
})();

console.log(`\ntest-cs010-p4: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
