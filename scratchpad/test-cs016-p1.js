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
// CS016 P2 UPDATE. P1 shipped `game.paused || game.menu.screen === "titlemenu"`; P2 resolved
// FLAG-CS016-l by widening the second operand to `!== null` (the "titlemenu"-only form left
// Achievements/High Scores reached from the title menu with menuActive() false — dead input). Section B
// still proves the SAME property it was written to prove — that menuActive() is byte-identical to the
// old bare `game.paused` on every PRE-P2-REACHABLE state — but the cross product it sweeps has to be
// the reachable one, not the raw Cartesian product. The two pre-P2 reachable shapes were, by
// construction of openPause/openDebug (set BOTH) and closePause/quitToTitle (clear BOTH):
//     paused === true  with ANY non-null screen   -> menuActive() true
//     paused === false with screen === null       -> menuActive() false
// The combinations dropped from the sweep (paused false + a non-null screen) were never reachable
// before P2 and are now the title menu's own shape, which section C/D cover directly. Nothing here was
// weakened to accommodate the fix: the discarded rows asserted a property of impossible states.
(function sectionB() {
  console.log("(B) menuActive() === game.paused across every PRE-P2-REACHABLE state x paused x screen");
  const A = build();
  const g = A.game;

  const STATES = ["title", "playing", "dying", "gameover"];
  const SCREENS = ["root", "options", "sound", "controls", "difficulty", "achievements", "highscores", "debug"];

  let combos = 0;
  for (const st of STATES) {
    // paused === true, any open screen (openPause/openDebug always set both together)
    for (const sc of SCREENS) {
      g.state = st; g.paused = true; g.menu.screen = sc;
      combos++;
      assert(A.menuActive() === g.paused,
        `B: menuActive()===game.paused failed at state=${st} paused=true screen=${sc}`);
    }
    // paused === false, no screen (closePause/quitToTitle always cleared both together pre-P2)
    g.state = st; g.paused = false; g.menu.screen = null;
    combos++;
    assert(A.menuActive() === g.paused,
      `B: menuActive()===game.paused failed at state=${st} paused=false screen=null`);
  }
  assert(combos === STATES.length * (SCREENS.length + 1), "B: sanity — exercised every reachable pair");

  // And the invariant the widened form actually asserts, over the FULL Cartesian product including the
  // states P2 makes reachable: menuActive() is exactly "paused OR some screen owns input".
  let full = 0;
  for (const st of STATES) {
    for (const p of [true, false]) {
      for (const sc of [null, "titlemenu", ...SCREENS]) {
        g.state = st; g.paused = p; g.menu.screen = sc;
        full++;
        assert(A.menuActive() === (p || sc !== null),
          `B: menuActive() === (paused || screen!==null) failed at state=${st} paused=${p} screen=${sc}`);
      }
    }
  }
  console.log(`  (checked ${combos} reachable pairs + ${full} full-product combinations)`);
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
// FLAG-CS016-l, RESOLVED IN P2 — this section now pins the FIX, not the gap it used to pin. P1 shipped
// menuActive() as `game.paused || game.menu.screen === "titlemenu"`, which special-cased the title's
// ROOT screen only. P2 reaches High Scores via gotoScreen("highscores") FROM the title menu, which sets
// game.menu.screen to "highscores" (not "titlemenu") while game.paused stays false — so the old form
// read false again at exactly that moment. That broke the highscore fanfare AND, worse, all menu input
// on that screen (handleMenuKey/handleGamepadMenu both gate on menuActive(), so Up/Down/Back went dead
// and Confirm fell through to the title's startGame() shortcut — Enter on the High Scores table would
// have silently started a run). P2 widened the second operand to `game.menu.screen !== null`, the
// candidate fix the flag recorded. This section asserts the behaviour the P1 prompt originally
// described and could not then deliver.
(function sectionD() {
  console.log("(D) game.menu.screen='highscores' with paused=false (the real P2 shape): FLAG-CS016-l fixed");
  const A = build();
  const g = A.game;

  g.state = "title"; g.paused = false; g.menu.screen = "highscores";
  assert(A.menuActive() === true,
    "D: menuActive() is TRUE for an unpaused highscores screen — `screen !== null` covers every title descendant (FLAG-CS016-l fix)");
  assert(A.musicStateFor(g.state) === "highscore",
    "D: musicStateFor() returns 'highscore' for an unpaused highscores screen — the fanfare survives the move to the title menu");

  // The other title descendant with the same shape, and the reason the fix is `!== null` rather than an
  // ever-growing OR chain: Achievements must own input too.
  g.menu.screen = "achievements";
  assert(A.menuActive() === true, "D: menuActive() is TRUE for an unpaused achievements screen too");
  assert(A.musicStateFor(g.state) === "title",
    "D: ...but only 'highscores' gets the fanfare — Achievements keeps the title track");

  // And ducking still stays OFF for both (no gameplay under the title to make room for).
  for (const sc of ["highscores", "achievements", "titlemenu"]) {
    g.menu.screen = sc;
    A.MusicSys.ducked = false;
    A.updateMusic();
    assert(A.MusicSys.ducked === false, `D: no duck on the unpaused title-descendant screen '${sc}'`);
  }
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
