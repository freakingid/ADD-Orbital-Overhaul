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
//  (C) title: openPause() lands on "options" directly (not "root"); Back returns to the title menu
//      (CS016 P2 — the title is a navigable menu now, so "close the overlay" there means "back to
//      screen 'titlemenu' with game.paused cleared", not "screen null").
//  (D) gameover: openPause() now lands on "root" (CS013 P1, FORK-CS013-A -> a — superseded this
//      file's original "-> options directly" pin); Back from the freshly-opened root closes the
//      overlay. The full gameover-root contract (Play Again/Quit to Title/Options round-trip) lives
//      in test-cs013-p1.js — this section only confirms CS012 P4's own back-path plumbing isn't
//      broken by CS013 P1's routing change.
//  (E) playing: openPause() -> "root" (Continue/Options/Quit); Options -> "options"; Back -> "root"
//      (NOT closePause — still paused).
//  (F) Achievements has exactly ONE parent and its Back restores the cursor to its own row — CS016 P2
//      (FORK-CS016-A) repointed that one parent from Options to the TITLE MENU, so the section now
//      drives the title-menu route and asserts Options offers no such row in either context.
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
  "MENU_ROOT_PLAY", "MENU_OPTIONS", "MENU_TITLE", "quitToTitle", "AudioSys"
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
  // CS016 P4 inserted a dim, inert "Save" row into MENU_ROOT_PLAY — pinned here against the live
  // constant rather than a re-hardcoded array, so this section can't drift from it a second time.
  for (const st of ["playing", "title"]) {
    A.game.state = st;
    assert(eqJSON(A.rootItems(), A.MENU_ROOT_PLAY), `B: rootItems() === MENU_ROOT_PLAY in state "${st}"`);
    assert(!A.rootItems().includes("Achievements") && !A.rootItems().includes("Back"),
      `B: rootItems() has no Achievements/Back row in state "${st}"`);
  }
  assert(eqJSON(A.MENU_ROOT_PLAY, ["Continue", "Save", "Options", "Quit"]), "B: MENU_ROOT_PLAY is the playing-state root layout (CS016 P4: Save added)");
})();

// ================= (C) title: O -> Options directly; Back returns to the title menu =====================
// CS016 P2: openPause()'s title routing is UNCHANGED (Options directly, game.paused true, so Options
// keeps its dimmed-panel chrome), which is what this section was written to pin. What changed is where
// Back lands: the title is a navigable menu now, so "close the overlay entirely" became "return to the
// title menu" — game.paused still clears, but game.menu.screen goes to "titlemenu", not null. The
// assertion below tests the same transition, against the new destination.
(function () {
  console.log("(C) title -> openPause() lands on Options (not root); Back returns to the title menu");
  const A = buildInstance();
  A.startGame(); A.quitToTitle();
  A.openPause();
  assert(A.game.paused === true, "C: openPause pauses (overlay open) on title");
  assert(A.game.menu.screen === "options", "C: openPause from title lands on \"options\" (NOT \"root\")");
  A.menuInput("back");
  assert(A.game.paused === false && A.game.menu.screen === "titlemenu",
    "C: Back from Options returns to the title menu (paused cleared, screen \"titlemenu\") — CS016 P2");
  assert(A.MENU_TITLE[A.game.menu.index] === "Options", "C: ...with the cursor on the Options row it came from");
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
  assert(eqJSON(A.rootItems(), A.MENU_ROOT_PLAY), "E: root shows the MENU_ROOT_PLAY layout (CS016 P4: + Save)");
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

// ================= (F) Achievements: single parent (title menu as of CS016 P2) =====================
// CS012 P4's property was "exactly ONE parent, so Back needs no return-context tracker". That property
// is intact; CS016 P2 (FORK-CS016-A) changed WHICH single parent — Options -> the title menu — and the
// pause-context path is now deliberately gone rather than a second route to the same screen.
(function () {
  console.log("(F) Achievements reached ONLY from the title menu; Back always -> title menu; gone from Options");
  const A = buildInstance();

  // Title context: title menu -> Achievements -> Back -> title menu.
  A.startGame(); A.quitToTitle();
  assert(A.game.menu.screen === "titlemenu", "F: title path: the title screen owns a menu");
  A.game.menu.index = A.MENU_TITLE.indexOf("Achievements");
  A.menuInput("confirm");
  assert(A.game.menu.screen === "achievements", "F: title path: title menu -> Achievements");
  A.menuInput("back");
  assert(A.game.menu.screen === "titlemenu" && A.MENU_TITLE[A.game.menu.index] === "Achievements",
    "F: title path: Back -> title menu, cursor on Achievements");

  // Still exactly one parent: Options no longer offers it, from the title or from pause.
  A.openPause();
  assert(A.game.menu.screen === "options" && A.MENU_OPTIONS.indexOf("Achievements") === -1,
    "F: title path: Options has no Achievements row (single parent, repointed)");
  A.closePause();

  A.startGame(); // state "playing"
  A.openPause();
  A.game.menu.index = A.rootItems().indexOf("Options"); A.menuInput("confirm");
  assert(A.game.menu.screen === "options" && A.MENU_OPTIONS.indexOf("Achievements") === -1,
    "F: pause path: Achievements is unreachable mid-run (CS016 P2 accepted cost; unlock toasts remain)");
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
    // title-context menu cycle: from the title menu dive into Achievements, back out, open Options,
    // back out — all UI calls route through AudioSys.ui()/etc which early-return on a null ctx.
    // CS016 P2: Achievements now hangs off the title menu, so the cycle starts there.
    A.quitToTitle();
    A.game.menu.index = A.MENU_TITLE.indexOf("Achievements"); A.menuInput("confirm");
    A.menuInput("back");
    A.openPause();
    A.menuInput("back");
    A.update(1 / 60);
  } catch (e) { ok = false; console.error("  FAIL: threw: " + e.stack); }
  assert(ok, "G: no throw across startGame/update + title menu cycle with ctx null");
  assert(A.game.paused === false && A.game.menu.screen === "titlemenu",
    "G: the cycle ended back on the title menu with nothing paused (CS016 P2 — 'closed' at the title means the title menu)");
})();

console.log(`\ntest-cs012-p4: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
