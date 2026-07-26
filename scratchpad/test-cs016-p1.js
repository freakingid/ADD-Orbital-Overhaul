// Headless test for CS016 Phase 1 — the menuActive() seam split, a pure no-op refactor prepping for
// P2's navigable title menu. menuActive() now reads `game.paused || game.menu.screen === "titlemenu"`
// instead of a bare `game.paused`; the setDuck call site in updateMusic() flipped to read game.paused
// directly (ducking is a "sim is frozen" concept); musicStateFor()'s highscore check flipped to read
// menuActive() (High Scores moves onto the title menu in P2, where game.paused will be false).
//
//   node scratchpad/test-cs016-p1.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL menuActive()/musicStateFor()/updateMusic()/startGame()/update()
// — never reimplement game logic. No screen is named "titlemenu" yet, so menuActive() === game.paused
// for every CURRENTLY REACHABLE state; that byte-identity is exactly what section (B) proves.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs016p1_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try {
    execSync(`node --check "${tmp}"`, { stdio: "pipe" });
    passed++;
  } catch (e) {
    failed++;
    console.error("  FAIL: node --check: " + e.stderr.toString());
  } finally {
    fs.unlinkSync(tmp);
  }
})();

function makeCtx(canvasStub) {
  return new Proxy({}, {
    get(t, prop) {
      if (prop === "measureText") return () => ({ width: 0 });
      if (prop === "canvas") return canvasStub;
      if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => ({ addColorStop: () => {} });
      return () => {};
    },
    set() { return true; }
  });
}

const RETURN = [
  "startGame", "update", "loop", "game", "settings",
  "menuActive", "musicStateFor", "updateMusic",
  "MusicSys", "AudioSys"
];

function build() {
  const canvasStub = { width: 1280, height: 720, style: {} };
  canvasStub.getContext = () => makeCtx(canvasStub);
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const listeners = {};
  const windowStub = {
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    innerWidth: 1280, innerHeight: 720,
    AudioContext: undefined, webkitAudioContext: undefined
  };
  const performanceStub = { now: () => 100000 };
  const rafStub = () => 0;
  const navigatorStub = { getGamepads: () => [] };
  const lsStore = {};
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, localStorageStub);
}

// ================= (B) EQUIVALENCE: menuActive() === game.paused for every reachable combination ====
(function sectionB() {
  console.log("(B) menuActive() === game.paused across every currently-reachable state x paused x screen");
  const A = build();
  const g = A.game;

  const STATES = ["title", "playing", "dying", "gameover"];
  const PAUSED = [true, false];
  const SCREENS = [null, "root", "options", "sound", "controls", "difficulty", "achievements", "highscores", "debug"];

  let combos = 0;
  for (const st of STATES) {
    for (const p of PAUSED) {
      for (const sc of SCREENS) {
        g.state = st; g.paused = p; g.menu.screen = sc;
        combos++;
        assert(A.menuActive() === g.paused,
          `B: menuActive()===game.paused failed at state=${st} paused=${p} screen=${sc}`);
      }
    }
  }
  assert(combos === STATES.length * PAUSED.length * SCREENS.length, "B: sanity — exercised the full cross product");
  console.log(`  (checked ${combos} combinations)`);
})();

// ================= (C) forward-looking: screen="titlemenu", paused=false ============================
(function sectionC() {
  console.log("(C) game.menu.screen='titlemenu' with paused=false: menuActive() true, no duck, state stays 'title'");
  const A = build();
  const g = A.game;

  g.state = "title"; g.paused = false; g.menu.screen = "titlemenu";
  assert(A.menuActive() === true, "C: menuActive() is true for the forward-looking titlemenu screen even though paused is false");

  A.MusicSys.ducked = false; // known starting point (ctx-less setDuck still tracks .ducked)
  A.updateMusic();
  assert(A.MusicSys.ducked === false, "C: updateMusic() does NOT duck when paused is false, even though menuActive() is true");

  assert(A.musicStateFor("title") === "title", "C: musicStateFor('title') is unaffected by menu.screen='titlemenu' (only 'highscores' is special-cased)");
})();

// ================= (D) the P2 shape: screen="highscores", paused=false =================================
// FLAG-CS016-l (see STATUS.md / PLANNED-FEATURES-CS016.md §1.1 addendum): the phase prompt's own
// description of this case says musicStateFor() should still return "highscore" here, reasoning that
// edit (3)'s menuActive() read covers it. It does NOT, as written. menuActive() is
// `game.paused || game.menu.screen === "titlemenu"` — literally "titlemenu" only. Once P2's
// gotoScreen("highscores") is reached FROM the title menu, game.menu.screen becomes "highscores" (not
// "titlemenu") while game.paused stays false, so menuActive() reads false again at that exact moment.
// This is a real gap in the P2 plan (not just the music state: handleMenuKey/handleGamepadMenu also
// gate on menuActive(), so Up/Down/Back would stop responding on that screen too, and Confirm would
// fall through to the title's startGame() shortcut). Flagged for P2 rather than silently patched here
// (P1 is scoped to the exact three edits, and the fix belongs with whichever phase actually introduces
// the reachable state). This test pins TODAY's real, literal behavior — update it once P2 lands.
(function sectionD() {
  console.log("(D) game.menu.screen='highscores' with paused=false (the P2 shape): documents today's literal behavior");
  const A = build();
  const g = A.game;

  g.state = "title"; g.paused = false; g.menu.screen = "highscores";
  assert(A.menuActive() === false,
    "D: menuActive() is false here — only 'titlemenu' is special-cased, not 'highscores' (FLAG-CS016-l)");
  assert(A.musicStateFor(g.state) !== "highscore",
    "D: consequently musicStateFor() does NOT return 'highscore' for an unpaused highscores screen today (FLAG-CS016-l)");
})();

// ================= (E) existing pause-menu highscores path is unchanged ==============================
(function sectionE() {
  console.log("(E) game.paused=true, screen='highscores' (today's real path): still 'highscore', still no duck");
  const A = build();
  const g = A.game;

  g.state = "playing"; g.paused = true; g.menu.screen = "highscores";
  assert(A.musicStateFor(g.state) === "highscore", "E: the existing paused High Scores path still returns 'highscore'");

  A.MusicSys.ducked = false;
  A.updateMusic();
  assert(A.MusicSys.ducked === false, "E: the High Scores exemption in setDuck's screen check still holds while paused");

  // Sanity: any OTHER paused screen still ducks (the exemption is 'highscores'-specific).
  g.menu.screen = "options";
  A.MusicSys.ducked = false;
  A.updateMusic();
  assert(A.MusicSys.ducked === true, "E: sanity — a paused non-highscores screen (options) still ducks");
})();

// ================= (F) AudioSys.ctx null -> startGame()/update() no-crash smoke ======================
(function sectionF() {
  console.log("(F) AudioSys.ctx null: startGame()/update(1/60) no-crash smoke");
  const A = build();
  assert(A.AudioSys.ctx === null, "F: sanity — no AudioContext stub means AudioSys.ctx is null");
  let threw = null;
  try {
    A.startGame();
    for (let i = 0; i < 10; i++) A.update(1 / 60);
    A.updateMusic();
  } catch (e) { threw = e; }
  assert(!threw, "F: startGame()/update()/updateMusic() ran headless without throwing" + (threw ? ": " + threw : ""));
})();

console.log(`\ntest-cs016-p1: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
