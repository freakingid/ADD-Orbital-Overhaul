// Headless test for CS013 Phase 1 (Group A, §1) — the gameover -> Title navigation fix
// (FORK-CS013-A -> a): gameover now opens its own context-aware root
// ["Play Again","Options","Quit to Title"] instead of jumping straight to Options, restoring a
// path back to the title screen. Playing and title behavior are unchanged.
//
//   node scratchpad/test-cs013-p1.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL handlers (openPause/menuInput/closePause/rootItems/quitToTitle,
// plus the real keydown listener for the entry-guard check) — never reimplement menu logic. The
// load-bearing risk is the BACK PATH (CS012 P4's own lesson): "Back from Options" must return to the
// root from BOTH playing and gameover, while still closing straight to title (which has no root).
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) rootItems() shape per game.state — Continue/Options/Quit for playing AND title (title never
//      opens a root in practice, but the pure function still returns the play layout for it),
//      Play Again/Options/Quit to Title for gameover.
//  (C) gameover: openPause() lands on "root" (NOT "options" — the pre-CS013 behavior).
//  (D) gameover root, Quit to Title: confirms on "Quit to Title" -> game.state "title", overlay closed.
//  (E) gameover root, Play Again: confirms on "Play Again" -> a genuinely fresh run (state "playing",
//      score/wave/entry all reset), overlay closed.
//  (F) gameover: Options -> Back -> root -> Back -> close (the full round-trip loop from the prompt).
//  (G) playing-path regression (unchanged): root is still Continue/Options/Quit; Options -> Back ->
//      root -> Back -> resume (still paused after the first Back, exactly as CS012 P4 left it).
//  (H) title-path regression (unchanged): openPause() from title still lands directly on "options"
//      (no root involved), Back closes straight to title.
//  (I) entry-guard: with game.entry live at gameover, the "o" keydown opener is a no-op (the existing
//      !game.entry guard already covers the new root path — no code change needed, asserted here).
//  (J) headless no-crash: AudioSys.ctx null -> startGame()/update(1/60) plus a full gameover
//      open/Options/Play-Again and open/Quit-to-Title cycle never throw.

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

// Full audio-node/ctx shape (mirrors test-cs012-p4.js) so an accidental AudioSys.init() would survive
// the voice graph too — though these sections deliberately leave AudioSys.ctx null (menu/UI + VoiceSys
// all early-return on a null ctx, which is exactly what section (J) exercises).
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
  "quitToTitle", "MENU_ROOT_PLAY", "MENU_ROOT_OVER", "MENU_OPTIONS", "AudioSys", "bindings"
];

// Returns the eval'd instance PLUS a `keydown(key, repeat)` test helper wired to the real
// window.addEventListener("keydown", ...) listener — needed for section (I), which exercises the
// actual "o"-opener guard (`!game.entry`), not just the openPause()/menuInput() call surface the other
// sections drive directly.
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
  const instance = factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, localStorageStub);
  instance.keydown = (key, repeat) => {
    const e = { key, repeat: !!repeat, preventDefault() {} };
    for (const fn of (listeners.keydown || [])) fn(e);
  };
  return instance;
}

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const eqJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(require("os").tmpdir(), "cs013-p1-extracted.js");
  fs.writeFileSync(tmp, currentSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: syntax: " + e.stderr.toString()); }
})();

// ================= (B) rootItems() shape per state =====================
(function () {
  console.log("(B) rootItems() is context-aware: Continue/Options/Quit except at gameover");
  const A = buildInstance();
  A.startGame();
  for (const st of ["playing", "title"]) {
    A.game.state = st;
    assert(eqJSON(A.rootItems(), ["Continue", "Options", "Quit"]), `B: rootItems() === MENU_ROOT_PLAY in state "${st}"`);
  }
  A.game.state = "gameover";
  assert(eqJSON(A.rootItems(), ["Play Again", "Options", "Quit to Title"]), "B: rootItems() === MENU_ROOT_OVER in state \"gameover\"");
  assert(eqJSON(A.MENU_ROOT_PLAY, ["Continue", "Options", "Quit"]), "B: MENU_ROOT_PLAY unchanged from CS012 P4");
  assert(eqJSON(A.MENU_ROOT_OVER, ["Play Again", "Options", "Quit to Title"]), "B: MENU_ROOT_OVER is the new CS013 P1 layout");
})();

// ================= (C) gameover: openPause() lands on "root" =====================
(function () {
  console.log("(C) gameover -> openPause() lands on \"root\" (was \"options\" pre-CS013)");
  const A = buildInstance();
  A.startGame(); A.game.state = "gameover"; A.game.paused = false;
  A.openPause();
  assert(A.game.paused === true, "C: openPause pauses (overlay open) on gameover");
  assert(A.game.menu.screen === "root", "C: openPause from gameover lands on \"root\"");
  assert(eqJSON(A.rootItems(), ["Play Again", "Options", "Quit to Title"]), "C: the opened root shows the gameover layout");
})();

// ================= (D) gameover root, Quit to Title =====================
(function () {
  console.log("(D) gameover root -> Quit to Title -> state \"title\", overlay closed");
  const A = buildInstance();
  A.startGame(); A.game.state = "gameover"; A.game.paused = false;
  A.openPause();
  A.game.menu.index = A.rootItems().indexOf("Quit to Title");
  A.menuInput("confirm");
  assert(A.game.state === "title", "D: Quit to Title moves game.state to \"title\"");
  assert(A.game.paused === false && A.game.menu.screen === null, "D: the overlay is closed after Quit to Title");
})();

