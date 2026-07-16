// Headless test for CS012 Phase 4 — menu IA refactor (FORK-CS012-C → a): the system-menu root is
// retired, Options becomes the sole hub, and the achReturn tracker is gone.
//
//   node scratchpad/test-cs012-p4.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL open/nav handlers (openPause/menuInput/closePause/rootItems) —
// never reimplement menu logic. The load-bearing risk is the BACK PATH: "Back from Options" must lead
// to the root while paused mid-game but CLOSE the overlay from title/gameover (where Options is the
// top-level dialog). Both entry contexts are tested. Sections:
//  (A) node --check on the extracted <script>; the retired identifiers are gone from source
//      (no `const MENU_ROOT_SYS`, no `.achReturn` read/write, no `achReturn:` field).
//  (B) rootItems() returns only [Continue, Options, Quit] — never an Achievements/Back system row —
//      for "playing" and "title" (gameover's own root layout is CS013 P1's addition, tested in
//      test-cs013-p1.js, not here — this file only pins the pre-CS013 CONTINUE/OPTIONS/QUIT shape).
//  (C) title: openPause() lands on "options" directly (not "root"); Back closes the overlay to title.
//  (D) gameover: openPause() now lands on "root" (CS013 P1, FORK-CS013-A -> a — superseded this
//      file's original "-> options directly" pin); Back from the freshly-opened root closes the
//      overlay. The full gameover-root contract (Play Again/Quit to Title/Options round-trip) lives
//      in test-cs013-p1.js — this section only confirms CS012 P4's own back-path plumbing isn't
//      broken by CS013 P1's routing change.
//  (E) playing: openPause() -> "root" (Continue/Options/Quit); Options -> "options"; Back -> "root"
//      (NOT closePause — still paused).
//  (F) Achievements is reached ONLY via Options (from BOTH title and pause) and its Back always returns
//      to Options with the cursor on "Achievements".
//  (G) headless no-crash: with AudioSys.ctx null, startGame()/update(1/60) and a full title-context
//      open/nav/close cycle never throw.

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

// Full audio-node/ctx shape (mirrors test-cs010-p4) so an accidental AudioSys.init() would survive the
// voice graph too — though these sections deliberately leave AudioSys.ctx null (menu/UI + VoiceSys all
// early-return on a null ctx, which is exactly the headless path (G) exercises).
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
  "startGame", "update", "game", "menuInput", "openPause", "closePause", "rootItems", "gotoScreen",
  "MENU_ROOT_PLAY", "MENU_OPTIONS", "AudioSys"
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
const eqJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ================= (A) syntax + retired identifiers gone from source =====================
(function () {
  console.log("(A) node --check + MENU_ROOT_SYS/achReturn retired from source");
  const tmp = path.join(require("os").tmpdir(), "cs012-p4-extracted.js");
  fs.writeFileSync(tmp, currentSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: syntax: " + e.stderr.toString()); }

  // The system-menu root array is gone (a retire-note comment may still name it, so check the const).
  assert(!/const\s+MENU_ROOT_SYS/.test(currentSrc), "A: MENU_ROOT_SYS is no longer declared");
  // achReturn is never set nor read (property access) and no longer a game.menu field.
  assert(!/\.achReturn/.test(currentSrc), "A: no code reads/writes .achReturn (tracker retired)");
  assert(!/achReturn\s*:/.test(currentSrc), "A: game.menu literal no longer carries an achReturn field");
})();

// ================= (B) rootItems() is Continue/Options/Quit for playing/title =====================
(function () {
  console.log("(B) rootItems() never returns an Achievements/Back system row (playing/title)");
  const A = buildInstance();
  A.startGame();
  // CS013 P1 gave "gameover" its own root layout (MENU_ROOT_OVER) — deliberately NOT checked here,
  // see test-cs013-p1.js. This section still pins the CS012 P4 shape for the two states it governs.
  for (const st of ["playing", "title"]) {
    A.game.state = st;
    assert(eqJSON(A.rootItems(), ["Continue", "Options", "Quit"]), `B: rootItems() === [Continue,Options,Quit] in state "${st}"`);
    assert(!A.rootItems().includes("Achievements") && !A.rootItems().includes("Back"),
      `B: rootItems() has no Achievements/Back row in state "${st}"`);
  }
  assert(eqJSON(A.MENU_ROOT_PLAY, ["Continue", "Options", "Quit"]), "B: MENU_ROOT_PLAY is the playing-state root layout");
})();

// ================= (C) title: O -> Options directly; Back closes the overlay =====================
(function () {
  console.log("(C) title -> openPause() lands on Options (not root); Back closes to title");
  const A = buildInstance();
  A.startGame(); A.game.state = "title"; A.game.paused = false;
  A.openPause();
  assert(A.game.paused === true, "C: openPause pauses (overlay open) on title");
  assert(A.game.menu.screen === "options", "C: openPause from title lands on \"options\" (NOT \"root\")");
  A.menuInput("back");
  assert(A.game.paused === false && A.game.menu.screen === null, "C: Back from Options closes the overlay (paused false, screen null)");
  assert(A.game.state === "title", "C: closing returns to the underlying title screen");
})();

// ================= (D) gameover: openPause() -> root (CS013 P1); Back from it closes =====================
(function () {
  console.log("(D) gameover -> openPause() lands on \"root\" (CS013 P1 superseded the old -> Options-direct); Back closes to gameover");
  const A = buildInstance();
  A.startGame(); A.game.state = "gameover"; A.game.paused = false;
  A.openPause();
  // CS013 P1 (FORK-CS013-A -> a): gameover now opens its own context-aware root, not Options directly.
  // Full coverage of that root (Play Again/Quit to Title/Options round-trip) is test-cs013-p1.js's job;
  // this section only re-confirms CS012 P4's back-path plumbing survives the routing change.
  assert(A.game.menu.screen === "root", "D: openPause from gameover lands on \"root\" (CS013 P1)");
  A.menuInput("back");
  assert(A.game.paused === false && A.game.menu.screen === null, "D: Back from the freshly-opened root closes the overlay");
  assert(A.game.state === "gameover", "D: closing returns to the underlying gameover screen");
})();

// ================= (E) playing: root (Continue/Options/Quit); Options; Back -> root =====================
(function () {
  console.log("(E) playing -> root; Options -> options; Back from Options -> root (NOT closePause)");
  const A = buildInstance();
  A.startGame(); // state "playing"
  A.openPause();
  assert(A.game.paused === true && A.game.menu.screen === "root", "E: openPause while playing lands on \"root\"");
  assert(eqJSON(A.rootItems(), ["Continue", "Options", "Quit"]), "E: root shows Continue/Options/Quit");
  A.game.menu.index = A.rootItems().indexOf("Options");
  A.menuInput("confirm");
  assert(A.game.menu.screen === "options", "E: selecting Options -> \"options\"");
  A.menuInput("back");
  assert(A.game.menu.screen === "root", "E: Back from Options returns to \"root\" (not close)");
  assert(A.game.paused === true, "E: still paused after backing to root (overlay NOT closed)");
  assert(A.rootItems()[A.game.menu.index] === "Options", "E: cursor left on the Options row");
  // one more: Back from root closes (Continue/Quit path unaffected)
  A.menuInput("back");
  assert(A.game.paused === false && A.game.menu.screen === null, "E: Back from root resumes the game");
})();

// ================= (F) Achievements: single parent (Options), from title AND pause =====================
(function () {
  console.log("(F) Achievements reached ONLY via Options; Back always -> Options (both contexts)");
  const A = buildInstance();

  // Title context: O -> Options -> Achievements -> Back -> Options.
  A.startGame(); A.game.state = "title"; A.game.paused = false;
  A.openPause();
  assert(A.game.menu.screen === "options", "F: title path: O opens Options directly");
  A.game.menu.index = A.MENU_OPTIONS.indexOf("Achievements");
  A.menuInput("confirm");
  assert(A.game.menu.screen === "achievements", "F: title path: Options -> Achievements");
  A.menuInput("back");
  assert(A.game.menu.screen === "options" && A.MENU_OPTIONS[A.game.menu.index] === "Achievements",
    "F: title path: Back -> Options, cursor on Achievements");
  A.closePause();

  // Pause context (mid-game): root -> Options -> Achievements -> Back -> Options.
  A.startGame(); // state "playing"
  A.openPause();
  A.game.menu.index = A.rootItems().indexOf("Options"); A.menuInput("confirm");
  A.game.menu.index = A.MENU_OPTIONS.indexOf("Achievements"); A.menuInput("confirm");
  assert(A.game.menu.screen === "achievements", "F: pause path: Options -> Achievements");
  A.menuInput("back");
  assert(A.game.menu.screen === "options" && A.MENU_OPTIONS[A.game.menu.index] === "Achievements",
    "F: pause path: Back -> Options, cursor on Achievements");
  A.closePause();
})();

// ================= (G) headless no-crash with AudioSys.ctx null =====================
(function () {
  console.log("(G) headless: startGame/update + a title open/nav/close cycle never throw (ctx null)");
  const A = buildInstance();
  let ok = true;
  try {
    assert(A.AudioSys.ctx === null || A.AudioSys.ctx === undefined, "G: AudioSys.ctx is null (no init())");
    A.startGame();
    for (let i = 0; i < 30; i++) A.update(1 / 60);
    // title-context menu cycle: open Options, dive into Achievements, back out, close — all UI calls
    // route through AudioSys.ui()/etc which early-return on a null ctx.
    A.game.state = "title"; A.game.paused = false;
    A.openPause();
    A.game.menu.index = A.MENU_OPTIONS.indexOf("Achievements"); A.menuInput("confirm");
    A.menuInput("back"); A.menuInput("back");
    A.update(1 / 60);
  } catch (e) { ok = false; console.error("  FAIL: threw: " + e.stack); }
  assert(ok, "G: no throw across startGame/update + title menu cycle with ctx null");
  assert(A.game.paused === false && A.game.menu.screen === null, "G: the cycle ended with the overlay closed");
})();

console.log(`\ntest-cs012-p4: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