// ================= (E) gameover root, Play Again =====================
(function () {
  console.log("(E) gameover root -> Play Again -> a genuinely fresh run");
  const A = buildInstance();
  A.startGame();
  A.game.score = 99999; A.game.wave = 7; A.game.state = "gameover"; A.game.paused = false;
  A.openPause();
  A.game.menu.index = A.rootItems().indexOf("Play Again");
  A.menuInput("confirm");
  assert(A.game.state === "playing", "E: Play Again moves game.state to \"playing\"");
  assert(A.game.paused === false && A.game.menu.screen === null, "E: the overlay is closed after Play Again");
  assert(A.game.score === 0, "E: Play Again is a real startGame() — score reset to 0, not just closed");
  assert(A.game.entry === null, "E: no stale initials-entry state carries into the fresh run");
})();

// ================= (F) gameover: Options -> Back -> root -> Back -> close =====================
(function () {
  console.log("(F) gameover: Options -> Back -> root -> Back -> close (the full round-trip loop)");
  const A = buildInstance();
  A.startGame(); A.game.state = "gameover"; A.game.paused = false;
  A.openPause();
  assert(A.game.menu.screen === "root", "F: opens on root");
  A.game.menu.index = A.rootItems().indexOf("Options");
  A.menuInput("confirm");
  assert(A.game.menu.screen === "options", "F: selecting Options -> \"options\"");
  A.menuInput("back");
  assert(A.game.menu.screen === "root", "F: Back from Options returns to \"root\" (not close) — the CS012 P4 back-path lesson, now extended to gameover");
  assert(A.game.paused === true, "F: still paused after backing to root (overlay NOT closed)");
  assert(A.rootItems()[A.game.menu.index] === "Options", "F: cursor left on the Options row");
  A.menuInput("back");
  assert(A.game.paused === false && A.game.menu.screen === null, "F: Back from root closes the overlay");
  assert(A.game.state === "gameover", "F: closing returns to the underlying gameover screen");
})();

// ================= (G) playing-path regression (unchanged) =====================
(function () {
  console.log("(G) playing -> root (Continue/Options/Quit); Options -> Back -> root -> Back -> resume — unchanged");
  const A = buildInstance();
  A.startGame(); // state "playing"
  A.openPause();
  assert(A.game.paused === true && A.game.menu.screen === "root", "G: openPause while playing lands on \"root\"");
  assert(eqJSON(A.rootItems(), ["Continue", "Options", "Quit"]), "G: root still shows Continue/Options/Quit while playing");
  A.game.menu.index = A.rootItems().indexOf("Options");
  A.menuInput("confirm");
  assert(A.game.menu.screen === "options", "G: selecting Options -> \"options\"");
  A.menuInput("back");
  assert(A.game.menu.screen === "root", "G: Back from Options returns to \"root\"");
  assert(A.game.paused === true, "G: still paused after backing to root");
  A.menuInput("back");
  assert(A.game.paused === false && A.game.menu.screen === null, "G: Back from root resumes the game");
})();

// ================= (H) title-path regression (unchanged) =====================
(function () {
  console.log("(H) title -> openPause() still lands directly on \"options\" (no root); Back closes to title");
  const A = buildInstance();
  A.startGame(); A.game.state = "title"; A.game.paused = false;
  A.openPause();
  assert(A.game.menu.screen === "options", "H: openPause from title still lands on \"options\" directly (title has no root)");
  A.menuInput("back");
  assert(A.game.paused === false && A.game.menu.screen === null, "H: Back from Options closes the overlay");
  assert(A.game.state === "title", "H: closing returns to the underlying title screen");
})();

// ================= (I) entry-guard: the "o" opener is a no-op during initials entry =====================
(function () {
  console.log("(I) FLAG-CS013-1a: game.entry live at gameover -> \"o\" keydown does NOT open the new root");
  const A = buildInstance();
  A.startGame(); A.game.state = "gameover"; A.game.paused = false;
  A.game.entry = { initials: [0, 0, 0], idx: 0 }; // simulate a qualifying run mid-initials-entry
  A.keydown("o");
  assert(A.game.paused === false, "I: the \"o\" opener is a no-op while game.entry is live (!game.entry guard, unchanged by CS013 P1)");
  assert(A.game.menu.screen === null, "I: no menu screen opened during entry");
  A.game.entry = null; // clear entry the normal way (commit), THEN the same key should open the root
  A.keydown("o");
  assert(A.game.paused === true && A.game.menu.screen === "root", "I: once entry clears, \"o\" opens the gameover root normally");
})();

// ================= (J) headless no-crash with AudioSys.ctx null =====================
(function () {
  console.log("(J) headless: startGame/update + gameover open/Options/Play-Again and open/Quit-to-Title cycles never throw (ctx null)");
  const A = buildInstance();
  let ok = true;
  try {
    assert(A.AudioSys.ctx === null || A.AudioSys.ctx === undefined, "J: AudioSys.ctx is null (no init())");
    A.startGame();
    for (let i = 0; i < 30; i++) A.update(1 / 60);

    A.game.state = "gameover"; A.game.paused = false;
    A.openPause();
    A.game.menu.index = A.rootItems().indexOf("Options"); A.menuInput("confirm");
    A.menuInput("back"); A.menuInput("back");
    A.update(1 / 60);

    A.game.state = "gameover"; A.game.paused = false;
    A.openPause();
    A.game.menu.index = A.rootItems().indexOf("Quit to Title"); A.menuInput("confirm");
    A.update(1 / 60);
  } catch (e) { ok = false; console.error("  FAIL: threw: " + e.stack); }
  assert(ok, "J: no throw across startGame/update + the two gameover-root cycles with ctx null");
  assert(A.game.paused === false && A.game.menu.screen === null, "J: the cycles ended with the overlay closed");
})();

console.log(`\ntest-cs013-p1: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
